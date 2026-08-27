import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { loadDials } from "./transporter";
import { continueHours, invoiceMinutes, priceBumpPct } from "@/lib/psychology";
import {
  CRYPTO_ASSETS,
  demoAddress,
  giftCode,
  invoiceId,
  usdToCrypto,
} from "@/lib/crypto";
import type { CryptoAsset, InvoiceKind, InvoiceView, VaultItem } from "@/lib/types";

let payColsReady = false;
async function ensurePayCols(sql: Sql) {
  if (payColsReady) return;
  await sql`alter table invoices add column if not exists pay_method text`;
  await sql`alter table invoices add column if not exists wallet_address text`;
  await sql`alter table invoices add column if not exists tx_hash text`;
  payColsReady = true;
}

type ShotRow = {
  id: string;
  ladder_id: string;
  step_index: number;
  title: string;
  price_cents: number;
  is_climax: boolean;
  media_url: string;
  media_type: "photo" | "video";
  object_position: string;
  grant_copy: string;
};

async function getUnlockedSet(sql: Sql, userId: string, ladderId: string) {
  const rows = await sql<{ shot_id: string }>`
    select shot_id from unlocks where user_id = ${userId} and ladder_id = ${ladderId}
  `;
  return new Set(rows.map((r) => r.shot_id));
}

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function resolvePayableShots(
  sql: Sql,
  userId: string,
  ladderId: string,
  kind: InvoiceKind,
  wantShotId?: string,
  upsellCount?: number,
) {
  const shots = await sql<ShotRow>`
    select * from shots where ladder_id = ${ladderId} order by step_index
  `;
  const unlocked = await getUnlockedSet(sql, userId, ladderId);
  const remaining = shots.filter((s) => !unlocked.has(s.id));
  if (remaining.length === 0) throw new Error("This ladder is already fully granted.");

  if (kind === "shot") {
    const next = remaining[0];
    if (wantShotId && wantShotId !== next.id) {
      throw new Error("She opens in order. Unlock the next shot first.");
    }
    return [next];
  }

  if (kind === "upsell") {
    const n = Math.max(1, Math.min(upsellCount ?? 3, remaining.length));
    return remaining.slice(0, n);
  }

  return remaining;
}

function priceFor(kind: InvoiceKind, shots: ShotRow[], bundleDiscount: number) {
  const sum = shots.reduce((a, s) => a + s.price_cents, 0);
  if (kind === "bundle") return Math.round(sum * (1 - bundleDiscount));
  if (kind === "upsell" && shots.length >= 3) return Math.round(sum * 0.78);
  if (kind === "upsell" && shots.length === 2) return Math.round(sum * 0.88);
  return sum;
}

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      ladderId: string;
      kind: InvoiceKind;
      asset: CryptoAsset;
      shotId?: string;
      upsellCount?: number;
      isGift?: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureProfile(sql, context.userId);
    await ensurePayCols(sql);

    const assetOk = CRYPTO_ASSETS.some((a) => a.id === data.asset);
    if (!assetOk) throw new Error("Unsupported asset.");

    const ladders = await sql<{
      id: string;
      title: string;
      bundle_discount: string | number;
    }>`select id, title, bundle_discount from ladders where id = ${data.ladderId}`;
    const ladder = ladders[0];
    if (!ladder) throw new Error("Ladder not found.");

    const shots = await resolvePayableShots(
      sql,
      context.userId,
      data.ladderId,
      data.kind,
      data.shotId,
      data.upsellCount,
    );
    const discount = typeof ladder.bundle_discount === "number"
      ? ladder.bundle_discount
      : Number(ladder.bundle_discount);
    let amount = priceFor(data.kind, shots, discount);
    const dials = await loadDials(sql);
    const pressure = await sql<{ continue_by: string | Date }>`
      select continue_by from collector_pressure
      where user_id = ${context.userId} and ladder_id = ${data.ladderId}
    `;
    const expired =
      pressure[0] && Date.now() > new Date(pressure[0].continue_by).getTime();
    const bump = expired ? priceBumpPct(dials) : 0;
    if (bump > 0 && data.kind === "shot") {
      amount = Math.round(amount * (1 + bump / 100));
    }
    const id = invoiceId();
    const address = demoAddress(id, data.asset);
    const cryptoAmount = usdToCrypto(amount, data.asset);
    const gift = Boolean(data.isGift);
    const code = gift ? giftCode(id) : null;
    const expiresAt = new Date(Date.now() + invoiceMinutes(dials) * 60_000);

    await sql`
      insert into invoices (
        id, user_id, ladder_id, kind, shot_ids, amount_cents, asset,
        pay_address, crypto_amount, status, is_gift, gift_code, expires_at
      ) values (
        ${id}, ${context.userId}, ${data.ladderId}, ${data.kind},
        ${JSON.stringify(shots.map((s) => s.id))}, ${amount}, ${data.asset},
        ${address}, ${cryptoAmount}, 'pending', ${gift}, ${code}, ${expiresAt.toISOString()}
      )
    `;
    await sql`
      insert into events (user_id, ladder_id, kind, meta)
      values (
        ${context.userId}, ${data.ladderId}, 'checkout',
        ${JSON.stringify({ kind: data.kind, amount, asset: data.asset })}
      )
    `;

    const view: InvoiceView = {
      id,
      ladderId: data.ladderId,
      ladderTitle: ladder.title,
      kind: data.kind,
      shotIds: shots.map((s) => s.id),
      shotTitles: shots.map((s) => s.title),
      amountCents: amount,
      asset: data.asset,
      payAddress: address,
      cryptoAmount,
      status: "pending",
      isGift: gift,
      giftCode: code,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    return view;
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      user_id: string;
      ladder_id: string;
      kind: InvoiceKind;
      shot_ids: string;
      amount_cents: number;
      asset: CryptoAsset;
      pay_address: string;
      crypto_amount: string;
      status: InvoiceView["status"];
      is_gift: boolean;
      gift_code: string | null;
      created_at: string | Date;
      expires_at: string | Date | null;
    }>`
      select * from invoices where id = ${data.id} and user_id = ${context.userId}
    `;
    const inv = rows[0];
    if (!inv) return null;
    if (
      inv.status === "pending" &&
      inv.expires_at &&
      Date.now() > new Date(inv.expires_at).getTime()
    ) {
      await sql`update invoices set status = 'expired' where id = ${inv.id}`;
      inv.status = "expired";
    }
    const lad = await sql<{ title: string }>`
      select title from ladders where id = ${inv.ladder_id}
    `;
    const ids = parseIds(inv.shot_ids);
    const shots = await sql<{ id: string; title: string }>`
      select id, title from shots where ladder_id = ${inv.ladder_id}
    `;
    const titleById = new Map(shots.map((s) => [s.id, s.title]));
    const view: InvoiceView = {
      id: inv.id,
      ladderId: inv.ladder_id,
      ladderTitle: lad[0]?.title ?? "Ladder",
      kind: inv.kind,
      shotIds: ids,
      shotTitles: ids.map((id) => titleById.get(id) ?? id),
      amountCents: inv.amount_cents,
      asset: inv.asset,
      payAddress: inv.pay_address,
      cryptoAmount: inv.crypto_amount,
      status: inv.status,
      isGift: inv.is_gift,
      giftCode: inv.gift_code,
      createdAt: new Date(inv.created_at).toISOString(),
      expiresAt: inv.expires_at ? new Date(inv.expires_at).toISOString() : null,
    };
    return view;
  });

async function settleInvoice(sql: Sql, invoiceId: string, userId: string) {
  const rows = await sql<{
    id: string;
    user_id: string;
    ladder_id: string;
    kind: string;
    shot_ids: string;
    amount_cents: number;
    status: string;
    is_gift: boolean;
    gift_code: string | null;
    expires_at: string | Date | null;
  }>`select * from invoices where id = ${invoiceId} and user_id = ${userId}`;
  const inv = rows[0];
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "paid") return { already: true as const, giftCode: inv.gift_code };
  if (inv.status === "expired") throw new Error("This invitation closed.");
  if (inv.expires_at && Date.now() > new Date(inv.expires_at).getTime()) {
    await sql`update invoices set status = 'expired' where id = ${inv.id}`;
    throw new Error("This invitation closed. Request access again.");
  }

  const ids = parseIds(inv.shot_ids);
  const shots = await sql<ShotRow>`
    select * from shots where ladder_id = ${inv.ladder_id}
  `;
  const byId = new Map(shots.map((s) => [s.id, s]));
  const prior = await sql<{ c: number }>`
    select count(*)::int as c from unlocks
    where user_id = ${userId} and ladder_id = ${inv.ladder_id}
  `;

  if (inv.is_gift && inv.gift_code) {
    await sql`
      insert into gifts (code, from_user_id, ladder_id, shot_ids, invoice_id)
      values (${inv.gift_code}, ${userId}, ${inv.ladder_id}, ${inv.shot_ids}, ${inv.id})
      on conflict (code) do nothing
    `;
  } else {
    for (const shotId of ids) {
      const shot = byId.get(shotId);
      if (!shot) continue;
      await sql`
        insert into unlocks (user_id, shot_id, ladder_id, invoice_id, amount_cents, gifted)
        values (${userId}, ${shot.id}, ${inv.ladder_id}, ${inv.id}, ${shot.price_cents}, false)
        on conflict (user_id, shot_id) do nothing
      `;
    }
    const hasClimax = ids.some((id) => byId.get(id)?.is_climax);
    if ((prior[0]?.c ?? 0) === 0) {
      await sql`
        update ladders
        set collectors_count = collectors_count + 1,
            climax_collectors = climax_collectors + ${hasClimax ? 1 : 0}
        where id = ${inv.ladder_id}
      `;
    } else if (hasClimax) {
      await sql`
        update ladders
        set climax_collectors = climax_collectors + 1
        where id = ${inv.ladder_id}
      `;
    }
    const dials = await loadDials(sql);
    const continueBy = new Date(Date.now() + continueHours(dials) * 3_600_000).toISOString();
    await sql`
      insert into collector_pressure (user_id, ladder_id, last_unlock_at, continue_by)
      values (${userId}, ${inv.ladder_id}, now(), ${continueBy})
      on conflict (user_id, ladder_id) do update set
        last_unlock_at = now(),
        continue_by = ${continueBy}
    `;
  }

  await sql`
    update invoices set status = 'paid', paid_at = now() where id = ${inv.id}
  `;
  await sql`
    insert into events (user_id, ladder_id, kind, meta)
    values (
      ${userId}, ${inv.ladder_id}, 'paid',
      ${JSON.stringify({ invoiceId: inv.id, amount: inv.amount_cents, kind: inv.kind })}
    )
  `;
  if (!inv.is_gift) {
    const { stampUnlocks } = await import("./stamps");
    const tx = "tx_hash" in inv ? String((inv as { tx_hash?: string | null }).tx_hash ?? "") : "";
    await stampUnlocks(sql, userId, ids, inv.id, tx || null);
  }
  return { already: false as const, giftCode: inv.gift_code };
}

export const confirmInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      id: string;
      method?: string;
      wallet?: string;
      txHash?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensurePayCols(sql);
    if (data.method || data.wallet || data.txHash) {
      await sql`
        update invoices
        set pay_method = ${data.method ?? null},
            wallet_address = ${data.wallet ?? null},
            tx_hash = ${data.txHash ?? null},
            status = 'confirming'
        where id = ${data.id} and user_id = ${context.userId} and status = 'pending'
      `;
    } else {
      await sql`
        update invoices set status = 'confirming'
        where id = ${data.id} and user_id = ${context.userId} and status = 'pending'
      `;
    }
    const result = await settleInvoice(sql, data.id, context.userId);
    return result;
  });

export const listVault = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const rows = await sql<{
      shot_id: string;
      ladder_id: string;
      title: string;
      slug: string;
      shot_title: string;
      step_index: number;
      media_type: "photo" | "video";
      media_url: string;
      object_position: string;
      grant_copy: string;
      created_at: string | Date;
    }>`
      select
        u.shot_id,
        u.ladder_id,
        l.title,
        l.slug,
        s.title as shot_title,
        s.step_index,
        s.media_type,
        s.media_url,
        s.object_position,
        s.grant_copy,
        u.created_at
      from unlocks u
      join ladders l on l.id = u.ladder_id
      join shots s on s.id = u.shot_id
      where u.user_id = ${context.userId}
      order by u.created_at desc
    `;
    const { grantMediaUrl } = await import("./stamps");
    const items: VaultItem[] = [];
    for (const r of rows) {
      const mediaUrl = await grantMediaUrl(sql, {
        userId: context.userId,
        shotId: r.shot_id,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
      });
      items.push({
        shotId: r.shot_id,
        ladderId: r.ladder_id,
        ladderTitle: r.title,
        ladderSlug: r.slug,
        title: r.shot_title,
        stepIndex: r.step_index,
        mediaType: r.media_type,
        mediaUrl,
        objectPosition: r.object_position,
        grantCopy: r.grant_copy,
        unlockedAt: new Date(r.created_at).toISOString(),
      });
    }
    return items;
  });

export const redeemGift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { code: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureProfile(sql, context.userId);
    const code = data.code.trim().toUpperCase();
    const rows = await sql<{
      code: string;
      from_user_id: string;
      ladder_id: string;
      shot_ids: string;
      invoice_id: string;
      redeemed_by: string | null;
    }>`select * from gifts where code = ${code}`;
    const gift = rows[0];
    if (!gift) throw new Error("That grant code is not real.");
    if (gift.redeemed_by) throw new Error("This grant was already claimed.");
    if (gift.from_user_id === context.userId) {
      throw new Error("You can't redeem a grant you sent.");
    }
    const ids = parseIds(gift.shot_ids);
    const shots = await sql<ShotRow>`select * from shots where ladder_id = ${gift.ladder_id}`;
    const byId = new Map(shots.map((s) => [s.id, s]));
    for (const shotId of ids) {
      const shot = byId.get(shotId);
      if (!shot) continue;
      await sql`
        insert into unlocks (user_id, shot_id, ladder_id, invoice_id, amount_cents, gifted)
        values (${context.userId}, ${shot.id}, ${gift.ladder_id}, ${gift.invoice_id}, 0, true)
        on conflict (user_id, shot_id) do nothing
      `;
    }
    await sql`
      update gifts set redeemed_by = ${context.userId}, redeemed_at = now()
      where code = ${code}
    `;
    const { stampUnlocks } = await import("./stamps");
    await stampUnlocks(sql, context.userId, ids, gift.invoice_id, null);
    const lad = await sql<{ slug: string }>`select slug from ladders where id = ${gift.ladder_id}`;
    return { slug: lad[0]?.slug ?? "", count: ids.length };
  });

export const peekGift = createServerFn({ method: "GET" })
  .validator((d: { code: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const code = data.code.trim().toUpperCase();
    const rows = await sql<{
      ladder_id: string;
      shot_ids: string;
      redeemed_by: string | null;
    }>`select ladder_id, shot_ids, redeemed_by from gifts where code = ${code}`;
    const gift = rows[0];
    if (!gift) return null;
    const lad = await sql<{ title: string; slug: string }>`
      select title, slug from ladders where id = ${gift.ladder_id}
    `;
    return {
      title: lad[0]?.title ?? "A private grant",
      slug: lad[0]?.slug ?? "",
      count: parseIds(gift.shot_ids).length,
      claimed: Boolean(gift.redeemed_by),
    };
  });

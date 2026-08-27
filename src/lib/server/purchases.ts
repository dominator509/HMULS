import { createServerFn } from "@tanstack/react-start";
import { getSql, withTransaction, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { loadDials } from "./transporter";
import { continueHours, invoiceMinutes, priceBumpPct } from "@/lib/psychology";
import { CRYPTO_ASSETS, giftCode, invoiceId } from "@/lib/crypto";
import { createNowpaymentsPayment, paymentsLive } from "./payments";
import { entityComplete } from "@/lib/legal-types";
import { ensureLegal, loadEntity } from "./legal";
import { grantVaultReady } from "./catalog";
import type { CryptoAsset, InvoiceKind, InvoiceView, VaultItem } from "@/lib/types";

let payColsReady = false;
async function ensurePayCols(sql: Sql) {
  if (payColsReady) return;
  await sql`alter table invoices add column if not exists pay_method text`;
  await sql`alter table invoices add column if not exists wallet_address text`;
  await sql`alter table invoices add column if not exists tx_hash text`;
  await sql`alter table invoices add column if not exists provider text`;
  await sql`alter table invoices add column if not exists provider_payment_id text`;
  await sql`alter table invoices add column if not exists pay_currency text`;
  await sql`alter table invoices add column if not exists price_amount text`;
  await sql`alter table invoices add column if not exists provider_expires_at timestamptz`;
  await sql`alter table gifts add column if not exists reserved_climax boolean not null default false`;
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
    await ensureLegal(sql);
    await ensureProfile(sql, context.userId);
    await ensurePayCols(sql);

    const assetOk = CRYPTO_ASSETS.some((a) => a.id === data.asset);
    if (!assetOk) throw new Error("Unsupported asset.");

    const ladders = await sql<{
      id: string;
      title: string;
      bundle_discount: string | number;
      climax_cap: number;
      climax_collectors: number;
    }>`select id, title, bundle_discount, climax_cap, climax_collectors from ladders where id = ${data.ladderId}`;
    const ladder = ladders[0];
    if (!ladder) throw new Error("Ladder not found.");

    const entity = await loadEntity(sql);
    const role = await ensureProfile(sql, context.userId);
    if (!entityComplete(entity) && role !== "admin") {
      throw new Error("This vault is not open for payment until the operator completes Ops → Legal.");
    }
    if (!grantVaultReady && role !== "admin") {
      throw new Error("Paid media vault is not ready.");
    }
    if (!paymentsLive() && role !== "admin") {
      throw new Error("Checkout is closed until NOWPayments is fully configured.");
    }

    const shots = await resolvePayableShots(
      sql,
      context.userId,
      data.ladderId,
      data.kind,
      data.shotId,
      data.upsellCount,
    );
    if (shots.some((s) => s.is_climax) && (ladder.climax_collectors ?? 0) >= (ladder.climax_cap ?? 48)) {
      throw new Error("Climax grants for this set are closed.");
    }
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
    let address = "";
    let cryptoAmount = "0";
    let provider: string | null = null;
    let providerPaymentId: string | null = null;
    let payCurrency: string | null = null;
    let priceAmount: string | null = null;
    let providerExpires: string | null = null;
    if (paymentsLive()) {
      const pay = await createNowpaymentsPayment({
        invoiceId: id,
        asset: data.asset,
        amountCents: amount,
      });
      address = pay.address;
      cryptoAmount = pay.payAmount;
      provider = pay.provider;
      providerPaymentId = pay.paymentId;
      payCurrency = pay.payCurrency;
      priceAmount = String(pay.priceAmount);
      providerExpires = pay.expiresAt;
    } else if (role !== "admin") {
      throw new Error("Checkout is closed until NOWPayments is fully configured.");
    }
    const gift = Boolean(data.isGift);
    const code = gift ? giftCode(id) : null;
    const marketingExpires = new Date(Date.now() + invoiceMinutes(dials) * 60_000);
    const expiresAt = providerExpires ? new Date(providerExpires) : marketingExpires;

    await sql`
      insert into invoices (
        id, user_id, ladder_id, kind, shot_ids, amount_cents, asset,
        pay_address, crypto_amount, status, is_gift, gift_code, expires_at,
        provider, provider_payment_id, pay_currency, price_amount, provider_expires_at
      ) values (
        ${id}, ${context.userId}, ${data.ladderId}, ${data.kind},
        ${JSON.stringify(shots.map((s) => s.id))}, ${amount}, ${data.asset},
        ${address}, ${cryptoAmount}, 'pending', ${gift}, ${code}, ${expiresAt.toISOString()},
        ${provider}, ${providerPaymentId}, ${payCurrency}, ${priceAmount}, ${providerExpires}
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
      paymentReady: Boolean(address && providerPaymentId),
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
      paymentReady: Boolean(inv.pay_address && (inv as { provider_payment_id?: string | null }).provider_payment_id),
    };
    return view;
  });

async function grantShots(
  sql: Sql,
  opts: {
    userId: string;
    ladderId: string;
    invoiceId: string;
    ids: string[];
    gifted: boolean;
    skipClimaxReserve?: boolean;
    invoiceAmountCents?: number;
  },
) {
  const shots = await sql<ShotRow>`
    select * from shots where ladder_id = ${opts.ladderId}
  `;
  const byId = new Map(shots.map((s) => [s.id, s]));
  const hasClimax = opts.ids.some((id) => byId.get(id)?.is_climax);
  if (hasClimax && !opts.skipClimaxReserve) {
    const cap = await sql<{ id: string }>`
      update ladders
      set climax_collectors = climax_collectors + 1
      where id = ${opts.ladderId}
        and climax_collectors < climax_cap
      returning id
    `;
    if (!cap[0]) throw new Error("Climax grants for this set are closed.");
  }
  const prior = await sql<{ c: number }>`
    select count(*)::int as c from unlocks
    where user_id = ${opts.userId} and ladder_id = ${opts.ladderId}
  `;
  const listSum = opts.ids.reduce((a, id) => a + (byId.get(id)?.price_cents ?? 0), 0);
  for (const shotId of opts.ids) {
    const shot = byId.get(shotId);
    if (!shot) continue;
    let cents = 0;
    if (!opts.gifted) {
      if (opts.invoiceAmountCents != null && listSum > 0) {
        cents = Math.round((shot.price_cents / listSum) * opts.invoiceAmountCents);
      } else {
        cents = shot.price_cents;
      }
    }
    await sql`
      insert into unlocks (user_id, shot_id, ladder_id, invoice_id, amount_cents, gifted)
      values (
        ${opts.userId}, ${shot.id}, ${opts.ladderId}, ${opts.invoiceId},
        ${cents}, ${opts.gifted}
      )
      on conflict (user_id, shot_id) do nothing
    `;
  }
  if ((prior[0]?.c ?? 0) === 0) {
    await sql`
      update ladders set collectors_count = collectors_count + 1 where id = ${opts.ladderId}
    `;
  }
  const dials = await loadDials(sql);
  const continueBy = new Date(Date.now() + continueHours(dials) * 3_600_000).toISOString();
  await sql`
    insert into collector_pressure (user_id, ladder_id, last_unlock_at, continue_by)
    values (${opts.userId}, ${opts.ladderId}, now(), ${continueBy})
    on conflict (user_id, ladder_id) do update set
      last_unlock_at = now(),
      continue_by = ${continueBy}
  `;
  return { ids: opts.ids, byId };
}

async function settleInvoice(
  sql: Sql,
  invoiceId: string,
  userId: string,
  opts?: { allowExpired?: boolean },
) {
  return withTransaction(async (tx) => {
    const claimed = await tx<{
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
      tx_hash: string | null;
    }>`
      update invoices
      set status = 'settling'
      where id = ${invoiceId}
        and user_id = ${userId}
        and status in ('pending', 'confirming')
        and (
          ${Boolean(opts?.allowExpired)}
          or expires_at is null
          or expires_at > now()
        )
      returning *
    `;
    const inv = claimed[0];
    if (!inv) {
      const rows = await tx<{ status: string; gift_code: string | null }>`
        select status, gift_code from invoices where id = ${invoiceId} and user_id = ${userId}
      `;
      const cur = rows[0];
      if (!cur) throw new Error("Invoice not found.");
      if (cur.status === "paid") return { already: true as const, settled: true as const, giftCode: cur.gift_code };
      if (cur.status === "expired") throw new Error("This invitation closed.");
      throw new Error("This invoice is not ready to settle.");
    }

    const ids = parseIds(inv.shot_ids);
    if (inv.is_gift && inv.gift_code) {
      const shots = await tx<ShotRow>`select * from shots where ladder_id = ${inv.ladder_id}`;
      const byId = new Map(shots.map((s) => [s.id, s]));
      const hasClimax = ids.some((id) => byId.get(id)?.is_climax);
      if (hasClimax) {
        const cap = await tx<{ id: string }>`
          update ladders
          set climax_collectors = climax_collectors + 1
          where id = ${inv.ladder_id}
            and climax_collectors < climax_cap
          returning id
        `;
        if (!cap[0]) throw new Error("Climax grants for this set are closed.");
      }
      await tx`
        insert into gifts (code, from_user_id, ladder_id, shot_ids, invoice_id, reserved_climax)
        values (${inv.gift_code}, ${userId}, ${inv.ladder_id}, ${inv.shot_ids}, ${inv.id}, ${hasClimax})
        on conflict (code) do nothing
      `;
    } else {
      await grantShots(tx, {
        userId,
        ladderId: inv.ladder_id,
        invoiceId: inv.id,
        ids,
        gifted: false,
        invoiceAmountCents: inv.amount_cents,
      });
    }

    await tx`
      update invoices set status = 'paid', paid_at = now() where id = ${inv.id}
    `;
    await tx`
      insert into events (user_id, ladder_id, kind, meta)
      values (
        ${userId}, ${inv.ladder_id}, 'paid',
        ${JSON.stringify({ invoiceId: inv.id, amount: inv.amount_cents, kind: inv.kind })}
      )
    `;
    if (!inv.is_gift) {
      const { stampUnlocks } = await import("./stamps");
      await stampUnlocks(tx, userId, ids, inv.id, inv.tx_hash || null);
    }
    return { already: false as const, settled: true as const, giftCode: inv.gift_code };
  });
}

export async function settleVerifiedInvoice(sql: Sql, invoiceId: string) {
  await ensurePayCols(sql);
  const rows = await sql<{ user_id: string }>`select user_id from invoices where id = ${invoiceId}`;
  const owner = rows[0];
  if (!owner) throw new Error("Invoice not found.");
  return settleInvoice(sql, invoiceId, owner.user_id, { allowExpired: true });
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
    const bumped = await sql<{ id: string; gift_code: string | null; status: string }>`
      update invoices
      set pay_method = coalesce(${data.method ?? null}, pay_method),
          wallet_address = coalesce(${data.wallet ?? null}, wallet_address),
          tx_hash = coalesce(${data.txHash ?? null}, tx_hash),
          status = 'confirming'
      where id = ${data.id} and user_id = ${context.userId} and status = 'pending'
      returning id, gift_code, status
    `;
    const row = bumped[0];
    if (!row) {
      const cur = await sql<{ status: string; gift_code: string | null }>`
        select status, gift_code from invoices where id = ${data.id} and user_id = ${context.userId}
      `;
      if (!cur[0]) throw new Error("Invoice not found.");
      if (cur[0].status === "paid") {
        return { settled: true as const, already: true as const, giftCode: cur[0].gift_code, status: "paid" as const };
      }
      if (cur[0].status === "confirming" || cur[0].status === "settling") {
        return {
          settled: false as const,
          already: false as const,
          giftCode: cur[0].gift_code,
          status: "confirming" as const,
        };
      }
      throw new Error("This invoice cannot be confirmed.");
    }
    return {
      settled: false as const,
      already: false as const,
      giftCode: row.gift_code,
      status: "confirming" as const,
    };
  });

export const operatorGrantInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const role = await ensureProfile(sql, context.userId);
    if (role !== "admin") throw new Error("Operator access only.");
    await ensurePayCols(sql);
    const owner = await sql<{ user_id: string }>`select user_id from invoices where id = ${data.id}`;
    if (!owner[0]) throw new Error("Invoice not found.");
    await sql`
      update invoices set status = 'confirming'
      where id = ${data.id} and status = 'pending'
    `;
    return settleInvoice(sql, data.id, owner[0].user_id);
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
    await ensurePayCols(sql);
    const code = data.code.trim().toUpperCase();
    return withTransaction(async (tx) => {
      const claimed = await tx<{
        code: string;
        from_user_id: string;
        ladder_id: string;
        shot_ids: string;
        invoice_id: string;
        reserved_climax: boolean;
      }>`
        update gifts
        set redeemed_by = ${context.userId}, redeemed_at = now()
        where code = ${code}
          and redeemed_by is null
          and from_user_id <> ${context.userId}
        returning code, from_user_id, ladder_id, shot_ids, invoice_id, reserved_climax
      `;
      const gift = claimed[0];
      if (!gift) {
        const rows = await tx<{ redeemed_by: string | null; from_user_id: string }>`
          select redeemed_by, from_user_id from gifts where code = ${code}
        `;
        if (!rows[0]) throw new Error("That grant code is not real.");
        if (rows[0].from_user_id === context.userId) {
          throw new Error("You can't redeem a grant you sent.");
        }
        throw new Error("This grant was already claimed.");
      }
      const ids = parseIds(gift.shot_ids);
      await grantShots(tx, {
        userId: context.userId,
        ladderId: gift.ladder_id,
        invoiceId: gift.invoice_id,
        ids,
        gifted: true,
        skipClimaxReserve: Boolean(gift.reserved_climax),
      });
      const { stampUnlocks } = await import("./stamps");
      await stampUnlocks(tx, context.userId, ids, gift.invoice_id, null);
      const lad = await tx<{ slug: string }>`select slug from ladders where id = ${gift.ladder_id}`;
      return { slug: lad[0]?.slug ?? "", count: ids.length };
    });
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

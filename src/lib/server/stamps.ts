import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

let tablesReady = false;

export async function ensureStampTables(sql: Sql) {
  if (tablesReady) return;
  await sql`
    create table if not exists vault_settings (
      id integer primary key default 1,
      stamp_grants boolean not null default true,
      stamp_visible boolean not null default true,
      updated_at timestamptz not null default now()
    )
  `;
  await sql`insert into vault_settings (id) values (1) on conflict (id) do nothing`;
  await sql`
    create table if not exists media_stamps (
      token text primary key,
      user_id text not null,
      shot_id text not null,
      invoice_id text,
      tx_hash text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create unique index if not exists media_stamps_user_shot on media_stamps (user_id, shot_id)`;
  tablesReady = true;
}

export async function loadStampSettings(sql: Sql) {
  await ensureStampTables(sql);
  const rows = await sql<{ stamp_grants: boolean; stamp_visible: boolean }>`
    select stamp_grants, stamp_visible from vault_settings where id = 1
  `;
  return {
    stampGrants: rows[0]?.stamp_grants ?? true,
    stampVisible: rows[0]?.stamp_visible ?? true,
  };
}

export async function grantMediaUrl(
  sql: Sql,
  opts: {
    userId: string;
    shotId: string;
    mediaUrl: string;
    mediaType: string;
    invoiceId?: string | null;
    txHash?: string | null;
  },
) {
  const settings = await loadStampSettings(sql);
  const existing = await sql<{ token: string }>`
    select token from media_stamps where user_id = ${opts.userId} and shot_id = ${opts.shotId}
  `;
  const token =
    existing[0]?.token ?? (await mintAndStamp(sql, opts, settings.stampGrants, settings.stampVisible));
  if (!token) return `/api/media/${opts.shotId}`;
  return `/api/media/${opts.shotId}?k=${token}`;
}

async function mintAndStamp(
  sql: Sql,
  opts: {
    userId: string;
    shotId: string;
    mediaUrl: string;
    mediaType: string;
    invoiceId?: string | null;
    txHash?: string | null;
  },
  stampPixels: boolean,
  visible: boolean,
) {
  const stamp = await import("./stamp.server");
  const token = stamp.mintToken();
  await sql`
    insert into media_stamps (token, user_id, shot_id, invoice_id, tx_hash)
    values (${token}, ${opts.userId}, ${opts.shotId}, ${opts.invoiceId ?? null}, ${opts.txHash ?? null})
    on conflict (user_id, shot_id) do nothing
  `;
  const row = await sql<{ token: string }>`
    select token from media_stamps where user_id = ${opts.userId} and shot_id = ${opts.shotId}
  `;
  const use = row[0]?.token ?? token;
  if (stampPixels && !stamp.isVideoUrl(opts.mediaUrl, opts.mediaType)) {
    try {
      if (stamp.stampSidecarConfigured()) {
        const { readPrivateOriginal, putStampCache } = await import("./object-store");
        const bytes = await readPrivateOriginal(opts.mediaUrl);
        if (bytes && bytes.length >= 32) {
          const png = await stamp.stampStillRemote(bytes, use, visible);
          await putStampCache(opts.userId, opts.shotId, png);
        }
      } else {
        const src = await stamp.materializeOriginal(opts.mediaUrl);
        const dest = stamp.cachePath(opts.userId, opts.shotId);
        if (src) {
          await stamp.stampStill({ sourcePath: src, destPath: dest, token: use, visible });
        }
      }
    } catch (err) {
      console.error("[stamp] still failed", err);
    }
  }
  return use;
}

export async function stampUnlocks(
  sql: Sql,
  userId: string,
  shotIds: string[],
  invoiceId: string | null,
  txHash: string | null,
) {
  if (!shotIds.length) return;
  const shots = await sql<{ id: string; media_url: string; media_type: string }>`
    select id, media_url, media_type from shots
  `;
  const by = new Map(shots.map((s) => [s.id, s]));
  for (const id of shotIds) {
    const s = by.get(id);
    if (!s) continue;
    await grantMediaUrl(sql, {
      userId,
      shotId: id,
      mediaUrl: s.media_url,
      mediaType: s.media_type,
      invoiceId,
      txHash,
    });
  }
}

export const getStampSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const { ensureProfile } = await import("./catalog");
    await ensureProfile(sql, context.userId);
    return loadStampSettings(sql);
  });

export const saveStampSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { stampGrants: boolean; stampVisible: boolean }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { ensureProfile } = await import("./catalog");
    const role = await ensureProfile(sql, context.userId);
    if (role !== "admin") throw new Error("Operator access only.");
    await sql`
      insert into vault_settings (id, stamp_grants, stamp_visible, updated_at)
      values (1, ${data.stampGrants}, ${data.stampVisible}, now())
      on conflict (id) do update set
        stamp_grants = excluded.stamp_grants,
        stamp_visible = excluded.stamp_visible,
        updated_at = now()
    `;
    return loadStampSettings(sql);
  });

export type LeakHit = {
  token: string;
  userId: string;
  email: string | null;
  shotId: string;
  shotTitle: string;
  ladderTitle: string;
  invoiceId: string | null;
  txHash: string | null;
  stampedAt: string;
};

export const traceLeak = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { dataUrl: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const { ensureProfile } = await import("./catalog");
    const role = await ensureProfile(sql, context.userId);
    if (role !== "admin") throw new Error("Operator access only.");
    const comma = data.dataUrl.indexOf(",");
    const b64 = comma >= 0 ? data.dataUrl.slice(comma + 1) : data.dataUrl;
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length < 32 || bytes.length > 8_000_000) {
      throw new Error("That file is empty or too large.");
    }
    const stamp = await import("./stamp.server");
    const token = await stamp.extractFromBuffer(bytes);
    if (!token) return { ok: false as const, error: "No stamp found in this file." };
    const rows = await sql<{
      token: string;
      user_id: string;
      shot_id: string;
      invoice_id: string | null;
      tx_hash: string | null;
      created_at: string | Date;
      shot_title: string;
      ladder_title: string;
    }>`
      select m.token, m.user_id, m.shot_id, m.invoice_id, m.tx_hash, m.created_at,
             s.title as shot_title, l.title as ladder_title
      from media_stamps m
      join shots s on s.id = m.shot_id
      join ladders l on l.id = s.ladder_id
      where m.token = ${token}
    `;
    const hit = rows[0];
    if (!hit) return { ok: false as const, error: `Stamp ${token} is not in this vault.` };
    let email: string | null = null;
    try {
      const u = await sql<{ email: string | null }>`
        select email from "user" where id = ${hit.user_id}
      `;
      email = u[0]?.email ?? null;
    } catch {
      email = null;
    }
    const found: LeakHit = {
      token: hit.token,
      userId: hit.user_id,
      email,
      shotId: hit.shot_id,
      shotTitle: hit.shot_title,
      ladderTitle: hit.ladder_title,
      invoiceId: hit.invoice_id,
      txHash: hit.tx_hash,
      stampedAt: new Date(hit.created_at).toISOString(),
    };
    return { ok: true as const, hit: found };
  });

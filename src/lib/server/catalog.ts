import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { SEED_LADDERS } from "@/lib/catalog-seed";
import { LIORA, photosetOf, type MuseBible } from "@/lib/muses";
import { loadMuseBibles } from "./muse-lookup";
import type { LadderPublic, ProgressState, ShotPublic } from "@/lib/types";

type LadderRow = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  tagline: string;
  description: string;
  cover_url: string;
  sort_order: number;
  bundle_discount: string | number;
  collectors_count: number;
  climax_collectors: number;
  climax_cap: number;
  scarcity_ends_at: string | Date | null;
  published: boolean;
  model_id: string | null;
  photoset_hook: string | null;
  photoset_tease: string | null;
};

type ShotRow = {
  id: string;
  ladder_id: string;
  step_index: number;
  title: string;
  tease: string;
  grant_copy: string;
  story: string;
  drop_line: string;
  media_type: "photo" | "video";
  media_url: string;
  object_position: string;
  price_cents: number;
  is_climax: boolean;
  visual_beat: string | null;
  teaser_url: string | null;
};

let seedPromise: Promise<void> | null = null;
let copySynced = false;
let voiceColsReady = false;
let grantVaultSynced = false;

async function ensureVoiceColumns(sql: Sql) {
  if (voiceColsReady) return;
  await sql`alter table ladders add column if not exists model_id text not null default 'mod_liora'`;
  await sql`alter table ladders add column if not exists photoset_hook text not null default ''`;
  await sql`alter table ladders add column if not exists photoset_tease text not null default ''`;
  await sql`alter table shots add column if not exists visual_beat text not null default ''`;
  await sql`alter table shots add column if not exists teaser_url text not null default ''`;
  await sql`alter table shots add column if not exists imagine_prompt text not null default ''`;
  voiceColsReady = true;
}

async function syncCatalogCopy(sql: Sql) {
  await ensureVoiceColumns(sql);
  for (const lad of SEED_LADDERS) {
    const set = photosetOf(lad.id);
    const hook = set?.hook ?? lad.tagline;
    const tease = set?.tease ?? lad.description;
    await sql`
      update ladders
      set tagline = ${hook},
          description = ${tease},
          model_id = 'mod_liora',
          photoset_hook = ${hook},
          photoset_tease = ${tease}
      where id = ${lad.id}
    `;
    for (const s of lad.shots) {
      const voice = set?.shots[s.id];
      await sql`
        update shots
        set title = ${s.title},
            tease = ${voice?.tease ?? s.tease},
            grant_copy = ${voice?.grant ?? s.grant},
            story = ${voice?.story ?? s.story},
            drop_line = ${voice?.drop ?? s.drop},
            visual_beat = ${voice?.visual ?? ""}
        where id = ${s.id}
      `;
    }
  }
}

export async function ensureCatalog(sql: Sql) {
  if (!seedPromise) {
    seedPromise = (async () => {
      await ensureVoiceColumns(sql);
      const existing = await sql<{ c: number }>`select count(*)::int as c from ladders`;
      if ((existing[0]?.c ?? 0) === 0) {
        for (const lad of SEED_LADDERS) {
          await sql`
            insert into ladders (
              id, slug, title, theme, tagline, description, cover_url, sort_order,
              bundle_discount, collectors_count, climax_collectors, scarcity_ends_at
            ) values (
              ${lad.id}, ${lad.slug}, ${lad.title}, ${lad.theme}, ${lad.tagline},
              ${lad.description}, ${lad.cover}, ${lad.sort}, ${lad.discount},
              ${lad.collectors}, ${lad.climax}, now() + interval '18 hours'
            )
          `;
          for (const s of lad.shots) {
            await sql`
              insert into shots (
                id, ladder_id, step_index, title, tease, grant_copy, story, drop_line,
                media_type, media_url, object_position, price_cents, is_climax
              ) values (
                ${s.id}, ${lad.id}, ${s.step}, ${s.title}, ${s.tease}, ${s.grant},
                ${s.story}, ${s.drop}, ${s.type}, ${s.media}, ${s.pos}, ${s.price},
                ${s.climax ?? false}
              )
            `;
          }
        }
        await sql`
          insert into psychology_dials (id) values (1) on conflict (id) do nothing
        `;
      }
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  await seedPromise;
  if (!copySynced) {
    await syncCatalogCopy(sql);
    copySynced = true;
  }
  if (!grantVaultSynced) {
    try {
      await authorizePublicAndGrants(sql);
      grantVaultSynced = true;
    } catch (err) {
      console.error("[grants] vault pass failed", err);
      grantVaultSynced = true;
    }
  }
}

export async function ensureProfile(sql: Sql, userId: string) {
  const existing = await sql<{ role: string }>`
    select role from profiles where user_id = ${userId}
  `;
  if (existing[0]) return existing[0].role;
  const admins = await sql<{ c: number }>`
    select count(*)::int as c from profiles where role = 'admin'
  `;
  const role = (admins[0]?.c ?? 0) === 0 ? "admin" : "buyer";
  await sql`
    insert into profiles (user_id, role) values (${userId}, ${role})
    on conflict (user_id) do nothing
  `;
  return role;
}

function discountNum(v: string | number) {
  return typeof v === "number" ? v : Number(v);
}

function mapShot(row: ShotRow, unlocked: boolean, coverUrl: string): ShotPublic {
  const teaser =
    row.teaser_url && !row.teaser_url.startsWith("grant:")
      ? row.teaser_url
      : coverUrl;
  return {
    id: row.id,
    ladderId: row.ladder_id,
    stepIndex: row.step_index,
    title: row.title,
    tease: row.tease,
    grantCopy: row.grant_copy,
    story: row.story ?? "",
    dropLine: row.drop_line ?? "",
    mediaType: row.media_type,
    teaserUrl: teaser,
    objectPosition: row.object_position,
    priceCents: row.price_cents,
    isClimax: row.is_climax,
    unlocked,
    mediaUrl: unlocked ? `/api/media/${row.id}` : null,
  };
}

function mapLadder(
  lad: LadderRow,
  shots: ShotRow[],
  unlocked: Set<string>,
  muse: MuseBible,
): LadderPublic {
  return {
    id: lad.id,
    slug: lad.slug,
    title: lad.title,
    theme: lad.theme,
    tagline: lad.photoset_hook || lad.tagline,
    description: lad.photoset_tease || lad.description,
    coverUrl: lad.cover_url,
    sortOrder: lad.sort_order,
    bundleDiscount: discountNum(lad.bundle_discount),
    collectorsCount: lad.collectors_count,
    climaxCollectors: lad.climax_collectors,
    climaxCap: lad.climax_cap ?? 48,
    scarcityEndsAt: lad.scarcity_ends_at ? new Date(lad.scarcity_ends_at).toISOString() : null,
    modelId: lad.model_id || muse.id,
    modelName: muse.stageName,
    modelSlug: muse.slug,
    photosetHook: lad.photoset_hook || lad.tagline,
    photosetTease: lad.photoset_tease || lad.description,
    shots: shots.map((s) => mapShot(s, unlocked.has(s.id), lad.cover_url)),
  };
}

export function applyUnlocks(
  ladder: LadderPublic,
  unlocked: Set<string>,
  mediaUrls?: Record<string, string>,
): LadderPublic {
  return {
    ...ladder,
    shots: ladder.shots.map((s) => ({
      ...s,
      unlocked: unlocked.has(s.id),
      mediaUrl: unlocked.has(s.id) ? (mediaUrls?.[s.id] ?? `/api/media/${s.id}`) : null,
    })),
  };
}

export function withBundle(ladder: LadderPublic): ProgressState {
  const granted = ladder.shots.filter((s) => s.unlocked);
  const remaining = ladder.shots.filter((s) => !s.unlocked);
  const remainingCents = remaining.reduce((a, s) => a + s.priceCents, 0);
  return {
    unlockedCount: granted.length,
    total: ladder.shots.length,
    spentCents: granted.reduce((a, s) => a + s.priceCents, 0),
    nextShotId: remaining[0]?.id ?? null,
    hasClimax: granted.some((s) => s.isClimax),
    remainingCents,
    bundleCents: Math.round(remainingCents * (1 - ladder.bundleDiscount)),
  };
}

export async function loadPublishedCatalog(sql: Sql): Promise<LadderPublic[]> {
  await ensureCatalog(sql);
  const ladders = await sql<LadderRow>`
    select * from ladders where published = true order by sort_order
  `;
  const shots = await sql<ShotRow>`select * from shots order by step_index`;
  const byLad = new Map<string, ShotRow[]>();
  for (const s of shots) {
    const list = byLad.get(s.ladder_id) ?? [];
    list.push(s);
    byLad.set(s.ladder_id, list);
  }
  const empty = new Set<string>();
  const muses = await loadMuseBibles(sql);
  return ladders
    .map((l) =>
      mapLadder(l, byLad.get(l.id) ?? [], empty, muses.get(l.model_id || "") ?? LIORA),
    )
    .filter((l) => l.shots.length > 0);
}

async function authorizePublicAndGrants(sql: Sql) {
  const { persistSeoMedia } = await import("./seo-media.server");
  const { vaultShotMedia, sweepPublicGrants } = await import("./grant-media.server");
  const muses = await loadMuseBibles(sql);
  const lads = await sql<{
    id: string;
    title: string;
    cover_url: string;
    model_id: string | null;
  }>`select id, title, cover_url, model_id from ladders`;
  for (const l of lads) {
    const muse = muses.get(l.model_id || "") ?? LIORA;
    const cover = await persistSeoMedia({
      srcUrl: l.cover_url,
      museSlug: muse.slug,
      step: 0,
      title: l.title,
      beat: "cover",
    });
    if (cover !== l.cover_url) {
      await sql`update ladders set cover_url = ${cover} where id = ${l.id}`;
      l.cover_url = cover;
    }
  }
  const shots = await sql<{
    id: string;
    ladder_id: string;
    step_index: number;
    title: string;
    media_url: string;
    media_type: string;
    visual_beat: string | null;
    teaser_url: string | null;
  }>`select id, ladder_id, step_index, title, media_url, media_type, visual_beat, teaser_url from shots`;
  const ladBy = new Map(lads.map((l) => [l.id, l]));
  const keep = new Set<string>(lads.map((l) => l.cover_url));
  keep.add("/media/hero.jpg");
  keep.add("/media/portrait.jpg");
  for (const s of shots) {
    const teaserName = (s.teaser_url || "").split("/").pop() || "";
    if (
      s.media_url.startsWith("grant:") &&
      /-tease\.jpg$/i.test(teaserName) &&
      teaserName.length <= 48
    ) {
      keep.add(s.teaser_url || "");
      continue;
    }
    const lad = ladBy.get(s.ladder_id);
    const muse = muses.get(lad?.model_id || "") ?? LIORA;
    const packed = await vaultShotMedia({
      srcUrl: s.media_url,
      shotId: s.id,
      museSlug: muse.slug,
      step: s.step_index,
      title: s.title,
      beat: s.visual_beat || undefined,
      mediaType: s.media_type,
    });
    if (packed.grantUrl !== s.media_url || packed.teaserUrl !== (s.teaser_url || "")) {
      await sql`
        update shots
        set media_url = ${packed.grantUrl}, teaser_url = ${packed.teaserUrl}
        where id = ${s.id}
      `;
    }
    keep.add(packed.teaserUrl);
  }
  await sweepPublicGrants([...keep]);
}

export const listLadders = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  return loadPublishedCatalog(sql);
});

export const getLadderBySlug = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const ladders = await sql<LadderRow>`
      select * from ladders where slug = ${data.slug} and published = true
    `;
    const lad = ladders[0];
    if (!lad) return null;
    const shots = await sql<ShotRow>`
      select * from shots where ladder_id = ${lad.id} order by step_index
    `;
    await sql`
      insert into events (ladder_id, kind, meta)
      values (${lad.id}, 'view', ${JSON.stringify({ slug: data.slug })})
    `;
    const muses = await loadMuseBibles(sql);
    const muse = muses.get(lad.model_id || "") ?? LIORA;
    return mapLadder(lad, shots, new Set(), muse);
  });

export const getMyUnlocks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const rows = await sql<{ shot_id: string; ladder_id: string }>`
      select shot_id, ladder_id from unlocks where user_id = ${context.userId}
    `;
    if (rows.length === 0) return [];
    const { grantMediaUrl } = await import("./stamps");
    const shots = await sql<{ id: string; media_url: string; media_type: string }>`
      select id, media_url, media_type from shots
    `;
    const by = new Map(shots.map((s) => [s.id, s]));
    const out: { shot_id: string; ladder_id: string; mediaUrl: string | null }[] = [];
    for (const r of rows) {
      const s = by.get(r.shot_id);
      const mediaUrl = s
        ? await grantMediaUrl(sql, {
            userId: context.userId,
            shotId: r.shot_id,
            mediaUrl: s.media_url,
            mediaType: s.media_type,
          })
        : null;
      out.push({ ...r, mediaUrl });
    }
    return out;
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    const role = await ensureProfile(sql, context.userId);
    return { role };
  });

export const getMyPressure = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { ladderId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ continue_by: string | Date }>`
      select continue_by from collector_pressure
      where user_id = ${context.userId} and ladder_id = ${data.ladderId}
    `;
    const continueBy = rows[0]?.continue_by
      ? new Date(rows[0].continue_by).toISOString()
      : null;
    return {
      continueBy,
      expired: continueBy ? Date.now() > new Date(continueBy).getTime() : false,
    };
  });

export const getAtmosphere = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureCatalog(sql);
  const rows = await sql<{
    kind: string;
    title: string;
    created_at: string | Date;
  }>`
    select e.kind, l.title, e.created_at
    from events e
    join ladders l on l.id = e.ladder_id
    where e.kind in ('paid', 'checkout')
    order by e.created_at desc
    limit 12
  `;
  return rows.map((r) => ({
    kind: r.kind,
    ladderTitle: r.title,
    at: new Date(r.created_at).toISOString(),
  }));
});

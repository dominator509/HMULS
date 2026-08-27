import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { bibleFor, slugify } from "./muse-lookup";
import { ensureLegal } from "./legal";
import type { AnalyticsSnapshot } from "@/lib/types";

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);

    const ladders = await sql<{ id: string; title: string }>`
      select id, title from ladders order by sort_order
    `;
    const paid = await sql<{
      ladder_id: string;
      revenue: string | number;
      unlocks: number;
    }>`
      select ladder_id,
             coalesce(sum(amount_cents), 0) as revenue,
             count(*)::int as unlocks
      from unlocks
      group by ladder_id
    `;
    const views = await sql<{ ladder_id: string; c: number }>`
      select ladder_id, count(*)::int as c from events where kind = 'view' group by ladder_id
    `;
    const climaxes = await sql<{ ladder_id: string; c: number }>`
      select u.ladder_id, count(*)::int as c
      from unlocks u
      join shots s on s.id = u.shot_id
      where s.is_climax = true
      group by u.ladder_id
    `;
    const unlockAgg = await sql<{
      revenue: string | number;
      unlocks: number;
    }>`
      select coalesce(sum(amount_cents), 0) as revenue, count(*)::int as unlocks
      from unlocks
    `;
    const invoiceAgg = await sql<{ invoices: number }>`
      select count(*)::int as invoices from invoices where status = 'paid'
    `;
    const viewTotal = await sql<{ c: number }>`
      select count(*)::int as c from events where kind = 'view'
    `;
    const recent = await sql<{
      id: number;
      kind: string;
      ladder_id: string | null;
      created_at: string | Date;
      meta: string | null;
    }>`
      select id, kind, ladder_id, created_at, meta from events
      order by created_at desc limit 12
    `;

    const payBy = new Map(paid.map((p) => [p.ladder_id, p]));
    const viewBy = new Map(views.map((v) => [v.ladder_id, v.c]));
    const climaxBy = new Map(climaxes.map((c) => [c.ladder_id, c.c]));
    const revenueCents = Number(unlockAgg[0]?.revenue ?? 0);
    const unlockCount = unlockAgg[0]?.unlocks ?? 0;
    const viewsN = viewTotal[0]?.c ?? 0;

    const snapshot: AnalyticsSnapshot = {
      revenueCents,
      unlockCount,
      invoiceCount: invoiceAgg[0]?.invoices ?? 0,
      conversionPct: viewsN === 0 ? 0 : Math.round((unlockCount / viewsN) * 1000) / 10,
      byLadder: ladders.map((l) => ({
        ladderId: l.id,
        title: l.title,
        revenueCents: Number(payBy.get(l.id)?.revenue ?? 0),
        unlocks: payBy.get(l.id)?.unlocks ?? 0,
        views: viewBy.get(l.id) ?? 0,
        climaxUnlocks: climaxBy.get(l.id) ?? 0,
      })),
      recent: recent.map((r) => {
        let amount: number | null = null;
        if (r.meta) {
          try {
            const m = JSON.parse(r.meta) as { amount?: number };
            amount = typeof m.amount === "number" ? m.amount : null;
          } catch {
            amount = null;
          }
        }
        return {
          id: r.id,
          kind: r.kind,
          ladderId: r.ladder_id,
          createdAt: new Date(r.created_at).toISOString(),
          amountCents: amount,
        };
      }),
    };
    return snapshot;
  });

export const listAdminLadders = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    const ladders = await sql<{
      id: string;
      slug: string;
      title: string;
      theme: string;
      tagline: string;
      cover_url: string;
      bundle_discount: string | number;
      collectors_count: number;
      published: boolean;
      model_id: string | null;
    }>`select id, slug, title, theme, tagline, cover_url, bundle_discount, collectors_count, published, model_id from ladders order by sort_order`;
    const shots = await sql<{
      id: string;
      ladder_id: string;
      step_index: number;
      title: string;
      price_cents: number;
      media_type: string;
      media_url: string;
      teaser_url: string | null;
      is_climax: boolean;
      tease: string;
      visual_beat: string | null;
    }>`select id, ladder_id, step_index, title, price_cents, media_type, media_url, teaser_url, is_climax, tease, visual_beat from shots order by step_index`;
    const names = new Map<string, string>();
    for (const l of ladders) {
      const muse = await bibleFor(sql, l.model_id);
      names.set(l.id, muse.stageName);
    }
    return ladders.map((l) => ({
      ...l,
      bundleDiscount: Number(l.bundle_discount),
      modelName: names.get(l.id) ?? "—",
      shots: shots.filter((s) => s.ladder_id === l.id),
    }));
  });

export const updateShotPrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { shotId: string; priceCents: number }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const cents = Math.max(0, Math.round(data.priceCents));
    await sql`update shots set price_cents = ${cents} where id = ${data.shotId}`;
    return { ok: true };
  });

export const updateLadderMeta = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      id: string;
      title: string;
      tagline: string;
      bundleDiscount: number;
      published: boolean;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const disc = Math.min(0.7, Math.max(0, data.bundleDiscount));
    await sql`
      update ladders
      set title = ${data.title},
          tagline = ${data.tagline},
          bundle_discount = ${disc},
          published = ${data.published}
      where id = ${data.id}
    `;
    return { ok: true };
  });

export const addShot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      ladderId: string;
      title: string;
      tease: string;
      grantCopy: string;
      mediaUrl: string;
      mediaType: "photo" | "video";
      priceCents: number;
      isClimax: boolean;
      visualBeat?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await ensureCatalog(sql);
    const max = await sql<{ m: number }>`
      select coalesce(max(step_index), 0)::int as m from shots where ladder_id = ${data.ladderId}
    `;
    const step = (max[0]?.m ?? 0) + 1;
    const id = `shot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const lad = await sql<{ model_id: string | null; title: string }>`
      select model_id, title from ladders where id = ${data.ladderId}
    `;
    const muse = await bibleFor(sql, lad[0]?.model_id);
    const tease =
      data.tease.trim() ||
      `${muse.stageName} · ${data.title}. The next yes is still hers to give.`;
    const grant =
      data.grantCopy.trim() || `You've been granted ${data.title}. ${muse.stageName} noticed.`;
    const { vaultShotMedia } = await import("./grant-media.server");
    const packed = await vaultShotMedia({
      srcUrl: data.mediaUrl,
      shotId: id,
      museSlug: muse.slug,
      step,
      title: data.title,
      beat: data.visualBeat,
      mediaType: data.mediaType,
    });
    await sql`
      insert into shots (
        id, ladder_id, step_index, title, tease, grant_copy, media_type,
        media_url, object_position, price_cents, is_climax, visual_beat, teaser_url
      ) values (
        ${id}, ${data.ladderId}, ${step}, ${data.title}, ${tease},
        ${grant}, ${data.mediaType}, ${packed.grantUrl}, 'center',
        ${Math.max(0, Math.round(data.priceCents))}, ${data.isClimax},
        ${data.visualBeat?.trim() ?? ""}, ${packed.teaserUrl}
      )
    `;
    if (step === 1) {
      await sql`update ladders set published = true where id = ${data.ladderId}`;
    }
    return { id, step, mediaUrl: packed.teaserUrl };
  });

export const replaceShotMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { shotId: string; mediaUrl: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await ensureCatalog(sql);
    const rows = await sql<{
      id: string;
      ladder_id: string;
      step_index: number;
      title: string;
      visual_beat: string | null;
      media_type: string;
    }>`
      select id, ladder_id, step_index, title, visual_beat, media_type
      from shots where id = ${data.shotId}
    `;
    const shot = rows[0];
    if (!shot) throw new Error("Shot not found.");
    const lad = await sql<{ model_id: string | null }>`
      select model_id from ladders where id = ${shot.ladder_id}
    `;
    const muse = await bibleFor(sql, lad[0]?.model_id);
    const mediaType = data.mediaUrl.endsWith(".mp4") ? "video" : shot.media_type || "photo";
    const { vaultShotMedia } = await import("./grant-media.server");
    const packed = await vaultShotMedia({
      srcUrl: data.mediaUrl,
      shotId: shot.id,
      museSlug: muse.slug,
      step: shot.step_index,
      title: shot.title,
      beat: shot.visual_beat ?? "",
      mediaType,
      replace: true,
    });
    await sql`
      update shots
      set media_url = ${packed.grantUrl},
          teaser_url = ${packed.teaserUrl},
          media_type = ${mediaType}
      where id = ${shot.id}
    `;
    if (shot.step_index === 1) {
      await sql`update ladders set published = true where id = ${shot.ladder_id}`;
    }
    return { ok: true as const, teaserUrl: packed.teaserUrl };
  });

export const createLadder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      modelId: string;
      title: string;
      slug?: string;
      theme: string;
      tagline: string;
      description: string;
      coverUrl: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const muse = await bibleFor(sql, data.modelId);
    if (muse.id === "mod_liora" && data.modelId !== "mod_liora") {
      throw new Error("Muse not found. Save her first.");
    }
    const slug =
      slugify(data.slug || data.title) || `set-${Date.now().toString(36)}`;
    const taken = await sql<{ c: number }>`select count(*)::int as c from ladders where slug = ${slug}`;
    if ((taken[0]?.c ?? 0) > 0) throw new Error("That photoset slug is already in use.");
    const sort = await sql<{ m: number }>`select coalesce(max(sort_order), 0)::int as m from ladders`;
    const id = `lad_${slug}`.slice(0, 40);
    const hook = data.tagline.trim() || `${muse.stageName} only opens this set in order.`;
    const tease =
      data.description.trim() ||
      `${muse.stageName}'s photoset. Nine yeses. She undresses for the man who stays.`;
    const coverIn = data.coverUrl.trim() || "/media/portrait.jpg";
    const { persistSeoMedia } = await import("./seo-media.server");
    const cover = await persistSeoMedia({
      srcUrl: coverIn,
      museSlug: muse.slug,
      step: 0,
      title: data.title,
      beat: "cover",
    });
    const theme = ["frontal", "worship", "feet"].includes(data.theme) ? data.theme : data.theme || "frontal";
    await sql`
      insert into ladders (
        id, slug, title, theme, tagline, description, cover_url, sort_order,
        bundle_discount, collectors_count, climax_collectors, scarcity_ends_at,
        model_id, photoset_hook, photoset_tease, published
      ) values (
        ${id}, ${slug}, ${data.title.trim()}, ${theme}, ${hook}, ${tease}, ${cover},
        ${(sort[0]?.m ?? 0) + 1}, 0.32, 0, 0, now() + interval '18 hours',
        ${muse.id}, ${hook}, ${tease}, false
      )
    `;
    const row = await sql<{ ladder_slugs: string }>`select ladder_slugs from models where id = ${muse.id}`;
    const slugs = (row[0]?.ladder_slugs || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!slugs.includes(slug)) slugs.push(slug);
    await sql`
      update models set ladder_slugs = ${slugs.join(",")}, updated_at = now() where id = ${muse.id}
    `;
    return { id, slug, modelId: muse.id, modelName: muse.stageName };
  });

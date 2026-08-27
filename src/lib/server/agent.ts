import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import {
  autoWriteLadder,
  extractJson,
  grokJson,
  loadDials,
  loadSurfaces,
  writeLadderCopy,
} from "./transporter";
import { SURFACE_SYSTEM, surfaceUserMessage } from "@/lib/prompt-pack";
import { mergeSurfaces, normalizeDials, type Dials, type Surfaces } from "@/lib/psychology";
import { ensureLegal, loadEntity, loadModels, regenerateAll } from "./legal";
import { modelCardPrompt } from "@/lib/legal-templates";
import { bibleFor, loadMuseBibles } from "./muse-lookup";
import type { ContentKind, LegalEntity, MuseModel } from "@/lib/legal-types";
import { type AgentKey, type KeyScope } from "@/lib/agent-types";

export type { AgentKey, KeyScope };

const NEED: Record<string, KeyScope> = {
  health: "read",
  list_ladders: "read",
  get_ladder: "read",
  get_analytics: "read",
  get_dials: "read",
  list_models: "read",
  get_legal: "read",
  list_events: "read",
  set_dials: "operator",
  write_ladder_copy: "operator",
  auto_write_ladder: "operator",
  write_surfaces: "operator",
  write_model_card: "operator",
  regenerate_legal: "operator",
  save_legal_entity: "operator",
  upsert_model: "write",
  create_ladder: "write",
  update_ladder: "write",
  add_shot: "write",
  set_shot_price: "write",
};

export async function hashToken(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

async function randomHex(bytes: number) {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(bytes).toString("hex");
}

let keysReady = false;

export async function ensureKeys(sql: Sql) {
  if (keysReady) return;
  await sql`
    create table if not exists api_keys (
      id text primary key,
      label text not null,
      prefix text not null,
      hash text unique not null,
      scope text not null default 'read',
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  await sql`delete from api_keys where id = 'key_preview'`;
  keysReady = true;
}

export async function authenticateAgent(
  sql: Sql,
  request: Request,
): Promise<{ ok: true; scope: KeyScope; id: string } | { ok: false; status: number; error: string }> {
  await ensureKeys(sql);
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const token = bearer || request.headers.get("x-api-key")?.trim() || "";
  if (!token) return { ok: false, status: 401, error: "Missing API key. Send Authorization: Bearer or X-Api-Key." };
  const hash = await hashToken(token);
  const rows = await sql<{ id: string; scope: KeyScope; revoked_at: string | Date | null }>`
    select id, scope, revoked_at from api_keys where hash = ${hash}
  `;
  const row = rows[0];
  if (!row) return { ok: false, status: 401, error: "Unknown API key." };
  if (row.revoked_at) return { ok: false, status: 403, error: "API key revoked." };
  await sql`update api_keys set last_used_at = now() where id = ${row.id}`;
  return { ok: true, scope: row.scope, id: row.id };
}

function allows(have: KeyScope, need: KeyScope) {
  if (need === "read") return true;
  if (need === "write") return have === "write" || have === "operator";
  return have === "operator";
}

export function corsHeaders(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("Access-Control-Allow-Origin", "*");
  h.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  h.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Api-Key, MCP-Protocol-Version");
  h.set("Access-Control-Expose-Headers", "MCP-Protocol-Version");
  h.set("MCP-Protocol-Version", "2025-03-26");
  return h;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ "Content-Type": "application/json; charset=utf-8" }),
  });
}

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureKeys(sql);
    await requireAdmin(sql, context.userId);
    const rows = await sql<{
      id: string;
      label: string;
      prefix: string;
      scope: KeyScope;
      last_used_at: string | Date | null;
      created_at: string | Date;
      revoked_at: string | Date | null;
    }>`select id, label, prefix, scope, last_used_at, created_at, revoked_at from api_keys order by created_at desc`;
    return rows.map(
      (r): AgentKey => ({
        id: r.id,
        label: r.label,
        prefix: r.prefix,
        scope: r.scope,
        lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
        createdAt: new Date(r.created_at).toISOString(),
        revoked: Boolean(r.revoked_at),
      }),
    );
  });

export const mintApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { label: string; scope: KeyScope }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureKeys(sql);
    await requireAdmin(sql, context.userId);
    const scope: KeyScope =
      data.scope === "operator" || data.scope === "write" ? data.scope : "read";
    const raw = `she_${await randomHex(24)}`;
    const id = `key_${await randomHex(8)}`;
    await sql`
      insert into api_keys (id, label, prefix, hash, scope)
      values (${id}, ${data.label.trim() || "Agent"}, ${raw.slice(0, 12)}, ${await hashToken(raw)}, ${scope})
    `;
    return { id, token: raw, prefix: raw.slice(0, 12), scope };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureKeys(sql);
    await requireAdmin(sql, context.userId);
    await sql`update api_keys set revoked_at = now() where id = ${data.id}`;
    return { ok: true };
  });

type Params = Record<string, unknown>;

function str(p: Params, k: string) {
  const v = p[k];
  return typeof v === "string" ? v : "";
}
function num(p: Params, k: string) {
  const v = p[k];
  return typeof v === "number" ? v : Number(v);
}
function bool(p: Params, k: string) {
  return Boolean(p[k]);
}

export async function runOp(
  sql: Sql,
  scope: KeyScope,
  op: string,
  params: Params = {},
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  const need = NEED[op];
  if (!need) return { ok: false, status: 404, error: `Unknown operation '${op}'.` };
  if (!allows(scope, need)) {
    return { ok: false, status: 403, error: `Scope '${scope}' cannot run '${op}' (needs ${need}).` };
  }
  await ensureCatalog(sql);
  try {
    const data = await dispatch(sql, op, params);
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Operation failed.";
    return { ok: false, status: 400, error: msg };
  }
}

async function dispatch(sql: Sql, op: string, p: Params): Promise<unknown> {
  switch (op) {
    case "health":
      return {
        ok: true,
        name: "SHE UNDRESSES",
        protocol: "2025-03-26",
        rest: "/api/v1",
        mcp: "/api/mcp",
      };
    case "list_ladders": {
      const ladders = await sql<{
        id: string;
        slug: string;
        title: string;
        theme: string;
        tagline: string;
        bundle_discount: string | number;
        collectors_count: number;
        published: boolean;
        model_id: string | null;
      }>`select id, slug, title, theme, tagline, bundle_discount, collectors_count, published, model_id from ladders order by sort_order`;
      const counts = await sql<{ ladder_id: string; c: number }>`
        select ladder_id, count(*)::int as c from shots group by ladder_id
      `;
      const by = new Map(counts.map((c) => [c.ladder_id, c.c]));
      const muses = await loadMuseBibles(sql);
      return ladders.map((l) => {
        const muse = muses.get(l.model_id || "") ?? null;
        return {
          ...l,
          bundleDiscount: Number(l.bundle_discount),
          shotCount: by.get(l.id) ?? 0,
          modelName: muse?.stageName ?? null,
        };
      });
    }
    case "get_ladder": {
      const slug = str(p, "slug") || str(p, "id");
      const lad = await sql<{ id: string; slug: string; title: string }>`
        select id, slug, title from ladders where slug = ${slug} or id = ${slug}
      `;
      if (!lad[0]) throw new Error("Ladder not found.");
      const shots = await sql`
        select id, step_index, title, tease, grant_copy, story, drop_line, media_type,
               price_cents, is_climax from shots
        where ladder_id = ${lad[0].id} order by step_index
      `;
      return { ...lad[0], shots };
    }
    case "get_analytics": {
      const unlockAgg = await sql<{ revenue: string | number; unlocks: number }>`
        select coalesce(sum(amount_cents), 0) as revenue, count(*)::int as unlocks from unlocks
      `;
      const invoices = await sql<{ c: number }>`select count(*)::int as c from invoices where status = 'paid'`;
      const views = await sql<{ c: number }>`select count(*)::int as c from events where kind = 'view'`;
      const by = await sql<{ ladder_id: string; title: string; revenue: string | number; unlocks: number }>`
        select l.id as ladder_id, l.title,
               coalesce(sum(u.amount_cents), 0) as revenue,
               count(u.id)::int as unlocks
        from ladders l
        left join unlocks u on u.ladder_id = l.id
        group by l.id, l.title
      `;
      return {
        revenueCents: Number(unlockAgg[0]?.revenue ?? 0),
        unlockCount: unlockAgg[0]?.unlocks ?? 0,
        invoiceCount: invoices[0]?.c ?? 0,
        views: views[0]?.c ?? 0,
        byLadder: by.map((r) => ({
          ladderId: r.ladder_id,
          title: r.title,
          revenueCents: Number(r.revenue),
          unlocks: r.unlocks,
        })),
      };
    }
    case "get_dials": {
      const dials = await loadDials(sql);
      const surfaces = await loadSurfaces(sql, dials);
      return { dials, surfaces };
    }
    case "set_dials": {
      const data = normalizeDials(p as Partial<Dials>);
      await sql`
        insert into psychology_dials (
          id, urgency, scarcity, tease, sunk_cost, social_proof, fetish_heat, addiction, updated_at
        ) values (
          1, ${data.urgency}, ${data.scarcity}, ${data.tease}, ${data.sunkCost},
          ${data.socialProof}, ${data.fetishHeat}, ${data.addiction}, now()
        )
        on conflict (id) do update set
          urgency = excluded.urgency,
          scarcity = excluded.scarcity,
          tease = excluded.tease,
          sunk_cost = excluded.sunk_cost,
          social_proof = excluded.social_proof,
          fetish_heat = excluded.fetish_heat,
          addiction = excluded.addiction,
          updated_at = now()
      `;
      return data;
    }
    case "list_models": {
      await ensureLegal(sql);
      return loadModels(sql);
    }
    case "get_legal": {
      await ensureLegal(sql);
      const entity = await loadEntity(sql);
      const models = await loadModels(sql);
      const slug = str(p, "slug");
      if (slug) {
        const rows = await sql<{ slug: string; title: string; body: string; kind: string; version: number }>`
          select slug, title, body, kind, version from legal_docs where slug = ${slug}
        `;
        return rows[0] ?? null;
      }
      const docs = await sql<{ slug: string; title: string; kind: string; scope: string; version: number }>`
        select slug, title, kind, scope, version from legal_docs order by scope, slug
      `;
      return { entity, models, docs };
    }
    case "list_events": {
      const rows = await sql`
        select id, kind, ladder_id, created_at, meta from events order by created_at desc limit 40
      `;
      return rows;
    }
    case "create_ladder": {
      const modelId = str(p, "modelId") || str(p, "museId");
      const title = str(p, "title");
      if (!modelId || !title) throw new Error("modelId and title required.");
      const muse = await bibleFor(sql, modelId);
      if (muse.id === "mod_liora" && modelId !== "mod_liora") {
        throw new Error("Muse not found. upsert_model first.");
      }
      const { slugify } = await import("./muse-lookup");
      const slug =
        slugify(str(p, "slug") || title) || `set-${Date.now().toString(36)}`;
      const taken = await sql<{ c: number }>`select count(*)::int as c from ladders where slug = ${slug}`;
      if ((taken[0]?.c ?? 0) > 0) throw new Error("Slug in use.");
      const sort = await sql<{ m: number }>`select coalesce(max(sort_order), 0)::int as m from ladders`;
      const id = `lad_${slug}`.slice(0, 40);
      const hook = str(p, "tagline") || `${muse.stageName} only opens this set in order.`;
      const tease =
        str(p, "description") ||
        `${muse.stageName}'s photoset. Nine yeses. She undresses for the man who stays.`;
      const coverIn = str(p, "coverUrl") || "/media/portrait.jpg";
      const theme = str(p, "theme") || "frontal";
      const { persistSeoMedia } = await import("./seo-media.server");
      const cover = await persistSeoMedia({
        srcUrl: coverIn,
        museSlug: muse.slug,
        step: 0,
        title,
        beat: "cover",
      });
      await sql`
        insert into ladders (
          id, slug, title, theme, tagline, description, cover_url, sort_order,
          bundle_discount, collectors_count, climax_collectors, scarcity_ends_at,
          model_id, photoset_hook, photoset_tease, published
        ) values (
          ${id}, ${slug}, ${title}, ${theme}, ${hook}, ${tease}, ${cover},
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
      await sql`update models set ladder_slugs = ${slugs.join(",")}, updated_at = now() where id = ${muse.id}`;
      return { id, slug, modelId: muse.id, modelName: muse.stageName };
    }
    case "update_ladder": {
      const id = str(p, "id") || str(p, "ladderId");
      if (!id) throw new Error("id required.");
      const existing = await sql<{
        title: string;
        tagline: string;
        bundle_discount: string | number;
        published: boolean;
      }>`select title, tagline, bundle_discount, published from ladders where id = ${id}`;
      if (!existing[0]) throw new Error("Ladder not found.");
      const title = str(p, "title") || existing[0].title;
      const tagline = str(p, "tagline") || existing[0].tagline;
      const disc =
        p.bundleDiscount != null
          ? Math.min(0.7, Math.max(0, num(p, "bundleDiscount")))
          : Number(existing[0].bundle_discount);
      const published = p.published != null ? bool(p, "published") : existing[0].published;
      await sql`
        update ladders
        set title = ${title}, tagline = ${tagline}, bundle_discount = ${disc}, published = ${published}
        where id = ${id}
      `;
      return { ok: true, id };
    }
    case "add_shot": {
      const ladderId = str(p, "ladderId");
      const title = str(p, "title");
      const mediaUrl = str(p, "mediaUrl");
      if (!ladderId || !title || !mediaUrl) throw new Error("ladderId, title, mediaUrl required.");
      const max = await sql<{ m: number }>`
        select coalesce(max(step_index), 0)::int as m from shots where ladder_id = ${ladderId}
      `;
      const step = (max[0]?.m ?? 0) + 1;
      const id = `shot_${Date.now().toString(36)}${await randomHex(3)}`;
      const mediaType = str(p, "mediaType") === "video" ? "video" : "photo";
      const price = Math.max(0, Math.round(num(p, "priceCents") || 499));
      const lad = await sql<{ model_id: string | null }>`
        select model_id from ladders where id = ${ladderId}
      `;
      const muse = await bibleFor(sql, lad[0]?.model_id);
      const { vaultShotMedia } = await import("./grant-media.server");
      const packed = await vaultShotMedia({
        srcUrl: mediaUrl,
        shotId: id,
        museSlug: muse.slug,
        step,
        title,
        beat: str(p, "visualBeat"),
        mediaType,
      });
      await sql`
        insert into shots (
          id, ladder_id, step_index, title, tease, grant_copy, media_type,
          media_url, object_position, price_cents, is_climax, visual_beat, teaser_url
        ) values (
          ${id}, ${ladderId}, ${step}, ${title}, ${str(p, "tease") || title},
          ${str(p, "grantCopy") || `You've been granted ${title}.`}, ${mediaType},
          ${packed.grantUrl}, 'center', ${price}, ${bool(p, "isClimax")},
          ${str(p, "visualBeat")}, ${packed.teaserUrl}
        )
      `;
      if (step === 1) {
        await sql`update ladders set published = true where id = ${ladderId}`;
      }
      return { id, step, mediaUrl: packed.teaserUrl };
    }
    case "set_shot_price": {
      const shotId = str(p, "shotId") || str(p, "id");
      const cents = Math.max(0, Math.round(num(p, "priceCents")));
      if (!shotId) throw new Error("shotId required.");
      await sql`update shots set price_cents = ${cents} where id = ${shotId}`;
      return { ok: true, shotId, priceCents: cents };
    }
    case "write_ladder_copy": {
      const ladderId = str(p, "ladderId") || str(p, "id");
      const lad = await sql<{ id: string }>`
        select id from ladders where id = ${ladderId} or slug = ${ladderId}
      `;
      if (!lad[0]) throw new Error("Ladder not found.");
      const wrote = await writeLadderCopy(sql, lad[0].id);
      if (!wrote.ok) throw new Error(wrote.error);
      return wrote;
    }
    case "auto_write_ladder": {
      const ladderId = str(p, "ladderId") || str(p, "id") || str(p, "slug");
      const lad = await sql<{ id: string }>`
        select id from ladders where id = ${ladderId} or slug = ${ladderId}
      `;
      if (!lad[0]) throw new Error("Ladder not found.");
      const wrote = await autoWriteLadder(sql, lad[0].id);
      if (!wrote.ok) throw new Error(wrote.error);
      return wrote;
    }
    case "write_surfaces": {
      const ladders = await sql<{ title: string; theme: string }>`
        select title, theme from ladders where published = true order by sort_order
      `;
      const dials = await loadDials(sql);
      const grok = await grokJson(SURFACE_SYSTEM, surfaceUserMessage({ dials, ladders }), 900);
      if (!grok.ok) throw new Error(grok.error);
      let parsed: Partial<Surfaces> = {};
      try {
        parsed = JSON.parse(extractJson(grok.text) || "{}") as Partial<Surfaces>;
      } catch {
        throw new Error("Grok returned no usable surface copy.");
      }
      const merged = mergeSurfaces(dials, parsed);
      await sql`
        alter table psychology_dials add column if not exists surface_json text not null default ''
      `;
      await sql`
        update psychology_dials set surface_json = ${JSON.stringify(merged)}, updated_at = now() where id = 1
      `;
      return { ok: true, surfaces: merged };
    }
    case "regenerate_legal": {
      await ensureLegal(sql);
      await regenerateAll(sql);
      return { ok: true };
    }
    case "save_legal_entity": {
      await ensureLegal(sql);
      const e = p as Partial<LegalEntity>;
      const cur = await loadEntity(sql);
      const next: LegalEntity = {
        siteName: e.siteName ?? cur.siteName,
        entityName: e.entityName ?? cur.entityName,
        jurisdiction: e.jurisdiction ?? cur.jurisdiction,
        custodianName: e.custodianName ?? cur.custodianName,
        custodianTitle: e.custodianTitle ?? cur.custodianTitle,
        address1: e.address1 ?? cur.address1,
        address2: e.address2 ?? cur.address2,
        city: e.city ?? cur.city,
        region: e.region ?? cur.region,
        postal: e.postal ?? cur.postal,
        country: e.country ?? cur.country,
        contactEmail: e.contactEmail ?? cur.contactEmail,
        dmcaEmail: e.dmcaEmail ?? cur.dmcaEmail,
        websiteUrl: e.websiteUrl ?? cur.websiteUrl,
      };
      await sql`
        update legal_entity set
          site_name = ${next.siteName}, entity_name = ${next.entityName},
          jurisdiction = ${next.jurisdiction}, custodian_name = ${next.custodianName},
          custodian_title = ${next.custodianTitle}, address1 = ${next.address1},
          address2 = ${next.address2}, city = ${next.city}, region = ${next.region},
          postal = ${next.postal}, country = ${next.country},
          contact_email = ${next.contactEmail}, dmca_email = ${next.dmcaEmail},
          website_url = ${next.websiteUrl}, updated_at = now()
        where id = 1
      `;
      await regenerateAll(sql);
      return next;
    }
    case "upsert_model": {
      await ensureLegal(sql);
      const stageName = str(p, "stageName");
      const slug = str(p, "slug") || stageName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (!stageName || !slug) throw new Error("stageName required.");
      const kind: ContentKind =
        str(p, "contentKind") === "human" || str(p, "contentKind") === "hybrid"
          ? (str(p, "contentKind") as ContentKind)
          : "synthetic";
      const age = Math.max(21, Math.round(num(p, "portrayedAgeMin") || 24));
      const id = str(p, "id") || `mod_${slug}`;
      const bio =
        str(p, "bio") ||
        `${stageName} is an adult muse on SHE UNDRESSES. Sequential unlock photosets — she undresses in order, one paid yes at a time. Portrayed ${age}+.`;
      await sql`
        insert into models (
          id, slug, stage_name, content_kind, portrayed_age_min, aliases, bio,
          is_fictional, likeness_ok, records_on_file, id_type_on_file, first_produced,
          ladder_slugs, card_portrayal, voice, looks, tease_style, updated_at
        ) values (
          ${id}, ${slug}, ${stageName}, ${kind}, ${age},
          ${str(p, "aliases")}, ${bio},
          ${p.isFictional == null ? kind === "synthetic" : bool(p, "isFictional")},
          ${p.likenessOk == null ? true : bool(p, "likenessOk")},
          ${bool(p, "recordsOnFile")}, ${str(p, "idTypeOnFile")},
          ${str(p, "firstProduced") || new Date().toISOString().slice(0, 10)},
          ${str(p, "ladderSlugs")}, ${str(p, "cardPortrayal")},
          ${str(p, "voice")}, ${str(p, "looks")}, ${str(p, "teaseStyle")}, now()
        )
        on conflict (id) do update set
          slug = excluded.slug, stage_name = excluded.stage_name,
          content_kind = excluded.content_kind, portrayed_age_min = excluded.portrayed_age_min,
          aliases = excluded.aliases, bio = excluded.bio, is_fictional = excluded.is_fictional,
          likeness_ok = excluded.likeness_ok, records_on_file = excluded.records_on_file,
          id_type_on_file = excluded.id_type_on_file, first_produced = excluded.first_produced,
          ladder_slugs = excluded.ladder_slugs, card_portrayal = excluded.card_portrayal,
          voice = excluded.voice, looks = excluded.looks, tease_style = excluded.tease_style,
          updated_at = now()
      `;
      await regenerateAll(sql);
      return { id, slug, stageName, contentKind: kind };
    }
    case "write_model_card": {
      await ensureLegal(sql);
      const modelId = str(p, "modelId") || str(p, "id") || str(p, "slug");
      const rows = await sql<{
        id: string;
        slug: string;
        stage_name: string;
        content_kind: ContentKind;
        portrayed_age_min: number;
        aliases: string;
        bio: string;
        is_fictional: boolean;
        likeness_ok: boolean;
        records_on_file: boolean;
        id_type_on_file: string;
        first_produced: string;
        ladder_slugs: string;
        card_portrayal: string;
        voice: string | null;
        looks: string | null;
        tease_style: string | null;
      }>`select * from models where id = ${modelId} or slug = ${modelId}`;
      const row = rows[0];
      if (!row) throw new Error("Model not found.");
      const model: MuseModel = {
        id: row.id,
        slug: row.slug,
        stageName: row.stage_name,
        contentKind: row.content_kind,
        portrayedAgeMin: row.portrayed_age_min,
        aliases: row.aliases,
        bio: row.bio,
        isFictional: row.is_fictional,
        likenessOk: row.likeness_ok,
        recordsOnFile: row.records_on_file,
        idTypeOnFile: row.id_type_on_file,
        firstProduced: row.first_produced,
        ladderSlugs: row.ladder_slugs,
        cardPortrayal: row.card_portrayal,
        voice: row.voice ?? "",
        looks: row.looks ?? "",
        teaseStyle: row.tease_style ?? "",
      };
      const entity = await loadEntity(sql);
      const prompt = modelCardPrompt(model, entity);
      const grok = await grokJson(prompt.system, prompt.user, 500);
      if (!grok.ok) throw new Error(grok.error);
      let portrayal = "";
      try {
        const json = JSON.parse(extractJson(grok.text) || "{}") as { portrayal?: string };
        portrayal = (json.portrayal ?? "").trim();
      } catch {
        throw new Error("Grok returned no portrayal.");
      }
      if (!portrayal) throw new Error("Empty portrayal.");
      await sql`update models set card_portrayal = ${portrayal}, updated_at = now() where id = ${model.id}`;
      await regenerateAll(sql);
      return { ok: true, portrayal };
    }
    default:
      throw new Error("Unknown operation.");
  }
}

export const OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "SHE UNDRESSES Agent API",
    version: "1.0.0",
    description:
      "REST + MCP connectors so n8n, Claude, Grok, and other agents can operate the vault. Authenticate with Authorization: Bearer <key> or X-Api-Key.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearer: { type: "http", scheme: "bearer" },
      apiKey: { type: "apiKey", in: "header", name: "X-Api-Key" },
    },
  },
  security: [{ bearer: [] }, { apiKey: [] }],
  paths: {
    "/health": { get: { summary: "Health", operationId: "health" } },
    "/catalog": { get: { summary: "List ladders", operationId: "list_ladders" } },
    "/ladders": { post: { summary: "Create a photoset for a muse", operationId: "create_ladder" } },
    "/ladders/{slug}": { get: { summary: "Ladder + shots", operationId: "get_ladder" } },
    "/analytics": { get: { summary: "Revenue and conversion", operationId: "get_analytics" } },
    "/dials": {
      get: { summary: "Psychology dials", operationId: "get_dials" },
      put: { summary: "Set dials (operator)", operationId: "set_dials" },
    },
    "/models": {
      get: { summary: "Loaded muses", operationId: "list_models" },
      post: { summary: "Load / update a model (auto legal pack)", operationId: "upsert_model" },
    },
    "/legal": { get: { summary: "Legal hub + docs", operationId: "get_legal" } },
    "/legal/regenerate": { post: { summary: "Rebuild legal pack", operationId: "regenerate_legal" } },
    "/transporter": { post: { summary: "Rewrite a ladder with Grok", operationId: "write_ladder_copy" } },
    "/transporter/auto": { post: { summary: "See frames then write copy", operationId: "auto_write_ladder" } },
    "/transporter/surfaces": { post: { summary: "Rewrite site surfaces", operationId: "write_surfaces" } },
    "/shots": { post: { summary: "Add a shot", operationId: "add_shot" } },
    "/events": { get: { summary: "Recent events", operationId: "list_events" } },
  },
};

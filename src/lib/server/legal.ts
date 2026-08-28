import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import {
  DEFAULT_ENTITY,
  LIORA_SEED,
  type ContentKind,
  type LegalDoc,
  type LegalEntity,
  type MuseModel,
} from "@/lib/legal-types";
import { buildModelDocs, buildSiteDocs, modelCardPrompt } from "@/lib/legal-templates";

type EntityRow = {
  site_name: string;
  entity_name: string;
  jurisdiction: string;
  custodian_name: string;
  custodian_title: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  contact_email: string;
  dmca_email: string;
  website_url: string;
};

type ModelRow = {
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
};

type DocRow = {
  id: string;
  scope: "site" | "model";
  model_id: string | null;
  kind: string;
  slug: string;
  title: string;
  body: string;
  version: number;
  generated_at: string | Date;
};

let legalReady = false;

function mapEntity(r: EntityRow | undefined): LegalEntity {
  if (!r) return { ...DEFAULT_ENTITY };
  return {
    siteName: r.site_name,
    entityName: r.entity_name,
    jurisdiction: r.jurisdiction,
    custodianName: r.custodian_name,
    custodianTitle: r.custodian_title,
    address1: r.address1,
    address2: r.address2,
    city: r.city,
    region: r.region,
    postal: r.postal,
    country: r.country,
    contactEmail: r.contact_email,
    dmcaEmail: r.dmca_email,
    websiteUrl: r.website_url,
  };
}

function mapModel(r: ModelRow): MuseModel {
  return {
    id: r.id,
    slug: r.slug,
    stageName: r.stage_name,
    contentKind: r.content_kind,
    portrayedAgeMin: r.portrayed_age_min,
    aliases: r.aliases,
    bio: r.bio,
    isFictional: r.is_fictional,
    likenessOk: r.likeness_ok,
    recordsOnFile: r.records_on_file,
    idTypeOnFile: r.id_type_on_file,
    firstProduced: r.first_produced,
    ladderSlugs: r.ladder_slugs,
    cardPortrayal: r.card_portrayal,
    voice: r.voice ?? "",
    looks: r.looks ?? "",
    teaseStyle: r.tease_style ?? "",
  };
}

function mapDoc(r: DocRow): LegalDoc {
  return {
    id: r.id,
    scope: r.scope,
    modelId: r.model_id,
    kind: r.kind,
    slug: r.slug,
    title: r.title,
    body: r.body,
    version: r.version,
    generatedAt: new Date(r.generated_at).toISOString(),
  };
}

export async function ensureLegal(sql: Sql) {
  if (legalReady) return;
  await sql`
    create table if not exists legal_entity (
      id int primary key default 1,
      site_name text not null default 'SHE UNDRESSES',
      entity_name text not null default '',
      jurisdiction text not null default 'Washington, United States',
      custodian_name text not null default '',
      custodian_title text not null default 'Custodian of Records',
      address1 text not null default '',
      address2 text not null default '',
      city text not null default '',
      region text not null default 'WA',
      postal text not null default '',
      country text not null default 'United States',
      contact_email text not null default '',
      dmca_email text not null default '',
      website_url text not null default '',
      updated_at timestamptz not null default now()
    )
  `;
  await sql`insert into legal_entity (id) values (1) on conflict (id) do nothing`;
  await sql`
    update legal_entity
    set website_url = ${DEFAULT_ENTITY.websiteUrl}, updated_at = now()
    where id = 1 and btrim(coalesce(website_url, '')) = ''
  `;
  await sql`
    create table if not exists models (
      id text primary key,
      slug text unique not null,
      stage_name text not null,
      content_kind text not null default 'synthetic',
      portrayed_age_min int not null default 24,
      aliases text not null default '',
      bio text not null default '',
      is_fictional boolean not null default true,
      likeness_ok boolean not null default true,
      records_on_file boolean not null default false,
      id_type_on_file text not null default '',
      first_produced text not null default '',
      ladder_slugs text not null default '',
      card_portrayal text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table models add column if not exists voice text not null default ''`;
  await sql`alter table models add column if not exists looks text not null default ''`;
  await sql`alter table models add column if not exists tease_style text not null default ''`;
  await sql`
    create table if not exists legal_docs (
      id text primary key,
      scope text not null,
      model_id text,
      kind text not null,
      slug text unique not null,
      title text not null,
      body text not null,
      version int not null default 1,
      generated_at timestamptz not null default now()
    )
  `;
  const existing = await sql<{ c: number }>`select count(*)::int as c from models`;
  if ((existing[0]?.c ?? 0) === 0) {
    const m = LIORA_SEED;
    await sql`
      insert into models (
        id, slug, stage_name, content_kind, portrayed_age_min, aliases, bio,
        is_fictional, likeness_ok, records_on_file, id_type_on_file, first_produced,
        ladder_slugs, card_portrayal, voice, looks, tease_style
      ) values (
        ${m.id}, ${m.slug}, ${m.stageName}, ${m.contentKind}, ${m.portrayedAgeMin},
        ${m.aliases}, ${m.bio}, ${m.isFictional}, ${m.likenessOk}, ${m.recordsOnFile},
        ${m.idTypeOnFile}, ${m.firstProduced}, ${m.ladderSlugs}, ${m.cardPortrayal},
        ${m.voice}, ${m.looks}, ${m.teaseStyle}
      )
    `;
  } else {
    await sql`
      update models
      set voice = ${LIORA_SEED.voice},
          looks = ${LIORA_SEED.looks},
          tease_style = ${LIORA_SEED.teaseStyle},
          bio = ${LIORA_SEED.bio}
      where id = ${LIORA_SEED.id} and voice = ''
    `;
  }
  const docs = await sql<{ c: number }>`select count(*)::int as c from legal_docs`;
  if ((docs[0]?.c ?? 0) === 0) {
    await regenerateAll(sql);
  }
  legalReady = true;
}

async function upsertDocs(sql: Sql, docs: ReturnType<typeof buildSiteDocs>) {
  for (const d of docs) {
    await sql`
      insert into legal_docs (id, scope, model_id, kind, slug, title, body, version, generated_at)
      values (
        ${d.id}, ${d.scope}, ${d.modelId}, ${d.kind}, ${d.slug}, ${d.title}, ${d.body},
        1, now()
      )
      on conflict (slug) do update set
        title = excluded.title,
        body = excluded.body,
        kind = excluded.kind,
        scope = excluded.scope,
        model_id = excluded.model_id,
        version = legal_docs.version + 1,
        generated_at = now()
    `;
  }
}

export async function loadEntity(sql: Sql): Promise<LegalEntity> {
  const rows = await sql<EntityRow>`select * from legal_entity where id = 1`;
  return mapEntity(rows[0]);
}

export async function loadModels(sql: Sql): Promise<MuseModel[]> {
  const rows = await sql<ModelRow>`select * from models order by stage_name`;
  return rows.map(mapModel);
}

export async function regenerateAll(sql: Sql) {
  const entity = await loadEntity(sql);
  const models = await loadModels(sql);
  await upsertDocs(sql, buildSiteDocs(entity, models));
  for (const m of models) {
    await upsertDocs(sql, buildModelDocs(entity, m));
  }
}

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

export const getLegalBundle = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureCatalog(sql);
  await ensureLegal(sql);
  const entity = await loadEntity(sql);
  const models = await loadModels(sql);
  const docs = await sql<DocRow>`select * from legal_docs order by scope, slug`;
  return { entity, models, docs: docs.map(mapDoc) };
});

export const getLegalDoc = createServerFn({ method: "GET" })
  .validator((d: { slug: string }) => d)
  .handler(async ({ data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    const rows = await sql<DocRow>`select * from legal_docs where slug = ${data.slug}`;
    return rows[0] ? mapDoc(rows[0]) : null;
  });

export const saveLegalEntity = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: LegalEntity) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    await sql`
      insert into legal_entity (
        id, site_name, entity_name, jurisdiction, custodian_name, custodian_title,
        address1, address2, city, region, postal, country, contact_email, dmca_email,
        website_url, updated_at
      ) values (
        1, ${data.siteName}, ${data.entityName}, ${data.jurisdiction}, ${data.custodianName},
        ${data.custodianTitle}, ${data.address1}, ${data.address2}, ${data.city}, ${data.region},
        ${data.postal}, ${data.country}, ${data.contactEmail}, ${data.dmcaEmail},
        ${data.websiteUrl}, now()
      )
      on conflict (id) do update set
        site_name = excluded.site_name,
        entity_name = excluded.entity_name,
        jurisdiction = excluded.jurisdiction,
        custodian_name = excluded.custodian_name,
        custodian_title = excluded.custodian_title,
        address1 = excluded.address1,
        address2 = excluded.address2,
        city = excluded.city,
        region = excluded.region,
        postal = excluded.postal,
        country = excluded.country,
        contact_email = excluded.contact_email,
        dmca_email = excluded.dmca_email,
        website_url = excluded.website_url,
        updated_at = now()
    `;
    await regenerateAll(sql);
    return loadEntity(sql);
  });

export async function upsertMuseModel(sql: Sql, data: MuseModel): Promise<MuseModel> {
  if (data.portrayedAgeMin < 21) {
    throw new Error("Portrayed age must be 21 or older.");
  }
  const kind: ContentKind =
    data.contentKind === "human" || data.contentKind === "hybrid"
      ? data.contentKind
      : "synthetic";
  let id = data.id || `mod_${data.slug}`;
  let slug = data.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (!slug || !data.stageName.trim()) throw new Error("Stage name and slug required.");
  const reserved = new Set([
    "terms",
    "privacy",
    "cookies",
    "refund",
    "dmca",
    "ai-disclosure",
    "2257",
    "models",
  ]);
  if (reserved.has(slug)) throw new Error("That slug is reserved for a site legal page.");
  const taken = await sql<{ id: string }>`select id from models where slug = ${slug}`;
  if (taken[0] && taken[0].id !== id) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    if (!data.id) id = `mod_${slug}`;
  }
  const bio =
    data.bio.trim() ||
    `${data.stageName.trim()} is an adult muse on SHE UNDRESSES. Sequential unlock photosets — she undresses in order, one paid yes at a time. Portrayed ${data.portrayedAgeMin}+.`;
  await sql`
    insert into models (
      id, slug, stage_name, content_kind, portrayed_age_min, aliases, bio,
      is_fictional, likeness_ok, records_on_file, id_type_on_file, first_produced,
      ladder_slugs, card_portrayal, voice, looks, tease_style, updated_at
    ) values (
      ${id}, ${slug}, ${data.stageName.trim()}, ${kind}, ${data.portrayedAgeMin},
      ${data.aliases}, ${bio}, ${data.isFictional}, ${data.likenessOk},
      ${data.recordsOnFile}, ${data.idTypeOnFile}, ${data.firstProduced || new Date().toISOString().slice(0, 10)},
      ${data.ladderSlugs}, ${data.cardPortrayal}, ${data.voice}, ${data.looks}, ${data.teaseStyle}, now()
    )
    on conflict (id) do update set
      slug = excluded.slug,
      stage_name = excluded.stage_name,
      content_kind = excluded.content_kind,
      portrayed_age_min = excluded.portrayed_age_min,
      aliases = excluded.aliases,
      bio = excluded.bio,
      is_fictional = excluded.is_fictional,
      likeness_ok = excluded.likeness_ok,
      records_on_file = excluded.records_on_file,
      id_type_on_file = excluded.id_type_on_file,
      first_produced = excluded.first_produced,
      ladder_slugs = excluded.ladder_slugs,
      card_portrayal = excluded.card_portrayal,
      voice = excluded.voice,
      looks = excluded.looks,
      tease_style = excluded.tease_style,
      updated_at = now()
  `;
  const rows = await sql<ModelRow>`select * from models where id = ${id}`;
  return rows[0] ? mapModel(rows[0]) : { ...data, id, slug, contentKind: kind, bio };
}

export const saveModel = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: MuseModel) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const saved = await upsertMuseModel(sql, data);
    await regenerateAll(sql);
    return saved;
  });

export const regenerateLegal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    await regenerateAll(sql);
    const docs = await sql<DocRow>`select * from legal_docs order by scope, slug`;
    return docs.map(mapDoc);
  });

export const writeModelCard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { modelId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const rows = await sql<ModelRow>`select * from models where id = ${data.modelId}`;
    const model = rows[0] ? mapModel(rows[0]) : null;
    if (!model) throw new Error("Model not found.");
    const entity = await loadEntity(sql);
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Grok is not available in this environment." };
    const p = modelCardPrompt(model, entity);
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.6,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: p.system },
          { role: "user", content: p.user },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, error: `Grok error ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    let portrayal = "";
    try {
      const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
        portrayal?: string;
      };
      portrayal = (json.portrayal ?? "").trim();
    } catch {
      return { ok: false as const, error: "Grok returned no portrayal." };
    }
    if (!portrayal) return { ok: false as const, error: "Empty portrayal." };
    await sql`
      update models set card_portrayal = ${portrayal}, updated_at = now() where id = ${model.id}
    `;
    await regenerateAll(sql);
    return { ok: true as const, portrayal };
  });

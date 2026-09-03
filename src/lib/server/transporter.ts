import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { bibleFor } from "./muse-lookup";
import { COPY_REV } from "@/lib/copy";
import {
  SURFACE_SYSTEM,
  TRANSPORTER_SYSTEM,
  surfaceUserMessage,
  transporterUserMessage,
} from "@/lib/prompt-pack";
import {
  DEFAULT_DIALS,
  mergeSurfaces,
  normalizeDials,
  parseSurfaces,
  type Dials,
  type Surfaces,
} from "@/lib/psychology";

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

let surfaceColumnReady = false;

async function ensureSurfaceColumn(sql: Sql) {
  if (surfaceColumnReady) return;
  await sql`
    alter table psychology_dials
    add column if not exists surface_json text not null default ''
  `;
  await sql`
    alter table psychology_dials
    add column if not exists copy_rev text not null default ''
  `;
  surfaceColumnReady = true;
}

export async function loadDials(sql: Sql): Promise<Dials> {
  await sql`
    insert into psychology_dials (id) values (1) on conflict (id) do nothing
  `;
  const rows = await sql<{
    urgency: number;
    scarcity: number;
    tease: number;
    sunk_cost: number;
    social_proof: number;
    fetish_heat: number;
    addiction: number;
  }>`select urgency, scarcity, tease, sunk_cost, social_proof, fetish_heat, addiction from psychology_dials where id = 1`;
  const r = rows[0];
  if (!r) return DEFAULT_DIALS;
  return normalizeDials({
    urgency: r.urgency,
    scarcity: r.scarcity,
    tease: r.tease,
    sunkCost: r.sunk_cost,
    socialProof: r.social_proof,
    fetishHeat: r.fetish_heat,
    addiction: r.addiction,
  });
}

export async function loadSurfaces(sql: Sql, dials: Dials): Promise<Surfaces> {
  await ensureSurfaceColumn(sql);
  await sql`
    update psychology_dials
    set surface_json = '', copy_rev = ${COPY_REV}
    where id = 1 and copy_rev <> ${COPY_REV}
  `;
  const rows = await sql<{ surface_json: string }>`
    select surface_json from psychology_dials where id = 1
  `;
  return mergeSurfaces(dials, parseSurfaces(rows[0]?.surface_json));
}

type ShotCopy = { id: string; tease: string; grant: string; story: string; drop: string };

export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}

export function parseLadderCopy(text: string): {
  tagline?: string;
  description?: string;
  shots: ShotCopy[];
} {
  try {
    const json = JSON.parse(extractJson(text) || "{}") as {
      tagline?: string;
      description?: string;
      shots?: ShotCopy[];
    };
    const shots = Array.isArray(json.shots)
      ? json.shots.filter((s) => s && typeof s.id === "string")
      : [];
    return {
      tagline: typeof json.tagline === "string" ? json.tagline : undefined,
      description: typeof json.description === "string" ? json.description : undefined,
      shots,
    };
  } catch {
    return { shots: [] };
  }
}

export async function grokJson(system: string, user: string, maxTokens: number) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "Grok is not available in this environment." };
  }
  const payload = JSON.stringify({
    model: "grok-4.5",
    temperature: 0.8,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const transient = new Set([408, 425, 429, 500, 502, 503, 504]);
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });
    lastStatus = res.status;
    if (res.ok) {
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content ?? "";
      return { ok: true as const, text };
    }
    if (!transient.has(res.status) || attempt === 2) break;
    await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
  }
  if (lastStatus === 503) {
    return {
      ok: false as const,
      error: "Grok is overloaded (503). Wait a minute and try again. No photoset images were generated.",
    };
  }
  return { ok: false as const, error: `Grok transporter error ${lastStatus}` };
}

export const getPsychology = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureCatalog(sql);
  const dials = await loadDials(sql);
  const surfaces = await loadSurfaces(sql, dials);
  return { dials, surfaces };
});

export const getDials = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  await ensureCatalog(sql);
  return loadDials(sql);
});

export const saveDials = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: Dials) => normalizeDials(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
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
  });

export const clearSurfaces = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    await ensureSurfaceColumn(sql);
    await sql`update psychology_dials set surface_json = '', updated_at = now() where id = 1`;
    const dials = await loadDials(sql);
    return loadSurfaces(sql, dials);
  });

export async function writeLadderCopy(sql: Sql, ladderId: string) {
  const lad = await sql<{
    id: string;
    title: string;
    theme: string;
    tagline: string;
    photoset_hook: string | null;
    photoset_tease: string | null;
    model_id: string | null;
  }>`
    select id, title, theme, tagline,
           coalesce(photoset_hook, '') as photoset_hook,
           coalesce(photoset_tease, '') as photoset_tease,
           coalesce(model_id, 'mod_liora') as model_id
    from ladders where id = ${ladderId}
  `;
  const ladder = lad[0];
  if (!ladder) return { ok: false as const, error: "Ladder not found." };
  const muse = await bibleFor(sql, ladder.model_id);

  const shots = await sql<{
    id: string;
    step_index: number;
    title: string;
    media_type: string;
    is_climax: boolean;
    visual_beat: string | null;
  }>`select id, step_index, title, media_type, is_climax, coalesce(visual_beat, '') as visual_beat
     from shots where ladder_id = ${ladder.id} order by step_index`;

  const dials = await loadDials(sql);
  const user = transporterUserMessage({
    ladderTitle: ladder.title,
    theme: ladder.theme,
    tagline: ladder.photoset_hook || ladder.tagline,
    dials,
    museName: muse.stageName,
    museVoice: muse.voice,
    museLooks: muse.looks,
    teaseStyle: muse.teaseStyle,
    photosetHook: ladder.photoset_hook || ladder.tagline,
    photosetTease: ladder.photoset_tease || "",
    shots: shots.map((s) => ({
      id: s.id,
      step: s.step_index,
      title: s.title,
      mediaType: s.media_type,
      isClimax: s.is_climax,
      visualBeat: s.visual_beat || "",
    })),
  });

  const grok = await grokJson(TRANSPORTER_SYSTEM, user, 2800);
  if (!grok.ok) return grok;
  const parsed = parseLadderCopy(grok.text);
  if (!parsed.shots.length) {
    return { ok: false as const, error: "Grok returned no usable shot copy." };
  }

  let written = 0;
  for (const row of parsed.shots) {
    const tease = (row.tease ?? "").trim();
    const grant = (row.grant ?? "").trim();
    if (!tease || !grant) continue;
    await sql`
      update shots
      set tease = ${tease},
          grant_copy = ${grant},
          story = ${(row.story ?? "").trim()},
          drop_line = ${(row.drop ?? "").trim()}
      where id = ${row.id} and ladder_id = ${ladder.id}
    `;
    written += 1;
  }
  const tagline = (parsed.tagline ?? "").trim();
  const description = (parsed.description ?? "").trim();
  if (tagline || description) {
    if (tagline && description) {
      await sql`
        update ladders
        set tagline = ${tagline}, description = ${description},
            photoset_hook = ${tagline}, photoset_tease = ${description}
        where id = ${ladder.id}
      `;
    } else if (tagline) {
      await sql`
        update ladders set tagline = ${tagline}, photoset_hook = ${tagline} where id = ${ladder.id}
      `;
    } else {
      await sql`
        update ladders set description = ${description}, photoset_tease = ${description} where id = ${ladder.id}
      `;
    }
  }
  return { ok: true as const, written, ladderTitle: ladder.title };
}

export async function autoWriteLadder(sql: Sql, ladderId: string) {
  const lad = await sql<{
    id: string;
    title: string;
    theme: string;
    model_id: string | null;
  }>`
    select id, title, theme, coalesce(model_id, 'mod_liora') as model_id
    from ladders where id = ${ladderId}
  `;
  const ladder = lad[0];
  if (!ladder) return { ok: false as const, error: "Ladder not found." };
  const muse = await bibleFor(sql, ladder.model_id);
  const shots = await sql<{
    id: string;
    step_index: number;
    title: string;
    media_type: string;
    media_url: string;
  }>`
    select id, step_index, title, media_type, media_url
    from shots where ladder_id = ${ladder.id} order by step_index
  `;
  if (!shots.length) {
    return { ok: false as const, error: "Add shots with media before auto-generate." };
  }

  const { seeShotFrames } = await import("./vision.server");
  const vision = await seeShotFrames({
    museName: muse.stageName,
    ladderTitle: ladder.title,
    theme: ladder.theme,
    shots: shots.map((s) => ({
      id: s.id,
      step: s.step_index,
      title: s.title,
      mediaType: s.media_type,
      mediaUrl: s.media_url,
    })),
  });

  let beats = 0;
  for (const s of vision.seen) {
    await sql`update shots set visual_beat = ${s.visualBeat} where id = ${s.id} and ladder_id = ${ladder.id}`;
    beats += 1;
  }
  if (vision.looks && !muse.looks.trim()) {
    await sql`update models set looks = ${vision.looks}, updated_at = now() where id = ${muse.id}`;
  }
  if (beats === 0) {
    const firstErr = vision.failed[0]?.error || "Grok could not see the frames.";
    return { ok: false as const, error: firstErr, seen: 0, written: 0, failed: vision.failed.length };
  }

  const wrote = await writeLadderCopy(sql, ladder.id);
  if (!wrote.ok) {
    return {
      ok: false as const,
      error: `Saw ${beats} frames, but copy failed: ${wrote.error}`,
      seen: beats,
      written: 0,
      failed: vision.failed.length,
    };
  }
  return {
    ok: true as const,
    seen: beats,
    written: wrote.written,
    failed: vision.failed.length,
    ladderTitle: ladder.title,
  };
}

export const runTransporter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ladderId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    return writeLadderCopy(sql, data.ladderId);
  });

export const autoWriteFromMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ladderId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    return autoWriteLadder(sql, data.ladderId);
  });

export const runSurfaceTransporter = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    await ensureSurfaceColumn(sql);

    const ladders = await sql<{ title: string; theme: string }>`
      select title, theme from ladders where published = true order by sort_order
    `;
    const dials = await loadDials(sql);
    const grok = await grokJson(
      SURFACE_SYSTEM,
      surfaceUserMessage({ dials, ladders }),
      900,
    );
    if (!grok.ok) return grok;

    let parsed: Partial<Surfaces> = {};
    try {
      parsed = JSON.parse(extractJson(grok.text) || "{}") as Partial<Surfaces>;
    } catch {
      return { ok: false as const, error: "Grok returned no usable surface copy." };
    }
    const merged = mergeSurfaces(dials, parsed);
    const hasAny = Object.values(parsed).some((v) => typeof v === "string" && v.trim());
    if (!hasAny) {
      return { ok: false as const, error: "Grok returned no usable surface copy." };
    }
    await sql`
      update psychology_dials
      set surface_json = ${JSON.stringify(merged)}, updated_at = now()
      where id = 1
    `;
    return { ok: true as const, surfaces: merged };
  });

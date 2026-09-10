import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { bibleFor } from "./muse-lookup";
import {
  NARRATIVE_AGE_BAND,
  buildNarrativeUserMessage,
  defaultLadderSpecs,
  narrativeSystemPrompt,
  parseMuseNarrative,
  type LadderSpec,
  type MuseNarrativeOutput,
  type NarrativeMode,
  type PhotosetNarrative,
  type ShotNarrative,
} from "@/lib/narrative-formula";
import { grokJson } from "./transporter";

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

async function ensureOwnerBriefColumns(sql: Sql) {
  await sql`alter table models add column if not exists owner_brief text not null default ''`;
  await sql`alter table ladders add column if not exists owner_brief text not null default ''`;
}

export type NarrativeGenerateInput = {
  mode: NarrativeMode;
  modelId?: string;
  stageName: string;
  looks?: string;
  voice?: string;
  teaseStyle?: string;
  scenario?: string;
  ownerBrief?: string;
  archetypeTags?: string[];
  respinNote?: string;
  portrayedAgeMin?: number;
  /** Restrict to these ladder ids; empty = all for muse or default three themes. */
  ladderIds?: string[];
  /** Persist LLM output to DB when true. */
  persist?: boolean;
  /** When persisting shot/photoset copy, overwrite existing non-empty fields. */
  overwrite?: boolean;
};

function themeToDefaultTitle(theme: string) {
  if (theme === "worship") return "The Curve";
  if (theme === "feet") return "The Pedestal";
  if (theme === "frontal") return "The Reveal";
  return theme;
}

async function loadLadderSpecs(
  sql: Sql,
  opts: { modelId?: string; ladderIds?: string[]; stageName: string },
): Promise<LadderSpec[]> {
  if (opts.ladderIds?.length) {
    const specs: LadderSpec[] = [];
    for (const id of opts.ladderIds) {
      const lad = await sql<{
        id: string;
        title: string;
        theme: string;
      }>`select id, title, theme from ladders where id = ${id}`;
      const ladder = lad[0];
      if (!ladder) continue;
      const shots = await sql<{
        id: string;
        step_index: number;
        title: string;
        visual_beat: string | null;
      }>`
        select id, step_index, title, coalesce(visual_beat, '') as visual_beat
        from shots where ladder_id = ${ladder.id} order by step_index
      `;
      specs.push({
        ladderId: ladder.id,
        theme: ladder.theme,
        title: ladder.title,
        shots: shots.map((s) => ({
          id: s.id,
          step: s.step_index,
          title: s.title,
          visualBeat: s.visual_beat || "",
        })),
      });
    }
    if (specs.length) return specs;
  }

  if (opts.modelId) {
    const rows = await sql<{
      id: string;
      title: string;
      theme: string;
    }>`select id, title, theme from ladders where model_id = ${opts.modelId} order by sort_order, title`;
    if (rows.length) {
      const specs: LadderSpec[] = [];
      for (const ladder of rows) {
        const shots = await sql<{
          id: string;
          step_index: number;
          title: string;
          visual_beat: string | null;
        }>`
          select id, step_index, title, coalesce(visual_beat, '') as visual_beat
          from shots where ladder_id = ${ladder.id} order by step_index
        `;
        specs.push({
          ladderId: ladder.id,
          theme: ladder.theme,
          title: ladder.title,
          shots: shots.length
            ? shots.map((s) => ({
                id: s.id,
                step: s.step_index,
                title: s.title,
                visualBeat: s.visual_beat || "",
              }))
            : defaultLadderSpecs([
                ladder.theme === "worship" || ladder.theme === "feet" || ladder.theme === "frontal"
                  ? ladder.theme
                  : "frontal",
              ])[0]?.shots,
        });
      }
      return specs;
    }
  }

  return defaultLadderSpecs();
}

function shotMapEntries(shots: PhotosetNarrative["shots"]): [string, ShotNarrative][] {
  if (Array.isArray(shots)) {
    return shots.map((s, i) => [`step_${i + 1}`, s]);
  }
  return Object.entries(shots);
}

async function persistNarrative(
  sql: Sql,
  input: NarrativeGenerateInput,
  output: MuseNarrativeOutput,
) {
  await ensureOwnerBriefColumns(sql);
  const overwrite = Boolean(input.overwrite || input.mode === "respin");
  const brief = input.ownerBrief?.trim() ?? "";

  if (input.modelId) {
    const muse = await bibleFor(sql, input.modelId);
    const age = Math.min(
      NARRATIVE_AGE_BAND.max,
      Math.max(NARRATIVE_AGE_BAND.min, input.portrayedAgeMin ?? NARRATIVE_AGE_BAND.min),
    );
    const looks = overwrite || !muse.looks.trim() ? output.looks || muse.looks : muse.looks;
    const voice = overwrite || !muse.voice.trim() ? output.voice || muse.voice : muse.voice;
    const tease =
      overwrite || !muse.teaseStyle.trim() ? output.teaseStyle || muse.teaseStyle : muse.teaseStyle;
    const curBio = await sql<{ bio: string; owner_brief: string | null }>`
      select bio, coalesce(owner_brief, '') as owner_brief from models where id = ${input.modelId}
    `;
    const bioCur = curBio[0]?.bio?.trim() || "";
    const bio = overwrite || !bioCur ? output.scenario || bioCur : bioCur;
    await sql`
      update models
      set looks = ${looks},
          voice = ${voice},
          tease_style = ${tease},
          bio = ${bio},
          owner_brief = ${brief || curBio[0]?.owner_brief || ""},
          portrayed_age_min = ${age},
          updated_at = now()
      where id = ${input.modelId}
    `;
  }

  for (const set of output.photosets) {
    let ladderId = set.ladderId;
    if (!ladderId && input.ladderIds?.length === 1) ladderId = input.ladderIds[0];
    if (!ladderId && set.theme && input.modelId) {
      const found = await sql<{ id: string }>`
        select id from ladders where model_id = ${input.modelId} and theme = ${set.theme} limit 1
      `;
      ladderId = found[0]?.id;
    }
    if (!ladderId) continue;

    const lad = await sql<{
      photoset_hook: string | null;
      photoset_tease: string | null;
      owner_brief: string | null;
    }>`
      select coalesce(photoset_hook, '') as photoset_hook,
             coalesce(photoset_tease, '') as photoset_tease,
             coalesce(owner_brief, '') as owner_brief
      from ladders where id = ${ladderId}
    `;
    if (!lad[0]) continue;
    const hook =
      overwrite || !lad[0].photoset_hook?.trim() ? set.hook || lad[0].photoset_hook || "" : lad[0].photoset_hook;
    const tease =
      overwrite || !lad[0].photoset_tease?.trim()
        ? set.tease || lad[0].photoset_tease || ""
        : lad[0].photoset_tease;
    await sql`
      update ladders
      set photoset_hook = ${hook},
          photoset_tease = ${tease},
          tagline = case when ${hook} <> '' then ${hook} else tagline end,
          description = case when ${tease} <> '' then ${tease} else description end,
          owner_brief = ${brief || lad[0].owner_brief || ""}
      where id = ${ladderId}
    `;

    const dbShots = await sql<{ id: string; step_index: number }>`
      select id, step_index from shots where ladder_id = ${ladderId} order by step_index
    `;
    const entries = shotMapEntries(set.shots);
    for (let i = 0; i < dbShots.length; i++) {
      const row = dbShots[i]!;
      const byId = entries.find(([k]) => k === row.id)?.[1];
      const byStep = entries.find(([k]) => k === `step_${row.step_index}`)?.[1];
      const byIndex = entries[i]?.[1];
      const shot = byId || byStep || byIndex;
      if (!shot) continue;
      const cur = await sql<{
        tease: string;
        grant_copy: string;
        story: string;
        drop_line: string;
        visual_beat: string;
      }>`
        select tease, grant_copy, story, drop_line, coalesce(visual_beat, '') as visual_beat
        from shots where id = ${row.id}
      `;
      const c = cur[0];
      if (!c) continue;
      const visual =
        overwrite || !c.visual_beat.trim() ? shot.visual || c.visual_beat : c.visual_beat;
      const teaseLine = overwrite || !c.tease.trim() ? shot.tease || c.tease : c.tease;
      const grant = overwrite || !c.grant_copy.trim() ? shot.grant || c.grant_copy : c.grant_copy;
      const story = overwrite || !c.story.trim() ? shot.story || c.story : c.story;
      const drop = overwrite || !c.drop_line.trim() ? shot.drop || c.drop_line : c.drop_line;
      if (!teaseLine && !grant) continue;
      await sql`
        update shots
        set visual_beat = ${visual},
            tease = ${teaseLine},
            grant_copy = ${grant},
            story = ${story},
            drop_line = ${drop}
        where id = ${row.id}
      `;
    }
  }
}

export async function generateMuseNarrative(sql: Sql, input: NarrativeGenerateInput) {
  const stageName = input.stageName.trim();
  if (!stageName) return { ok: false as const, error: "Stage name required." };

  const age = input.portrayedAgeMin ?? NARRATIVE_AGE_BAND.min;
  if (age < NARRATIVE_AGE_BAND.min || age > NARRATIVE_AGE_BAND.max) {
    return {
      ok: false as const,
      error: `Portrayed age must stay in the ${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max} band.`,
    };
  }

  let looks = input.looks ?? "";
  let voice = input.voice ?? "";
  let teaseStyle = input.teaseStyle ?? "";
  let scenario = input.scenario ?? "";
  let ownerBrief = input.ownerBrief ?? "";

  if (input.modelId) {
    await ensureOwnerBriefColumns(sql);
    const muse = await bibleFor(sql, input.modelId);
    looks = looks || muse.looks;
    voice = voice || muse.voice;
    teaseStyle = teaseStyle || muse.teaseStyle;
    const row = await sql<{ bio: string; owner_brief: string | null }>`
      select bio, coalesce(owner_brief, '') as owner_brief from models where id = ${input.modelId}
    `;
    scenario = scenario || row[0]?.bio || "";
    ownerBrief = ownerBrief || row[0]?.owner_brief || "";
  }

  if (input.mode === "from_identity" && !looks.trim() && !ownerBrief.trim()) {
    return {
      ok: false as const,
      error: "Add looks (or an owner brief) before Generate from looks.",
    };
  }

  const ladders = await loadLadderSpecs(sql, {
    modelId: input.modelId,
    ladderIds: input.ladderIds,
    stageName,
  });

  if (input.mode === "reverse_frames") {
    const hasFrames = ladders.some((l) => l.shots?.some((s) => s.visualBeat?.trim()));
    if (!hasFrames) {
      return {
        ok: false as const,
        error: "Reverse from frames needs visual beats or frame captions on shots. Run Auto from photos or paste beats first.",
      };
    }
  }

  const prior =
    input.mode === "respin"
      ? {
          looks,
          voice,
          teaseStyle,
          scenario,
          photosets: [] as MuseNarrativeOutput["photosets"],
        }
      : undefined;

  const user = buildNarrativeUserMessage({
    mode: input.mode,
    stageName,
    looks,
    voice,
    teaseStyle,
    scenario,
    ownerBrief,
    archetypeTags: input.archetypeTags,
    respinNote: input.respinNote,
    portrayedAgeMin: age,
    ladders,
    prior,
  });

  const grok = await grokJson(narrativeSystemPrompt(), user, 4500);
  if (!grok.ok) return grok;
  const parsed = parseMuseNarrative(grok.text);
  if (!parsed) {
    return { ok: false as const, error: "Grok returned no usable muse narrative JSON." };
  }

  // Identity lock: never blank out looks on respin if model had them.
  if (!parsed.looks.trim() && looks.trim()) parsed.looks = looks;
  if (!parsed.voice.trim() && voice.trim()) parsed.voice = voice;

  if (input.persist && input.modelId) {
    await persistNarrative(sql, input, parsed);
  }

  return {
    ok: true as const,
    narrative: parsed,
    mode: input.mode,
    ladderCount: ladders.length,
    persisted: Boolean(input.persist && input.modelId),
  };
}

export const generateNarrative = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: NarrativeGenerateInput) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    return generateMuseNarrative(sql, data);
  });

export const saveOwnerBrief = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { modelId?: string; ladderId?: string; ownerBrief: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    await ensureOwnerBriefColumns(sql);
    const brief = data.ownerBrief.trim();
    if (data.modelId) {
      await sql`update models set owner_brief = ${brief}, updated_at = now() where id = ${data.modelId}`;
    }
    if (data.ladderId) {
      await sql`update ladders set owner_brief = ${brief} where id = ${data.ladderId}`;
    }
    return { ok: true as const };
  });

export const saveManualNarrative = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      modelId: string;
      looks?: string;
      voice?: string;
      teaseStyle?: string;
      scenario?: string;
      ownerBrief?: string;
      ladderId?: string;
      hook?: string;
      photosetTease?: string;
      shots?: { id: string; visual?: string; tease?: string; grant?: string; story?: string; drop?: string }[];
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    await ensureOwnerBriefColumns(sql);

    if (data.looks !== undefined || data.voice !== undefined || data.teaseStyle !== undefined || data.scenario !== undefined || data.ownerBrief !== undefined) {
      const cur = await sql<{
        looks: string | null;
        voice: string | null;
        tease_style: string | null;
        bio: string;
        owner_brief: string | null;
      }>`select looks, voice, tease_style, bio, coalesce(owner_brief, '') as owner_brief from models where id = ${data.modelId}`;
      const c = cur[0];
      if (!c) throw new Error("Muse not found.");
      await sql`
        update models
        set looks = ${data.looks ?? c.looks ?? ""},
            voice = ${data.voice ?? c.voice ?? ""},
            tease_style = ${data.teaseStyle ?? c.tease_style ?? ""},
            bio = ${data.scenario ?? c.bio},
            owner_brief = ${data.ownerBrief ?? c.owner_brief ?? ""},
            updated_at = now()
        where id = ${data.modelId}
      `;
    }

    if (data.ladderId && (data.hook !== undefined || data.photosetTease !== undefined)) {
      const lad = await sql<{ photoset_hook: string | null; photoset_tease: string | null }>`
        select coalesce(photoset_hook, '') as photoset_hook, coalesce(photoset_tease, '') as photoset_tease
        from ladders where id = ${data.ladderId}
      `;
      if (!lad[0]) throw new Error("Photoset not found.");
      const hook = data.hook ?? lad[0].photoset_hook ?? "";
      const tease = data.photosetTease ?? lad[0].photoset_tease ?? "";
      await sql`
        update ladders
        set photoset_hook = ${hook},
            photoset_tease = ${tease},
            tagline = case when ${hook} <> '' then ${hook} else tagline end,
            description = case when ${tease} <> '' then ${tease} else description end
        where id = ${data.ladderId}
      `;
    }

    if (data.shots?.length) {
      for (const s of data.shots) {
        const cur = await sql<{
          visual_beat: string;
          tease: string;
          grant_copy: string;
          story: string;
          drop_line: string;
        }>`
          select coalesce(visual_beat, '') as visual_beat, tease, grant_copy, story, drop_line
          from shots where id = ${s.id}
        `;
        const c = cur[0];
        if (!c) continue;
        await sql`
          update shots
          set visual_beat = ${s.visual ?? c.visual_beat},
              tease = ${s.tease ?? c.tease},
              grant_copy = ${s.grant ?? c.grant_copy},
              story = ${s.story ?? c.story},
              drop_line = ${s.drop ?? c.drop_line}
          where id = ${s.id}
        `;
      }
    }

    return { ok: true as const };
  });

export { themeToDefaultTitle };

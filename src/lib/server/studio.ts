import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { bibleFor, slugify } from "./muse-lookup";
import { ensureLegal, loadModels, regenerateAll, upsertMuseModel } from "./legal";
import { grokJson, extractJson, writeLadderCopy } from "./transporter";
import {
  AESTHETIC_SYSTEM,
  LIKENESS_SYSTEM,
  STUDIO_SYSTEM,
  aestheticUserMessage,
  likenessUserMessage,
  studioUserMessage,
} from "@/lib/prompt-pack";
import {
  STUDIO_PRICES,
  type StudioLadderPlan,
  type StudioMusePlan,
  type StudioPlan,
  type StudioShotPlan,
} from "@/lib/studio-types";
import {
  completeTheme,
  themeFromAesthetic,
  type AestheticSuggestion,
} from "@/lib/theme";
import type { MuseModel } from "@/lib/legal-types";

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

async function ensureStudioCols(sql: Sql) {
  await sql`alter table shots add column if not exists imagine_prompt text not null default ''`;
  await sql`alter table shots add column if not exists imagine_prompt_used text not null default ''`;
}

function asString(v: unknown, fallback = "") {
  return typeof v === "string" ? v.trim() : fallback;
}

function asInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function parseAesthetic(raw: unknown): AestheticSuggestion {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pal = (o.palette && typeof o.palette === "object" ? o.palette : {}) as Record<string, unknown>;
  const theme = completeTheme({
    bg: asString(pal.bg) || undefined,
    surface: asString(pal.surface) || undefined,
    fg: asString(pal.fg) || undefined,
    accent: asString(pal.accent) || undefined,
    blood: asString(pal.blood) || undefined,
    displayFont: asString(o.displayFont) || undefined,
    bodyFont: asString(o.bodyFont) || undefined,
  });
  return {
    name: asString(o.name, "Untitled night"),
    promptStyle: asString(o.promptStyle),
    rationale: asString(o.rationale),
    palette: {
      bg: theme.bg,
      surface: theme.surface,
      fg: theme.fg,
      accent: theme.accent,
      blood: theme.blood,
    },
    displayFont: theme.displayFont,
    bodyFont: theme.bodyFont,
  };
}

function parseShots(raw: unknown): StudioShotPlan[] {
  const list = Array.isArray(raw) ? raw : [];
  const shots: StudioShotPlan[] = [];
  for (let i = 0; i < 9; i++) {
    const row = (list[i] && typeof list[i] === "object" ? list[i] : {}) as Record<string, unknown>;
    shots.push({
      step: i + 1,
      title: asString(row.title, `Shot ${i + 1}`),
      visualBeat: asString(row.visualBeat || row.visual_beat),
      imaginePrompt: asString(row.imaginePrompt || row.imagine_prompt),
      priceCents: Math.max(25, asInt(row.priceCents ?? row.price_cents, 25)),
      isClimax: i === 8 || row.isClimax === true || row.is_climax === true,
    });
  }
  shots[8].isClimax = true;
  return shots;
}

function parseMuse(raw: unknown, fallback?: Partial<StudioMusePlan>): StudioMusePlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const stageName = asString(o.stageName || o.stage_name, fallback?.stageName || "Muse");
  const slug =
    slugify(asString(o.slug, fallback?.slug || stageName)) || `muse-${Date.now().toString(36)}`;
  return {
    id: asString(o.id, fallback?.id || "") || undefined,
    stageName,
    slug,
    looks: asString(o.looks, fallback?.looks || ""),
    voice: asString(o.voice, fallback?.voice || ""),
    teaseStyle: asString(o.teaseStyle || o.tease_style, fallback?.teaseStyle || ""),
    bio: asString(o.bio, fallback?.bio || ""),
    portrayedAgeMin: Math.max(24, asInt(o.portrayedAgeMin ?? o.portrayed_age_min, fallback?.portrayedAgeMin ?? 24)),
    aliases: asString(o.aliases, fallback?.aliases || ""),
  };
}

function parseLadder(raw: unknown): StudioLadderPlan {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = asString(o.title, "Untitled set");
  const themeRaw = asString(o.theme, "frontal");
  const theme = ["frontal", "worship", "feet"].includes(themeRaw) ? themeRaw : "frontal";
  return {
    title,
    slug: slugify(asString(o.slug, title)) || `set-${Date.now().toString(36)}`,
    theme,
    tagline: asString(o.tagline),
    description: asString(o.description),
  };
}

function parsePlan(text: string, mode: "new" | "likeness", fallbackMuse?: Partial<StudioMusePlan>): StudioPlan | null {
  try {
    const json = JSON.parse(extractJson(text) || "{}") as Record<string, unknown>;
    const muse = parseMuse(json.muse, fallbackMuse);
    const ladder = parseLadder(json.ladder);
    const shots = parseShots(json.shots);
    if (!muse.stageName || !shots.some((s) => s.imaginePrompt || s.visualBeat)) return null;
    return {
      mode,
      muse,
      ladder,
      shots,
      aesthetic: parseAesthetic(json.aesthetic),
      refUrls: [],
    };
  } catch {
    return null;
  }
}

async function loadMuseFrames(sql: Sql, modelId: string) {
  const rows = await sql<{
    id: string;
    step_index: number;
    title: string;
    media_type: string;
    media_url: string;
    teaser_url: string | null;
    ladder_title: string;
    cover_url: string;
  }>`
    select s.id, s.step_index, s.title, s.media_type, s.media_url, s.teaser_url,
           l.title as ladder_title, l.cover_url
    from shots s
    join ladders l on l.id = s.ladder_id
    where l.model_id = ${modelId}
    order by l.sort_order, s.step_index
    limit 12
  `;
  const refs: { id: string; step: number; title: string; mediaType: string; mediaUrl: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.step_index >= 8) continue;
    const url = r.media_url || r.teaser_url || "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    refs.push({
      id: r.id,
      step: r.step_index,
      title: r.title,
      mediaType: r.media_type,
      mediaUrl: url,
    });
    if (refs.length >= 4) break;
  }
  const cover = rows[0]?.cover_url;
  if (cover && !seen.has(cover) && refs.length < 4) {
    refs.unshift({
      id: "cover",
      step: 0,
      title: "Cover",
      mediaType: "photo",
      mediaUrl: cover,
    });
  }
  return { frames: refs.slice(0, 4), cover: cover || "/media/portrait.jpg" };
}

export const authorNewMuse = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { brief: string; theme: string; notes: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const models = await loadModels(sql);
    const grok = await grokJson(
      STUDIO_SYSTEM,
      studioUserMessage({
        brief: data.brief,
        theme: data.theme,
        notes: data.notes,
        existingNames: models.map((m) => m.stageName),
      }),
      4200,
    );
    if (!grok.ok) return grok;
    const plan = parsePlan(grok.text, "new");
    if (!plan) return { ok: false as const, error: "Grok returned no usable muse plan." };
    return { ok: true as const, plan };
  });

export const authorLikenessSet = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { modelId: string; theme: string; brief: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const muse = await bibleFor(sql, data.modelId);
    if (muse.id === "mod_liora" && data.modelId !== "mod_liora") {
      throw new Error("Muse not found.");
    }
    const models = await loadModels(sql);
    const row = models.find((m) => m.id === muse.id);
    const { frames } = await loadMuseFrames(sql, muse.id);
    let looks = (row?.looks || muse.looks || "").trim();
    let frameNotes = "";
    if (frames.length && looks.length < 40) {
      const { seeShotFrames } = await import("./vision.server");
      const vision = await seeShotFrames({
        museName: muse.stageName,
        ladderTitle: "likeness lock",
        theme: data.theme,
        shots: frames.map((f) => ({
          id: f.id,
          step: f.step,
          title: f.title,
          mediaType: f.mediaType,
          mediaUrl: f.mediaUrl,
        })),
      });
      if (vision.looks) looks = vision.looks;
      frameNotes = vision.seen.map((s) => `${s.id}: ${s.visualBeat}`).join("\n");
      if (looks && row && !row.looks.trim()) {
        await sql`update models set looks = ${looks}, updated_at = now() where id = ${muse.id}`;
      }
    }
    const grok = await grokJson(
      LIKENESS_SYSTEM,
      likenessUserMessage({
        stageName: muse.stageName,
        slug: muse.slug,
        looks: looks || muse.looks,
        voice: row?.voice || muse.voice,
        teaseStyle: row?.teaseStyle || muse.teaseStyle,
        theme: data.theme,
        brief: data.brief,
        frameNotes,
      }),
      4200,
    );
    if (!grok.ok) return grok;
    const plan = parsePlan(grok.text, "likeness", {
      id: muse.id,
      stageName: muse.stageName,
      slug: muse.slug,
      looks: looks || muse.looks,
      voice: row?.voice || muse.voice,
      teaseStyle: row?.teaseStyle || muse.teaseStyle,
      bio: row?.bio || "",
      portrayedAgeMin: row?.portrayedAgeMin ?? 24,
      aliases: row?.aliases || "",
    });
    if (!plan) return { ok: false as const, error: "Grok returned no usable photoset plan." };
    plan.muse.id = muse.id;
    plan.muse.stageName = muse.stageName;
    plan.muse.slug = muse.slug;
    if (looks) plan.muse.looks = looks;
    plan.refUrls = frames.map((f) => f.mediaUrl).slice(0, 3);
    return { ok: true as const, plan, framesRead: frames.length };
  });

export const suggestAesthetic = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { museName?: string; looks?: string; theme?: string; brief?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const grok = await grokJson(AESTHETIC_SYSTEM, aestheticUserMessage(data), 900);
    if (!grok.ok) return grok;
    try {
      const json = JSON.parse(extractJson(grok.text) || "{}");
      const aesthetic = parseAesthetic(json);
      return { ok: true as const, aesthetic, theme: themeFromAesthetic(aesthetic) };
    } catch {
      return { ok: false as const, error: "Grok returned no usable aesthetic." };
    }
  });

async function insertStudioLadder(sql: Sql, modelId: string, ladder: StudioLadderPlan, coverUrl: string) {
  const muse = await bibleFor(sql, modelId);
  let slug = slugify(ladder.slug || ladder.title) || `set-${Date.now().toString(36)}`;
  const taken = await sql<{ c: number }>`select count(*)::int as c from ladders where slug = ${slug}`;
  if ((taken[0]?.c ?? 0) > 0) slug = `${slug}-${Date.now().toString(36).slice(-3)}`;
  const sort = await sql<{ m: number }>`select coalesce(max(sort_order), 0)::int as m from ladders`;
  const id = `lad_${slug}`.slice(0, 40);
  const hook = ladder.tagline.trim() || `${muse.stageName} only opens this set in order.`;
  const tease =
    ladder.description.trim() ||
    `${muse.stageName}'s photoset. Nine shots. She starts dressed. You pay. One layer comes off.`;
  const coverIn = coverUrl.trim() || "/media/portrait.jpg";
  const { persistSeoMedia } = await import("./seo-media.server");
  const cover = await persistSeoMedia({
    srcUrl: coverIn,
    museSlug: muse.slug,
    step: 0,
    title: ladder.title,
    beat: "cover",
  });
  const theme = ["frontal", "worship", "feet"].includes(ladder.theme) ? ladder.theme : "frontal";
  await sql`
    insert into ladders (
      id, slug, title, theme, tagline, description, cover_url, sort_order,
      bundle_discount, collectors_count, climax_collectors, scarcity_ends_at,
      model_id, photoset_hook, photoset_tease, published
    ) values (
      ${id}, ${slug}, ${ladder.title.trim()}, ${theme}, ${hook}, ${tease}, ${cover},
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
  return { id, slug, modelId: muse.id, modelName: muse.stageName, cover };
}

export const commitStudioPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { plan: StudioPlan }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    await ensureStudioCols(sql);
    const plan = data.plan;
    let modelId = plan.muse.id || "";
    if (plan.mode === "new" || !modelId) {
      const payload: MuseModel = {
        id: "",
        slug: plan.muse.slug,
        stageName: plan.muse.stageName,
        contentKind: "synthetic",
        portrayedAgeMin: Math.max(24, plan.muse.portrayedAgeMin || 24),
        aliases: plan.muse.aliases,
        bio: plan.muse.bio,
        isFictional: true,
        likenessOk: true,
        recordsOnFile: false,
        idTypeOnFile: "",
        firstProduced: new Date().toISOString().slice(0, 10),
        ladderSlugs: "",
        cardPortrayal: "",
        voice: plan.muse.voice,
        looks: plan.muse.looks,
        teaseStyle: plan.muse.teaseStyle,
      };
      const saved = await upsertMuseModel(sql, payload);
      await regenerateAll(sql);
      modelId = saved.id;
      plan.muse.id = saved.id;
      plan.muse.slug = saved.slug;
    }
    const made = await insertStudioLadder(sql, modelId, plan.ladder, "/media/portrait.jpg");
    const { writeAwaitingStill } = await import("./imagine.server");
    const { vaultShotMedia } = await import("./grant-media.server");
    for (const shot of plan.shots) {
      const shotId = `shot_${made.id}_${shot.step}`.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
      let srcUrl = "/media/portrait.jpg";
      try {
        srcUrl = await writeAwaitingStill(shotId);
      } catch {
        srcUrl = "/media/portrait.jpg";
      }
      const packed = await vaultShotMedia({
        srcUrl,
        shotId,
        museSlug: plan.muse.slug,
        step: shot.step,
        title: shot.title,
        beat: shot.visualBeat,
        mediaType: "photo",
        replace: true,
      });
      const tease = `${shot.title}. The next shot is still hers to give.`;
      const grant = `${shot.title} is unlocked.`;
      await sql`
        insert into shots (
          id, ladder_id, step_index, title, tease, grant_copy, media_type,
          media_url, object_position, price_cents, is_climax, visual_beat, teaser_url, imagine_prompt
        ) values (
          ${shotId}, ${made.id}, ${shot.step}, ${shot.title}, ${tease},
          ${grant}, 'photo', ${packed.grantUrl}, 'center',
          ${shot.priceCents}, ${shot.isClimax},
          ${shot.visualBeat}, ${packed.teaserUrl}, ${shot.imaginePrompt}
        )
        on conflict (id) do update set
          title = excluded.title,
          visual_beat = excluded.visual_beat,
          imagine_prompt = excluded.imagine_prompt,
          price_cents = excluded.price_cents
      `;
    }
    return {
      ok: true as const,
      modelId,
      modelName: made.modelName,
      ladderId: made.id,
      slug: made.slug,
      museSlug: plan.muse.slug,
    };
  });

function wrapImaginePrompt(shot: StudioShotPlan, looks: string, style: string) {
  const lock = looks.trim();
  const styleLine = style.trim();
  const body = shot.imaginePrompt.trim() || shot.visualBeat.trim();
  return [
    "Photorealistic editorial photograph of an adult woman, mid-to-late 20s.",
    lock ? `Likeness lock (same woman every frame): ${lock}` : "",
    body,
    shot.visualBeat && shot.visualBeat !== body ? `Pose / garment: ${shot.visualBeat}` : "",
    styleLine ? `Night style: ${styleLine}` : "",
    "Vertical 2:3 still, 85mm, cinematic lighting, no text, no watermark, no collage.",
  ]
    .filter(Boolean)
    .join("\n");
}

export const generateStudioShot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      ladderId: string;
      museSlug: string;
      looks: string;
      promptStyle: string;
      shot: StudioShotPlan;
      refUrls?: string[];
      previousSrc?: string;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    await ensureStudioCols(sql);
    const count = await sql<{ c: number }>`
      select count(*)::int as c from shots where ladder_id = ${data.ladderId}
    `;
    const existing = await sql<{ id: string; media_url: string }>`
      select id, media_url from shots
      where ladder_id = ${data.ladderId} and step_index = ${data.shot.step}
    `;
    if (!existing[0] && (count[0]?.c ?? 0) >= 9) {
      throw new Error("This ladder already has nine shots.");
    }

    const prompt = wrapImaginePrompt(data.shot, data.looks, data.promptStyle);
    const { imagineGenerate, imagineEdit, persistOriginal, persistPublicCover, writeAwaitingStill } = await import("./imagine.server");
    const { frameDataUrl } = await import("./vision.server");

    const refUrls = [...(data.refUrls ?? [])];
    if (data.previousSrc) refUrls.unshift(data.previousSrc);
    const unique = [...new Set(refUrls)].slice(0, 3);
    const dataUris: string[] = [];
    for (const url of unique) {
      try {
        dataUris.push(await frameDataUrl(url, "photo"));
      } catch {
        /* skip unreadable ref */
      }
    }

    const result =
      dataUris.length > 0 ? await imagineEdit(prompt, dataUris) : await imagineGenerate(prompt);

    const shotId =
      existing[0]?.id || `shot_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    let srcUrl = "/media/portrait.jpg";
    let generated = false;
    if (result.ok) {
      srcUrl = await persistOriginal(result.bytes, shotId, result.mime === "video/mp4" ? ".mp4" : ".jpg");
      generated = true;
      if (data.shot.step === 1 && result.mime !== "video/mp4") {
        const cover = await persistPublicCover(result.bytes, data.museSlug, data.shot.title);
        await sql`update ladders set cover_url = ${cover} where id = ${data.ladderId}`;
      }
    } else {
      try {
        srcUrl = await writeAwaitingStill(shotId);
      } catch {
        srcUrl = "/media/portrait.jpg";
      }
    }

    const { vaultShotMedia } = await import("./grant-media.server");
    const packed = await vaultShotMedia({
      srcUrl,
      shotId,
      museSlug: data.museSlug,
      step: data.shot.step,
      title: data.shot.title,
      beat: data.shot.visualBeat,
      mediaType: "photo",
      replace: true,
    });
    const tease = `${data.shot.title}. The next shot is still hers to give.`;
    const grant = `${data.shot.title} is unlocked.`;
    const usedPrompt = result.usedPrompt || prompt;
    if (existing[0]) {
      await sql`
        update shots
        set title = ${data.shot.title},
            tease = ${tease},
            grant_copy = ${grant},
            media_url = ${packed.grantUrl},
            teaser_url = ${packed.teaserUrl},
            visual_beat = ${data.shot.visualBeat},
            imagine_prompt = ${data.shot.imaginePrompt},
            imagine_prompt_used = ${generated ? usedPrompt : ""},
            price_cents = ${data.shot.priceCents},
            is_climax = ${data.shot.isClimax}
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into shots (
          id, ladder_id, step_index, title, tease, grant_copy, media_type,
          media_url, object_position, price_cents, is_climax, visual_beat, teaser_url, imagine_prompt, imagine_prompt_used
        ) values (
          ${shotId}, ${data.ladderId}, ${data.shot.step}, ${data.shot.title}, ${tease},
          ${grant}, 'photo', ${packed.grantUrl}, 'center',
          ${data.shot.priceCents}, ${data.shot.isClimax},
          ${data.shot.visualBeat}, ${packed.teaserUrl}, ${data.shot.imaginePrompt}, ${generated ? usedPrompt : ""}
        )
      `;
    }
    if (data.shot.step === 1 && generated) {
      await sql`update ladders set published = true where id = ${data.ladderId}`;
    }

    return {
      ok: generated,
      blocked: !generated && result.ok === false ? result.blocked : false,
      nudged: generated ? result.nudged : false,
      nudgeRung: result.rung,
      nudgeDelta: result.delta,
      error: generated ? undefined : result.ok === false ? result.error : "Imagine returned no still.",
      shotId: existing[0]?.id || shotId,
      step: data.shot.step,
      teaserUrl: packed.teaserUrl,
      grantUrl: packed.grantUrl,
      srcUrl: packed.grantUrl,
    };
  });

export const generateStudioClip = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      ladderId: string;
      museSlug: string;
      looks: string;
      promptStyle: string;
      shot: StudioShotPlan;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    await ensureStudioCols(sql);
    const existing = await sql<{ id: string }>`
      select id from shots
      where ladder_id = ${data.ladderId} and step_index = ${data.shot.step}
    `;
    if (!existing[0]) throw new Error("Generate the still first, then the clip.");
    const still = wrapImaginePrompt(data.shot, data.looks, data.promptStyle);
    const prompt = [
      still,
      "Short 6-second vertical clip of this exact beat. One take. Slow fabric and breath. No jump cuts. Photoreal.",
    ].join("\n");
    const { imagineGenerateVideo, persistOriginal } = await import("./imagine.server");
    const result = await imagineGenerateVideo(prompt);
    if (!result.ok) {
      return {
        ok: false as const,
        blocked: result.blocked,
        nudged: result.nudged,
        nudgeRung: result.rung,
        nudgeDelta: result.delta,
        error: result.error,
        shotId: existing[0].id,
        step: data.shot.step,
      };
    }
    const srcUrl = await persistOriginal(result.bytes, existing[0].id, ".mp4");
    const { vaultShotMedia } = await import("./grant-media.server");
    const packed = await vaultShotMedia({
      srcUrl,
      shotId: existing[0].id,
      museSlug: data.museSlug,
      step: data.shot.step,
      title: data.shot.title,
      beat: data.shot.visualBeat,
      mediaType: "video",
      replace: true,
    });
    await sql`
      update shots
      set media_type = 'video',
          media_url = ${packed.grantUrl},
          teaser_url = ${packed.teaserUrl},
          imagine_prompt_used = ${result.usedPrompt}
      where id = ${existing[0].id}
    `;
    return {
      ok: true as const,
      blocked: false,
      nudged: result.nudged,
      nudgeRung: result.rung,
      nudgeDelta: result.delta,
      shotId: existing[0].id,
      step: data.shot.step,
      teaserUrl: packed.teaserUrl,
      grantUrl: packed.grantUrl,
      srcUrl: packed.grantUrl,
    };
  });

export const writeStudioCopy = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ladderId: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    return writeLadderCopy(sql, data.ladderId);
  });

import { createServerFn } from "@tanstack/react-start";
import { getSql, type Sql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureCatalog, ensureProfile } from "./catalog";
import { slugify } from "./muse-lookup";
import { ensureLegal, regenerateAll, upsertMuseModel } from "./legal";
import type { MuseModel } from "@/lib/legal-types";
import { STUDIO_PRICES } from "@/lib/studio-types";
import {
  type LadderTheme,
  type NudeMasterBeat,
  NUDE_MASTER_LADDERS,
  image0Prompt,
  image0RetryPrompt,
  laddersForThemes,
  paidShotPrompt,
} from "@/lib/nude-master";

async function requireAdmin(sql: Sql, userId: string) {
  const role = await ensureProfile(sql, userId);
  if (role !== "admin") throw new Error("Operator access only.");
}

function asTheme(v: string): LadderTheme | null {
  if (v === "frontal" || v === "worship" || v === "feet") return v;
  return null;
}

export const getOpsStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    return {
      xai: Boolean(process.env.XAI_API_KEY?.trim()),
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
      nowpayments: Boolean(process.env.NOWPAYMENTS_API_KEY?.trim()),
    };
  });

export const generateLockMaster = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { identityLock: string; stageName?: string }) => d)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await requireAdmin(sql, context.userId);
    const identityLock = (data.identityLock || "").trim();
    if (identityLock.length < 40) {
      return { ok: false as const, error: "Paste a full identity lock (looks, hair, body, jewelry) first." };
    }
    const { imagineGenerate, persistOriginal } = await import("./imagine.server");
    const first = await imagineGenerate(image0Prompt(identityLock));
    let result = first;
    let usedOpenRobe = false;
    if (!first.ok && first.blocked) {
      const retry = await imagineGenerate(image0RetryPrompt(identityLock));
      result = retry;
      usedOpenRobe = retry.ok;
    }
    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error || "Imagine declined Image 0.",
        blocked: result.blocked,
      };
    }
    const lockId = `lock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const lockUrl = await persistOriginal(result.bytes, lockId, ".jpg");
    const previewDataUrl = `data:image/jpeg;base64,${result.bytes.toString("base64")}`;
    return {
      ok: true as const,
      lockUrl,
      previewDataUrl,
      nudged: result.nudged,
      usedOpenRobe,
      delta: result.delta,
    };
  });

async function copyLockToShot(lockUrl: string, shotId: string) {
  const { readPrivateOriginal, putPrivateOriginal } = await import("./object-store");
  const bytes = await readPrivateOriginal(lockUrl);
  if (!bytes) throw new Error("Image 0 lock original is missing from the vault.");
  return putPrivateOriginal(`${shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}.jpg`, bytes);
}

async function insertLadder(
  sql: Sql,
  modelId: string,
  museSlug: string,
  museName: string,
  theme: LadderTheme,
  title: string,
  tagline: string,
  description: string,
) {
  const base = slugify(`${museSlug}-${title}`) || `set-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const taken = await sql<{ c: number }>`select count(*)::int as c from ladders where slug = ${slug}`;
    if ((taken[0]?.c ?? 0) === 0) break;
    slug = `${base}-${Date.now().toString(36).slice(-3)}`;
  }
  const sort = await sql<{ m: number }>`select coalesce(max(sort_order), 0)::int as m from ladders`;
  const id = `lad_${slug}`.slice(0, 40);
  const cover = "/media/portrait.jpg";
  await sql`
    insert into ladders (
      id, slug, title, theme, tagline, description, cover_url, sort_order,
      bundle_discount, collectors_count, climax_collectors, scarcity_ends_at,
      model_id, photoset_hook, photoset_tease, published
    ) values (
      ${id}, ${slug}, ${title}, ${theme}, ${tagline}, ${description}, ${cover},
      ${(sort[0]?.m ?? 0) + 1}, 0.32, 0, 0, now() + interval '18 hours',
      ${modelId}, ${tagline}, ${description}, false
    )
  `;
  const row = await sql<{ ladder_slugs: string }>`select ladder_slugs from models where id = ${modelId}`;
  const slugs = (row[0]?.ladder_slugs || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!slugs.includes(slug)) slugs.push(slug);
  await sql`update models set ladder_slugs = ${slugs.join(",")}, updated_at = now() where id = ${modelId}`;
  return { id, slug, title, theme, modelName: museName };
}

export const commitNudeMasterPlan = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      identityLock: string;
      stageName: string;
      voice?: string;
      bio?: string;
      lockUrl: string;
      themes: LadderTheme[];
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await ensureLegal(sql);
    await requireAdmin(sql, context.userId);
    const identityLock = data.identityLock.trim();
    const stageName = data.stageName.trim();
    if (!stageName) return { ok: false as const, error: "She needs a stage name." };
    if (!data.lockUrl) return { ok: false as const, error: "Approve Image 0 first." };
    const themes = (data.themes || []).map(asTheme).filter((t): t is LadderTheme => Boolean(t));
    const packs = laddersForThemes(themes.length ? themes : ["frontal", "worship", "feet"]);
    if (!packs.length) return { ok: false as const, error: "Pick at least one photoset." };

    const payload: MuseModel = {
      id: "",
      slug: slugify(stageName) || `muse-${Date.now().toString(36)}`,
      stageName,
      contentKind: "synthetic",
      portrayedAgeMin: 24,
      aliases: "",
      bio: (data.bio || "").trim(),
      isFictional: true,
      likenessOk: true,
      recordsOnFile: false,
      idTypeOnFile: "",
      firstProduced: new Date().toISOString().slice(0, 10),
      ladderSlugs: "",
      cardPortrayal: "",
      voice: (data.voice || "").trim(),
      looks: identityLock,
      teaseStyle: "Write from Image 0. Early shots ADD garments onto the nude lock. Late shots keep her body and change pose and light.",
    };
    const saved = await upsertMuseModel(sql, payload);
    await regenerateAll(sql);

    const { vaultShotMedia } = await import("./grant-media.server");
    const ladders: {
      ladderId: string;
      slug: string;
      title: string;
      theme: LadderTheme;
      shots: { shotId: string; beatId: string; step: number; title: string; isVideoSlot: boolean }[];
    }[] = [];

    for (const pack of packs) {
      const made = await insertLadder(
        sql,
        saved.id,
        saved.slug,
        saved.stageName,
        pack.theme,
        pack.title,
        pack.tagline,
        pack.description,
      );
      const shots: { shotId: string; beatId: string; step: number; title: string; isVideoSlot: boolean }[] = [];
      for (const beat of pack.shots) {
        const shotId = `shot_${made.id}_${beat.step}`.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
        await copyLockToShot(data.lockUrl, shotId);
        const packed = await vaultShotMedia({
          srcUrl: `grant:${shotId}.jpg`,
          shotId,
          museSlug: saved.slug,
          step: beat.step,
          title: beat.title,
          beat: beat.visualBeat,
          mediaType: "photo",
          replace: true,
        });
        const prompt = paidShotPrompt(identityLock, beat);
        const tease = `${beat.title}. The next shot is still hers to give.`;
        const grant = `${beat.title} is unlocked.`;
        const price = STUDIO_PRICES[beat.step - 1] ?? 999;
        await sql`
          insert into shots (
            id, ladder_id, step_index, title, tease, grant_copy, media_type,
            media_url, object_position, price_cents, is_climax, visual_beat, teaser_url, imagine_prompt
          ) values (
            ${shotId}, ${made.id}, ${beat.step}, ${beat.title}, ${tease},
            ${grant}, 'photo', ${packed.grantUrl}, 'center',
            ${price}, ${beat.isClimax},
            ${beat.visualBeat}, ${packed.teaserUrl}, ${prompt}
          )
          on conflict (id) do update set
            title = excluded.title,
            visual_beat = excluded.visual_beat,
            imagine_prompt = excluded.imagine_prompt,
            price_cents = excluded.price_cents
        `;
        shots.push({
          shotId,
          beatId: beat.id,
          step: beat.step,
          title: beat.title,
          isVideoSlot: beat.isVideoSlot,
        });
      }
      ladders.push({
        ladderId: made.id,
        slug: made.slug,
        title: made.title,
        theme: pack.theme,
        shots,
      });
    }

    return {
      ok: true as const,
      modelId: saved.id,
      modelName: saved.stageName,
      museSlug: saved.slug,
      lockUrl: data.lockUrl,
      ladders,
    };
  });

export const generateNudeMasterShot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (d: {
      ladderId: string;
      shotId: string;
      step: number;
      title: string;
      visualBeat: string;
      identityLock: string;
      lockUrl: string;
      museSlug: string;
      priceCents?: number;
      isClimax?: boolean;
      beat?: NudeMasterBeat;
    }) => d,
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureCatalog(sql);
    await requireAdmin(sql, context.userId);
    if (!data.lockUrl) return { ok: false as const, error: "Image 0 lock is missing." };

    const beat: NudeMasterBeat = data.beat || {
      id: `step_${data.step}`,
      step: data.step,
      title: data.title,
      visualBeat: data.visualBeat,
      isClimax: Boolean(data.isClimax),
      isVideoSlot: false,
    };
    const prompt = paidShotPrompt(data.identityLock, beat);

    const { imagineEdit, persistOriginal } = await import("./imagine.server");
    const { frameDataUrl } = await import("./vision.server");
    let ref: string | null = null;
    try {
      ref = await frameDataUrl(data.lockUrl, "photo");
    } catch {
      return { ok: false as const, error: "Could not read Image 0 from the vault." };
    }

    const result = await imagineEdit(prompt, [ref]);
    const shotId = data.shotId;
    if (!result.ok) {
      return {
        ok: false as const,
        blocked: result.blocked,
        nudged: result.nudged,
        error: result.error,
        shotId,
        step: data.step,
      };
    }

    const srcUrl = await persistOriginal(result.bytes, shotId, ".jpg");
    const { vaultShotMedia } = await import("./grant-media.server");
    const packed = await vaultShotMedia({
      srcUrl,
      shotId,
      museSlug: data.museSlug,
      step: data.step,
      title: data.title,
      beat: data.visualBeat,
      mediaType: "photo",
      replace: true,
    });
    const tease = `${data.title}. The next shot is still hers to give.`;
    const grant = `${data.title} is unlocked.`;
    if (data.step === 1) {
      const { persistPublicCover } = await import("./imagine.server");
      try {
        const cover = await persistPublicCover(result.bytes, data.museSlug, data.title);
        await sql`update ladders set cover_url = ${cover}, published = true where id = ${data.ladderId}`;
      } catch {
        await sql`update ladders set published = true where id = ${data.ladderId}`;
      }
    }
    await sql`
      update shots
      set title = ${data.title},
          tease = ${tease},
          grant_copy = ${grant},
          media_url = ${packed.grantUrl},
          teaser_url = ${packed.teaserUrl},
          visual_beat = ${data.visualBeat},
          imagine_prompt = ${prompt},
          imagine_prompt_used = ${result.usedPrompt},
          is_climax = ${Boolean(data.isClimax)}
      where id = ${shotId}
    `;
    const previewDataUrl = `data:image/jpeg;base64,${result.bytes.toString("base64")}`;
    return {
      ok: true as const,
      blocked: false,
      nudged: result.nudged,
      nudgeDelta: result.delta,
      shotId,
      step: data.step,
      teaserUrl: packed.teaserUrl,
      grantUrl: packed.grantUrl,
      previewDataUrl,
    };
  });

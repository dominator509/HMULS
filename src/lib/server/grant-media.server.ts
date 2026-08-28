import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join } from "node:path";
import { seoStem } from "@/lib/seo";
import { isMarketingFilename } from "@/lib/safe-path";
import { privateMediaDir, privateOriginalExists, resolveBundledOriginal } from "./object-store";

export function grantsDir() {
  return privateMediaDir();
}

export function isGrantUrl(url: string) {
  return url.startsWith("grant:");
}

export function grantFilename(url: string) {
  if (!url.startsWith("grant:")) return "";
  return url.slice(6).replace(/[^a-zA-Z0-9._-]/g, "");
}

export function grantFilePath(grantUrl: string) {
  const name = grantFilename(grantUrl);
  if (!name) return null;
  return resolveBundledOriginal(name);
}

export function isMarketingName(filename: string) {
  return isMarketingFilename(filename);
}

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Paid originals live in private-media/ (bundled, read-only on Vercel).
 * This pass never writes public/ and never copies a paid original into public/.
 */
export async function vaultShotMedia(opts: {
  srcUrl: string;
  shotId: string;
  museSlug: string;
  step: number;
  title: string;
  beat?: string;
  mediaType: "photo" | "video" | string;
  replace?: boolean;
}): Promise<{ grantUrl: string; teaserUrl: string }> {
  const ext =
    extname((opts.srcUrl || "").split("?")[0]) ||
    (opts.mediaType === "video" ? ".mp4" : ".jpg");
  const grantName = `${opts.shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}${ext}`;
  const grantUrl = `grant:${grantName}`;
  const ok = await privateOriginalExists(grantName) || await privateOriginalExists(opts.srcUrl);
  if (!ok) {
    throw new Error(`Missing private original for ${opts.shotId} (${grantName}).`);
  }

  const stem = seoStem([
    opts.museSlug,
    String(opts.step).padStart(2, "0"),
    opts.title,
  ]).slice(0, 56);
  const teaserUrl = `/media/${stem || opts.shotId}-tease.jpg`;
  const teaserPath = join(process.cwd(), "public", teaserUrl.replace(/^\/+/, ""));
  if (await exists(teaserPath)) return { grantUrl, teaserUrl };
  return { grantUrl, teaserUrl: "/media/liora-00-the-reveal-cover.jpg" };
}

export async function sweepPublicGrants(_keepUrls: string[]) {
  /* Public marketing files are committed teasers. Do not mutate them at runtime. */
}

export async function isolatePaidFromPublic() {
  /* Isolation is a build artifact invariant, not a runtime rewrite. */
}

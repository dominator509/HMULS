import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { extname, join } from "node:path";
import { seoStem } from "@/lib/seo";
import { isMarketingFilename } from "@/lib/safe-path";
import {
  privateMediaDir,
  privateOriginalExists,
  putPrivateOriginal,
  readPrivateOriginal,
  resolveBundledOriginal,
} from "./object-store";

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

const MAX_BYTES = 8_000_000;

async function loadOriginalBytes(srcUrl: string): Promise<Buffer | null> {
  const raw = (srcUrl || "").trim();
  if (!raw) return null;
  const fromVault = await readPrivateOriginal(raw).catch(() => null);
  if (fromVault && fromVault.length >= 2048) return fromVault;

  let url = raw;
  if (url.startsWith("/")) {
    const host = (process.env.PUBLIC_SITE_URL || "https://sheundresses.com").replace(/\/$/, "");
    url = `${host}${url}`;
  }
  if (!/^https?:\/\//i.test(url)) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 2048 || bytes.length > MAX_BYTES) return null;
  return bytes;
}

/**
 * Paid originals live in private blob (or bundled private-media/).
 * This never writes public/ and never copies a paid original into public/.
 * On replace, or when the grant file is missing, ingest srcUrl (https, /media, or grant:).
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
  const grantName = `${opts.shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}${ext.startsWith(".") ? ext : `.${ext}`}`;
  const grantUrl = `grant:${grantName}`;
  const already = await privateOriginalExists(grantName);

  if (!already || opts.replace) {
    const bytes = await loadOriginalBytes(opts.srcUrl);
    if (bytes) {
      await putPrivateOriginal(grantName, bytes);
    } else if (!already) {
      throw new Error(
        `Could not ingest media for ${opts.shotId}. Use a reachable https or /media URL, or generate the still in Studio.`,
      );
    }
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

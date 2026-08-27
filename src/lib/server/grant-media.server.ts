import { execFile } from "node:child_process";
import { access, copyFile, mkdir, readdir, unlink, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { seoStem } from "@/lib/seo";
import { isMarketingFilename } from "@/lib/safe-path";

const exec = promisify(execFile);
const FFMPEG = process.env.FFMPEG || "/usr/local/bin/ffmpeg";

export function grantsDir() {
  return join(process.cwd(), "data", "grants");
}

export function isGrantUrl(url: string) {
  return url.startsWith("grant:");
}

export function grantFilename(url: string) {
  if (!url.startsWith("grant:")) return "";
  return url.slice(6).replace(/[^a-zA-Z0-9._-]/g, "");
}

function underDir(dir: string, file: string) {
  const root = resolve(dir);
  const full = resolve(file);
  return full === root || full.startsWith(root + "/");
}

export function grantFilePath(grantUrl: string) {
  const name = grantFilename(grantUrl);
  if (!name) return null;
  const full = join(grantsDir(), name);
  return underDir(grantsDir(), full) ? full : null;
}

export function isMarketingName(filename: string) {
  return isMarketingFilename(filename);
}

function publicPath(url: string) {
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/api/")) return null;
  const full = resolve(join(process.cwd(), "public", url.replace(/^\/+/, "")));
  const root = resolve(join(process.cwd(), "public"));
  if (full !== root && !full.startsWith(root + "/")) return null;
  return full;
}

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findSource(srcUrl: string) {
  if (isGrantUrl(srcUrl)) {
    const p = grantFilePath(srcUrl);
    if (p && (await exists(p))) return p;
  }
  const pub = publicPath(srcUrl);
  if (pub && (await exists(pub))) return pub;
  const orig = join(process.cwd(), "data", "originals", srcUrl.replace(/^\/+/, ""));
  if (underDir(join(process.cwd(), "data", "originals"), orig) && (await exists(orig))) return orig;
  return null;
}

async function makeTeaser(src: string, dest: string, video: boolean) {
  await mkdir(dirname(dest), { recursive: true });
  const vf = "scale='min(720,iw)':-2,gblur=sigma=14,eq=brightness=-0.08:saturation=0.75";
  const args = video
    ? ["-y", "-ss", "0.35", "-i", src, "-frames:v", "1", "-vf", vf, "-q:v", "6", dest]
    : ["-y", "-i", src, "-frames:v", "1", "-vf", vf, "-q:v", "6", dest];
  try {
    await exec(FFMPEG, args, { timeout: 25000 });
    if (await exists(dest)) return true;
  } catch {
    try {
      await exec("ffmpeg", args, { timeout: 25000 });
      if (await exists(dest)) return true;
    } catch {
      return false;
    }
  }
  return false;
}

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
  const src = await findSource(opts.srcUrl);
  const ext =
    extname((src || opts.srcUrl).split("?")[0]) ||
    (opts.mediaType === "video" ? ".mp4" : ".jpg");
  const grantName = `${opts.shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}${ext}`;
  const grantUrl = `grant:${grantName}`;
  const destGrant = join(grantsDir(), grantName);
  await mkdir(grantsDir(), { recursive: true });
  if (src && destGrant !== src) {
    if (opts.replace || !(await exists(destGrant))) {
      await copyFile(src, destGrant);
    }
  } else if (!src && !(await exists(destGrant))) {
    return {
      grantUrl: opts.srcUrl,
      teaserUrl: opts.srcUrl.startsWith("/media/") ? opts.srcUrl : "/media/portrait.jpg",
    };
  }

  const stem = seoStem([
    opts.museSlug,
    String(opts.step).padStart(2, "0"),
    opts.title,
  ]).slice(0, 56);
  const teaserUrl = `/media/${stem || opts.shotId}-tease.jpg`;
  const teaserPath = join(process.cwd(), "public", teaserUrl.replace(/^\/+/, ""));
  const video = opts.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(ext);
  const needTease = opts.replace || !(await exists(teaserPath));
  if (needTease) {
    const ok = await makeTeaser(destGrant, teaserPath, video);
    if (!ok) {
      const fallback = publicPath("/media/portrait.jpg");
      if (fallback && (await exists(fallback))) {
        try {
          await mkdir(dirname(teaserPath), { recursive: true });
          await copyFile(fallback, teaserPath);
        } catch {
          /* keep going */
        }
      }
    }
  }

  return { grantUrl, teaserUrl: (await exists(teaserPath)) ? teaserUrl : "/media/portrait.jpg" };
}

async function sha256File(path: string) {
  const buf = await readFile(path);
  return createHash("sha256").update(buf).digest("hex");
}

/** If a public file is byte-identical to a paid grant, replace the public copy with a teaser. */
export async function isolatePaidFromPublic() {
  const root = grantsDir();
  let grantNames: string[] = [];
  try {
    grantNames = await readdir(root);
  } catch {
    return;
  }
  const hashToGrant = new Map<string, string>();
  for (const name of grantNames) {
    const p = join(root, name);
    if (!underDir(root, p)) continue;
    try {
      hashToGrant.set(await sha256File(p), p);
    } catch {
      /* skip */
    }
  }
  const pub = join(process.cwd(), "public", "media");
  let names: string[] = [];
  try {
    names = await readdir(pub);
  } catch {
    return;
  }
  for (const name of names) {
    if (/-tease\./i.test(name)) continue;
    const p = join(pub, name);
    if (!underDir(pub, p)) continue;
    let hash: string;
    try {
      hash = await sha256File(p);
    } catch {
      continue;
    }
    const grant = hashToGrant.get(hash);
    if (!grant) continue;
    const video = /\.(mp4|webm|mov)$/i.test(name);
    const ok = await makeTeaser(grant, p, video);
    if (!ok && !isMarketingName(name)) {
      try {
        await unlink(p);
      } catch {
        /* keep */
      }
    }
  }
}

export async function sweepPublicGrants(keepUrls: string[]) {
  const dir = join(process.cwd(), "public", "media");
  let names: string[] = [];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const keep = new Set(
    keepUrls
      .map((u) => (u.split("/").pop() || "").split("?")[0])
      .filter(Boolean),
  );
  for (const name of names) {
    if (isMarketingName(name) || keep.has(name)) continue;
    try {
      await unlink(join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

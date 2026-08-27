import { access, copyFile, mkdir, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { seoStem } from "@/lib/seo";
import { containedPublicPath, isInside } from "@/lib/safe-path";

async function realContained(userPath: string) {
  const candidate = containedPublicPath(userPath);
  const mediaRoot = resolve(process.cwd(), "public", "media");
  const uploadsRoot = resolve(process.cwd(), "public", "uploads");
  try {
    const real = await realpath(candidate);
    if (!isInside(mediaRoot, real) && !isInside(uploadsRoot, real)) {
      throw new Error("Rejected path.");
    }
    return real;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return candidate;
    throw err;
  }
}

export async function persistSeoMedia(opts: {
  srcUrl: string;
  museSlug: string;
  step: number;
  title: string;
  beat?: string;
}) {
  if (!opts.srcUrl.startsWith("/media/") && !opts.srcUrl.startsWith("/uploads/")) {
    return opts.srcUrl;
  }
  const ext = extname(opts.srcUrl.split("?")[0]) || ".jpg";
  const stem = seoStem([
    opts.museSlug,
    String(opts.step).padStart(2, "0"),
    opts.title,
    opts.beat,
  ]);
  if (!stem) return opts.srcUrl;
  const destUrl = `/media/${stem}${ext}`;
  if (destUrl === opts.srcUrl) return opts.srcUrl;
  let src: string;
  let dest: string;
  try {
    src = await realContained(opts.srcUrl);
    dest = containedPublicPath(destUrl);
  } catch {
    return opts.srcUrl;
  }
  try {
    await mkdir(dirname(dest), { recursive: true });
    try {
      await access(dest, constants.F_OK);
      return destUrl;
    } catch {
      await copyFile(src, dest);
      return destUrl;
    }
  } catch {
    return opts.srcUrl;
  }
}

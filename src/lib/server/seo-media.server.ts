import { access, copyFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, join } from "node:path";
import { seoStem } from "@/lib/seo";

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
  const src = join(process.cwd(), "public", opts.srcUrl.replace(/^\/+/, ""));
  const dest = join(process.cwd(), "public", destUrl.replace(/^\/+/, ""));
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

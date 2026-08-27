import { resolve } from "node:path";

const ALLOWED = new Set(["media", "uploads"]);

/** Resolve a user-supplied /media or /uploads path inside public/. Throws on traversal. */
export function containedPublicPath(userPath: string, cwd = process.cwd()) {
  const raw = (userPath.split("?")[0] || "").trim();
  if (!raw.startsWith("/media/") && !raw.startsWith("/uploads/")) {
    throw new Error("Media path must be under /media or /uploads.");
  }
  if (
    raw.includes("\0") ||
    raw.includes("\\") ||
    raw.includes("%2e") ||
    raw.includes("%2E") ||
    raw.includes("..")
  ) {
    throw new Error("Rejected path.");
  }
  const rel = raw.replace(/^\/+/, "");
  const first = rel.split("/")[0];
  if (!ALLOWED.has(first)) throw new Error("Rejected path.");
  const publicRoot = resolve(cwd, "public");
  const full = resolve(publicRoot, rel);
  const mediaRoot = resolve(publicRoot, "media");
  const uploadsRoot = resolve(publicRoot, "uploads");
  if (
    !isInside(mediaRoot, full) &&
    !isInside(uploadsRoot, full)
  ) {
    throw new Error("Rejected path.");
  }
  if (!isInside(publicRoot, full)) throw new Error("Rejected path.");
  return full;
}

export function isInside(root: string, file: string) {
  const r = resolve(root);
  const f = resolve(file);
  return f === r || f.startsWith(r.endsWith("/") ? r : r + "/");
}

export const MARKETING_FILES = [
  "hero.jpg",
  "portrait.jpg",
  "cover-reveal.jpg",
  "cover-curve.jpg",
  "cover-pedestal.jpg",
] as const;

export function isMarketingFilename(name: string) {
  const base = name.split("/").pop() || name;
  if ((MARKETING_FILES as readonly string[]).includes(base)) return true;
  if (/-cover\./i.test(base)) return true;
  if (/-tease\./i.test(base)) return true;
  return false;
}

export function paidMediaMustNotBePublic(mediaUrl: string) {
  if (!mediaUrl) return false;
  if (mediaUrl.startsWith("grant:")) return false;
  if (mediaUrl.startsWith("original:")) return false;
  if (!mediaUrl.startsWith("/media/") && !mediaUrl.startsWith("/uploads/")) return false;
  const base = mediaUrl.split("/").pop() || "";
  return isMarketingFilename(base) || mediaUrl.startsWith("/media/") || mediaUrl.startsWith("/uploads/");
}

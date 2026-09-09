/** Client helpers for collector downloads of unlocked grant media. */

export type MediaKind = "photo" | "video";

export type DownloadMode = "direct" | "canvas-png";

export type DownloadOffer = {
  id: "original" | "png" | "mp4" | "webm";
  label: string;
  /** File extension used for the saved name. */
  ext: string;
  mode: DownloadMode;
};

export function extFromContentType(ct: string | null | undefined): string | null {
  if (!ct) return null;
  const t = ct.split(";")[0]!.trim().toLowerCase();
  if (t === "image/jpeg" || t === "image/jpg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "video/mp4") return "mp4";
  if (t === "video/webm") return "webm";
  return null;
}

export function labelForExt(ext: string): string {
  const e = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  if (e === "jpg") return "Download JPG";
  if (e === "png") return "Download PNG";
  if (e === "webp") return "Download WebP";
  if (e === "mp4") return "Download MP4";
  if (e === "webm") return "Download WebM";
  return `Download ${e.toUpperCase()}`;
}

/**
 * Build 1–2 download offers from known media type + optional Content-Type.
 * Videos: MP4 only unless WebM is already the served type / secondary.
 * Photos: original format from the grant URL, plus canvas PNG when original is not PNG.
 */
export function offersForMedia(opts: {
  mediaType: MediaKind;
  contentType?: string | null;
  /** True when a second video container is already available server-side. */
  webmAvailable?: boolean;
}): DownloadOffer[] {
  if (opts.mediaType === "video") {
    const served = extFromContentType(opts.contentType);
    if (served === "webm") {
      return [{ id: "webm", label: "Download WebM", ext: "webm", mode: "direct" }];
    }
    const offers: DownloadOffer[] = [
      { id: "mp4", label: "Download MP4", ext: "mp4", mode: "direct" },
    ];
    if (opts.webmAvailable) {
      offers.push({ id: "webm", label: "Download WebM", ext: "webm", mode: "direct" });
    }
    return offers;
  }

  const primary = extFromContentType(opts.contentType) ?? "jpg";
  if (primary === "png") {
    return [{ id: "original", label: "Download PNG", ext: "png", mode: "direct" }];
  }
  const offers: DownloadOffer[] = [
    {
      id: "original",
      label: labelForExt(primary),
      ext: primary === "jpeg" ? "jpg" : primary,
      mode: "direct",
    },
  ];
  // Client-side PNG via canvas — no heavy deps; skip when original is already PNG.
  offers.push({ id: "png", label: "Download PNG", ext: "png", mode: "canvas-png" });
  return offers;
}

/** Safe download basename from shot title. */
export function downloadFilename(shotTitle: string, ext: string): string {
  const slug =
    shotTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "shot";
  const e = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  return `${slug}.${e}`;
}

/** Only when the collector already has a grant media URL (clear unlocked media). */
export function canOfferDownload(opts: {
  unlocked?: boolean;
  mediaUrl: string | null | undefined;
}): boolean {
  if (!opts.mediaUrl) return false;
  if (opts.unlocked === false) return false;
  return true;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export async function fetchGrantBlob(mediaUrl: string): Promise<{ blob: Blob; contentType: string | null }> {
  const res = await fetch(mediaUrl, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const contentType = res.headers.get("content-type");
  const blob = await res.blob();
  return { blob, contentType };
}

/** Encode the already-visible grant image as PNG via canvas (same-origin grant URL). */
export async function canvasPngBlob(mediaUrl: string): Promise<Blob> {
  const img = new Image();
  img.decoding = "async";
  // Same-origin /api/media — credentials not needed on <img> for cookie auth in most browsers,
  // but grant URLs typically include ?k= stamp token.
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load image for PNG export"));
    img.src = mediaUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  if (!canvas.width || !canvas.height) {
    throw new Error("Image has no dimensions");
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("PNG encode failed");
  return blob;
}

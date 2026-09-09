import { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  canOfferDownload,
  canvasPngBlob,
  downloadFilename,
  extFromContentType,
  fetchGrantBlob,
  offersForMedia,
  triggerBlobDownload,
  type DownloadOffer,
  type MediaKind,
} from "@/lib/download-media";

type Props = {
  mediaUrl: string | null | undefined;
  mediaType: MediaKind;
  title: string;
  /** When false, render nothing (locked / blurred). Omit for vault items that are always owned. */
  unlocked?: boolean;
  className?: string;
  /** Compact icon-style controls for gallery tiles. */
  compact?: boolean;
  /** Button variant matching Pay / unlock chrome. */
  variant?: "gold" | "blood" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
};

export function DownloadMediaButtons({
  mediaUrl,
  mediaType,
  title,
  unlocked,
  className,
  compact = false,
  variant = "gold",
  size = "md",
}: Props) {
  const allowed = canOfferDownload({ unlocked, mediaUrl });
  const [contentType, setContentType] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!allowed || !mediaUrl) {
      setContentType(null);
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch(mediaUrl, {
          method: "HEAD",
          credentials: "include",
          signal: ac.signal,
        });
        if (cancelled) return;
        if (res.ok) {
          setContentType(res.headers.get("content-type"));
          return;
        }
      } catch {
        /* HEAD may be unsupported; fall through */
      }
      if (cancelled) return;
      // Fallback: GET and drop the body once headers are known.
      try {
        const res = await fetch(mediaUrl, { credentials: "include", signal: ac.signal });
        if (cancelled) {
          res.body?.cancel();
          return;
        }
        if (res.ok) {
          setContentType(res.headers.get("content-type"));
        }
        res.body?.cancel();
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [allowed, mediaUrl]);

  const offers = useMemo(
    () => offersForMedia({ mediaType, contentType }),
    [mediaType, contentType],
  );

  const runOffer = useCallback(
    async (offer: DownloadOffer) => {
      if (!mediaUrl || busyId) return;
      setBusyId(offer.id);
      try {
        if (offer.mode === "canvas-png") {
          const blob = await canvasPngBlob(mediaUrl);
          triggerBlobDownload(blob, downloadFilename(title, "png"));
          return;
        }
        const { blob, contentType: ct } = await fetchGrantBlob(mediaUrl);
        if (ct) setContentType(ct);
        const ext =
          offer.id === "mp4"
            ? "mp4"
            : offer.id === "webm"
              ? "webm"
              : extFromContentType(ct) ?? offer.ext;
        triggerBlobDownload(blob, downloadFilename(title, ext));
      } catch (err) {
        console.error("[download]", err);
        toast.error("Download failed. Try again while the shot is open.");
      } finally {
        setBusyId(null);
      }
    },
    [busyId, mediaUrl, title],
  );

  if (!allowed || !mediaUrl) return null;

  if (compact) {
    return (
      <div
        className={cn("flex flex-wrap gap-1", className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {offers.map((offer, i) => (
          <button
            key={offer.id}
            type="button"
            aria-label={offer.label}
            title={offer.label}
            disabled={busyId !== null}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[10px] font-medium tracking-wide uppercase disabled:opacity-40",
              i === 0
                ? "bg-gold text-bg hover:bg-gold-soft"
                : "border border-gold/50 bg-bg/70 text-gold hover:border-gold",
            )}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void runOffer(offer);
            }}
          >
            <Download className="size-3 shrink-0" aria-hidden />
            {offer.ext.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap", className)}>
      {offers.map((offer, i) => (
        <Button
          key={offer.id}
          type="button"
          variant={i === 0 ? variant : "outline"}
          size={size}
          disabled={busyId !== null}
          aria-label={offer.label}
          onClick={() => void runOffer(offer)}
        >
          <Download className="size-4 shrink-0" aria-hidden />
          {busyId === offer.id ? "Saving…" : offer.label}
        </Button>
      ))}
    </div>
  );
}

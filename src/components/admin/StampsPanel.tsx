import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getStampSettings,
  saveStampSettings,
  traceLeak,
  type LeakHit,
} from "@/lib/server/stamps";
import { toast } from "sonner";

export function StampsPanel() {
  const [stampGrants, setStampGrants] = useState(true);
  const [stampVisible, setStampVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hit, setHit] = useState<LeakHit | null>(null);
  const [miss, setMiss] = useState<string | null>(null);

  useEffect(() => {
    getStampSettings()
      .then((s) => {
        setStampGrants(s.stampGrants);
        setStampVisible(s.stampVisible);
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setBusy(true);
    try {
      const next = await saveStampSettings({ data: { stampGrants, stampVisible } });
      setStampGrants(next.stampGrants);
      setStampVisible(next.stampVisible);
      toast.success(
        next.stampGrants
          ? "Grants will be stamped and served from the vault."
          : "Stamps off. Unlocked media uses the public file again.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setHit(null);
    setMiss(null);
    setBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file."));
        r.readAsDataURL(file);
      });
      const res = await traceLeak({ data: { dataUrl } });
      if (!res.ok) setMiss(res.error);
      else setHit(res.hit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Trace failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker kicker-accent">Forensic</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Grant stamps</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          These flags save. Pixel stamping (LSB / visible corner mark) and leak
          tracing need Node + ffmpeg, which this Cloudflare Worker does not run.
          Unlocked media is still served from the private original. Do not expect
          a forensic token on this deploy.
        </p>
        <label className="mt-5 flex items-start gap-3 text-sm text-fg">
          <input
            type="checkbox"
            checked={stampGrants}
            onChange={(e) => setStampGrants(e.target.checked)}
            className="mt-1 size-4 accent-[#c9a227]"
          />
          Stamp grants (private originals + leak tracer)
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-fg">
          <input
            type="checkbox"
            checked={stampVisible}
            onChange={(e) => setStampVisible(e.target.checked)}
            disabled={!stampGrants}
            className="mt-1 size-4 accent-[#c9a227]"
          />
          Faint visible mark (last 4 of the token, low opacity)
        </label>
        <Button className="mt-5" variant="gold" disabled={busy} onClick={() => void save()}>
          Save stamp settings
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker">Trace a leak</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Whose grant is this?</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Paste a still that came from this vault. Re-jpeg and crop can destroy the
          invisible payload — Discord/Telegram PNG dumps usually keep it.
        </p>
        <input
          type="file"
          accept="image/*"
          className="field-input mt-5"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        {miss ? <p className="mt-4 text-sm text-blood">{miss}</p> : null}
        {hit ? (
          <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
            <Row k="Token" v={hit.token} />
            <Row k="Collector" v={hit.email || hit.userId} />
            <Row k="Shot" v={`${hit.ladderTitle} · ${hit.shotTitle}`} />
            <Row k="Invoice" v={hit.invoiceId || "—"} />
            <Row k="Tx" v={hit.txHash || "—"} />
            <Row k="Stamped" v={hit.stampedAt.slice(0, 19).replace("T", " ")} />
          </dl>
        ) : null}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs text-subtle">{k}</p>
      <p className="mt-0.5 break-all text-fg">{v}</p>
    </div>
  );
}

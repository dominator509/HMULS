import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { createLadder, listAdminLadders } from "@/lib/server/admin";
import { getLegalBundle, saveModel } from "@/lib/server/legal";
import { autoWriteFromMedia, runTransporter } from "@/lib/server/transporter";
import type { ContentKind, MuseModel } from "@/lib/legal-types";
import { toast } from "sonner";

const EMPTY: MuseModel = {
  id: "",
  slug: "",
  stageName: "",
  contentKind: "synthetic",
  portrayedAgeMin: 24,
  aliases: "",
  bio: "",
  isFictional: true,
  likenessOk: true,
  recordsOnFile: false,
  idTypeOnFile: "",
  firstProduced: "",
  ladderSlugs: "",
  cardPortrayal: "",
  voice: "",
  looks: "",
  teaseStyle: "",
};

export function MusesPanel({ onLadders }: { onLadders?: () => void }) {
  const [models, setModels] = useState<MuseModel[]>([]);
  const [draft, setDraft] = useState<MuseModel>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [ageText, setAgeText] = useState(String(EMPTY.portrayedAgeMin));
  const [setTitle, setSetTitle] = useState("");
  const [theme, setTheme] = useState("frontal");
  const [tagline, setTagline] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [forMuse, setForMuse] = useState("");

  useEffect(() => {
    getLegalBundle()
      .then((b) => {
        setModels(b.models);
        if (b.models[0]) setForMuse(b.models[0].id);
      })
      .catch(() => toast.error("Could not load muses."));
  }, []);

  async function saveMuse() {
    if (!draft.stageName.trim()) {
      toast.error("She needs a stage name.");
      return;
    }
    const age = Math.max(21, Number(ageText) || 0);
    if (!Number.isFinite(age) || age < 21) {
      toast.error("Portrayed age must be 21 or older.");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveModel({
        data: {
          ...draft,
          portrayedAgeMin: age,
          slug: draft.slug || draft.stageName,
          isFictional: draft.contentKind === "synthetic" ? true : draft.isFictional,
        },
      });
      const b = await getLegalBundle();
      setModels(b.models);
      setForMuse(saved.id);
      setDraft(EMPTY);
      toast.success(`${saved.stageName} is onboarded. Legal pack generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save muse.");
    } finally {
      setBusy(false);
    }
  }

  async function makeSet() {
    if (!forMuse || !setTitle.trim()) {
      toast.error("Pick a muse and name the photoset.");
      return;
    }
    setBusy(true);
    try {
      const made = await createLadder({
        data: {
          modelId: forMuse,
          title: setTitle.trim(),
          theme,
          tagline,
          description: tagline,
          coverUrl,
        },
      });
      setSetTitle("");
      setTagline("");
      setCoverUrl("");
      onLadders?.();
      toast.success(`${made.modelName} · ${made.slug} is live. Add shots under Ladders.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create photoset.");
    } finally {
      setBusy(false);
    }
  }

  async function autoHer(ladderId: string, name: string) {
    setBusy(true);
    try {
      const res = await autoWriteFromMedia({ data: { ladderId } });
      if (!res.ok) toast.error(res.error);
      else toast.success(`${name}: saw ${res.seen} frames, wrote ${res.written} teases.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-generate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function writeHerCopy(ladderId: string, name: string) {
    setBusy(true);
    try {
      const res = await runTransporter({ data: { ladderId } });
      if (!res.ok) toast.error(res.error);
      else toast.success(`${name}: ${res.written} teases written in her voice.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transporter failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker kicker-accent">Onboard</p>
        <h2 className="mt-1 font-display text-3xl text-fg">New muse</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Looks, voice, and tease style are how she stays unique. Auto-from-photos
          and copy rewrite need an xAI key on this Worker. She will not inherit Liora.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field
            label="Stage name"
            value={draft.stageName}
            onChange={(v) => setDraft({ ...draft, stageName: v })}
            placeholder="Her name as collectors will see it"
          />
          <Field
            label="Slug"
            value={draft.slug}
            onChange={(v) => setDraft({ ...draft, slug: v })}
            placeholder="auto from name"
          />
          <label className="text-xs text-subtle">
            Kind
            <select
              value={draft.contentKind}
              onChange={(e) =>
                setDraft({ ...draft, contentKind: e.target.value as ContentKind })
              }
              className="field-input"
            >
              <option value="synthetic">Synthetic / AI</option>
              <option value="human">Human (full 2257)</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          <Field
            label="Portrayed age (21+)"
            value={ageText}
            onChange={(v) => {
              const cleaned = v.replace(/[^0-9]/g, "").slice(0, 3);
              setAgeText(cleaned);
              if (cleaned === "") return;
              const n = Number(cleaned);
              if (Number.isFinite(n)) {
                setDraft({ ...draft, portrayedAgeMin: n });
              }
            }}
          />
        </div>
        <label className="mt-3 block text-xs text-subtle">
          Looks lock — what teasers must name
          <textarea
            value={draft.looks}
            onChange={(e) => setDraft({ ...draft, looks: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="Skin, hair, jewelry, tattoo, robe — unique to her frames"
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Voice
          <textarea
            value={draft.voice}
            onChange={(e) => setDraft({ ...draft, voice: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="How she talks in a tease. Quiet, specific, in control…"
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Tease style
          <textarea
            value={draft.teaseStyle}
            onChange={(e) => setDraft({ ...draft, teaseStyle: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="Write from the frame. Never generic nudes."
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Bio
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            rows={2}
            className="field-input"
          />
        </label>
        <Button className="mt-5" variant="gold" disabled={busy} onClick={() => void saveMuse()}>
          {busy ? "Saving…" : "Onboard muse"}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker">Photoset</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Give her a ladder</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          One muse can have several parallel sets. After this, add shots on the Ladders
          tab (media URL + visual beat), then write her copy.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-subtle">
            Muse
            <select
              value={forMuse}
              onChange={(e) => setForMuse(e.target.value)}
              className="field-input"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.stageName}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Photoset title"
            value={setTitle}
            onChange={setSetTitle}
            placeholder="The Reveal, Midnight, Pedestal…"
          />
          <label className="text-xs text-subtle">
            Theme
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="field-input">
              <option value="frontal">Frontal / face</option>
              <option value="worship">Back / curve</option>
              <option value="feet">Feet / floor</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <Field
            label="Cover image URL"
            value={coverUrl}
            onChange={setCoverUrl}
            placeholder="/media/… or https://"
          />
        </div>
        <label className="mt-3 block text-xs text-subtle">
          Hook / tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="field-input"
            placeholder="One line that is only true of THIS set"
          />
        </label>
        <Button className="mt-5" disabled={busy} onClick={() => void makeSet()}>
          Create photoset
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker">Roster</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Loaded muses</h2>
        <ul className="mt-5 space-y-4">
          {models.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl text-fg">{m.stageName}</p>
                  <p className="mt-1 text-xs tracking-[0.14em] text-gold uppercase">
                    {m.contentKind} · {m.slug}
                  </p>
                  <p className="mt-2 max-w-xl text-sm text-muted">
                    {m.looks || m.bio || "No looks lock yet — teasers will drift."}
                  </p>
                  <p className="mt-2 text-xs text-subtle">
                    Sets: {m.ladderSlugs || "none yet"}
                  </p>
                </div>
                <Link to="/legal/models/$slug" params={{ slug: m.slug }} className="text-sm text-gold">
                  Model card
                </Link>
              </div>
              <WriteButtons
                slugs={m.ladderSlugs}
                name={m.stageName}
                busy={busy}
                onWrite={writeHerCopy}
                onAuto={autoHer}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function WriteButtons({
  slugs,
  name,
  busy,
  onWrite,
  onAuto,
}: {
  slugs: string;
  name: string;
  busy: boolean;
  onWrite: (id: string, name: string) => Promise<void>;
  onAuto: (id: string, name: string) => Promise<void>;
}) {
  const [ladders, setLadders] = useState<{ id: string; slug: string; title: string }[]>([]);
  useEffect(() => {
    listAdminLadders()
      .then((rows) =>
        setLadders(
          rows
            .filter((r) => slugs.split(",").map((s) => s.trim()).includes(r.slug))
            .map((r) => ({ id: r.id, slug: r.slug, title: r.title })),
        ),
      )
      .catch(() => undefined);
  }, [slugs]);
  if (!ladders.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ladders.map((l) => (
        <span key={l.id} className="contents">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onWrite(l.id, `${name} · ${l.title}`)}
        >
          Write {l.title}
        </Button>
        <Button
          variant="gold"
          size="sm"
          disabled={busy}
          onClick={() => void onAuto(l.id, `${name} · ${l.title}`)}
        >
          Auto from photos
        </Button>
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-xs text-subtle">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field-input"
      />
    </label>
  );
}

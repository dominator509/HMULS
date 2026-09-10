import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chrome";
import { createLadder, listAdminLadders } from "@/lib/server/admin";
import { getLegalBundle, saveModel } from "@/lib/server/legal";
import { autoWriteFromMedia, runTransporter } from "@/lib/server/transporter";
import { generateNarrative, saveManualNarrative } from "@/lib/server/narrative";
import {
  PSYCH_LEVERS,
  applyNarrativeToDraft,
  type NarrativeMode,
} from "@/lib/narrative-formula";
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
  ownerBrief: "",
};

type NarrMode = "manual" | NarrativeMode;

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
  const [narrMode, setNarrMode] = useState<NarrMode>("manual");
  const [respinNote, setRespinNote] = useState("");
  const [archetypeTags, setArchetypeTags] = useState("");
  const [selectedLadderId, setSelectedLadderId] = useState("");
  const [hookDraft, setHookDraft] = useState("");
  const [photosetTeaseDraft, setPhotosetTeaseDraft] = useState("");

  useEffect(() => {
    getLegalBundle()
      .then((b) => {
        setModels(b.models);
        if (b.models[0]) setForMuse(b.models[0].id);
      })
      .catch(() => toast.error("Could not load muses."));
  }, []);

  function loadMuse(m: MuseModel) {
    setDraft({ ...m, ownerBrief: m.ownerBrief ?? "" });
    setAgeText(String(m.portrayedAgeMin));
    setForMuse(m.id);
    setNarrMode("manual");
  }

  function hasFilledNarrative(d: MuseModel) {
    return Boolean(d.looks.trim() || d.voice.trim() || d.teaseStyle.trim() || d.bio.trim());
  }

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
          ownerBrief: draft.ownerBrief ?? "",
        },
      });
      if (selectedLadderId && (hookDraft.trim() || photosetTeaseDraft.trim())) {
        await saveManualNarrative({
          data: {
            modelId: saved.id,
            ladderId: selectedLadderId,
            hook: hookDraft,
            photosetTease: photosetTeaseDraft,
            ownerBrief: draft.ownerBrief ?? "",
          },
        });
      }
      const b = await getLegalBundle();
      setModels(b.models);
      setForMuse(saved.id);
      setDraft({ ...saved });
      toast.success(`${saved.stageName} saved. Manual fields are source of truth.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save muse.");
    } finally {
      setBusy(false);
    }
  }

  async function runGenerate() {
    if (!draft.stageName.trim()) {
      toast.error("Stage name required.");
      return;
    }
    if (narrMode === "manual") return;
    const mode: NarrativeMode = narrMode;
    const isRespin = narrMode === "respin";

    const overwrite = isRespin || hasFilledNarrative(draft);
    if (overwrite) {
      const ok = window.confirm(
        isRespin
          ? "Respin will overwrite muse narrative fields (looks/voice/teaseStyle/bio) and selected photoset copy. Continue?"
          : "Narrative fields already have copy. Generate will overwrite them. Continue? (Cancel keeps your manual edits.)",
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      // Persist brief + identity first so reverse/respin have a model id when possible.
      let modelId = draft.id;
      if (!modelId) {
        const age = Math.max(24, Math.min(34, Number(ageText) || 24));
        const saved = await saveModel({
          data: {
            ...draft,
            portrayedAgeMin: age,
            slug: draft.slug || draft.stageName,
            isFictional: draft.contentKind === "synthetic" ? true : draft.isFictional,
            ownerBrief: draft.ownerBrief ?? "",
          },
        });
        modelId = saved.id;
        setDraft({ ...saved });
      }

      const res = await generateNarrative({
        data: {
          mode,
          modelId,
          stageName: draft.stageName,
          looks: draft.looks,
          voice: draft.voice,
          teaseStyle: draft.teaseStyle,
          scenario: draft.bio,
          ownerBrief: draft.ownerBrief,
          archetypeTags: archetypeTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          respinNote: isRespin ? respinNote : undefined,
          portrayedAgeMin: Math.max(24, Math.min(34, Number(ageText) || 24)),
          ladderIds: selectedLadderId ? [selectedLadderId] : undefined,
          persist: true,
          overwrite,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const next = applyNarrativeToDraft(draft, res.narrative, { overwrite: true });
      setDraft({ ...next, id: modelId, ownerBrief: draft.ownerBrief ?? "" });
      if (res.narrative.photosets[0]) {
        setHookDraft(res.narrative.photosets[0].hook);
        setPhotosetTeaseDraft(res.narrative.photosets[0].tease);
      }
      const b = await getLegalBundle();
      setModels(b.models);
      toast.success(
        isRespin
          ? `Respun ${draft.stageName} (${res.ladderCount} photoset${res.ladderCount === 1 ? "" : "s"}).`
          : `Narrative generated for ${draft.stageName}. Review, then Save if you tweak manually.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Narrative generate failed.");
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
          Manual fields are the source of truth. Generate / Respin only run when you click them —
          they never wipe unsaved edits without confirm. Adult OC 24–34 only.
        </p>

        <div className="mt-4">
          <Segmented
            value={narrMode}
            onChange={(id) => setNarrMode(id as NarrMode)}
            options={[
              { id: "manual", label: "Manual" },
              { id: "from_identity", label: "Generate from looks" },
              { id: "reverse_frames", label: "Reverse from frames" },
              { id: "respin", label: "Respin" },
            ]}
          />
        </div>

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
            label="Portrayed age (24–34 band for narrative)"
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
          Owner brief — model + shoot + story (optional; saved for respins; not public)
          <textarea
            value={draft.ownerBrief ?? ""}
            onChange={(e) => setDraft({ ...draft, ownerBrief: e.target.value })}
            rows={3}
            className="field-input"
            placeholder="Personality, setting, wardrobe beats, kinks-to-lean, shoot notes, lines to hit/avoid — ban Engrish; lean Brazzers-scenario…"
          />
        </label>

        {narrMode === "from_identity" || narrMode === "respin" ? (
          <Field
            label="Archetype tags (comma-separated)"
            value={archetypeTags}
            onChange={setArchetypeTags}
            placeholder="dominant cyber, soft control silk…"
          />
        ) : null}

        {narrMode === "respin" ? (
          <label className="mt-3 block text-xs text-subtle">
            Respin note
            <input
              value={respinNote}
              onChange={(e) => setRespinNote(e.target.value)}
              className="field-input"
              placeholder="more dominant · less soft · more cyber"
            />
          </label>
        ) : null}

        <PsychTips />

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
            placeholder="Native American English. Dirty-smooth. Quiet/precise/in control — never ESL mush…"
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Tease style
          <textarea
            value={draft.teaseStyle}
            onChange={(e) => setDraft({ ...draft, teaseStyle: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="From the frame + next unlock. Brazzers-scenario beats. Never Engrish."
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Scenario / backstory (Brazzers-scenario blurb — stored as bio)
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            rows={3}
            className="field-input"
            placeholder="2–5 sentences: WHO + WHERE + tension + sexual promise. Fluent American English…"
          />
        </label>

        <PhotosetVoiceFields
          forMuse={forMuse || draft.id}
          selectedLadderId={selectedLadderId}
          setSelectedLadderId={setSelectedLadderId}
          hookDraft={hookDraft}
          setHookDraft={setHookDraft}
          photosetTeaseDraft={photosetTeaseDraft}
          setPhotosetTeaseDraft={setPhotosetTeaseDraft}
        />

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy} onClick={() => void saveMuse()}>
            {busy ? "Saving…" : draft.id ? "Save muse" : "Onboard muse"}
          </Button>
          {narrMode !== "manual" ? (
            <Button disabled={busy} onClick={() => void runGenerate()}>
              {busy
                ? "Working…"
                : narrMode === "respin"
                  ? "Respin narrative"
                  : narrMode === "reverse_frames"
                    ? "Reverse from frames"
                    : "Generate narrative"}
            </Button>
          ) : null}
          {draft.id ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setDraft(EMPTY);
                setAgeText(String(EMPTY.portrayedAgeMin));
                setHookDraft("");
                setPhotosetTeaseDraft("");
              }}
            >
              Clear form
            </Button>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker">Photoset</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Give her a ladder</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          One muse can have several parallel sets. After this, add shots on the Ladders
          tab (media URL + visual beat), then write her copy or Reverse from frames.
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
                <div className="flex flex-col items-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadMuse(m)}>
                    Edit narrative
                  </Button>
                  <Link to="/legal/models/$slug" params={{ slug: m.slug }} className="text-sm text-gold">
                    Model card
                  </Link>
                </div>
              </div>
              <WriteButtons
                slugs={m.ladderSlugs}
                name={m.stageName}
                busy={busy}
                onWrite={writeHerCopy}
                onAuto={autoHer}
                onNarrative={(ladderId) => {
                  loadMuse(m);
                  setSelectedLadderId(ladderId);
                  setNarrMode("from_identity");
                }}
                onReverse={(ladderId) => {
                  loadMuse(m);
                  setSelectedLadderId(ladderId);
                  setNarrMode("reverse_frames");
                }}
                onRespin={(ladderId) => {
                  loadMuse(m);
                  setSelectedLadderId(ladderId);
                  setNarrMode("respin");
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PsychTips() {
  return (
    <details className="mt-4 rounded-lg border border-border bg-raised/40 p-3 text-xs text-muted">
      <summary className="cursor-pointer text-gold">Psych tips + copyStyle (brazzers-scenario)</summary>
      <p className="mt-2 text-muted">
        Write fluent native American English — dirty-smooth scene blurbs, not Engrish. WHO / WHERE /
        tension / sexual promise; leave the unlock ladder to deliver. Ban &quot;very sexy beautiful&quot;
        and broken grammar.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {PSYCH_LEVERS.map((l) => (
          <li key={l.id}>
            <span className="text-fg">{l.label}.</span> {l.tip}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PhotosetVoiceFields({
  forMuse,
  selectedLadderId,
  setSelectedLadderId,
  hookDraft,
  setHookDraft,
  photosetTeaseDraft,
  setPhotosetTeaseDraft,
}: {
  forMuse: string;
  selectedLadderId: string;
  setSelectedLadderId: (v: string) => void;
  hookDraft: string;
  setHookDraft: (v: string) => void;
  photosetTeaseDraft: string;
  setPhotosetTeaseDraft: (v: string) => void;
}) {
  const [ladders, setLadders] = useState<{ id: string; title: string; slug: string }[]>([]);
  useEffect(() => {
    if (!forMuse) return;
    listAdminLadders()
      .then((rows) => {
        const withModel = rows.filter((r) => (r as { model_id?: string | null }).model_id === forMuse);
        setLadders(
          (withModel.length ? withModel : rows).map((r) => ({
            id: r.id,
            title: r.title,
            slug: r.slug,
          })),
        );
      })
      .catch(() => undefined);
  }, [forMuse]);

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
      <p className="text-xs tracking-[0.14em] text-gold uppercase">Photoset voice (manual)</p>
      <label className="block text-xs text-subtle">
        Target photoset (optional — Generate uses all if empty)
        <select
          value={selectedLadderId}
          onChange={(e) => setSelectedLadderId(e.target.value)}
          className="field-input"
        >
          <option value="">All ladders for muse / default three</option>
          {ladders.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title} ({l.slug})
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-subtle">
        Photoset hook
        <input
          value={hookDraft}
          onChange={(e) => setHookDraft(e.target.value)}
          className="field-input"
          placeholder="One line unique to this set — collector / lore drop welcome"
        />
      </label>
      <label className="block text-xs text-subtle">
        Photoset tease
        <textarea
          value={photosetTeaseDraft}
          onChange={(e) => setPhotosetTeaseDraft(e.target.value)}
          rows={2}
          className="field-input"
          placeholder="2–4 sentences. Progressive revelation. Desire first."
        />
      </label>
      <p className="text-[11px] text-subtle">
        Per-shot visual / tease / grant / story / drop: edit under Ladders after Generate, or use
        Write / Auto from photos. Manual Save writes muse bible + optional hook/tease here.
      </p>
    </div>
  );
}

function WriteButtons({
  slugs,
  name,
  busy,
  onWrite,
  onAuto,
  onNarrative,
  onReverse,
  onRespin,
}: {
  slugs: string;
  name: string;
  busy: boolean;
  onWrite: (id: string, name: string) => Promise<void>;
  onAuto: (id: string, name: string) => Promise<void>;
  onNarrative: (ladderId: string) => void;
  onReverse: (ladderId: string) => void;
  onRespin: (ladderId: string) => void;
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
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onNarrative(l.id)}>
            Generate narrative
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onReverse(l.id)}>
            Reverse frames
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onRespin(l.id)}>
            Respin
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

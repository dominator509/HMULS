import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  getLegalBundle,
  regenerateLegal,
  saveLegalEntity,
  saveModel,
  writeModelCard,
} from "@/lib/server/legal";
import {
  DEFAULT_ENTITY,
  entityComplete,
  type ContentKind,
  type LegalEntity,
  type MuseModel,
} from "@/lib/legal-types";
import { toast } from "sonner";

export function LegalPanel() {
  const [entity, setEntity] = useState<LegalEntity>(DEFAULT_ENTITY);
  const [models, setModels] = useState<MuseModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<MuseModel>({
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
  });

  useEffect(() => {
    getLegalBundle()
      .then((b) => {
        setEntity(b.entity);
        setModels(b.models);
      })
      .catch(() => toast.error("Could not load legal pack."));
  }, []);

  async function saveEntity() {
    setBusy(true);
    try {
      const next = await saveLegalEntity({ data: entity });
      setEntity(next);
      toast.success("Entity saved. Site pack regenerated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function regen() {
    setBusy(true);
    try {
      await regenerateLegal();
      const b = await getLegalBundle();
      setModels(b.models);
      toast.success("All legal documents regenerated from templates.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Regenerate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upsertModel(m: MuseModel) {
    setBusy(true);
    try {
      await saveModel({ data: m });
      const b = await getLegalBundle();
      setModels(b.models);
      toast.success(`${m.stageName} saved. Model pack generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Model save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function grokCard(id: string) {
    setBusy(true);
    try {
      const res = await writeModelCard({ data: { modelId: id } });
      if (!res.ok) throw new Error(res.error);
      const b = await getLegalBundle();
      setModels(b.models);
      toast.success("Grok wrote the portrayal. Legal clauses stayed locked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transporter failed.");
    } finally {
      setBusy(false);
    }
  }

  const ready = entityComplete(entity);

  return (
    <div className="mt-8 space-y-10">
      <p className="text-sm text-muted">
        Modeled on Fanvue (Shift Holdings), OnlyFans (Fenix International), and
        synthetic vaults (exemption when no actual person is depicted). Templates
        always write the statutes. Grok only writes portrayal copy, operator-initiated.
      </p>
      {!ready ? (
        <p className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          Fill a real custodian legal name and a street address before publishing
          human performers. P.O. boxes fail 28 C.F.R. Part 75. Stage names fail.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-2xl text-fg">Custodian / entity</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["siteName", "Site name"],
              ["entityName", "Legal entity"],
              ["jurisdiction", "Jurisdiction"],
              ["custodianName", "Custodian legal name"],
              ["custodianTitle", "Title"],
              ["address1", "Street"],
              ["address2", "Street 2"],
              ["city", "City"],
              ["region", "State / region"],
              ["postal", "Postal"],
              ["country", "Country"],
              ["contactEmail", "Legal email"],
              ["dmcaEmail", "DMCA email"],
              ["websiteUrl", "Public URL"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-subtle">
              {label}
              <input
                value={entity[key]}
                onChange={(e) => setEntity({ ...entity, [key]: e.target.value })}
                className="field-input"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy} onClick={() => void saveEntity()}>
            Save & regenerate site pack
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void regen()}>
            Rebuild every document
          </Button>
          <Link to="/legal" className="inline-flex items-center text-sm text-gold">
            Open legal hub
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-fg">Loaded models</h2>
        {models.map((m) => (
          <ModelEditor
            key={m.id}
            model={m}
            busy={busy}
            onSave={(next) => void upsertModel(next)}
            onGrok={() => void grokCard(m.id)}
          />
        ))}
      </section>

      <section className="rounded-xl border border-dashed border-gold/40 bg-surface p-5">
        <h2 className="font-display text-2xl text-fg">Load a new model</h2>
        <p className="mt-1 text-sm text-muted">
          Saving generates her 2257 statement or synthetic exemption automatically.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="Stage name"
            value={draft.stageName}
            onChange={(v) =>
              setDraft({
                ...draft,
                stageName: v,
                slug: draft.slug || v.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
              })
            }
          />
          <Field
            label="Slug"
            value={draft.slug}
            onChange={(v) => setDraft({ ...draft, slug: v })}
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
              <option value="synthetic">Synthetic / AI (exemption)</option>
              <option value="human">Human (full 2257)</option>
              <option value="hybrid">Hybrid (records + AI disclosure)</option>
            </select>
          </label>
          <Field
            label="Portrayed age min (21+)"
            value={String(draft.portrayedAgeMin)}
            onChange={(v) =>
              setDraft({ ...draft, portrayedAgeMin: Math.max(21, Number(v) || 21) })
            }
          />
          <Field
            label="Aliases"
            value={draft.aliases}
            onChange={(v) => setDraft({ ...draft, aliases: v })}
          />
          <Field
            label="Ladder slugs (comma)"
            value={draft.ladderSlugs}
            onChange={(v) => setDraft({ ...draft, ladderSlugs: v })}
          />
        </div>
        <label className="mt-3 block text-xs text-subtle">
          Bio
          <textarea
            value={draft.bio}
            onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
            rows={3}
            className="field-input"
          />
        </label>
        <label className="mt-3 block text-xs text-subtle">
          Looks lock (what the teasers must name)
          <textarea
            value={draft.looks}
            onChange={(e) => setDraft({ ...draft, looks: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="Skin, hair, jewelry, robe, tattoo — unique to her frames"
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
          Tease style for this muse's photosets
          <textarea
            value={draft.teaseStyle}
            onChange={(e) => setDraft({ ...draft, teaseStyle: e.target.value })}
            rows={2}
            className="field-input"
            placeholder="Write from the frame. Never generic nudes."
          />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={draft.likenessOk}
            onChange={(e) => setDraft({ ...draft, likenessOk: e.target.checked })}
            className="size-4 accent-gold"
          />
          Not a real identifiable person (or written authorization on file)
        </label>
        {draft.contentKind !== "synthetic" ? (
          <label className="mt-2 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={draft.recordsOnFile}
              onChange={(e) => setDraft({ ...draft, recordsOnFile: e.target.checked })}
              className="size-4 accent-gold"
            />
            2257 ID records are in the custodian cabinet (not in this app)
          </label>
        ) : null}
        <Button
          className="mt-4"
          variant="gold"
          disabled={busy || !draft.stageName}
          onClick={() => {
            void upsertModel({
              ...draft,
              id: `mod_${draft.slug || draft.stageName.toLowerCase()}`,
              isFictional: draft.contentKind === "synthetic",
            });
          }}
        >
          Load model & generate pack
        </Button>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs text-subtle">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
      />
    </label>
  );
}

function ModelEditor({
  model,
  busy,
  onSave,
  onGrok,
}: {
  model: MuseModel;
  busy: boolean;
  onSave: (m: MuseModel) => void;
  onGrok: () => void;
}) {
  const [m, setM] = useState(model);
  useEffect(() => setM(model), [model]);

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-fg">{m.stageName}</h3>
        <Link
          to="/legal/models/$slug"
          params={{ slug: m.slug }}
          className="text-xs text-gold"
        >
          View generated pack
        </Link>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-subtle">
          Kind
          <select
            value={m.contentKind}
            onChange={(e) =>
              setM({ ...m, contentKind: e.target.value as ContentKind })
            }
            className="field-input"
          >
            <option value="synthetic">Synthetic / AI</option>
            <option value="human">Human</option>
            <option value="hybrid">Hybrid</option>
          </select>
        </label>
        <Field
          label="Portrayed age min"
          value={String(m.portrayedAgeMin)}
          onChange={(v) => setM({ ...m, portrayedAgeMin: Math.max(21, Number(v) || 21) })}
        />
        <Field label="Aliases" value={m.aliases} onChange={(v) => setM({ ...m, aliases: v })} />
        <Field
          label="Ladders"
          value={m.ladderSlugs}
          onChange={(v) => setM({ ...m, ladderSlugs: v })}
        />
      </div>
      {m.contentKind !== "synthetic" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={m.recordsOnFile}
              onChange={(e) => setM({ ...m, recordsOnFile: e.target.checked })}
              className="size-4 accent-gold"
            />
            Records on file with custodian
          </label>
          <Field
            label="ID type on file"
            value={m.idTypeOnFile}
            onChange={(v) => setM({ ...m, idTypeOnFile: v })}
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" disabled={busy} onClick={() => onSave(m)}>
          Save model (auto-pack)
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onGrok}>
          Grok writes portrayal
        </Button>
      </div>
    </div>
  );
}

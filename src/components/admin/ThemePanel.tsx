import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getLegalBundle } from "@/lib/server/legal";
import { getTheme, saveTheme } from "@/lib/server/theme";
import { suggestAesthetic } from "@/lib/server/studio";
import {
  applyThemeToDocument,
  BODY_FONTS,
  completeTheme,
  DEFAULT_THEME,
  DISPLAY_FONTS,
  THEME_PRESETS,
  type VaultTheme,
} from "@/lib/theme";
import type { MuseModel } from "@/lib/legal-types";
import { toast } from "sonner";

function ColorField({
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
      <span className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-border bg-raised p-1"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field-input font-mono text-sm"
        />
      </span>
    </label>
  );
}

export function ThemePanel() {
  const [theme, setTheme] = useState<VaultTheme>(DEFAULT_THEME);
  const [models, setModels] = useState<MuseModel[]>([]);
  const [museId, setMuseId] = useState("");
  const [setType, setSetType] = useState("frontal");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTheme()
      .then((t) => {
        setTheme(t);
        applyThemeToDocument(t);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    getLegalBundle()
      .then((b) => {
        setModels(b.models);
        if (b.models[0]) setMuseId(b.models[0].id);
      })
      .catch(() => undefined);
  }, []);

  function patch(partial: Partial<VaultTheme>) {
    const next = completeTheme({ ...theme, ...partial });
    setTheme(next);
    applyThemeToDocument(next);
  }

  async function save() {
    setBusy(true);
    try {
      const next = await saveTheme({ data: theme });
      setTheme(next);
      applyThemeToDocument(next);
      toast.success("Palette saved. Collectors see it on the next load.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save theme.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setTheme(DEFAULT_THEME);
    applyThemeToDocument(DEFAULT_THEME);
    setBusy(true);
    try {
      await saveTheme({ data: DEFAULT_THEME });
      toast.success("Gold / blood restored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setBusy(false);
    }
  }

  async function grokSuggest() {
    setBusy(true);
    try {
      const muse = models.find((m) => m.id === museId);
      const res = await suggestAesthetic({
        data: {
          museName: muse?.stageName,
          looks: muse?.looks,
          theme: setType,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTheme(res.theme);
      applyThemeToDocument(res.theme);
      await saveTheme({ data: res.theme });
      toast.success(`${res.aesthetic.name}: ${res.aesthetic.rationale}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Suggest failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return <div className="mt-8 h-48 animate-pulse rounded-xl bg-surface" />;

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker kicker-accent">Chrome</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Colors & type</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Live on this vault. Presets, pickers, or Grok reading a muse and
          photoset type. Display type is for titles; body is everything else.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              size="sm"
              onClick={() => {
                setTheme(p.theme);
                applyThemeToDocument(p.theme);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ColorField label="Background" value={theme.bg} onChange={(bg) => patch({ bg })} />
          <ColorField label="Surface" value={theme.surface} onChange={(surface) => patch({ surface })} />
          <ColorField label="Text" value={theme.fg} onChange={(fg) => patch({ fg })} />
          <ColorField label="Accent" value={theme.accent} onChange={(accent) => patch({ accent })} />
          <ColorField label="Heat / CTA" value={theme.blood} onChange={(blood) => patch({ blood })} />
          <ColorField label="Border" value={theme.border} onChange={(border) => patch({ border })} />
          <label className="text-xs text-subtle">
            Display font
            <select
              className="field-input"
              value={theme.displayFont}
              onChange={(e) => patch({ displayFont: e.target.value })}
            >
              {DISPLAY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Body font
            <select
              className="field-input"
              value={theme.bodyFont}
              onChange={(e) => patch({ bodyFont: e.target.value })}
            >
              {BODY_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p
          className="mt-6 font-display text-4xl text-fg"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Watch her take it off. One layer at a time.
        </p>
        <p className="mt-2 max-w-lg text-sm text-muted" style={{ fontFamily: "var(--font-sans)" }}>
          Sequential strip. Nine shots. You cannot skip. The last frame is the one men who quit never see.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save theme"}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => void reset()}>
            Reset gold / blood
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker">Grok</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Suggest from a muse</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Reads her looks lock and the photoset type, then writes a palette, a
          font pairing, and a stills lighting brief.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-subtle">
            Muse
            <select value={museId} onChange={(e) => setMuseId(e.target.value)} className="field-input">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.stageName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-subtle">
            Photoset type
            <select value={setType} onChange={(e) => setSetType(e.target.value)} className="field-input">
              <option value="frontal">Frontal / face</option>
              <option value="worship">Back / curve</option>
              <option value="feet">Feet / floor</option>
              <option value="vault">Whole vault</option>
            </select>
          </label>
        </div>
        <Button className="mt-5" variant="outline" disabled={busy} onClick={() => void grokSuggest()}>
          {busy ? "Reading her…" : "Suggest aesthetic"}
        </Button>
      </section>
    </div>
  );
}

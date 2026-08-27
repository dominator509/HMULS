import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chrome";
import { getLegalBundle } from "@/lib/server/legal";
import {
  authorLikenessSet,
  authorNewMuse,
  commitStudioPlan,
  generateStudioClip,
  generateStudioShot,
  suggestAesthetic,
  writeStudioCopy,
} from "@/lib/server/studio";
import { saveTheme } from "@/lib/server/theme";
import { applyThemeToDocument, themeFromAesthetic } from "@/lib/theme";
import type { MuseModel } from "@/lib/legal-types";
import type { StudioPlan, StudioShotPlan } from "@/lib/studio-types";
import { toast } from "sonner";

const THEMES = [
  { id: "frontal", label: "Frontal / face" },
  { id: "worship", label: "Back / curve" },
  { id: "feet", label: "Feet / floor" },
];

export function StudioPanel({ onLadders }: { onLadders?: () => void }) {
  const [mode, setMode] = useState<"new" | "likeness">("new");
  const [models, setModels] = useState<MuseModel[]>([]);
  const [brief, setBrief] = useState("");
  const [notes, setNotes] = useState("");
  const [theme, setTheme] = useState("frontal");
  const [modelId, setModelId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudioPlan | null>(null);
  const [ladderId, setLadderId] = useState<string | null>(null);
  const [museSlug, setMuseSlug] = useState("");
  const [progress, setProgress] = useState<{ step: number; total: number; note: string } | null>(null);
  const [shotStatus, setShotStatus] = useState<Record<number, "ok" | "blocked" | "pending" | "nudged">>({});

  useEffect(() => {
    getLegalBundle()
      .then((b) => {
        setModels(b.models);
        if (b.models[0]) setModelId(b.models[0].id);
      })
      .catch(() => toast.error("Could not load muses."));
  }, []);

  async function author() {
    setBusy("author");
    setLadderId(null);
    setShotStatus({});
    try {
      if (mode === "new") {
        const res = await authorNewMuse({ data: { brief, theme, notes } });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setPlan(res.plan);
        toast.success(`${res.plan.muse.stageName} · ${res.plan.ladder.title} authored. Review, then onboard.`);
      } else {
        if (!modelId) {
          toast.error("Pick a muse.");
          return;
        }
        const res = await authorLikenessSet({ data: { modelId, theme, brief } });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setPlan(res.plan);
        toast.success(
          `Likeness locked from ${res.framesRead} frames. ${res.plan.ladder.title} is ready to onboard.`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Author failed.");
    } finally {
      setBusy(null);
    }
  }

  async function suggest() {
    setBusy("aes");
    try {
      const picked = models.find((m) => m.id === modelId);
      const res = await suggestAesthetic({
        data: {
          museName: plan?.muse.stageName || picked?.stageName,
          looks: plan?.muse.looks || picked?.looks,
          theme,
          brief: brief || notes,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (plan) setPlan({ ...plan, aesthetic: res.aesthetic });
      applyThemeToDocument(res.theme);
      if (!plan) {
        await saveTheme({ data: res.theme });
        toast.success(`${res.aesthetic.name} applied to the vault.`);
      } else {
        toast.success(`${res.aesthetic.name} loaded into this plan. Apply palette to keep it.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not suggest an aesthetic.");
    } finally {
      setBusy(null);
    }
  }

  async function applyPlanAesthetic() {
    if (!plan) return;
    const themeNext = themeFromAesthetic(plan.aesthetic);
    applyThemeToDocument(themeNext);
    try {
      await saveTheme({ data: themeNext });
      toast.success(`${plan.aesthetic.name} is now the site palette.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save palette.");
    }
  }

  async function commit() {
    if (!plan) return;
    setBusy("commit");
    try {
      const res = await commitStudioPlan({ data: { plan } });
      if (!res.ok) return;
      setLadderId(res.ladderId);
      setMuseSlug(res.museSlug);
      setPlan({ ...plan, muse: { ...plan.muse, id: res.modelId, slug: res.museSlug } });
      onLadders?.();
      toast.success(`${res.modelName} · ${res.slug} onboarded. Generate stills next.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not onboard.");
    } finally {
      setBusy(null);
    }
  }

  async function generateAll() {
    if (!plan || !ladderId) return;
    setBusy("gen");
    let previousSrc: string | undefined;
    const status: Record<number, "ok" | "blocked" | "pending" | "nudged"> = {};
    for (const shot of plan.shots) {
      setProgress({ step: shot.step, total: 9, note: shot.title });
      try {
        const res = await generateStudioShot({
          data: {
            ladderId,
            museSlug: museSlug || plan.muse.slug,
            looks: plan.muse.looks,
            promptStyle: plan.aesthetic.promptStyle,
            shot,
            refUrls: plan.refUrls,
            previousSrc,
          },
        });
        if (res.ok) {
          status[shot.step] = res.nudged ? "nudged" : "ok";
          previousSrc = res.srcUrl;
          if (res.nudged) {
            toast.message(`Shot ${shot.step} vaulted after easing the prompt${res.nudgeDelta ? ` — ${res.nudgeDelta}` : "."}`);
          }
        } else {
          status[shot.step] = "blocked";
          toast.error(`Shot ${shot.step}: ${res.error}`);
        }
        setShotStatus({ ...status });
      } catch (err) {
        status[shot.step] = "blocked";
        setShotStatus({ ...status });
        toast.error(err instanceof Error ? err.message : `Shot ${shot.step} failed.`);
      }
    }
    setProgress(null);
    setBusy(null);
    onLadders?.();
    const ok = Object.values(status).filter((s) => s === "ok").length;
    const blocked = Object.values(status).filter((s) => s === "blocked").length;
    const eased = Object.values(status).filter((s) => s === "nudged").length;
    if (ok || eased) {
      toast.success(
        `${ok + eased} stills vaulted${eased ? ` (${eased} eased past moderation)` : ""}${blocked ? `, ${blocked} still declined` : ""}.`,
      );
    }
  }

  async function generateOne(shot: StudioShotPlan) {
    if (!plan || !ladderId) return;
    setBusy(`shot-${shot.step}`);
    try {
      const res = await generateStudioShot({
        data: {
          ladderId,
          museSlug: museSlug || plan.muse.slug,
          looks: plan.muse.looks,
          promptStyle: plan.aesthetic.promptStyle,
          shot,
          refUrls: plan.refUrls,
        },
      });
      setShotStatus((prev) => ({
        ...prev,
        [shot.step]: res.ok ? (res.nudged ? "nudged" : "ok") : "blocked",
      }));
      if (res.ok) {
        toast.success(
          res.nudged
            ? `Shot ${shot.step} vaulted after easing the prompt${res.nudgeDelta ? ` — ${res.nudgeDelta}` : "."}`
            : `Shot ${shot.step} vaulted.`,
        );
      } else toast.error(res.error || "Declined.");
      onLadders?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed.");
    } finally {
      setBusy(null);
    }
  }

  async function generateClip(shot: StudioShotPlan) {
    if (!plan || !ladderId) return;
    setBusy(`clip-${shot.step}`);
    try {
      const res = await generateStudioClip({
        data: {
          ladderId,
          museSlug: museSlug || plan.muse.slug,
          looks: plan.muse.looks,
          promptStyle: plan.aesthetic.promptStyle,
          shot,
        },
      });
      if (res.ok) {
        setShotStatus((prev) => ({ ...prev, [shot.step]: res.nudged ? "nudged" : "ok" }));
        toast.success(
          res.nudged
            ? `Shot ${shot.step} clip vaulted after easing the prompt${res.nudgeDelta ? ` — ${res.nudgeDelta}` : "."}`
            : `Shot ${shot.step} clip vaulted.`,
        );
      } else {
        toast.error(res.error || "Clip declined.");
      }
      onLadders?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clip failed.");
    } finally {
      setBusy(null);
    }
  }

  async function writeCopy() {
    if (!ladderId) return;
    setBusy("copy");
    try {
      const res = await writeStudioCopy({ data: { ladderId } });
      if (!res.ok) toast.error(res.error);
      else toast.success(`Transporter wrote ${res.written} teases.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker kicker-accent">Studio</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Author with Grok</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Sign in as operator (Grok or email). Transporter authors the muse
          bible, the nine-yes, Imagine prompts, and a matching palette. Stills
          spend Imagine credits — operator click only, nine frames capped.
          If a still is too spicy, the prompt is eased just enough and retried.
          Existing-muse likeness is reverse-engineered from her frames with
          Grok vision (not OCR), then locked into every prompt.
        </p>
        <div className="mt-5">
          <Segmented
            value={mode}
            options={[
              { id: "new", label: "New muse" },
              { id: "likeness", label: "Existing muse" },
            ]}
            onChange={(id) => {
              setMode(id as "new" | "likeness");
              setPlan(null);
              setLadderId(null);
            }}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {mode === "likeness" ? (
            <label className="text-xs text-subtle">
              Muse
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="field-input">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.stageName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-xs text-subtle">
            Photoset type
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="field-input">
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className={`text-xs text-subtle ${mode === "new" ? "sm:col-span-2" : ""}`}>
            {mode === "new" ? "Who she is" : "New night"}
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="field-input"
              rows={3}
              placeholder={
                mode === "new"
                  ? "Caramel skin, tight dark curls, gold moon jewelry, cream silk — a woman who decides if you stay."
                  : "Same woman, new garment story. Rain on the terrace. She never takes the necklace off."
              }
            />
          </label>
          {mode === "new" ? (
            <label className="text-xs text-subtle sm:col-span-2">
              Extra notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="field-input"
                rows={2}
                placeholder="Room, jewelry, what the climax withholds…"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="gold" disabled={busy !== null} onClick={() => void author()}>
            {busy === "author"
              ? mode === "new"
                ? "Authoring…"
                : "Reading frames…"
              : mode === "new"
                ? "Author muse + set"
                : "Lock likeness + author set"}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => void suggest()}>
            {busy === "aes" ? "Suggesting…" : "Suggest aesthetic"}
          </Button>
        </div>
      </section>

      {plan ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <p className="kicker">Plan</p>
          <h2 className="mt-1 font-display text-3xl text-fg">{plan.muse.stageName}</h2>
          <p className="mt-1 text-sm text-gold">{plan.ladder.title}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-subtle">
              Stage name
              <input
                className="field-input"
                value={plan.muse.stageName}
                onChange={(e) => setPlan({ ...plan, muse: { ...plan.muse, stageName: e.target.value } })}
              />
            </label>
            <label className="text-xs text-subtle">
              Photoset title
              <input
                className="field-input"
                value={plan.ladder.title}
                onChange={(e) => setPlan({ ...plan, ladder: { ...plan.ladder, title: e.target.value } })}
              />
            </label>
            <label className="text-xs text-subtle sm:col-span-2">
              Looks lock
              <textarea
                className="field-input"
                rows={2}
                value={plan.muse.looks}
                onChange={(e) => setPlan({ ...plan, muse: { ...plan.muse, looks: e.target.value } })}
              />
            </label>
            <label className="text-xs text-subtle sm:col-span-2">
              Voice
              <textarea
                className="field-input"
                rows={2}
                value={plan.muse.voice}
                onChange={(e) => setPlan({ ...plan, muse: { ...plan.muse, voice: e.target.value } })}
              />
            </label>
            <label className="text-xs text-subtle sm:col-span-2">
              Bio
              <textarea
                className="field-input"
                rows={2}
                value={plan.muse.bio}
                onChange={(e) => setPlan({ ...plan, muse: { ...plan.muse, bio: e.target.value } })}
              />
            </label>
            <label className="text-xs text-subtle sm:col-span-2">
              Tagline
              <input
                className="field-input"
                value={plan.ladder.tagline}
                onChange={(e) => setPlan({ ...plan, ladder: { ...plan.ladder, tagline: e.target.value } })}
              />
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-raised p-4">
            <p className="font-display text-xs tracking-[0.18em] text-gold uppercase">
              {plan.aesthetic.name}
            </p>
            <p className="mt-1 text-sm text-muted">{plan.aesthetic.rationale}</p>
            <label className="mt-3 block text-xs text-subtle">
              Imagine night style
              <textarea
                className="field-input"
                rows={2}
                value={plan.aesthetic.promptStyle}
                onChange={(e) =>
                  setPlan({
                    ...plan,
                    aesthetic: { ...plan.aesthetic, promptStyle: e.target.value },
                  })
                }
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                plan.aesthetic.palette.bg,
                plan.aesthetic.palette.surface,
                plan.aesthetic.palette.fg,
                plan.aesthetic.palette.accent,
                plan.aesthetic.palette.blood,
              ].map((c) => (
                <span
                  key={c}
                  className="size-8 rounded-md border border-border"
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => void applyPlanAesthetic()}>
              Apply palette to site
            </Button>
          </div>

          <ol className="mt-6 space-y-3">
            {plan.shots.map((s, i) => (
              <li key={s.step} className="rounded-lg border border-border bg-raised p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="min-w-0 flex-1 text-xs text-subtle">
                    Shot {s.step}
                    {s.isClimax ? " · climax" : ""}
                    {shotStatus[s.step] === "ok" ? (
                      <span className="ml-2 text-xs text-gold">vaulted</span>
                    ) : shotStatus[s.step] === "nudged" ? (
                      <span className="ml-2 text-xs text-gold">vaulted · eased</span>
                    ) : shotStatus[s.step] === "blocked" ? (
                      <span className="ml-2 text-xs text-blood">declined — swap on Ladders</span>
                    ) : null}
                    <input
                      className="field-input mt-1"
                      value={s.title}
                      onChange={(e) => {
                        const shots = plan.shots.slice();
                        shots[i] = { ...s, title: e.target.value };
                        setPlan({ ...plan, shots });
                      }}
                    />
                  </label>
                  <label className="w-24 text-xs text-subtle">
                    USD
                    <input
                      className="field-input mt-1"
                      value={(s.priceCents / 100).toFixed(2)}
                      onChange={(e) => {
                        const cents = Math.round(Number(e.target.value) * 100);
                        if (!Number.isFinite(cents)) return;
                        const shots = plan.shots.slice();
                        shots[i] = { ...s, priceCents: Math.max(99, cents) };
                        setPlan({ ...plan, shots });
                      }}
                    />
                  </label>
                  {ladderId ? (
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void generateOne(s)}
                      >
                        {busy === `shot-${s.step}` ? "Generating…" : "Generate this still"}
                      </Button>
                      {shotStatus[s.step] === "ok" || shotStatus[s.step] === "nudged" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void generateClip(s)}
                        >
                          {busy === `clip-${s.step}` ? "Clipping…" : "Generate clip"}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <label className="mt-2 block text-xs text-subtle">
                  Visual beat
                  <textarea
                    className="field-input mt-1"
                    rows={2}
                    value={s.visualBeat}
                    onChange={(e) => {
                      const shots = plan.shots.slice();
                      shots[i] = { ...s, visualBeat: e.target.value };
                      setPlan({ ...plan, shots });
                    }}
                  />
                </label>
                <label className="mt-2 block text-xs text-subtle">
                  Imagine prompt
                  <textarea
                    className="field-input mt-1"
                    rows={2}
                    value={s.imaginePrompt}
                    onChange={(e) => {
                      const shots = plan.shots.slice();
                      shots[i] = { ...s, imaginePrompt: e.target.value };
                      setPlan({ ...plan, shots });
                    }}
                  />
                </label>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="gold" disabled={busy !== null || !!ladderId} onClick={() => void commit()}>
              {busy === "commit" ? "Onboarding…" : ladderId ? "Onboarded" : "Onboard muse & photoset"}
            </Button>
            <Button variant="outline" disabled={busy !== null || !ladderId} onClick={() => void generateAll()}>
              {busy === "gen" ? "Generating stills…" : "Generate 9 stills"}
            </Button>
            <Button variant="ghost" disabled={busy !== null || !ladderId} onClick={() => void writeCopy()}>
              {busy === "copy" ? "Writing…" : "Write transporter copy"}
            </Button>
          </div>
          {progress ? (
            <p className="mt-3 text-sm text-muted">
              Generating {progress.step}/{progress.total} — {progress.note}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-subtle">
            If Imagine declines a spicy frame, we ease the prompt a notch — same
            pose, garment, likeness — and retry (up to three). The original
            prompt stays on the shot. Clips spend more credits; generate one at
            a time. If it still refuses, swap a still under Ladders.
          </p>
        </section>
      ) : null}
    </div>
  );
}

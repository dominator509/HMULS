import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/chrome";
import { getLegalBundle } from "@/lib/server/legal";
import {
  authorLikenessSet,
  commitStudioPlan,
  generateStudioClip,
} from "@/lib/server/studio";
import {
  commitNudeMasterPlan,
  generateLockMaster,
  generateNudeMasterShot,
  getOpsStatus,
} from "@/lib/server/nude-master";
import {
  type LadderTheme,
  type NudeMasterBeat,
  NUDE_MASTER_LADDERS,
  laddersForThemes,
} from "@/lib/nude-master";
import type { MuseModel } from "@/lib/legal-types";
import type { StudioPlan } from "@/lib/studio-types";
import { toast } from "sonner";

type ShotStatus = "pending" | "ok" | "nudged" | "blocked";

type CommittedLadder = {
  ladderId: string;
  slug: string;
  title: string;
  theme: LadderTheme;
  shots: { shotId: string; beatId: string; step: number; title: string; isVideoSlot: boolean }[];
};

export function StudioPanel({ onLadders }: { onLadders?: () => void }) {
  const [mode, setMode] = useState<"new" | "likeness">("new");
  const [xai, setXai] = useState<boolean | null>(null);
  const [models, setModels] = useState<MuseModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [stageName, setStageName] = useState("");
  const [identityLock, setIdentityLock] = useState("");
  const [voice, setVoice] = useState("");
  const [notes, setNotes] = useState("");
  const [themes, setThemes] = useState<LadderTheme[]>(["frontal", "worship", "feet"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [lockUrl, setLockUrl] = useState<string | null>(null);
  const [lockPreview, setLockPreview] = useState<string | null>(null);
  const [lockApproved, setLockApproved] = useState(false);
  const [usedOpenRobe, setUsedOpenRobe] = useState(false);
  const [committed, setCommitted] = useState<CommittedLadder[] | null>(null);
  const [museSlug, setMuseSlug] = useState("");
  const [shotStatus, setShotStatus] = useState<Record<string, ShotStatus>>({});
  const [shotPreview, setShotPreview] = useState<Record<string, string>>({});
  const [likenessPlan, setLikenessPlan] = useState<StudioPlan | null>(null);
  const [likenessLadderId, setLikenessLadderId] = useState<string | null>(null);

  useEffect(() => {
    getOpsStatus()
      .then((s) => setXai(s.xai))
      .catch(() => setXai(null));
    getLegalBundle()
      .then((b) => {
        setModels(b.models);
        if (b.models[0]) setModelId(b.models[0].id);
      })
      .catch(() => undefined);
  }, []);

  function toggleTheme(t: LadderTheme) {
    setThemes((prev) => {
      if (prev.includes(t)) {
        const next = prev.filter((x) => x !== t);
        return next.length ? next : prev;
      }
      return [...prev, t];
    });
  }

  async function makeLock() {
    if (!identityLock.trim() || identityLock.trim().length < 40) {
      toast.error("Paste a full identity lock first — looks, hair, body, jewelry. It is copied verbatim into every prompt.");
      return;
    }
    setBusy("lock");
    try {
      const res = await Promise.race([
        generateLockMaster({
          data: { identityLock, stageName },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Image 0 timed out waiting on Grok Imagine. If Grok is under heavy load, wait a minute and try once more.",
                ),
              ),
            90_000,
          ),
        ),
      ]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLockUrl(res.lockUrl);
      setLockPreview(res.previewDataUrl);
      setLockApproved(false);
      setCommitted(null);
      setUsedOpenRobe(Boolean(res.usedOpenRobe));
      toast.success(
        res.usedOpenRobe
          ? "Image 0 landed with the open-robe fallback. Approve it or reroll."
          : "Image 0 nude lock is ready. Approve it before generating paid stills.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image 0 failed.");
    } finally {
      setBusy(null);
    }
  }

  async function approveLock() {
    if (!lockUrl) return;
    if (!stageName.trim()) {
      toast.error("Give her a stage name before onboarding.");
      return;
    }
    setBusy("approve");
    try {
      const res = await commitNudeMasterPlan({
        data: {
          identityLock,
          stageName,
          voice,
          bio: notes,
          lockUrl,
          themes,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLockApproved(true);
      setCommitted(res.ladders);
      setMuseSlug(res.museSlug);
      setShotStatus({});
      setShotPreview({});
      onLadders?.();
      toast.success(`${res.modelName} onboarded. Image 0 is the source for every paid still.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not onboard.");
    } finally {
      setBusy(null);
    }
  }

  async function generateBeat(ladder: CommittedLadder, shot: CommittedLadder["shots"][number], packShot: NudeMasterBeat) {
    if (!lockUrl) return;
    const key = shot.shotId;
    setBusy(key);
    try {
      const res = await generateNudeMasterShot({
        data: {
          ladderId: ladder.ladderId,
          shotId: shot.shotId,
          step: shot.step,
          title: shot.title,
          visualBeat: packShot.visualBeat,
          identityLock,
          lockUrl,
          museSlug,
          isClimax: packShot.isClimax,
          beat: packShot,
        },
      });
      if (!res.ok) {
        setShotStatus((s) => ({ ...s, [key]: "blocked" }));
        toast.error(`${shot.title}: ${res.error}`);
        return;
      }
      setShotStatus((s) => ({ ...s, [key]: res.nudged ? "nudged" : "ok" }));
      if (res.previewDataUrl) {
        setShotPreview((s) => ({ ...s, [key]: res.previewDataUrl }));
      }
      onLadders?.();
      toast.success(
        res.nudged
          ? `${shot.title} vaulted after easing the prompt.`
          : `${shot.title} vaulted from Image 0.`,
      );
    } catch (err) {
      setShotStatus((s) => ({ ...s, [key]: "blocked" }));
      toast.error(err instanceof Error ? err.message : `${shot.title} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function generateSet(ladder: CommittedLadder) {
    const pack = NUDE_MASTER_LADDERS.find((l) => l.theme === ladder.theme);
    if (!pack) return;
    for (const shot of ladder.shots) {
      const beat = pack.shots.find((b) => b.step === shot.step);
      if (!beat) continue;
      await generateBeat(ladder, shot, beat);
      if (busy === "stop") return;
    }
  }

  async function generateRemaining() {
    if (!committed) return;
    for (const ladder of committed) {
      const pack = NUDE_MASTER_LADDERS.find((l) => l.theme === ladder.theme);
      if (!pack) continue;
      for (const shot of ladder.shots) {
        if (shotStatus[shot.shotId] === "ok" || shotStatus[shot.shotId] === "nudged") continue;
        const beat = pack.shots.find((b) => b.step === shot.step);
        if (!beat) continue;
        await generateBeat(ladder, shot, beat);
      }
    }
  }

  async function clipFor(ladder: CommittedLadder, shot: CommittedLadder["shots"][number], packShot: NudeMasterBeat) {
    setBusy(`clip-${shot.shotId}`);
    try {
      const res = await generateStudioClip({
        data: {
          ladderId: ladder.ladderId,
          museSlug,
          looks: identityLock,
          promptStyle: "Same apartment night as Image 0. Mid-motion still energy.",
          shot: {
            step: shot.step,
            title: shot.title,
            visualBeat: packShot.visualBeat,
            imaginePrompt: packShot.visualBeat,
            priceCents: 0,
            isClimax: packShot.isClimax,
          },
        },
      });
      if (res.ok) toast.success(`${shot.title} clip vaulted.`);
      else toast.error(res.error || "Clip declined.");
      onLadders?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Clip failed.");
    } finally {
      setBusy(null);
    }
  }

  const packs = laddersForThemes(themes);
  const imagineOff = xai === false;

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="kicker kicker-accent">Studio</p>
        <h2 className="mt-1 font-display text-3xl text-fg">Nude lock, then dress her</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Generate her fully nude Image 0 first and approve it. Every paid still is an
          edit of that lock that ADDS clothes for early beats. Imagine rejects that path
          less than starting clothed and undressing. Identity lock is pasted verbatim
          into every prompt.
        </p>
        {imagineOff ? (
          <p className="mt-4 rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-fg">
            Grok Imagine is not configured on this Worker (`XAI_API_KEY`). You can still
            write the lock and layout; generate stays off until the key is set.
          </p>
        ) : null}
        <div className="mt-5">
          <Segmented
            value={mode}
            options={[
              { id: "new", label: "New muse" },
              { id: "likeness", label: "Existing muse" },
            ]}
            onChange={(id) => {
              setMode(id as "new" | "likeness");
              setLikenessPlan(null);
              setLikenessLadderId(null);
            }}
          />
        </div>
      </section>

      {mode === "new" ? (
        <>
          <section className="rounded-xl border border-border bg-surface p-5">
            <p className="kicker">Identity</p>
            <h2 className="mt-1 font-display text-3xl text-fg">Who she is</h2>
            <label className="mt-5 block text-xs text-subtle">
              Stage name
              <input
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                className="field-input"
                placeholder="Collectors will see this"
              />
            </label>
            <label className="mt-3 block text-xs text-subtle">
              Identity lock (verbatim first paragraph of every Imagine prompt)
              <textarea
                value={identityLock}
                onChange={(e) => setIdentityLock(e.target.value)}
                rows={6}
                className="field-input"
                placeholder="Face geometry, eye shape, nose, lips, hair, skin, head-to-body ratio, shoulder width, waist-to-hip, breast size/shape, hip width, jewelry. Do not mention another muse."
              />
            </label>
            <label className="mt-3 block text-xs text-subtle">
              Voice (optional)
              <textarea
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                rows={2}
                className="field-input"
                placeholder="How she talks in a tease."
              />
            </label>
            <label className="mt-3 block text-xs text-subtle">
              Extra notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="field-input"
                placeholder="Room, what the climax withholds…"
              />
            </label>
            <p className="mt-5 text-xs text-subtle">Photosets to generate after you approve Image 0</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {(
                [
                  ["frontal", "The Reveal"],
                  ["worship", "The Curve"],
                  ["feet", "The Pedestal"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    checked={themes.includes(id)}
                    onChange={() => toggleTheme(id)}
                    className="size-4 accent-[#c9a227]"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="gold"
                disabled={Boolean(busy) || imagineOff}
                onClick={() => void makeLock()}
              >
                {busy === "lock" ? "Generating Image 0…" : lockUrl ? "Reroll Image 0" : "Generate Image 0 · nude lock"}
              </Button>
            </div>
          </section>

          {lockPreview ? (
            <section className="rounded-xl border border-border bg-surface p-5">
              <p className="kicker kicker-accent">Image 0</p>
              <h2 className="mt-1 font-display text-3xl text-fg">Nude lock</h2>
              <p className="mt-2 max-w-xl text-sm text-muted">
                This is the only visual authority. Paid stills edit this file. They never
                use a drifted child as the new source.
                {usedOpenRobe ? " Landed on the open-robe fallback after a moderation retry." : ""}
              </p>
              <img
                src={lockPreview}
                alt="Image 0 nude identity lock"
                className="mt-5 max-h-[70vh] w-full max-w-md rounded-lg border border-border object-contain"
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="gold"
                  disabled={Boolean(busy) || lockApproved}
                  onClick={() => void approveLock()}
                >
                  {busy === "approve" ? "Onboarding…" : lockApproved ? "Lock approved" : "Approve lock"}
                </Button>
                <Button variant="outline" disabled={Boolean(busy) || imagineOff} onClick={() => void makeLock()}>
                  Reroll lock
                </Button>
              </div>
            </section>
          ) : null}

          {lockApproved && committed ? (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="gold"
                  disabled={Boolean(busy) || imagineOff}
                  onClick={() => void generateRemaining()}
                >
                  Generate remaining stills
                </Button>
                <p className="text-sm text-muted">
                  {packs.length} set{packs.length === 1 ? "" : "s"} · source is always Image 0
                </p>
              </div>
              {committed.map((ladder) => {
                const pack = NUDE_MASTER_LADDERS.find((l) => l.theme === ladder.theme);
                return (
                  <div key={ladder.ladderId} className="rounded-xl border border-border bg-surface p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="kicker">{ladder.theme}</p>
                        <h3 className="mt-1 font-display text-2xl text-fg">{ladder.title}</h3>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(busy) || imagineOff}
                        onClick={() => void generateSet(ladder)}
                      >
                        Generate this set
                      </Button>
                    </div>
                    <ul className="mt-5 grid gap-4 md:grid-cols-2">
                      {ladder.shots.map((shot) => {
                        const beat = pack?.shots.find((b) => b.step === shot.step);
                        const status = shotStatus[shot.shotId];
                        return (
                          <li key={shot.shotId} className="rounded-lg border border-border p-4">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="font-display text-xl text-fg">
                                {shot.step}. {shot.title}
                              </p>
                              {status === "ok" ? (
                                <span className="text-xs text-gold">vaulted</span>
                              ) : status === "nudged" ? (
                                <span className="text-xs text-gold">vaulted · eased</span>
                              ) : status === "blocked" ? (
                                <span className="text-xs text-blood">declined</span>
                              ) : (
                                <span className="text-xs text-subtle">pending</span>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-muted">{beat?.visualBeat}</p>
                            {shotPreview[shot.shotId] ? (
                              <img
                                src={shotPreview[shot.shotId]}
                                alt={shot.title}
                                className="mt-3 max-h-64 w-full rounded-md object-contain"
                              />
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="gold"
                                disabled={Boolean(busy) || imagineOff || !beat}
                                onClick={() => beat && void generateBeat(ladder, shot, beat)}
                              >
                                {busy === shot.shotId
                                  ? "Generating…"
                                  : status
                                    ? "Reroll this shot"
                                    : "Generate this shot"}
                              </Button>
                              {shot.isVideoSlot && (status === "ok" || status === "nudged") ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={Boolean(busy) || imagineOff || !beat}
                                  onClick={() => beat && void clipFor(ladder, shot, beat)}
                                >
                                  {busy === `clip-${shot.shotId}` ? "Clipping…" : "Generate clip"}
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          ) : null}
        </>
      ) : (
        <LikenessStudio
          models={models}
          modelId={modelId}
          setModelId={setModelId}
          imagineOff={imagineOff}
          busy={busy}
          setBusy={setBusy}
          plan={likenessPlan}
          setPlan={setLikenessPlan}
          ladderId={likenessLadderId}
          setLadderId={setLikenessLadderId}
          onLadders={onLadders}
        />
      )}
    </div>
  );
}

function LikenessStudio({
  models,
  modelId,
  setModelId,
  imagineOff,
  busy,
  setBusy,
  plan,
  setPlan,
  ladderId,
  setLadderId,
  onLadders,
}: {
  models: MuseModel[];
  modelId: string;
  setModelId: (v: string) => void;
  imagineOff: boolean;
  busy: string | null;
  setBusy: (v: string | null) => void;
  plan: StudioPlan | null;
  setPlan: (p: StudioPlan | null) => void;
  ladderId: string | null;
  setLadderId: (v: string | null) => void;
  onLadders?: () => void;
}) {
  const [theme, setTheme] = useState("frontal");
  const [brief, setBrief] = useState("");

  async function author() {
    if (!modelId) {
      toast.error("Pick a muse.");
      return;
    }
    setBusy("author");
    try {
      const res = await authorLikenessSet({ data: { modelId, theme, brief } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPlan(res.plan);
      setLadderId(null);
      toast.success(`Likeness locked from ${res.framesRead} frames. Review, then onboard.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Author failed.");
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!plan) return;
    setBusy("commit");
    try {
      const res = await commitStudioPlan({ data: { plan } });
      if (!res.ok) {
        toast.error("Could not onboard.");
        return;
      }
      setLadderId(res.ladderId);
      onLadders?.();
      toast.success(`${res.modelName} · ${res.slug} onboarded.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not onboard.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <p className="kicker">Likeness</p>
      <h2 className="mt-1 font-display text-3xl text-fg">New night, same woman</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Reverse-engineers looks from her existing frames, then authors one new set.
        Prefer New muse + Image 0 lock when you are starting from scratch.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
        <label className="text-xs text-subtle">
          Photoset type
          <select value={theme} onChange={(e) => setTheme(e.target.value)} className="field-input">
            <option value="frontal">The Reveal · frontal</option>
            <option value="worship">The Curve · back</option>
            <option value="feet">The Pedestal · feet</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs text-subtle">
        New night
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          className="field-input"
          placeholder="Same woman, new garment story."
        />
      </label>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="gold" disabled={Boolean(busy) || imagineOff} onClick={() => void author()}>
          {busy === "author" ? "Reading frames…" : "Lock likeness + author set"}
        </Button>
        {plan ? (
          <Button disabled={Boolean(busy) || Boolean(ladderId)} onClick={() => void commit()}>
            {busy === "commit" ? "Onboarding…" : ladderId ? "Onboarded" : "Onboard this set"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

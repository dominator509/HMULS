import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  addShot,
  getAnalytics,
  listAdminLadders,
  replaceShotMedia,
  updateLadderMeta,
  updateShotPrice,
} from "@/lib/server/admin";
import { runSurfaceTransporter, runTransporter, autoWriteFromMedia, saveDials, clearSurfaces, getPsychology } from "@/lib/server/transporter";
import { getMyRole, claimOwner } from "@/lib/server/catalog";
import type { AnalyticsSnapshot } from "@/lib/types";
import { DIAL_META, DEFAULT_DIALS, dialEffects, type Dials, type Surfaces, fallbackSurfaces } from "@/lib/psychology";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { LegalPanel } from "@/components/admin/LegalPanel";
import { ConnectorsPanel } from "@/components/admin/ConnectorsPanel";
import { MusesPanel } from "@/components/admin/MusesPanel";
import { StampsPanel } from "@/components/admin/StampsPanel";
import { StudioPanel } from "@/components/admin/StudioPanel";
import { ThemePanel } from "@/components/admin/ThemePanel";
import { Button } from "@/components/ui/button";
import { PageHeader, Segmented } from "@/components/ui/chrome";
import { formatUsd } from "@/lib/utils";
import { privateHead } from "@/lib/seo";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => privateHead("/admin", "Ops | SHE UNDRESSES"),
});

type AdminLadder = Awaited<ReturnType<typeof listAdminLadders>>[number];

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState<AnalyticsSnapshot | null>(null);
  const [ladders, setLadders] = useState<AdminLadder[]>([]);
  const [bootstrap, setBootstrap] = useState("");
  const [roleTick, setRoleTick] = useState(0);
  const [tab, setTab] = useState<
    "stats" | "studio" | "muses" | "ladders" | "dials" | "theme" | "stamps" | "legal" | "connectors"
  >("stats");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 3; i++) {
        try {
          const r = await getMyRole();
          if (!cancelled) setRole(r.role);
          return;
        } catch {
          await new Promise((res) => setTimeout(res, 400 * (i + 1)));
        }
      }
      if (!cancelled) setRole("unknown");
    })();
    return () => {
      cancelled = true;
    };
  }, [user, roleTick]);

  useEffect(() => {
    if (role !== "admin") return;
    getAnalytics()
      .then(setStats)
      .catch(() => setStats(null));
    listAdminLadders()
      .then(setLadders)
      .catch(() => setLadders([]));
  }, [role]);

  if (isPending || (user && role === null)) {
    return <div className="px-5 py-24 text-center text-muted">Checking operator access…</div>;
  }
  if (!user) return <RedirectToSignIn />;
  if (role === "unknown") {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="text-muted">
          Could not verify operator access. The Worker often drops the first
          auth call. Retry.
        </p>
        <Button
          className="mt-6"
          size="xl"
          onClick={() => {
            setRole(null);
            setRoleTick((n) => n + 1);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="text-muted">
          This inbox is not an operator. Sign in as the designated operator, or
          paste the one-time bootstrap secret only if you were given one.
        </p>
        <label className="mt-6 block text-left text-xs text-subtle">
          Bootstrap secret
          <input
            type="password"
            value={bootstrap}
            onChange={(e) => setBootstrap(e.target.value)}
            className="field-input mt-1"
          />
        </label>
        <Button
          className="mt-4"
          size="xl"
          onClick={() => {
            claimOwner({ data: { secret: bootstrap } })
              .then(() => {
                setRole("admin");
                toast.success("Vault claimed.");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Claim failed."));
          }}
        >
          Claim owner
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader kicker="Operator" title="Vault control" body="Prices, muses, photosets, and legal save to the live vault. Studio and copy rewrite need an xAI key on this Worker." />
      <div className="mt-6">
        <Segmented
          value={tab}
          options={[
            { id: "stats", label: "Analytics" },
            { id: "studio", label: "Studio" },
            { id: "muses", label: "Muses" },
            { id: "ladders", label: "Photosets" },
            { id: "dials", label: "Pressure" },
            { id: "theme", label: "Theme" },
            { id: "stamps", label: "Watermarks" },
            { id: "legal", label: "Legal" },
            { id: "connectors", label: "API keys" },
          ]}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>

      {tab === "stats" ? (
        <Stats stats={stats} />
      ) : tab === "studio" ? (
        <StudioPanel
          onLadders={() => {
            listAdminLadders()
              .then(setLadders)
              .catch(() => undefined);
          }}
        />
      ) : tab === "muses" ? (
        <MusesPanel
          onLadders={() => {
            listAdminLadders()
              .then(setLadders)
              .catch(() => undefined);
          }}
        />
      ) : tab === "ladders" ? (
        <LaddersEditor ladders={ladders} onChange={setLadders} />
      ) : tab === "theme" ? (
        <ThemePanel />
      ) : tab === "stamps" ? (
        <StampsPanel />
      ) : tab === "legal" ? (
        <LegalPanel />
      ) : tab === "connectors" ? (
        <ConnectorsPanel />
      ) : (
        <DialsPanel ladders={ladders} onLadders={setLadders} />
      )}
    </div>
  );
}

function Stats({ stats }: { stats: AnalyticsSnapshot | null }) {
  if (!stats) {
    return (
      <p className="mt-10 text-sm text-muted">
        Analytics did not load. Refresh, or check that this inbox is an operator.
      </p>
    );
  }
  const cards = [
    { l: "Revenue", v: formatUsd(stats.revenueCents) },
    { l: "Unlocks", v: String(stats.unlockCount) },
    { l: "Paid invoices", v: String(stats.invoiceCount) },
    { l: "View → paid invoice", v: `${stats.conversionPct}%` },
  ];
  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.l} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-subtle">{c.l}</p>
            <p className="mt-1 font-display text-3xl tabular-nums text-fg">{c.v}</p>
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl border border-border bg-surface p-4">
        <p className="mb-3 text-xs text-subtle">Revenue by ladder</p>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={stats.byLadder.map((l) => ({ name: l.title, usd: l.revenueCents / 100 }))}>
            <XAxis dataKey="name" stroke="#6e6a64" fontSize={11} />
            <YAxis stroke="#6e6a64" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#121212", border: "1px solid #2a2422" }}
            />
            <Bar dataKey="usd" fill="#c9a227" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-raised text-xs text-subtle">
            <tr>
              <th className="px-4 py-3">Ladder</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3">Unlocks</th>
              <th className="px-4 py-3">Climax</th>
              <th className="px-4 py-3">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {stats.byLadder.map((l) => (
              <tr key={l.ladderId} className="border-t border-border">
                <td className="px-4 py-3">{l.title}</td>
                <td className="px-4 py-3 tabular-nums">{l.views}</td>
                <td className="px-4 py-3 tabular-nums">{l.unlocks}</td>
                <td className="px-4 py-3 tabular-nums">{l.climaxUnlocks}</td>
                <td className="px-4 py-3 tabular-nums">{formatUsd(l.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="mb-3 text-xs text-subtle">Recent events</p>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-muted">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {stats.recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-muted">
                <span>{r.kind}{r.ladderId ? ` · ${r.ladderId}` : ""}</span>
                <span className="tabular-nums text-subtle">{r.createdAt.replace("T", " ").slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function LaddersEditor({
  ladders,
  onChange,
}: {
  ladders: AdminLadder[];
  onChange: (l: AdminLadder[]) => void;
}) {
  return (
    <div className="mt-8 space-y-8">
      {ladders.map((lad) => (
        <LadderBlock
          key={lad.id}
          ladder={lad}
          onUpdate={(next) => onChange(ladders.map((l) => (l.id === next.id ? next : l)))}
        />
      ))}
    </div>
  );
}

function LadderBlock({
  ladder,
  onUpdate,
}: {
  ladder: AdminLadder;
  onUpdate: (l: AdminLadder) => void;
}) {
  const [title, setTitle] = useState(ladder.title);
  const [tagline, setTagline] = useState(ladder.tagline);
  const [disc, setDisc] = useState(Math.round(ladder.bundleDiscount * 100));
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPrice, setNewPrice] = useState("0.25");
  const [newBeat, setNewBeat] = useState("");
  const [autoBusy, setAutoBusy] = useState(false);
  const [replaceUrl, setReplaceUrl] = useState<Record<string, string>>({});
  const [replaceBusy, setReplaceBusy] = useState<string | null>(null);

  async function saveMeta() {
    try {
      await updateLadderMeta({
        data: {
          id: ladder.id,
          title,
          tagline,
          bundleDiscount: disc / 100,
          published: ladder.published,
        },
      });
      onUpdate({ ...ladder, title, tagline, bundleDiscount: disc / 100, published: ladder.published });
      toast.success("Photoset saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function savePrice(shotId: string, dollars: string) {
    const cents = Math.round(Number(dollars) * 100);
    if (!Number.isFinite(cents)) return;
    try {
      await updateShotPrice({ data: { shotId, priceCents: cents } });
      onUpdate({
        ...ladder,
        shots: ladder.shots.map((s) =>
          s.id === shotId ? { ...s, price_cents: cents } : s,
        ),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Price failed.");
    }
  }

  async function createShot() {
    if (!newTitle || !newUrl) {
      toast.error("Title and media URL required.");
      return;
    }
    try {
      const cents = Math.round(Number(newPrice) * 100);
      await addShot({
        data: {
          ladderId: ladder.id,
          title: newTitle,
          tease: newTitle,
          grantCopy: `${newTitle} is unlocked.`,
          mediaUrl: newUrl,
          mediaType: newUrl.endsWith(".mp4") ? "video" : "photo",
          priceCents: cents,
          isClimax: false,
          visualBeat: newBeat,
        },
      });
      const fresh = await listAdminLadders();
      const next = fresh.find((l) => l.id === ladder.id);
      if (next) onUpdate(next);
      setNewTitle("");
      setNewUrl("");
      setNewBeat("");
      toast.success("Shot added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add shot.");
    }
  }

  async function replaceMedia(shotId: string) {
    const url = (replaceUrl[shotId] || "").trim();
    if (!url) {
      toast.error("Paste a /media or https photo or video URL first.");
      return;
    }
    setReplaceBusy(shotId);
    try {
      await replaceShotMedia({ data: { shotId, mediaUrl: url } });
      const fresh = await listAdminLadders();
      const next = fresh.find((l) => l.id === ladder.id);
      if (next) onUpdate(next);
      setReplaceUrl((prev) => ({ ...prev, [shotId]: "" }));
      toast.success("Photo/video replaced in the vault.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replace failed.");
    } finally {
      setReplaceBusy(null);
    }
  }

  async function autoFromPhotos() {
    setAutoBusy(true);
    try {
      const res = await autoWriteFromMedia({ data: { ladderId: ladder.id } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Saw ${res.seen} frames, wrote ${res.written} teases${res.failed ? ` (${res.failed} skipped)` : ""}.`,
      );
      const fresh = await listAdminLadders();
      const next = fresh.find((l) => l.id === ladder.id);
      if (next) onUpdate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auto-generate failed.");
    } finally {
      setAutoBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs tracking-[0.16em] text-gold uppercase">{ladder.modelName}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-subtle">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="text-xs text-subtle">
          Tagline
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="field-input"
          />
        </label>
        <label className="text-xs text-subtle">
          Bundle discount %
          <input
            type="number"
            value={disc}
            onChange={(e) => setDisc(Number(e.target.value))}
            className="field-input"
          />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-fg">
        <input
          type="checkbox"
          checked={ladder.published}
          onChange={(e) => onUpdate({ ...ladder, published: e.target.checked })}
          className="size-4 accent-[#c9a227]"
        />
        Published on the site
      </label>
      <Button className="mt-4" variant="gold" size="sm" onClick={() => void saveMeta()}>
        Save photoset
      </Button>
      <Button
        className="mt-4 ml-2"
        variant="outline"
        size="sm"
        disabled={autoBusy || ladder.shots.length === 0}
        onClick={() => void autoFromPhotos()}
      >
        {autoBusy ? "Seeing frames…" : "Auto from photos"}
      </Button>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Shot</th>
              <th className="py-2 pr-3">USD</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Replace photo/video</th>
            </tr>
          </thead>
          <tbody>
            {ladder.shots.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-2 pr-3 tabular-nums text-subtle">{s.step_index}</td>
                <td className="py-2 pr-3">
                  {s.title}
                  {s.is_climax ? " · climax" : ""}
                </td>
                <td className="py-2 pr-3">
                  <input
                    defaultValue={(s.price_cents / 100).toFixed(2)}
                    className="field-input h-9 w-24"
                    onBlur={(e) => void savePrice(s.id, e.target.value)}
                  />
                </td>
                <td className="py-2 pr-3 text-subtle">{s.media_type}</td>
                <td className="py-2 pr-3">
                  <span className="flex min-w-[14rem] items-center gap-2">
                    <input
                      value={replaceUrl[s.id] ?? ""}
                      onChange={(e) =>
                        setReplaceUrl((prev) => ({ ...prev, [s.id]: e.target.value }))
                      }
                      placeholder="/media or https"
                      className="field-input h-9"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={replaceBusy !== null}
                      onClick={() => void replaceMedia(s.id)}
                    >
                      {replaceBusy === s.id ? "…" : "Swap"}
                    </Button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <input
          placeholder="New shot title"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="field-input"
        />
        <input
          placeholder="Media URL (/media/… or https://)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          className="field-input"
        />
        <input
          placeholder="Visual beat — what's in this frame"
          value={newBeat}
          onChange={(e) => setNewBeat(e.target.value)}
          className="field-input sm:col-span-2"
        />
        <div className="flex gap-2">
          <label className="text-xs text-subtle">
            USD
            <input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="field-input w-24"
            />
          </label>
          <Button variant="outline" onClick={() => void createShot()}>
            Add shot
          </Button>
        </div>
      </div>
    </section>
  );
}

function DialsPanel({
  ladders,
  onLadders,
}: {
  ladders: AdminLadder[];
  onLadders: (l: AdminLadder[]) => void;
}) {
  const [dials, setDials] = useState<Dials>(DEFAULT_DIALS);
  const [surfaces, setSurfaces] = useState<Surfaces>(() => fallbackSurfaces(DEFAULT_DIALS));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    getPsychology()
      .then((p) => {
        setDials(p.dials);
        setSurfaces(p.surfaces);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const fx = dialEffects(dials);

  async function save() {
    setSaving(true);
    try {
      const next = await saveDials({ data: dials });
      setDials(next);
      toast.success("Dials saved. Live pressure (blur, timers, bump, copy fallbacks) updates now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save dials.");
    } finally {
      setSaving(false);
    }
  }

  async function transport(ladderId: string) {
    setRunning(ladderId);
    try {
      const res = await runTransporter({ data: { ladderId } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Grok wrote ${res.written} shots on ${res.ladderTitle}.`);
      const fresh = await listAdminLadders();
      onLadders(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transporter failed.");
    } finally {
      setRunning(null);
    }
  }

  async function transportSurfaces() {
    setRunning("surfaces");
    try {
      const res = await runSurfaceTransporter();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSurfaces(res.surfaces);
      toast.success("Grok rewrote homepage, sticky, checkout, and post-grant copy.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Surface transporter failed.");
    } finally {
      setRunning(null);
    }
  }

  async function transportAll() {
    setRunning("all");
    try {
      for (const l of ladders) {
        const res = await runTransporter({ data: { ladderId: l.id } });
        if (!res.ok) {
          toast.error(`${l.title}: ${res.error}`);
          return;
        }
        toast.success(`${l.title}: ${res.written} shots.`);
      }
      const surf = await runSurfaceTransporter();
      if (surf.ok) {
        setSurfaces(surf.surfaces);
        toast.success("Vault chrome rewritten.");
      } else {
        toast.error(surf.error);
      }
      const fresh = await listAdminLadders();
      onLadders(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transporter failed.");
    } finally {
      setRunning(null);
    }
  }

  async function resetSurfaces() {
    try {
      const next = await clearSurfaces();
      setSurfaces(next);
      toast.success("Chrome copy reset to dial fallbacks.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset.");
    }
  }

  if (!loaded) return <div className="mt-8 h-48 animate-pulse rounded-xl bg-surface" />;

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="font-display text-xs tracking-[0.24em] text-gold uppercase">
          Sales psychology
        </p>
        <h2 className="mt-1 font-display text-3xl text-fg">Dials</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          These sliders change live pressure immediately: deadlines, blur, price
          bumps, scarcity, and fallback copy. Save first. Rewriting tease/homepage
          copy needs an xAI key on this Worker.
        </p>
        <div className="mt-6 space-y-5">
          {DIAL_META.map((m) => (
            <label key={m.key} className="block">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">{m.label}</span>
                <span className="tabular-nums text-gold">{dials[m.key]}/10</span>
              </div>
              <input
                type="range"
                min={0}
                max={10}
                value={dials[m.key]}
                onChange={(e) =>
                  setDials({ ...dials, [m.key]: Number(e.target.value) })
                }
                className="mt-2 w-full accent-gold"
              />
              <p className="mt-1 text-xs text-subtle">{m.hint}</p>
            </label>
          ))}
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 text-xs md:grid-cols-5">
          {[
            { l: "Preferred window", v: `${fx.continueHours}h` },
            { l: "Invoice dies", v: `${fx.invoiceMinutes}m` },
            { l: "Next-shot blur", v: `${fx.nextBlur}px` },
            { l: "Locked blur", v: `${fx.lockedBlur}px` },
            { l: "Expired bump", v: fx.bumpPct ? `+${fx.bumpPct}%` : "off" },
          ].map((x) => (
            <div key={x.l} className="rounded-md border border-border bg-raised p-3">
              <dt className="text-subtle">{x.l}</dt>
              <dd className="mt-1 font-display text-xl text-gold">{x.v}</dd>
            </div>
          ))}
        </dl>
        <Button className="mt-6" variant="gold" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save dials"}
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="font-display text-xs tracking-[0.24em] text-gold uppercase">
          Copy rewrite
        </p>
        <h2 className="mt-1 font-display text-3xl text-fg">Write the vault</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Built-in prompts ship with the app. Operator click only — never on
          page load. Each ladder run rewrites tease, grant, story, drop-off,
          tagline, and description. Surfaces rewrites homepage, sticky bar,
          checkout, and the post-grant hook.
        </p>
        <div className="mt-5 space-y-2">
          {ladders.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3"
            >
              <div>
                <p className="text-sm text-fg">{l.title}</p>
                <p className="text-xs text-subtle">{l.theme} · {l.shots.length} shots</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={running !== null}
                onClick={() => void transport(l.id)}
              >
                {running === l.id ? "Writing…" : "Run transporter"}
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3">
            <div>
              <p className="text-sm text-fg">Vault chrome</p>
              <p className="text-xs text-subtle">Hero, sticky, checkout, unfinished</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={running !== null}
              onClick={() => void transportSurfaces()}
            >
              {running === "surfaces" ? "Writing…" : "Write surfaces"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="gold" disabled={running !== null} onClick={() => void transportAll()}>
            {running === "all" ? "Writing everything…" : "Write all copy"}
          </Button>
          <Button variant="ghost" onClick={() => void resetSurfaces()}>
            Reset chrome to dial fallbacks
          </Button>
        </div>
        <div className="mt-6 rounded-md border border-border bg-raised p-4 text-sm text-muted">
          <p className="font-display text-xs tracking-[0.18em] text-gold uppercase">Live chrome</p>
          <p className="mt-2 text-fg">{surfaces.heroHeadline}</p>
          <p className="mt-1">{surfaces.heroBody}</p>
          <p className="mt-3 text-xs text-subtle">Sticky · {surfaces.stickyCta}</p>
          <p className="text-xs text-subtle">After pay · {surfaces.postGrant}</p>
        </div>
      </section>
    </div>
  );
}

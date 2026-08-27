import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listLadders, getMyUnlocks } from "@/lib/server/catalog";
import { getPsychology } from "@/lib/server/transporter";
import type { LadderPublic } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { collectorTier, formatCompact, formatUsd, remainingLabel } from "@/lib/utils";
import {
  DEFAULT_DIALS,
  fallbackSurfaces,
  type Dials,
  type Surfaces,
} from "@/lib/psychology";
import { LETTER, statusLine } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Kicker, ProgressBar } from "@/components/ui/chrome";
import { Lock, Play } from "lucide-react";
import { getDiscover } from "@/lib/server/discover";
import { FaqList, JsonLd } from "@/components/seo/JsonLd";
import {
  DEFAULT_DESC,
  headTags,
  homeFaqs,
  jsonLdGraph,
  modelAlt,
} from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: () => getDiscover(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin || "";
    const names = (loaderData?.models ?? []).map((m) => m.stageName).join(", ");
    return headTags({
      title: "SHE UNDRESSES — sequential adult photosets",
      description: names
        ? `Sequential unlock photosets from ${names}. She undresses for you, one paid permission at a time. 18+.`
        : DEFAULT_DESC,
      path: "/",
      origin,
      image: "/media/hero.jpg",
      keywords: `SHE UNDRESSES, sequential unlock, Nine-Yes, ${names}`,
    });
  },
  component: Home,
});

function Home() {
  const boot = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [ladders, setLadders] = useState<LadderPublic[] | null>(boot?.ladders ?? null);
  const [unlocks, setUnlocks] = useState<{ shot_id: string; ladder_id: string }[]>([]);
  const [dials, setDials] = useState<Dials>(DEFAULT_DIALS);
  const [surfaces, setSurfaces] = useState<Surfaces>(() => fallbackSurfaces(DEFAULT_DIALS));
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    setClock(0);
    const t = window.setInterval(() => setClock((n) => (n ?? 0) + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  void clock;

  useEffect(() => {
    listLadders()
      .then(setLadders)
      .catch(() => setLadders([]));
    getPsychology()
      .then((p) => {
        setDials(p.dials);
        setSurfaces(p.surfaces);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnlocks([]);
      return;
    }
    getMyUnlocks()
      .then(setUnlocks)
      .catch(() => setUnlocks([]));
  }, [user]);

  const unlockedByLadder = new Map<string, number>();
  for (const u of unlocks) {
    unlockedByLadder.set(u.ladder_id, (unlockedByLadder.get(u.ladder_id) ?? 0) + 1);
  }
  const totalUnlocked = unlocks.length;
  const tier = collectorTier(totalUnlocked, false);
  const unfinished = (ladders ?? []).filter((l) => {
    const have = unlockedByLadder.get(l.id) ?? 0;
    return have > 0 && have < l.shots.length;
  });

  return (
    <div>
      <JsonLd
        data={jsonLdGraph({
          origin: boot?.origin || "",
          path: "/",
          title: "SHE UNDRESSES",
          description: DEFAULT_DESC,
          image: "/media/hero.jpg",
          faqs: homeFaqs(boot?.models ?? []),
          crumbs: [{ name: "Home", path: "/" }],
        })}
      />
      <section className="relative min-h-[82dvh] overflow-hidden">
        <img
          src="/media/hero.jpg"
          alt="SHE UNDRESSES — she stands in the doorway until you pay for the next yes"
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
        <div className="relative mx-auto flex min-h-[82dvh] max-w-6xl flex-col justify-end px-5 pb-14 pt-28">
          <Kicker accent>{surfaces.heroKicker}</Kicker>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] text-fg sm:text-7xl">
            {surfaces.heroHeadline}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            {surfaces.heroBody}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {unfinished[0] ? (
              <Link
                to="/ladders/$slug"
                params={{ slug: unfinished[0].slug }}
                search={{ pay: undefined }}
                className="sm:w-auto"
              >
                <Button size="xl" className="sm:w-auto">
                  {LETTER.heroCtaContinue} · {unfinished[0].title}
                </Button>
              </Link>
            ) : (
              <a href="#ladders" className="sm:w-auto">
                <Button size="xl" className="sm:w-auto">
                  {LETTER.heroCta}
                </Button>
              </a>
            )}
            <Link to="/vault" className="sm:w-auto">
              <Button variant="outline" size="xl" className="sm:w-auto">
                {LETTER.vaultCta}
              </Button>
            </Link>
          </div>
          {user ? (
            <p className="mt-6 text-xs tracking-[0.16em] text-gold uppercase">
              {statusLine(tier.label, totalUnlocked)}
            </p>
          ) : ladders && ladders[0] && dials.socialProof >= 4 ? (
            <p className="mt-6 text-sm text-subtle">
              {formatCompact(ladders[0].collectorsCount)} collectors are inside{" "}
              {ladders[0].title}. {formatCompact(ladders[0].climaxCollectors)} have
              the last frame.
            </p>
          ) : null}
        </div>
      </section>

      {unfinished.length > 0 ? (
        <section className="border-b border-border bg-raised/80">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg">{surfaces.unfinished}</p>
            <div className="flex flex-wrap gap-2">
              {unfinished.map((l) => {
                const have = unlockedByLadder.get(l.id) ?? 0;
                return (
                  <Link
                    key={l.id}
                    to="/ladders/$slug"
                    params={{ slug: l.slug }}
                    search={{ pay: true }}
                    className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-xs text-gold hover:border-gold/50"
                  >
                    {l.title} · shot {have + 1} waiting
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2">
          <div>
            <p className="kicker">{LETTER.lieKicker}</p>
            <h2 className="mt-2 font-display text-3xl text-fg sm:text-4xl">
              {LETTER.lieTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              {LETTER.lieBody}
            </p>
          </div>
          <div>
            <p className="kicker">{LETTER.mechKicker}</p>
            <h2 className="mt-2 font-display text-3xl text-fg sm:text-4xl">
              {LETTER.mechTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              {LETTER.mechBody}
            </p>
          </div>
        </div>
      </section>

      <section id="ladders" className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="kicker">{LETTER.laddersKicker}</p>
            <h2 className="mt-2 font-display text-4xl text-fg">{LETTER.laddersTitle}</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="hidden max-w-xs text-right text-sm text-muted sm:block">
              {LETTER.laddersAside}
            </p>
            <Link
              to="/models"
              className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-soft"
            >
              All muses
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ladders === null
            ? [0, 1, 2].map((i) => (
                <div key={i} className="panel h-[28rem] animate-pulse" />
              ))
            : ladders.map((lad) => {
                const have = unlockedByLadder.get(lad.id) ?? 0;
                const total = lad.shots.length;
                const first = lad.shots[0];
                const remaining = lad.shots
                  .slice(have)
                  .reduce((a, s) => a + s.priceCents, 0);
                const bundle = Math.round(remaining * (1 - lad.bundleDiscount));
                const climaxLeft = Math.max(0, (lad.climaxCap ?? 48) - lad.climaxCollectors);
                const window = clock == null ? null : remainingLabel(lad.scarcityEndsAt);
                const mid = have > 0 && have < total;
                return (
                  <Link
                    key={lad.id}
                    to="/ladders/$slug"
                    params={{ slug: lad.slug }}
                    search={{ pay: undefined }}
                    className="panel group block overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img
                        src={lad.coverUrl}
                        alt={modelAlt(lad.modelName, lad.photosetHook || lad.title)}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
                      <div className="absolute left-4 top-4 flex gap-2">
                        <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-xs tracking-[0.16em] text-gold uppercase">
                          {lad.modelName}
                        </span>
                        <span className="rounded-full border border-border bg-bg/70 px-2.5 py-1 text-xs tracking-[0.16em] text-muted uppercase">
                          {lad.theme}
                        </span>
                        {lad.shots.some((s) => s.mediaType === "video") ? (
                          <span className="flex items-center gap-1 rounded-full bg-bg/70 px-2.5 py-1 text-xs text-fg">
                            <Play className="size-3" /> clip
                          </span>
                        ) : null}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <h3 className="font-display text-3xl text-fg">{lad.title}</h3>
                        <p className="mt-1 text-sm text-muted">{lad.photosetHook || lad.tagline}</p>
                      </div>
                    </div>
                    <div className="space-y-3 p-5">
                      <ProgressBar value={(have / total) * 100} />
                      <div className="flex items-center justify-between text-xs text-subtle">
                        <span>
                          {have}/{total} granted
                        </span>
                        <span>{formatCompact(lad.collectorsCount)} collectors</span>
                      </div>
                      {dials.scarcity >= 5 && climaxLeft <= 20 ? (
                        <p className="text-xs text-gold">
                          {climaxLeft} last-frame grants left
                          {window ? ` · ${window}` : ""}
                        </p>
                      ) : null}
                      {mid ? (
                        <p className="text-xs text-blood">
                          You stopped at shot {have}. She doesn't rewind.
                        </p>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted">
                          {have === 0 ? (
                            <>From {formatUsd(first?.priceCents ?? 0)}</>
                          ) : have === total ? (
                            "Fully granted"
                          ) : (
                            <>Finish for {formatUsd(bundle)}</>
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-gold">
                          <Lock className="size-3" />
                          {mid ? "Continue" : "Climb"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </section>

      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
          {LETTER.pillars.map((b) => (
            <div key={b.t}>
              <h3 className="font-display text-2xl text-fg">{b.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <p className="kicker">Fascinations</p>
          <h2 className="mt-2 max-w-lg font-display text-3xl text-fg sm:text-4xl">
            Why the next yes costs what it costs.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {LETTER.fascinations.map((f) => (
              <div key={f.t} className="border-t border-border pt-5">
                <h3 className="font-display text-xl text-fg">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FaqList items={homeFaqs(boot?.models ?? [])} />

      <section className="border-t border-border bg-raised/60">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="kicker">{LETTER.closeKicker}</p>
          <h2 className="mt-3 font-display text-4xl text-fg">{LETTER.closeTitle}</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            {LETTER.closeBody}
          </p>
          <a href="#ladders" className="mt-8 inline-block w-full sm:w-auto">
            <Button size="xl" className="sm:w-auto">
              {LETTER.heroCta}
            </Button>
          </a>
        </div>
      </section>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyUnlocks,
  getAtmosphere,
  getLadderBySlug,
  getMyPressure,
  getMyUnlocks,
  withBundle,
} from "@/lib/server/catalog";
import { createInvoice, getPaymentStatus } from "@/lib/server/purchases";
import { getPsychology } from "@/lib/server/transporter";
import type { CryptoAsset, InvoiceKind, LadderPublic, ShotPublic } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Kicker, Overlay, OverlayClose, ProgressBar } from "@/components/ui/chrome";
import { collectorTier, formatCompact, formatUsd, remainingLabel } from "@/lib/utils";
import {
  addictionCta,
  DEFAULT_DIALS,
  dropLine,
  endowmentLine,
  fallbackStory,
  fallbackSurfaces,
  lockedBlurPx,
  nextBlurPx,
  priceBumpPct,
  recoveryLine,
  rivalLine,
  scarcityLine,
  sunkLine,
  waitingLine,
  whisperLine,
  type Dials,
  type Surfaces,
} from "@/lib/psychology";
import { CRYPTO_ASSETS } from "@/lib/crypto";
import { alsoUnlocked, offerFrame, PAY_SHEET, stackNote } from "@/lib/copy";
import { toast } from "sonner";
import { Lock, Play } from "lucide-react";
import { getDiscover } from "@/lib/server/discover";
import { JsonLd, Crumbs, FaqList } from "@/components/seo/JsonLd";
import { authorLadderSeo, headTags, jsonLdGraph, modelAlt } from "@/lib/seo";

export const Route = createFileRoute("/ladders/$slug")({
  loader: async ({ params }) => {
    const ladder = await getLadderBySlug({ data: { slug: params.slug } });
    const d = await getDiscover().catch(() => null);
    return { ladder, origin: d?.origin ?? "" };
  },
  head: ({ loaderData, params }) => {
    const lad = loaderData?.ladder;
    const origin = loaderData?.origin || "";
    if (!lad) {
      return headTags({
        title: "Photoset closed | SHE UNDRESSES",
        description: "That ladder is not published.",
        path: `/ladders/${params.slug}`,
        origin,
        noindex: true,
      });
    }
    const seo = authorLadderSeo({
      title: lad.title,
      modelName: lad.modelName,
      theme: lad.theme,
      tagline: lad.tagline,
      description: lad.description,
      photosetHook: lad.photosetHook,
      photosetTease: lad.photosetTease,
    });
    return headTags({
      title: seo.title,
      description: seo.description,
      path: `/ladders/${lad.slug}`,
      origin,
      image: lad.coverUrl,
      keywords: seo.keywords,
    });
  },
  component: LadderPage,
  validateSearch: (s: Record<string, unknown>) => ({
    pay: s.pay === true || s.pay === "1" || s.pay === "true" ? true : undefined,
  }),
});

function LadderPage() {
  const { slug } = Route.useParams();
  const loaded = Route.useLoaderData();
  const { pay: autoPay } = Route.useSearch();
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [raw, setRaw] = useState<LadderPublic | null | undefined>(loaded?.ladder ?? undefined);
  const [unlockIds, setUnlockIds] = useState<string[]>([]);
  const [unlockMedia, setUnlockMedia] = useState<Record<string, string>>({});
  const [active, setActive] = useState<ShotPublic | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [kind, setKind] = useState<InvoiceKind>("shot");
  const [upsellN, setUpsellN] = useState(3);
  const [asset, setAsset] = useState<CryptoAsset>("ETH");
  const [gift, setGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payStatus, setPayStatus] = useState<{ nowpayments: boolean; missing: string[] } | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [dials, setDials] = useState<Dials>(DEFAULT_DIALS);
  const [surfaces, setSurfaces] = useState<Surfaces>(() => fallbackSurfaces(DEFAULT_DIALS));
  const [pressure, setPressure] = useState<{ continueBy: string | null; expired: boolean }>({
    continueBy: null,
    expired: false,
  });
  const [feed, setFeed] = useState<{ kind: string; ladderTitle: string; at: string }[]>([]);
  const [feedI, setFeedI] = useState(0);
  const autoOpened = useRef(false);

  useEffect(() => {
    setClock(0);
    const t = window.setInterval(() => setClock((n) => (n ?? 0) + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    getLadderBySlug({ data: { slug } })
      .then(setRaw)
      .catch(() => setRaw(null));
  }, [slug]);

  useEffect(() => {
    getPsychology()
      .then((p) => {
        setDials(p.dials);
        setSurfaces(p.surfaces);
      })
      .catch(() => undefined);
    getAtmosphere()
      .then(setFeed)
      .catch(() => setFeed([]));
  }, []);

  useEffect(() => {
    if (!user || !raw) {
      setPressure({ continueBy: null, expired: false });
      return;
    }
    getMyPressure({ data: { ladderId: raw.id } })
      .then(setPressure)
      .catch(() => setPressure({ continueBy: null, expired: false }));
  }, [user, raw]);

  useEffect(() => {
    if (!user) {
      setUnlockIds([]);
      return;
    }
    getMyUnlocks()
      .then((rows) => {
        setUnlockIds(rows.map((r) => r.shot_id));
        const urls: Record<string, string> = {};
        for (const r of rows) {
          if (r.mediaUrl) urls[r.shot_id] = r.mediaUrl;
        }
        setUnlockMedia(urls);
      })
      .catch(() => {
        setUnlockIds([]);
        setUnlockMedia({});
      });
  }, [user]);

  const ladder = useMemo(() => {
    if (!raw) return null;
    return applyUnlocks(raw, new Set(unlockIds), unlockMedia);
  }, [raw, unlockIds, unlockMedia]);

  const progress = ladder ? withBundle(ladder) : null;
  const next = ladder && progress ? (ladder.shots.find((s) => s.id === progress.nextShotId) ?? null) : null;

  useEffect(() => {
    if (!autoPay || autoOpened.current || isPending || !user || !next) return;
    autoOpened.current = true;
    setKind("shot");
    setUpsellN(3);
    setPayOpen(true);
  }, [autoPay, isPending, user, next]);

  useEffect(() => {
    const t = window.setInterval(() => setFeedI((n) => n + 1), 4200);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!payOpen || !user) return;
    getPaymentStatus()
      .then(setPayStatus)
      .catch(() => setPayStatus({ nowpayments: false, missing: ["NOWPAYMENTS_API_KEY"] }));
  }, [payOpen, user]);

  if (raw === undefined) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-20">
        <div className="h-[32rem] animate-pulse rounded-xl bg-surface" />
      </div>
    );
  }
  if (!ladder || !progress) {
    return (
      <div className="px-5 py-24 text-center text-muted">This ladder is closed.</div>
    );
  }

  const remainingShots = ladder.shots.filter((s) => !s.unlocked);
  const upsellShots = remainingShots.slice(0, upsellN);
  const upsellSum = upsellShots.reduce((a, s) => a + s.priceCents, 0);
  const upsellPrice =
    upsellN >= 3
      ? Math.round(upsellSum * 0.78)
      : upsellN === 2
        ? Math.round(upsellSum * 0.88)
        : upsellSum;
  const threePrice =
    remainingShots.length >= 3
      ? Math.round(remainingShots.slice(0, 3).reduce((a, s) => a + s.priceCents, 0) * 0.78)
      : null;
  const tier = collectorTier(progress.unlockedCount, progress.hasClimax);
  const scarcity = clock == null ? null : remainingLabel(ladder.scarcityEndsAt);
  const poseClock = clock == null ? null : remainingLabel(pressure.continueBy);
  void clock;
  const climaxLeft = Math.max(0, (ladder.climaxCap ?? 48) - ladder.climaxCollectors);
  const bump = pressure.expired ? priceBumpPct(dials) : 0;
  const nextPrice = next ? Math.round(next.priceCents * (1 + bump / 100)) : 0;
  const story = next ? next.story || fallbackStory(ladder.theme, next.stepIndex) : "";
  const sting = next ? dropLine(next.stepIndex, dials, next.dropLine) : "";
  const also = alsoUnlocked(ladder.slug);
  const rival = next ? rivalLine(dials, next.stepIndex, 0) : "";
  const endowed = endowmentLine(progress.unlockedCount, dials);
  const recover = recoveryLine(dials, bump, pressure.expired);
  const whisper = next
    ? whisperLine(dials, {
        isVideo: next.mediaType === "video",
        isClimax: next.isClimax,
        remaining: remainingShots.length,
      })
    : "";
  const feedLines = [
    ...feed.map((f) =>
      f.kind === "paid"
        ? `A collector just unlocked a shot on ${f.ladderTitle}.`
        : `A collector requested ${f.ladderTitle}.`,
    ),
    rival,
    sting,
  ].filter(Boolean);
  const liveLine = feedLines.length ? feedLines[feedI % feedLines.length] : "";
  const recommendThree = dials.addiction >= 7 && remainingShots.length >= 3;
  const frame = offerFrame(progress.unlockedCount, remainingShots.length);

  function startPay(nextKind: InvoiceKind, n = 3) {
    if (!user && !isPending) {
      void nav({ to: "/login" });
      return;
    }
    setKind(nextKind);
    setUpsellN(n);
    setPayOpen(true);
  }


  async function submitPay() {
    if (!ladder) return;
    if (payStatus && !payStatus.nowpayments) {
      toast.error(
        payStatus.missing.length
          ? `NOWPayments is not live on the Worker (missing: ${payStatus.missing.join(", ")}). No wallet can open without a pay address.`
          : "NOWPayments is not live on the Worker. No wallet can open without a pay address.",
      );
      return;
    }
    setBusy(true);
    try {
      const inv = await Promise.race([
        createInvoice({
          data: {
            ladderId: ladder.id,
            kind,
            asset,
            shotId: kind === "shot" ? next?.id : undefined,
            upsellCount: kind === "upsell" ? upsellN : undefined,
            isGift: gift,
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Opening the invoice timed out. Try again — if this keeps happening, NOWPayments may be slow or the Worker is cold.",
                ),
              ),
            35_000,
          ),
        ),
      ]);
      void nav({
        to: "/checkout/$invoiceId",
        params: { invoiceId: inv.id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open payment.");
    } finally {
      setBusy(false);
    }
  }

  const payAmount =
    kind === "shot" ? nextPrice : kind === "bundle" ? progress.bundleCents : upsellPrice;

  return (
    <div
      className="pb-28"
      style={
        {
          "--next-blur": `${nextBlurPx(dials)}px`,
          "--locked-blur": `${lockedBlurPx(dials)}px`,
        } as React.CSSProperties
      }
    >
      <JsonLd
        data={jsonLdGraph({
          origin: loaded?.origin || "",
          path: `/ladders/${ladder.slug}`,
          title: ladder.title,
          description: ladder.photosetTease || ladder.description,
          image: ladder.coverUrl,
          faqs: authorLadderSeo({
            title: ladder.title,
            modelName: ladder.modelName,
            theme: ladder.theme,
            tagline: ladder.tagline,
            description: ladder.description,
            photosetHook: ladder.photosetHook,
            photosetTease: ladder.photosetTease,
          }).faqs,
          type: "product",
          name: `${ladder.modelName} — ${ladder.title}`,
          offers: {
            price: (ladder.shots[0]?.priceCents ?? 0) / 100,
            priceCurrency: "USD",
          },
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Muses", path: "/models" },
            { name: ladder.modelName, path: `/models/${ladder.modelSlug}` },
            { name: ladder.title, path: `/ladders/${ladder.slug}` },
          ],
        })}
      />
      <section className="relative h-[52dvh] min-h-[22rem] overflow-hidden sm:h-[60dvh]">
        <img
          src={ladder.coverUrl}
          alt={modelAlt(ladder.modelName, ladder.photosetHook || ladder.title)}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/10" />
        <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end px-5 pb-8">
          <Crumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Muses", href: "/models" },
              { label: ladder.modelName, href: `/models/${ladder.modelSlug}` },
              { label: ladder.title },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              to="/models/$slug"
              params={{ slug: ladder.modelSlug }}
              className="kicker kicker-accent hover:text-gold-soft"
            >
              {ladder.modelName}
            </Link>
            <Kicker>
              {ladder.theme} · {tier.label}
            </Kicker>
          </div>
          <h1 className="mt-2 font-display text-5xl text-fg sm:text-6xl">{ladder.title}</h1>
          <p className="mt-3 max-w-xl font-display text-xl text-gold sm:text-2xl">
            {ladder.photosetHook || ladder.tagline}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {ladder.photosetTease || ladder.description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5">
        <div className="panel mt-6 p-5">
          <div className="flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              {progress.unlockedCount} of {progress.total} unlocked
            </span>
            <span className="tabular-nums text-gold">
              {sunkLine(progress.spentCents, progress.unlockedCount, dials)}
            </span>
          </div>
          <ProgressBar
            className="mt-3"
            value={(progress.unlockedCount / progress.total) * 100}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle">
            <span>
              {scarcityLine(dials, climaxLeft, ladder.collectorsCount, scarcity)}
            </span>
            {progress.unlockedCount > 0 ? (
              <span className="tabular-nums text-blood">
                {waitingLine(pressure.expired, dials)}
                {poseClock && !pressure.expired ? ` · ${poseClock}` : ""}
              </span>
            ) : (
              <span>{formatCompact(ladder.climaxCollectors)} have the last frame</span>
            )}
          </div>
          {endowed ? <p className="mt-2 text-xs text-gold">{endowed}</p> : null}
          {liveLine && dials.socialProof >= 4 ? (
            <p className="mt-2 text-xs text-muted">{liveLine}</p>
          ) : null}
        </div>

        <ol className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {ladder.shots.map((shot) => {
            const isNext = shot.id === progress.nextShotId;
            const locked = !shot.unlocked;
            return (
              <li key={shot.id}>
                <button
                  type="button"
                  onClick={() => setActive(shot)}
                  className={`group w-full overflow-hidden rounded-lg border bg-raised text-left transition-[border-color,box-shadow] duration-150 ${
                    isNext
                      ? "border-gold/50 shadow-[var(--shadow-border-hover)]"
                      : "border-border hover:border-gold/30"
                  }`}
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    {shot.mediaType === "video" && shot.unlocked ? (
                      <video
                        src={shot.mediaUrl ?? shot.teaserUrl}
                        className="h-full w-full object-cover"
                        style={{ objectPosition: shot.objectPosition }}
                        muted
                        playsInline
                        loop
                        autoPlay
                      />
                    ) : (
                      <img
                        src={shot.unlocked ? (shot.mediaUrl ?? shot.teaserUrl) : shot.teaserUrl}
                        alt={modelAlt(ladder.modelName, shot.title)}
                        className={
                          shot.unlocked
                            ? "h-full w-full object-cover"
                            : isNext
                              ? "next-media h-full w-full object-cover"
                              : "locked-media h-full w-full object-cover"
                        }
                        style={{ objectPosition: shot.objectPosition }}
                      />
                    )}
                    {locked ? (
                      <div className="absolute inset-0 grid place-items-center bg-bg/20">
                        <Lock className="size-5 text-gold" />
                      </div>
                    ) : shot.mediaType === "video" ? (
                      <div className="absolute right-2 top-2 rounded-full bg-bg/70 p-1">
                        <Play className="size-3 text-gold" />
                      </div>
                    ) : null}
                    {isNext ? (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg to-transparent p-2">
                        <p className="text-xs tracking-[0.16em] text-gold uppercase">
                          Next
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs tabular-nums text-subtle">
                      {String(shot.stepIndex).padStart(2, "0")}
                      {shot.isClimax ? " · climax" : ""}
                    </p>
                    <p className="truncate font-display text-sm text-fg">{shot.title}</p>
                    <p className={`mt-0.5 text-xs ${isNext && bump > 0 ? "text-gold" : "text-muted"}`}>
                      {shot.unlocked
                        ? "Unlocked"
                        : isNext
                          ? formatUsd(nextPrice)
                          : formatUsd(shot.priceCents)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>

        {next ? (
          <div className="panel mt-8 overflow-hidden">
            <div className="grid md:grid-cols-2">
              <div className="relative min-h-[16rem] overflow-hidden">
                <img
                  src={next.teaserUrl}
                  alt={modelAlt(ladder.modelName, `next unlock ${next.title}`)}
                  className="next-media h-full w-full object-cover"
                  style={{ objectPosition: next.objectPosition }}
                />
                <div className="absolute inset-0 grid place-items-center">
                  <Lock className="size-8 text-gold" />
                </div>
              </div>
              <div className="flex flex-col justify-center p-6">
                <Kicker accent>
                  {frame.kicker} · Shot {next.stepIndex}
                  {next.isClimax ? " · last frame" : ""}
                </Kicker>
                <h2 className="mt-2 font-display text-3xl text-fg">{next.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">{next.tease}</p>
                {story ? (
                  <p className="mt-3 text-sm leading-relaxed text-fg/80">{story}</p>
                ) : null}
                {sting ? <p className="mt-3 text-xs text-blood">{sting}</p> : null}
                {dials.socialProof >= 4 ? (
                  <p className="mt-3 text-xs text-subtle">
                    She also has: {also}.
                  </p>
                ) : null}
                {recover ? (
                  <p className="mt-2 text-xs text-gold">{recover}</p>
                ) : poseClock && !pressure.expired ? (
                  <p className="mt-2 text-xs text-gold">
                    Hold the pose until {poseClock} or the rate jumps.
                  </p>
                ) : null}
                {whisper ? <p className="mt-2 text-xs text-muted">{whisper}</p> : null}
                <div className="mt-6 flex flex-col gap-2">
                  <Button size="xl" onClick={() => startPay("shot")}>
                    {frame.single || addictionCta(dials, remainingShots.length)} ·{" "}
                    <Money cents={nextPrice} was={bump > 0 ? next.priceCents : undefined} />
                  </Button>
                  {threePrice ? (
                    <Button
                      variant={recommendThree ? "gold" : "outline"}
                      size="xl"
                      onClick={() => startPay("upsell", 3)}
                    >
                      {frame.three || "Keep the pose · next 3"} · {formatUsd(threePrice)}
                    </Button>
                  ) : null}
                  {remainingShots.length > 1 ? (
                    <Button variant="outline" size="xl" onClick={() => startPay("bundle")}>
                      {frame.bundle || PAY_SHEET.bundle(remainingShots.length)} · {formatUsd(progress.bundleCents)}
                      <span className="text-xs opacity-80">
                        save {Math.round(ladder.bundleDiscount * 100)}%
                      </span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel mt-8 p-8 text-center">
            <Kicker accent>{frame.kicker}</Kicker>
            <h2 className="mt-2 font-display text-3xl text-fg">
              {frame.headline}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted">
              {frame.body}
            </p>
            <Link to="/" className="mt-6 inline-block">
              <Button variant="gold">Open another set</Button>
            </Link>
          </div>
        )}
      </div>

      <FaqList
        title={`About ${ladder.title}`}
        items={authorLadderSeo({
          title: ladder.title,
          modelName: ladder.modelName,
          theme: ladder.theme,
          tagline: ladder.tagline,
          description: ladder.description,
          photosetHook: ladder.photosetHook,
          photosetTease: ladder.photosetTease,
        }).faqs}
      />

      {next && !payOpen && !active ? (
        <div className="sticky-cta fixed inset-x-0 bottom-0 border-t border-border bg-bg/92 px-4 pt-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="relative hidden size-12 overflow-hidden rounded-md sm:block">
              <img
                src={next.teaserUrl}
                alt={modelAlt(ladder.modelName, next.title)}
                className="next-media h-full w-full object-cover"
                style={{ objectPosition: next.objectPosition }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm text-fg">
                Shot {next.stepIndex} · {next.title}
              </p>
              <p className="truncate text-xs text-gold">
                {pressure.expired && bump > 0
                  ? `Preferred lost · +${bump}%`
                  : poseClock && !pressure.expired
                    ? `Hold pose · ${poseClock}`
                    : surfaces.stickyCta}
              </p>
            </div>
            <Button size="lg" className="cta-pulse shrink-0" onClick={() => startPay("shot")}>
              {formatUsd(nextPrice)}
            </Button>
          </div>
        </div>
      ) : null}

      {active ? (
        <Overlay onClose={() => setActive(null)} wide labelledBy="shot-title">
          <div className="relative grid sm:grid-cols-2">
            <OverlayClose onClick={() => setActive(null)} />
            <div className="relative h-[42dvh] overflow-hidden bg-raised sm:h-auto sm:min-h-[28rem] sm:max-h-[82dvh]">
              {active.unlocked && active.mediaType === "video" ? (
                <video
                  src={active.mediaUrl ?? active.teaserUrl}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: active.objectPosition }}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={active.unlocked ? (active.mediaUrl ?? active.teaserUrl) : active.teaserUrl}
                  alt={modelAlt(ladder.modelName, active.title)}
                  className={
                    active.unlocked
                      ? "h-full w-full object-cover"
                      : active.id === progress.nextShotId
                        ? "next-media h-full w-full object-cover"
                        : "locked-media h-full w-full object-cover"
                  }
                  style={{ objectPosition: active.objectPosition }}
                />
              )}
            </div>
            <div className="p-5 sm:flex sm:flex-col sm:justify-center sm:p-8">
              <p className="text-xs tabular-nums text-subtle">
                Shot {String(active.stepIndex).padStart(2, "0")}
                {active.isClimax ? " · climax" : ""}
              </p>
              <h3 id="shot-title" className="mt-1 font-display text-3xl text-fg">
                {active.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {active.unlocked
                  ? active.grantCopy
                  : active.story || active.tease}
              </p>
              {!active.unlocked ? (
                active.id === progress.nextShotId ? (
                  <Button
                    className="mt-5"
                    size="xl"
                    onClick={() => {
                      setActive(null);
                      startPay("shot");
                    }}
                  >
                    Request access · <Money cents={nextPrice} was={bump > 0 ? active.priceCents : undefined} />
                  </Button>
                ) : (
                  <p className="mt-5 text-sm text-gold">
                    She opens in order. Unlock Shot {next?.stepIndex ?? "—"} first.
                    {dials.sunkCost >= 6
                      ? " Skipping is how men never see the last frame."
                      : ""}
                  </p>
                )
              ) : next && active.id !== next.id ? (
                <Button
                  className="mt-5"
                  size="xl"
                  onClick={() => {
                    setActive(null);
                    startPay("shot");
                  }}
                >
                  Continue — Shot {next.stepIndex} is waiting · {formatUsd(nextPrice)}
                </Button>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}

      {payOpen ? (
        <Overlay onClose={() => setPayOpen(false)} labelledBy="pay-title">
          <div className="relative p-6">
            <OverlayClose onClick={() => setPayOpen(false)} />
            <Kicker>{PAY_SHEET.kicker}</Kicker>
            <h3 id="pay-title" className="mt-1 font-display text-2xl text-fg">
              {kind === "shot"
                ? next?.title
                : kind === "bundle"
                  ? `Finish her · ${remainingShots.length} remaining`
                  : `Keep the pose · next ${upsellN}`}
            </h3>
            <p className="mt-3 text-sm text-muted">
              {gift ? PAY_SHEET.gift : PAY_SHEET.crypto}
            </p>

            <div className="mt-4 grid gap-2">
              <PayChoice
                active={kind === "shot"}
                label={frame.single || PAY_SHEET.single}
                price={nextPrice}
                was={bump > 0 ? next?.priceCents : undefined}
                note={stackNote("shot", dials, bump)}
                onClick={() => setKind("shot")}
              />
              {threePrice ? (
                <PayChoice
                  active={kind === "upsell"}
                  label={frame.three || PAY_SHEET.three}
                  price={threePrice}
                  note={stackNote("upsell", dials, bump)}
                  recommended={recommendThree}
                  onClick={() => {
                    setKind("upsell");
                    setUpsellN(3);
                  }}
                />
              ) : null}
              {remainingShots.length > 1 ? (
                <PayChoice
                  active={kind === "bundle"}
                  label={frame.bundle || PAY_SHEET.bundle(remainingShots.length)}
                  price={progress.bundleCents}
                  note={stackNote("bundle", dials, bump)}
                  onClick={() => setKind("bundle")}
                />
              ) : null}
            </div>

            {recover && kind === "shot" ? (
              <p className="mt-3 text-xs text-gold">{recover}</p>
            ) : null}

            <p className="mt-4 font-display text-3xl tabular-nums text-gold">
              <Money
                cents={payAmount}
                was={kind === "shot" && bump > 0 ? next?.priceCents : undefined}
              />
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {CRYPTO_ASSETS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAsset(a.id)}
                  className={`min-h-14 rounded-lg border px-3 py-3 text-left text-sm ${
                    asset === a.id
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-border text-muted hover:border-gold/40"
                  }`}
                >
                  <span className="block text-fg">{a.name}</span>
                  <span className="text-xs">{a.network}</span>
                </button>
              ))}
            </div>
            <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={gift}
                onChange={(e) => setGift(e.target.checked)}
                className="size-4 accent-gold"
              />
              {PAY_SHEET.giftLabel}
            </label>
            {payStatus && !payStatus.nowpayments ? (
              <p className="mt-4 rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-fg">
                NOWPayments is not configured on Worker hmuls
                {payStatus.missing.length ? ` (missing: ${payStatus.missing.join(", ")})` : ""}.
                Set those vars, then pay again — wallets only appear after a live pay address exists.
              </p>
            ) : null}
            <Button className="mt-5" size="xl" disabled={busy || (payStatus != null && !payStatus.nowpayments)} onClick={() => void submitPay()}>
              {busy ? "Opening invoice…" : PAY_SHEET.pay(asset)}
            </Button>
            <p className="mt-3 text-center text-xs text-subtle">
              Wallet checkout next — send from MetaMask, Rainbow, Trust, or Phantom.
            </p>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

function Money({ cents, was }: { cents: number; was?: number }) {
  if (was && was !== cents) {
    return (
      <span>
        <s className="mr-1.5 text-subtle">{formatUsd(was)}</s>
        <span>{formatUsd(cents)}</span>
      </span>
    );
  }
  return <span>{formatUsd(cents)}</span>;
}

function PayChoice({
  active,
  label,
  price,
  was,
  note,
  recommended,
  onClick,
}: {
  active: boolean;
  label: string;
  price: number;
  was?: number;
  note?: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-3 py-3 text-left ${
        active ? "border-gold bg-gold/10" : "border-border hover:border-gold/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-fg">
          {label}
          {recommended ? (
            <span className="ml-2 text-xs tracking-[0.14em] text-gold uppercase">
              Keep the pose
            </span>
          ) : null}
        </span>
        <span className="text-sm tabular-nums text-gold">
          <Money cents={price} was={was} />
        </span>
      </div>
      {note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
    </button>
  );
}

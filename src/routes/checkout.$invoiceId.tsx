import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { confirmInvoice, getInvoice } from "@/lib/server/purchases";
import { getLadderBySlug, getMyUnlocks, listLadders } from "@/lib/server/catalog";
import { getPsychology } from "@/lib/server/transporter";
import type { InvoiceView } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Kicker, PageHeader, Panel } from "@/components/ui/chrome";
import { PayWallet } from "@/components/wallet/PayWallet";
import { formatUsd, remainingLabel } from "@/lib/utils";
import {
  DEFAULT_DIALS,
  fallbackSurfaces,
  invoiceUrge,
  type Dials,
  type Surfaces,
} from "@/lib/psychology";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { CHECKOUT_COPY } from "@/lib/copy";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/checkout/$invoiceId")({
  component: CheckoutPage,
  head: () => privateHead("/checkout", "Checkout | SHE UNDRESSES"),
});

function CheckoutPage() {
  const { invoiceId } = Route.useParams();
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [inv, setInv] = useState<InvoiceView | null | undefined>(undefined);
  const [phase, setPhase] = useState<"pay" | "wait" | "done">("pay");
  const [giftCode, setGiftCode] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [dials, setDials] = useState<Dials>(DEFAULT_DIALS);
  const [surfaces, setSurfaces] = useState<Surfaces>(() => fallbackSurfaces(DEFAULT_DIALS));
  const [licenseOk, setLicenseOk] = useState(false);

  useEffect(() => {
    setClock(0);
    const t = window.setInterval(() => setClock((n) => (n ?? 0) + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    getPsychology()
      .then((p) => {
        setDials(p.dials);
        setSurfaces(p.surfaces);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    getInvoice({ data: { id: invoiceId } })
      .then(async (row) => {
        setInv(row);
        if (!row) return;
        const ladders = await listLadders();
        const lad = ladders.find((l) => l.id === row.ladderId);
        setSlug(lad?.slug ?? null);
        if (row.status === "paid") {
          setPhase("done");
          setGiftCode(row.giftCode);
        }
      })
      .catch(() => setInv(null));
  }, [invoiceId, user]);

  if (isPending) {
    return <div className="px-5 py-24 text-center text-muted">Checking your session…</div>;
  }
  if (!user) return <RedirectToSignIn />;
  if (inv === undefined) {
    return <div className="px-5 py-24 text-center text-muted">Opening invoice…</div>;
  }
  if (!inv) {
    return (
      <div className="px-5 py-24 text-center">
        <p className="text-muted">Invoice not found.</p>
        <Link to="/" className="mt-4 inline-block text-gold">
          Return
        </Link>
      </div>
    );
  }

  const expired =
    inv.status === "expired" ||
    (inv.expiresAt ? Date.now() > new Date(inv.expiresAt).getTime() : false);
  void clock;
  const clockLabel = clock == null ? null : remainingLabel(inv.expiresAt);

  async function settle(info?: { method: string; wallet: string; txHash: string }) {
    setPhase("wait");
    try {
      const res = await confirmInvoice({
        data: {
          id: invoiceId,
          method: info?.method,
          wallet: info?.wallet,
          txHash: info?.txHash,
        },
      });
      setGiftCode(res.giftCode);
      setPhase("done");
      toast.success("Access granted.");
    } catch (err) {
      setPhase("pay");
      toast.error(err instanceof Error ? err.message : "Confirmation failed.");
    }
  }

  if (phase === "done") {
    return (
      <Done
        inv={inv}
        giftCode={giftCode}
        slug={slug}
        surfaces={surfaces}
        onContinue={(payNext) => {
          if (slug) {
            void nav({
              to: "/ladders/$slug",
              params: { slug },
              search: { pay: payNext },
            });
          } else void nav({ to: "/vault" });
        }}
      />
    );
  }

  if (expired) {
    return (
      <div className="mx-auto max-w-md px-5 py-12 text-center">
        <Kicker>{CHECKOUT_COPY.expiredKicker}</Kicker>
        <h1 className="mt-2 font-display text-4xl text-fg">{CHECKOUT_COPY.expiredTitle}</h1>
        <p className="mt-3 text-sm text-muted">
          {invoiceUrge(dials, true, null)} This invoice is dead. Request access again
          — singles may have jumped.
        </p>
        <Button
          className="mt-8"
          size="xl"
          onClick={() => {
            if (slug) void nav({ to: "/ladders/$slug", params: { slug }, search: { pay: true } });
            else void nav({ to: "/" });
          }}
        >
          {CHECKOUT_COPY.expiredCta}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <PageHeader
        kicker={CHECKOUT_COPY.kicker}
        title={CHECKOUT_COPY.title}
        body={`${inv.ladderTitle} · ${inv.shotTitles.join(", ")} · ${formatUsd(inv.amountCents)}`}
      />

      {clockLabel ? (
        <p className="mt-4 text-center font-display text-xl tabular-nums text-blood">
          {invoiceUrge(dials, false, clockLabel)} · {clockLabel}
        </p>
      ) : (
        <p className="mt-4 text-center text-sm text-gold">{surfaces.checkoutUrge}</p>
      )}

      <div className="mt-6">
        <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          <input
            type="checkbox"
            checked={licenseOk}
            onChange={(e) => setLicenseOk(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[#c9a227]"
          />
          <span>
            I will not duplicate, edit, share, or distribute what I unlock. Personal viewing
            only.{" "}
            <Link to="/legal/$slug" params={{ slug: "terms" }} className="text-gold underline">
              Terms
            </Link>
          </span>
        </label>
        <PayWallet
          inv={inv}
          disabled={phase === "wait" || !licenseOk}
          onPaid={(info) => settle(info)}
        />
      </div>

      {phase === "wait" ? (
        <p className="mt-6 text-center text-sm text-gold">{CHECKOUT_COPY.waiting}</p>
      ) : (
        <Button
          className="mt-4"
          variant="ghost"
          size="xl"
          disabled={!licenseOk}
          onClick={() => void settle()}
        >
          {CHECKOUT_COPY.sent}
        </Button>
      )}
      <p className="mt-4 text-center text-xs leading-relaxed text-subtle">
        Vault wallet and browser-wallet signatures settle the grant here. Production
        broadcasts the transfer to the invoice address (WalletConnect / NOWPayments IPN).
      </p>
    </div>
  );
}

function Done({
  inv,
  giftCode,
  slug,
  surfaces,
  onContinue,
}: {
  inv: InvoiceView;
  giftCode: string | null;
  slug: string | null;
  surfaces: Surfaces;
  onContinue: (payNext: boolean) => void;
}) {
  const [offer, setOffer] = useState<{
    nextTitle: string;
    nextTease: string;
    nextStory: string;
    nextPrice: number;
    threePrice: number | null;
    remaining: number;
    grant: string;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    Promise.all([getLadderBySlug({ data: { slug } }), getMyUnlocks()])
      .then(([lad, unlocks]) => {
        if (!lad) return;
        const have = new Set(unlocks.map((u) => u.shot_id));
        const granted = lad.shots.filter((s) => inv.shotIds.includes(s.id));
        const rest = lad.shots.filter((s) => !have.has(s.id));
        const three = rest.slice(0, 3);
        setOffer({
          nextTitle: rest[0]?.title ?? "",
          nextTease: rest[0]?.tease ?? "",
          nextStory: rest[0]?.story ?? "",
          nextPrice: rest[0]?.priceCents ?? 0,
          threePrice:
            three.length >= 3
              ? Math.round(three.reduce((a, s) => a + s.priceCents, 0) * 0.78)
              : null,
          remaining: rest.length,
          grant: granted[0]?.grantCopy ?? "",
        });
      })
      .catch(() => undefined);
  }, [slug, inv.shotIds, inv.isGift]);

  return (
    <div className="mx-auto max-w-md px-5 py-12 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
        <Check className="size-6" />
      </div>
      <Kicker accent className="mt-6">
        {CHECKOUT_COPY.doneKicker}
      </Kicker>
      <h1 className="mt-2 font-display text-4xl text-fg">
        {inv.isGift ? CHECKOUT_COPY.giftTitle : CHECKOUT_COPY.doneTitle}
      </h1>
      <p className="mt-3 text-sm text-muted">{inv.shotTitles.join(" · ")}</p>
      {offer?.grant && !inv.isGift ? (
        <p className="mt-4 text-sm leading-relaxed text-gold">{offer.grant}</p>
      ) : null}
      {giftCode ? (
        <Panel className="mt-6">
          <p className="text-xs text-subtle">Gift code</p>
          <p className="mt-2 font-mono text-2xl tracking-[0.2em] text-gold">{giftCode}</p>
          <p className="mt-2 text-xs text-muted">
            Send this. They claim it after they sign in.
          </p>
        </Panel>
      ) : null}

      {offer && !inv.isGift && offer.remaining > 0 ? (
        <Panel className="mt-8 text-left">
          <p className="font-display text-sm text-gold">{surfaces.postGrant}</p>
          <p className="mt-3 font-display text-2xl text-fg">{offer.nextTitle}</p>
          <p className="mt-2 text-sm text-muted">{offer.nextTease || offer.nextStory}</p>
          <p className="mt-2 text-xs text-subtle">
            {offer.remaining} still locked. Don't leave her half-open.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button size="lg" onClick={() => onContinue(true)}>
              Request {offer.nextTitle} · {formatUsd(offer.nextPrice)}
            </Button>
            <Button variant="outline" size="lg" onClick={() => onContinue(false)}>
              {CHECKOUT_COPY.seeUnlocked}
            </Button>
            {offer.threePrice ? (
              <p className="text-center text-xs text-subtle">
                Next 3 still sit at {formatUsd(offer.threePrice)}. That's the pose rate.
              </p>
            ) : null}
          </div>
        </Panel>
      ) : (
        <Button className="mt-8" size="xl" onClick={() => onContinue(false)}>
          Return to the ladder
        </Button>
      )}
    </div>
  );
}

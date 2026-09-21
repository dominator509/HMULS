import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Overlay, OverlayClose, Panel } from "@/components/ui/chrome";
import type { InvoiceView } from "@/lib/types";
import {
  WALLET_OPTIONS,
  connectInjected,
  detectInjected,
  detectSolWallet,
  formatSolAmount,
  isMobileUserAgent,
  launchSolWallet,
  listInjectedProviders,
  paymentUri,
  sendInjectedEth,
  sendSolWithWallet,
  shortAddr,
  walletDeepLink,
  type SolWalletId,
} from "@/lib/wallet";
import {
  cleanSolUlUrl,
  clearSolCheckoutAck,
  continueSolMobileAfterConnect,
  finishSolMobileAfterSign,
  parseSolUlReturn,
  persistSolCheckoutAck,
} from "@/lib/sol-mobile-deeplink";
import { friendlySolPrepareError } from "@/lib/sol-recent-blockhash";
import { Copy, ExternalLink, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

type Phase = "idle" | "confirm" | "signing" | "broadcast";

export function PayWallet({
  inv,
  disabled,
  onSubmitted,
}: {
  inv: InvoiceView;
  disabled?: boolean;
  onSubmitted: (info: { method: string; wallet: string; txHash: string }) => Promise<void>;
}) {
  const injected = useMemo(() => detectInjected(), []);
  const injectedList = useMemo(() => listInjectedProviders(), []);
  const hasPhantom = useMemo(() => detectSolWallet("phantom"), []);
  const hasSolflare = useMemo(() => detectSolWallet("solflare"), []);
  const mobile = useMemo(() => isMobileUserAgent(), []);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("injected");
  const [phase, setPhase] = useState<Phase>("idle");
  const ulHandled = useRef(false);

  const uri = paymentUri(inv.asset, inv.payAddress, inv.cryptoAmount);
  const solAmount = inv.asset === "SOL" ? formatSolAmount(inv.cryptoAmount) : inv.cryptoAmount;
  const busy = phase === "signing" || phase === "broadcast";

  // Resume encrypted Phantom/Solflare UL flow after iOS wallet redirects back to checkout.
  // Do NOT gate on `disabled` (terms checkbox): Safari reloads wipe React state and would
  // silently stall with an unchecked box. Ack is restored from localStorage on checkout (cross-tab; Phantom return may be a new tab).
  useEffect(() => {
    if (typeof window === "undefined" || ulHandled.current) return;
    if (inv.asset !== "SOL") return;
    const parsed = parseSolUlReturn(window.location.href);
    if (!parsed.active) return;
    ulHandled.current = true;

    void (async () => {
      const wallet = parsed.wallet!;
      const name = wallet === "phantom" ? "Phantom" : "Solflare";
      setMethod(wallet);
      try {
        if (parsed.step === "connect") {
          setPhase("signing");
          toast.message(`Confirm in ${name}…`);
          const next = await continueSolMobileAfterConnect(window.location.href);
          if (!next.ok) {
            setPhase("idle");
            toast.error(friendlySolPrepareError(new Error(next.error)));
            window.history.replaceState({}, "", cleanSolUlUrl(window.location.href));
            return;
          }
          window.history.replaceState({}, "", cleanSolUlUrl(window.location.href));
          toast.message(next.message);
          window.location.href = next.href;
          return;
        }
        if (parsed.step === "sign") {
          setPhase("broadcast");
          const done = await finishSolMobileAfterSign(window.location.href);
          window.history.replaceState({}, "", cleanSolUlUrl(window.location.href));
          if (!done.ok) {
            setPhase("idle");
            toast.error(done.error);
            return;
          }
          clearSolCheckoutAck();
          setAccount(done.from);
          await onSubmitted({ method: done.wallet, wallet: done.from, txHash: done.signature });
          toast.success("Payment sent. Waiting for unlock…");
          return;
        }
      } catch (err) {
        setPhase("idle");
        window.history.replaceState({}, "", cleanSolUlUrl(window.location.href));
        toast.error(friendlySolPrepareError(err) || `Could not finish ${name} payment.`);
      }
    })();
  }, [inv.asset, onSubmitted]);

  async function copyPayLink() {
    if (!uri) {
      toast.error("Pay link is not ready yet.");
      return;
    }
    await navigator.clipboard.writeText(uri);
    toast.success("Pay link copied (backup). Prefer Pay with Phantom / Solflare above.");
  }

  async function copyAddress() {
    if (!inv.payAddress) return;
    await navigator.clipboard.writeText(inv.payAddress);
    toast.success("Address copied.");
  }

  async function payWithSol(id: SolWalletId) {
    if (disabled) return;
    if (!inv.payAddress || !inv.paymentReady) {
      toast.error("Payment address is not ready yet.");
      return;
    }
    setMethod(id);
    const name = id === "phantom" ? "Phantom" : "Solflare";
    try {
      // Buyer already checked terms to enable Pay — keep that across iOS UL return.
      if (inv.id) persistSolCheckoutAck(inv.id);
      if (detectSolWallet(id)) {
        setPhase("signing");
        const { signature, from } = await sendSolWithWallet({
          wallet: id,
          to: inv.payAddress,
          amountSol: inv.cryptoAmount,
        });
        setAccount(from);
        setPhase("broadcast");
        clearSolCheckoutAck();
        await onSubmitted({ method: id, wallet: from, txHash: signature });
        toast.success("Payment sent. Waiting for unlock…");
        return;
      }
      const launch = launchSolWallet(id, inv.payAddress, inv.cryptoAmount, {
        checkoutUrl: typeof window !== "undefined" ? window.location.href : undefined,
        invoiceId: inv.id,
      });
      if (launch.kind === "open") {
        window.location.href = launch.href;
        toast.message(launch.message);
        setOpen(false);
        return;
      }
      if (launch.uri) {
        await navigator.clipboard.writeText(launch.uri);
      }
      toast.message(launch.message);
      setOpen(false);
    } catch (err) {
      setPhase("idle");
      toast.error(friendlySolPrepareError(err) || `Could not pay with ${name}.`);
    }
  }

  async function pick(id: string) {
    const opt = WALLET_OPTIONS.find((w) => w.id === id);
    if (!opt) return;
    setMethod(id);
    try {
      if (id === "injected") {
        const addr = await connectInjected();
        setAccount(addr);
        setOpen(false);
        setPhase("confirm");
        toast.success("Wallet connected.");
        return;
      }
      if ((id === "phantom" || id === "solflare") && inv.asset === "SOL") {
        await payWithSol(id);
        return;
      }
      const link = walletDeepLink(id, inv.asset, inv.payAddress, inv.cryptoAmount);
      window.open(link, "_blank", "noopener,noreferrer");
      setOpen(false);
      toast.message(`Opened ${opt.name}. Send to the invoice address, then mark sent.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect.");
    }
  }

  async function payEth() {
    if (disabled) return;
    if (!inv.payAddress || !inv.paymentReady) {
      toast.error("Payment address is not configured.");
      return;
    }
    setPhase("signing");
    try {
      let hash = "";
      if (method === "injected" && account && inv.asset === "ETH") {
        hash = await sendInjectedEth(account, inv.payAddress, inv.cryptoAmount);
      }
      setPhase("broadcast");
      await onSubmitted({ method, wallet: account || "", txHash: hash });
    } catch (err) {
      setPhase("confirm");
      toast.error(err instanceof Error ? err.message : "Could not send payment.");
    }
  }

  const options = WALLET_OPTIONS.filter((w) => {
    if (w.id === "injected") return Boolean(injected) && inv.asset === "ETH";
    if (w.id === "phantom" || w.id === "solflare") return false;
    return w.assets.includes(inv.asset);
  });

  return (
    <div>
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker kicker-accent">Pay</p>
            <p className="mt-1 font-display text-2xl text-fg">
              {solAmount} {inv.asset}
            </p>
            <p className="text-sm text-muted">
              {inv.asset === "SOL"
                ? "Pay the exact amount. Unlock continues after the network confirms."
                : "Send this exact amount to the invoice address. Access unlocks after payment confirms."}
            </p>
          </div>
          <Wallet className="size-5 text-gold" />
        </div>

        {inv.payAddress ? (
          <div className="mt-4 rounded-lg border border-border bg-raised px-3 py-3">
            <p className="text-xs text-subtle">Invoice address</p>
            <p className="mt-0.5 break-all font-mono text-sm text-fg">{inv.payAddress}</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-gold"
              onClick={() => void copyAddress()}
            >
              <Copy className="size-3" /> Copy address
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-fg">
            Payment address is unavailable right now. Refresh in a moment or contact support.
          </p>
        )}

        {account ? (
          <p className="mt-3 text-xs text-subtle">Connected {shortAddr(account)}</p>
        ) : null}

        {busy ? (
          <p className="mt-4 text-sm text-gold">
            {phase === "signing" ? "Confirm in your wallet…" : "Waiting for confirmation…"}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {inv.asset === "SOL" && inv.paymentReady ? (
            <>
              <Button
                size="xl"
                variant="gold"
                disabled={disabled || !inv.payAddress || busy}
                onClick={() => void payWithSol("phantom")}
              >
                {busy && method === "phantom" ? <Loader2 className="size-4 animate-spin" /> : null}
                {hasPhantom
                  ? `Pay ${solAmount} SOL with Phantom`
                  : mobile
                    ? "Pay with Phantom"
                    : "Connect Phantom & pay"}
              </Button>
              <Button
                size="xl"
                disabled={disabled || !inv.payAddress || busy}
                onClick={() => void payWithSol("solflare")}
              >
                {busy && method === "solflare" ? <Loader2 className="size-4 animate-spin" /> : null}
                {hasSolflare
                  ? `Pay ${solAmount} SOL with Solflare`
                  : mobile
                    ? "Pay with Solflare"
                    : "Connect Solflare & pay"}
              </Button>
              <p className="text-xs text-subtle">
                {hasPhantom || hasSolflare
                  ? "Your wallet will ask you to confirm the exact amount."
                  : mobile
                    ? "Opens Phantom or Solflare only — approve, then confirm the exact SOL amount. You return here signed in."
                    : "Install Phantom or Solflare in this browser, or pay from your phone."}
              </p>
            </>
          ) : null}

          {inv.asset === "ETH" && injectedList.length && inv.paymentReady && !account
            ? injectedList.map((p) => (
                <Button
                  key={p.name}
                  size="xl"
                  disabled={disabled || busy}
                  onClick={() => {
                    void (async () => {
                      try {
                        const addr = await connectInjected(p.provider);
                        setAccount(addr);
                        setMethod("injected");
                        setPhase("confirm");
                        toast.success(`${p.name} connected.`);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not connect.");
                      }
                    })();
                  }}
                >
                  Connect {p.name}
                </Button>
              ))
            : null}
          {inv.asset === "ETH" && account ? (
            <Button size="xl" disabled={disabled || !inv.paymentReady || busy} onClick={() => void payEth()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Send {inv.cryptoAmount} ETH
            </Button>
          ) : null}
          {inv.asset === "ETH" && !injectedList.length && inv.paymentReady ? (
            <p className="text-xs text-subtle">
              No browser wallet detected. Use Open a mobile wallet below (MetaMask / Trust / Coinbase).
            </p>
          ) : null}

          {inv.asset === "SOL" ? (
            <button
              type="button"
              className="mt-1 text-left text-xs text-subtle underline-offset-2 hover:text-muted hover:underline"
              onClick={() => setMoreOpen((v) => !v)}
            >
              {moreOpen ? "Hide backup options" : "Backup: copy address or pay link"}
            </button>
          ) : null}
          {inv.asset === "SOL" && moreOpen ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 px-3 py-3">
              <Button size="lg" variant="outline" disabled={disabled || !uri} onClick={() => void copyPayLink()}>
                <Copy className="size-4" /> Copy pay link
              </Button>
              <p className="text-[11px] text-subtle">
                Only if the buttons above are unavailable. Paste or scan inside your wallet — do not
                reopen this site inside a wallet browser.
              </p>
            </div>
          ) : null}

          {inv.asset !== "SOL" ? (
            <Button
              size={inv.asset === "ETH" && injected ? "lg" : "xl"}
              variant={inv.asset === "ETH" && injected ? "outline" : "gold"}
              disabled={disabled || !inv.payAddress}
              onClick={() => setOpen(true)}
            >
              Open a mobile wallet
            </Button>
          ) : null}
        </div>
      </Panel>

      {open ? (
        <Overlay onClose={() => setOpen(false)} labelledBy="wallet-title">
          <div className="relative p-6">
            <OverlayClose onClick={() => setOpen(false)} />
            <p className="kicker">Pay</p>
            <h3 id="wallet-title" className="mt-1 font-display text-2xl text-fg">
              Open a wallet with this invoice
            </h3>
            <p className="mt-2 text-sm text-muted">
              Prefer a native send when offered. Wallet buttons never reopen this site inside
              Phantom/Solflare (that would ask you to sign in again).
            </p>
            <ul className="mt-5 space-y-2">
              {options.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => void pick(w.id)}
                    className="flex min-h-14 w-full items-center justify-between rounded-lg border border-border px-3 py-3 text-left hover:border-gold/40"
                  >
                    <span>
                      <span className="block text-sm text-fg">
                        {w.id === "injected" ? (injected?.name ?? w.name) : w.name}
                      </span>
                      <span className="text-xs text-subtle">{w.hint}</span>
                    </span>
                    <ExternalLink className="size-4 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

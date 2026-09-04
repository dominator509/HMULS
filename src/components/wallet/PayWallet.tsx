import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Overlay, OverlayClose, Panel } from "@/components/ui/chrome";
import type { InvoiceView } from "@/lib/types";
import {
  WALLET_OPTIONS,
  connectInjected,
  detectInjected,
  listInjectedProviders,
  paymentUri,
  sendInjectedEth,
  shortAddr,
  walletDeepLink,
} from "@/lib/wallet";
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
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("injected");
  const [phase, setPhase] = useState<Phase>("idle");

  const uri = paymentUri(inv.asset, inv.payAddress, inv.cryptoAmount);

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
      const link = walletDeepLink(id, inv.asset, inv.payAddress, inv.cryptoAmount);
      window.open(link, "_blank", "noopener,noreferrer");
      setOpen(false);
      toast.message(`Opened ${opt.name}. Send to the invoice address, then mark sent.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect.");
    }
  }

  async function pay() {
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
    return w.assets.includes(inv.asset);
  });

  return (
    <div>
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker kicker-accent">Send</p>
            <p className="mt-1 font-display text-2xl text-fg">
              {inv.cryptoAmount} {inv.asset}
            </p>
            <p className="text-sm text-muted">
              Send exactly this amount to the invoice address. Access grants after NOWPayments confirms finished.
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
              onClick={() => {
                void navigator.clipboard.writeText(inv.payAddress);
                toast.success("Address copied.");
              }}
            >
              <Copy className="size-3" /> Copy
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-fg">
            No live payment address from NOWPayments. Wallets cannot connect until Worker hmuls has
            NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET, and NOWPAYMENTS_IPN_URL. Operator can still grant from Ops.
          </p>
        )}

        {account ? (
          <p className="mt-3 text-xs text-subtle">Connected {shortAddr(account)}</p>
        ) : null}

        {phase === "signing" || phase === "broadcast" ? (
          <p className="mt-4 text-sm text-gold">
            {phase === "signing" ? "Confirm the transfer in your wallet…" : "Waiting for chain verification…"}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {inv.asset === "ETH" && injectedList.length && inv.paymentReady && !account ? (
            injectedList.map((p) => (
              <Button
                key={p.name}
                size="xl"
                disabled={disabled || phase === "signing" || phase === "broadcast"}
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
          ) : null}
          {inv.asset === "ETH" && account ? (
            <Button
              size="xl"
              disabled={disabled || !inv.paymentReady || phase === "signing" || phase === "broadcast"}
              onClick={() => void pay()}
            >
              {phase === "signing" || phase === "broadcast" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Send {inv.cryptoAmount} ETH
            </Button>
          ) : null}
          {inv.asset === "ETH" && !injectedList.length && inv.paymentReady ? (
            <p className="text-xs text-subtle">
              No browser wallet detected. Use Open a mobile wallet below (MetaMask / Trust / Coinbase).
            </p>
          ) : null}
          <Button
            size={inv.asset === "ETH" && injected ? "lg" : "xl"}
            variant={inv.asset === "ETH" && injected ? "outline" : "gold"}
            disabled={disabled || !inv.payAddress}
            onClick={() => setOpen(true)}
          >
            Open a mobile wallet
          </Button>
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
              Deeplinks fill the address and amount. A signature is not payment. The grant waits for NOWPayments
              status finished.
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
                        {w.id === "injected" ? injected?.name ?? w.name : w.name}
                      </span>
                      <span className="text-xs text-subtle">{w.hint}</span>
                    </span>
                    <ExternalLink className="size-4 text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
            {uri ? (
              <p className="mt-4 break-all font-mono text-[11px] text-subtle">{uri}</p>
            ) : null}
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}

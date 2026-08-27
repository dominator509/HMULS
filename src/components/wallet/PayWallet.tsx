import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Overlay, OverlayClose, Panel } from "@/components/ui/chrome";
import type { InvoiceView } from "@/lib/types";
import {
  WALLET_OPTIONS,
  authorizeMessage,
  connectInjected,
  createVaultWallet,
  demoTxHash,
  detectInjected,
  ensureVaultWallet,
  loadVaultWallet,
  paymentUri,
  shortAddr,
  signInjected,
  walletDeepLink,
  type VaultWallet,
} from "@/lib/wallet";
import { Check, Copy, ExternalLink, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

type Phase = "idle" | "connect" | "confirm" | "signing" | "broadcast" | "mined";

export function PayWallet({
  inv,
  disabled,
  onPaid,
}: {
  inv: InvoiceView;
  disabled?: boolean;
  onPaid: (info: { method: string; wallet: string; txHash: string }) => Promise<void>;
}) {
  const injected = useMemo(() => detectInjected(), []);
  const [open, setOpen] = useState(false);
  const [vault, setVault] = useState<VaultWallet | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [method, setMethod] = useState<string>("vault");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirms, setConfirms] = useState(0);

  useEffect(() => {
    setVault(loadVaultWallet());
  }, []);

  const uri = paymentUri(inv.asset, inv.payAddress, inv.cryptoAmount);
  const connected = account || (method === "vault" ? vault?.eth : null);

  async function pick(id: string) {
    const opt = WALLET_OPTIONS.find((w) => w.id === id);
    if (!opt) return;
    setMethod(id);
    try {
      if (id === "vault") {
        const w = ensureVaultWallet();
        setVault(w);
        setAccount(w.eth);
        setOpen(false);
        setPhase("confirm");
        toast.success("Vault wallet connected.");
        return;
      }
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
      toast.message(`Opened ${opt.name}. Send, then confirm below.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not connect.");
    }
  }

  async function createVault() {
    const w = createVaultWallet();
    setVault(w);
    setAccount(w.eth);
    setMethod("vault");
    setOpen(false);
    setPhase("confirm");
    toast.success("Vault wallet created.");
  }

  async function pay() {
    if (disabled) return;
    const from = account || vault?.eth;
    if (!from) {
      setOpen(true);
      return;
    }
    setPhase("signing");
    try {
      if (method === "injected" && account) {
        await signInjected(
          account,
          authorizeMessage(inv.id, inv.cryptoAmount, inv.asset, inv.payAddress),
        );
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
      const hash = demoTxHash(inv.id, from);
      setTxHash(hash);
      setPhase("broadcast");
      setConfirms(0);
      await new Promise((r) => setTimeout(r, 450));
      setConfirms(1);
      await new Promise((r) => setTimeout(r, 450));
      setConfirms(2);
      setPhase("mined");
      await onPaid({ method, wallet: from, txHash: hash });
    } catch (err) {
      setPhase("confirm");
      toast.error(err instanceof Error ? err.message : "Signature rejected.");
    }
  }

  const options = WALLET_OPTIONS.filter((w) => {
    if (w.id === "injected") return Boolean(injected);
    return w.assets.includes(inv.asset) || w.id === "vault";
  });

  return (
    <div>
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="kicker kicker-accent">Wallet</p>
            <p className="mt-1 font-display text-2xl text-fg">
              {inv.cryptoAmount} {inv.asset}
            </p>
            <p className="text-sm text-muted">One tap from a connected wallet.</p>
          </div>
          <Wallet className="size-5 text-gold" />
        </div>

        {connected ? (
          <div className="mt-4 rounded-lg border border-border bg-raised px-3 py-3">
            <p className="text-xs text-subtle">
              {method === "vault" ? "Vault wallet" : method === "injected" ? injected?.name ?? "Browser wallet" : "Connected"}
            </p>
            <p className="mt-0.5 font-mono text-sm text-fg">{shortAddr(connected)}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            Connect a vault wallet (always works here) or a browser wallet. Mobile wallets open with the invoice filled in.
          </p>
        )}

        {phase === "signing" || phase === "broadcast" || phase === "mined" ? (
          <div className="mt-5 space-y-2 text-sm">
            <Step done={phase !== "signing"} label={phase === "signing" ? "Waiting on signature…" : "Signed"} />
            <Step done={confirms >= 1} label={confirms >= 1 ? "Broadcast" : "Broadcasting…"} />
            <Step done={confirms >= 2} label={confirms >= 2 ? "2 confirmations" : `${confirms}/2 confirmations`} />
            {txHash ? (
              <p className="break-all font-mono text-xs text-subtle">{txHash}</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {!connected ? (
            <Button size="xl" disabled={disabled} onClick={() => setOpen(true)}>
              Connect wallet
            </Button>
          ) : (
            <Button
              size="xl"
              disabled={disabled || phase === "signing" || phase === "broadcast"}
              onClick={() => void pay()}
            >
              {phase === "signing" || phase === "broadcast" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {phase === "signing"
                ? "Confirm in wallet…"
                : phase === "broadcast"
                  ? "Waiting on chain…"
                  : `Pay ${inv.cryptoAmount} ${inv.asset}`}
            </Button>
          )}
          {connected ? (
            <button
              type="button"
              className="min-h-11 text-sm text-muted hover:text-fg"
              onClick={() => setOpen(true)}
            >
              Switch wallet
            </button>
          ) : null}
        </div>
      </Panel>

      {open ? (
        <Overlay onClose={() => setOpen(false)} labelledBy="wallet-title">
          <div className="relative p-6">
            <OverlayClose onClick={() => setOpen(false)} />
            <p className="kicker">Connect</p>
            <h3 id="wallet-title" className="mt-1 font-display text-2xl text-fg">
              Choose how you pay
            </h3>
            <p className="mt-2 text-sm text-muted">
              Vault wallet is the guaranteed path in this preview. Browser and mobile wallets use the same invoice.
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
                    {w.id === "vault" ? (
                      <span className="text-xs tracking-[0.14em] text-gold uppercase">Easiest</span>
                    ) : (
                      <ExternalLink className="size-4 text-subtle" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            {!vault ? (
              <Button className="mt-4" variant="gold" size="xl" onClick={createVault}>
                Create a vault wallet
              </Button>
            ) : null}
            <p className="mt-4 text-xs text-subtle">
              Demo vault signs a grant authorization. Production broadcasts to the invoice address via WalletConnect / NOWPayments.
            </p>
          </div>
        </Overlay>
      ) : null}

      <details className="mt-4 rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm text-muted hover:text-fg">
          Send from another wallet
        </summary>
        <div className="mt-4 space-y-3">
          <p className="break-all font-mono text-xs text-fg">{inv.payAddress}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(inv.payAddress);
                toast.success("Address copied.");
              }}
            >
              <Copy className="size-3" /> Address
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(`${inv.cryptoAmount} ${inv.asset}`);
                toast.success("Amount copied.");
              }}
            >
              <Copy className="size-3" /> Amount
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(uri);
                toast.success("Pay link copied.");
              }}
            >
              <Copy className="size-3" /> Pay link
            </Button>
          </div>
          <p className="text-xs text-subtle">
            Open MetaMask, Trust, Phantom, or any wallet and send exactly {inv.cryptoAmount} {inv.asset}.
            Then confirm below if you paid outside this screen.
          </p>
        </div>
      </details>
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <p className={`flex items-center gap-2 ${done ? "text-gold" : "text-muted"}`}>
      {done ? <Check className="size-3.5" /> : <Loader2 className="size-3.5 animate-spin" />}
      {label}
    </p>
  );
}

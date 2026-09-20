import type { CryptoAsset } from "./types";

const VAULT_KEY = "sheundresses.vault.wallet";

export type VaultWallet = {
  id: string;
  eth: string;
  createdAt: number;
};

export type WalletOption = {
  id: string;
  name: string;
  hint: string;
  kind: "vault" | "injected" | "deeplink";
  assets: CryptoAsset[];
};

export function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < bytes; i += 1) a[i] = Math.floor(Math.random() * 256);
  }
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadVaultWallet(): VaultWallet | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as VaultWallet;
    if (!w?.eth?.startsWith("0x")) return null;
    return w;
  } catch {
    return null;
  }
}

export function createVaultWallet(): VaultWallet {
  const w: VaultWallet = {
    id: `vw_${randomHex(6)}`,
    eth: `0x${randomHex(20)}`,
    createdAt: Date.now(),
  };
  localStorage.setItem(VAULT_KEY, JSON.stringify(w));
  return w;
}

export function ensureVaultWallet(): VaultWallet {
  return loadVaultWallet() ?? createVaultWallet();
}

type EthProvider = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isRainbow?: boolean;
  isCoinbaseWallet?: boolean;
  isTrust?: boolean;
  isBase?: boolean;
  providers?: EthProvider[];
};

function readEthereum(): EthProvider | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthProvider }).ethereum ?? null;
}

function providerName(eth: EthProvider) {
  if (eth.isMetaMask) return "MetaMask";
  if (eth.isRainbow) return "Rainbow";
  if (eth.isCoinbaseWallet || eth.isBase) return "Coinbase / Base Wallet";
  if (eth.isTrust) return "Trust Wallet";
  return "Browser wallet";
}

export function listInjectedProviders(): { name: string; provider: EthProvider }[] {
  const eth = readEthereum();
  if (!eth) return [];
  const raw = Array.isArray(eth.providers) && eth.providers.length ? eth.providers : [eth];
  const seen = new Set<string>();
  const out: { name: string; provider: EthProvider }[] = [];
  for (const p of raw) {
    const name = providerName(p);
    const key = name + String(Boolean(p.isMetaMask)) + String(Boolean(p.isCoinbaseWallet));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, provider: p });
  }
  return out;
}

export function detectInjected(): { name: string } | null {
  const list = listInjectedProviders();
  return list[0] ? { name: list[0].name } : null;
}

export async function connectInjected(preferred?: EthProvider): Promise<string> {
  const list = listInjectedProviders();
  const eth =
    preferred ||
    list.find((p) => p.provider.isMetaMask)?.provider ||
    list.find((p) => p.provider.isCoinbaseWallet || p.provider.isBase)?.provider ||
    list[0]?.provider ||
    null;
  if (!eth) throw new Error("No browser wallet found. Install MetaMask, Coinbase Wallet, or Trust and refresh.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const addr = accounts?.[0];
  if (!addr) throw new Error("Wallet returned no account.");
  return addr;
}

export async function signInjected(address: string, message: string): Promise<string> {
  const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No browser wallet found.");
  const sig = (await eth.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;
  return sig;
}

export function ethToWei(ethAmount: string): bigint {
  const [w, f = ""] = ethAmount.split(".");
  const frac = `${f}000000000000000000`.slice(0, 18);
  return BigInt(w || "0") * 10n ** 18n + BigInt(frac || "0");
}

export function paymentUri(asset: CryptoAsset, address: string, amount: string, label = "SHE UNDRESSES") {
  const enc = encodeURIComponent(label);
  switch (asset) {
    case "ETH":
      return `ethereum:${address}@1?value=${ethToWei(amount).toString()}&label=${enc}`;
    case "BTC":
      return `bitcoin:${address}?amount=${amount}&label=${enc}`;
    case "SOL":
      return `solana:${address}?amount=${amount}&label=${enc}`;
    case "USDT":
      return address;
  }
}

/** Phantom Android applicationId — pins Solana Pay away from other solana: handlers. */
export const PHANTOM_ANDROID_PACKAGE = "app.phantom";
/** Solflare Android applicationId. */
export const SOLFLARE_ANDROID_PACKAGE = "com.solflare.mobile";

export function isAndroidUserAgent(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /Android/i.test(ua);
}

/**
 * Android Intent URL that opens a Solana Pay transfer in a *specific* wallet.
 * Bare `solana:` is a shared scheme (other wallets can hijack it). Package-scoped
 * intents do not open sheundresses.com in an in-app browser.
 */
export function androidSolanaPayIntent(solanaUri: string, androidPackage: string): string {
  if (!solanaUri.startsWith("solana:")) {
    throw new Error("Expected a solana: pay URI");
  }
  const pathAndQuery = solanaUri.slice("solana:".length);
  return `intent://${pathAndQuery}#Intent;scheme=solana;package=${androidPackage};end`;
}

export type SolWalletLaunch =
  | { kind: "open"; href: string; uri: string; message: string }
  | { kind: "copy"; uri: string; message: string };

/**
 * How to open Phantom / Solflare for SOL unlock without forcing a logged-out
 * in-app browser session on sheundresses.com.
 *
 * Research note (2026-09): Phantom/Solflare branded ULs are connect/sign*
 * (encrypted sessions) or `…/ul/browse/<https-url>` (in-app browser). There is
 * no branded HTTPS deeplink that pre-fills a native Solana Pay send. On Android
 * we package-pin the shared `solana:` scheme; elsewhere we copy the pay link.
 */
export function launchSolWallet(
  wallet: "phantom" | "solflare",
  address: string,
  amount: string,
  opts?: { userAgent?: string },
): SolWalletLaunch {
  const uri = paymentUri("SOL", address, amount);
  const ua = opts?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const name = wallet === "phantom" ? "Phantom" : "Solflare";
  const pkg = wallet === "phantom" ? PHANTOM_ANDROID_PACKAGE : SOLFLARE_ANDROID_PACKAGE;
  if (isAndroidUserAgent(ua)) {
    return {
      kind: "open",
      href: androidSolanaPayIntent(uri, pkg),
      uri,
      message: `Opening ${name} to send. Confirm the amount, then mark sent here.`,
    };
  }
  return {
    kind: "copy",
    uri,
    message: `Pay link copied. Open ${name} → paste or scan Solana Pay. Do not re-open this site inside the wallet browser (separate sign-in).`,
  };
}

export type WalletDeepLinkOpts = {
  checkoutUrl?: string;
  /** Optional UA override for tests / SSR. */
  userAgent?: string;
};

export function walletDeepLink(
  wallet: string,
  asset: CryptoAsset,
  address: string,
  amount: string,
  opts?: WalletDeepLinkOpts,
) {
  const uri = paymentUri(asset, address, amount);
  const encoded = encodeURIComponent(uri);
  switch (wallet) {
    case "metamask":
      if (asset === "ETH") {
        return `https://metamask.app.link/send/${address}@1?value=${ethToWei(amount).toString()}`;
      }
      return `https://metamask.app.link/dapp/${encoded}`;
    case "rainbow":
      return `https://rnbwapp.com/wc?uri=${encoded}`;
    case "coinbase":
      return `https://go.cb-w.com/dapp?cb_url=${encoded}`;
    case "trust":
      if (asset === "ETH") {
        return `https://link.trustwallet.com/send?coin=60&address=${address}&amount=${amount}`;
      }
      if (asset === "BTC") {
        return `https://link.trustwallet.com/send?coin=0&address=${address}&amount=${amount}`;
      }
      return `https://link.trustwallet.com/send?address=${address}&amount=${amount}`;
    case "phantom":
    case "solflare": {
      // Prefer native / copy — never default to wallet in-app browse (logged-out).
      if (asset !== "SOL") return uri;
      const launch = launchSolWallet(wallet, address, amount, { userAgent: opts?.userAgent });
      return launch.kind === "open" ? launch.href : launch.uri;
    }
    default:
      return uri;
  }
}

export async function sendInjectedEth(from: string, to: string, amountEth: string): Promise<string> {
  const eth =
    listInjectedProviders().find((p) => p.provider.isMetaMask)?.provider ||
    listInjectedProviders()[0]?.provider ||
    null;
  if (!eth) throw new Error("No browser wallet found.");
  const hash = (await eth.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to,
        value: "0x" + ethToWei(amountEth).toString(16),
      },
    ],
  })) as string;
  if (!hash) throw new Error("Wallet did not broadcast a transaction.");
  return hash;
}

export function authorizeMessage(invoiceId: string, amount: string, asset: string, address: string) {
  return `SHE UNDRESSES\nAuthorize grant ${invoiceId}\nPay ${amount} ${asset}\nTo ${address}\nThis signature is the yes.`;
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "injected",
    name: "Browser wallet",
    hint: "MetaMask, Rainbow, Rabby, Coinbase extension. Broadcasts the payment.",
    kind: "injected",
    assets: ["ETH"],
  },
  {
    id: "metamask",
    name: "MetaMask",
    hint: "Opens the app with the invoice filled in.",
    kind: "deeplink",
    assets: ["ETH", "USDT"],
  },
  {
    id: "rainbow",
    name: "Rainbow",
    hint: "Mobile wallet. Scan or open the pay link.",
    kind: "deeplink",
    assets: ["ETH"],
  },
  {
    id: "trust",
    name: "Trust Wallet",
    hint: "Send from Trust with amount and address set.",
    kind: "deeplink",
    assets: ["ETH", "BTC", "USDT"],
  },
  {
    id: "coinbase",
    name: "Coinbase / Base Wallet",
    hint: "Opens Coinbase Wallet with the pay link.",
    kind: "deeplink",
    assets: ["ETH", "USDT"],
  },
  {
    id: "phantom",
    name: "Phantom",
    hint: "Android: native send. Other devices: copies the pay link (no in-app site login).",
    kind: "deeplink",
    assets: ["SOL"],
  },
  {
    id: "solflare",
    name: "Solflare",
    hint: "Android: native send. Other devices: copies the pay link (no in-app site login).",
    kind: "deeplink",
    assets: ["SOL"],
  },
];

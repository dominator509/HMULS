import type { CryptoAsset } from "./types";
import { formatSolAmount, isSolanaAddress, solToLamports } from "./sol-amount.ts";
import { startSolMobileConnect } from "./sol-mobile-deeplink.ts";
import {
  fetchRecentBlockhashFromApi,
  friendlySolPrepareError,
} from "./sol-recent-blockhash.ts";

export { formatSolAmount, isSolanaAddress, solToLamports } from "./sol-amount.ts";

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

/** Tether USD (USDT) ERC-20 on Ethereum mainnet — NOWPayments `usdterc20`. */
export const USDT_ERC20_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const USDT_ERC20_DECIMALS = 6;
export const USDT_ERC20_CHAIN_ID = 1;

/**
 * NOWPayments USDT is `usdterc20` (Ethereum). Default ERC-20 unless payCurrency
 * explicitly names TRC-20 (not wired in this app).
 */
export function isUsdtErc20(asset: CryptoAsset, payCurrency?: string | null): boolean {
  if (asset !== "USDT") return false;
  const cur = (payCurrency || "usdterc20").toLowerCase().replace(/[_\s]/g, "");
  if (cur === "usdttrc20" || cur === "trc20" || cur.includes("tron")) return false;
  return true;
}

/** Human USDT amount → ERC-20 uint256 base units (6 decimals), floored. */
export function usdtToBaseUnits(amount: string): bigint {
  const raw = (amount || "").trim();
  if (!raw || raw.startsWith("-")) return 0n;
  const [whole, frac = ""] = raw.split(".");
  const w = whole.replace(/[^0-9]/g, "") || "0";
  const f = `${frac.replace(/[^0-9]/g, "")}000000`.slice(0, USDT_ERC20_DECIMALS);
  return BigInt(w) * 10n ** BigInt(USDT_ERC20_DECIMALS) + BigInt(f || "0");
}

/** EIP-681 ERC-20 transfer URI for USDT on Ethereum mainnet. */
export function usdtErc20PaymentUri(payAddress: string, amount: string): string {
  const addr = (payAddress || "").trim();
  if (!addr || !/^0x[a-fA-F0-9]{40}$/.test(addr)) return "";
  const units = usdtToBaseUnits(amount);
  if (units <= 0n) return "";
  return `ethereum:${USDT_ERC20_CONTRACT}@${USDT_ERC20_CHAIN_ID}/transfer?address=${addr}&uint256=${units.toString()}`;
}

export type PaymentUriOpts = {
  /** NOWPayments pay_currency (e.g. usdterc20). */
  payCurrency?: string | null;
};

export function paymentUri(
  asset: CryptoAsset,
  address: string,
  amount: string,
  label = "SHE UNDRESSES",
  opts?: PaymentUriOpts,
) {
  const enc = encodeURIComponent(label);
  const addr = (address || "").trim();
  switch (asset) {
    case "ETH":
      if (!addr) return "";
      return `ethereum:${addr}@1?value=${ethToWei(amount).toString()}&label=${enc}`;
    case "BTC":
      if (!addr) return "";
      return `bitcoin:${addr}?amount=${amount}&label=${enc}`;
    case "LTC":
      if (!addr) return "";
      return `litecoin:${addr}?amount=${amount}&label=${enc}`;
    case "SOL": {
      // Solana Pay rejects >9 decimals / scientific notation / empty recipient (invalid link).
      const amt = formatSolAmount(amount);
      if (!addr || !isSolanaAddress(addr) || !amt || amt === "0") return "";
      return `solana:${addr}?amount=${amt}&label=${enc}`;
    }
    case "USDT":
      if (!isUsdtErc20("USDT", opts?.payCurrency)) return addr;
      return usdtErc20PaymentUri(addr, amount);
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
 * - Android: package-scoped `intent://` Solana Pay (native send; not Base).
 * - iOS: branded HTTPS universal links — `https://phantom.app/ul/v1/connect`
 *   then Phantom `…/signTransaction` (deprecated signAndSend) + server
 *   sendRaw; Solflare `…/signAndSendTransaction`. Never bare `solana:`
 *   (iOS has no chooser; Base hijacks the shared scheme).
 * - Desktop: extension `sendSolWithWallet`; copy is fallback only.
 * - Never `…/ul/browse/<checkout>` as the primary pay path (logged-out WebView).
 */
export function isMobileUserAgent(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export function isIosUserAgent(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
}

export type LaunchSolWalletOpts = {
  userAgent?: string;
  /** Required on iOS for branded connect UL redirect back to checkout. */
  checkoutUrl?: string;
  appUrl?: string;
  /** Persist terms ack for this invoice across the wallet round-trip. */
  invoiceId?: string;
};

export function launchSolWallet(
  wallet: "phantom" | "solflare",
  address: string,
  amount: string,
  opts?: LaunchSolWalletOpts,
): SolWalletLaunch {
  const uri = paymentUri("SOL", address, amount);
  if (!uri) {
    return {
      kind: "copy",
      uri: "",
      message: "Payment address or amount is not ready yet. Wait a moment and try again.",
    };
  }
  const ua = opts?.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const name = wallet === "phantom" ? "Phantom" : "Solflare";
  const pkg = wallet === "phantom" ? PHANTOM_ANDROID_PACKAGE : SOLFLARE_ANDROID_PACKAGE;
  const amt = formatSolAmount(amount);
  // Android: package-scoped intent → native send sheet (not Base, not in-app browse).
  if (isAndroidUserAgent(ua)) {
    return {
      kind: "open",
      href: androidSolanaPayIntent(uri, pkg),
      uri,
      message: `Confirm ${amt} SOL in ${name}.`,
    };
  }
  // iOS / other mobile: wallet-owned HTTPS UL (connect → sign / signAndSend). Never bare solana:.
  if (isMobileUserAgent(ua) || isIosUserAgent(ua)) {
    const checkoutUrl =
      opts?.checkoutUrl ||
      (typeof window !== "undefined" && window.location?.href?.startsWith("https://")
        ? window.location.href
        : "");
    if (!checkoutUrl.startsWith("https://")) {
      return {
        kind: "copy",
        uri,
        message: `Open this page over HTTPS, then tap Pay with ${name} again.`,
      };
    }
    try {
      const started = startSolMobileConnect({
        wallet,
        to: address,
        amountSol: amount,
        checkoutUrl,
        appUrl: opts?.appUrl,
        invoiceId: opts?.invoiceId,
      });
      return {
        kind: "open",
        href: started.href,
        uri,
        message: started.message,
      };
    } catch (err) {
      return {
        kind: "copy",
        uri,
        message: err instanceof Error ? err.message : `Could not open ${name}.`,
      };
    }
  }
  // Desktop without extension: UI prefers connect+signAndSend; copy is fallback only.
  return {
    kind: "copy",
    uri,
    message: `Install the ${name} extension to pay in one tap, or use Copy address below.`,
  };
}

export type SolWalletId = "phantom" | "solflare";

type SolanaInjected = {
  isPhantom?: boolean;
  isSolflare?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect?: () => Promise<void>;
  signAndSendTransaction: (
    transaction: unknown,
    opts?: { skipPreflight?: boolean },
  ) => Promise<{ signature: string } | string>;
};

function readSolInjected(id: SolWalletId): SolanaInjected | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    phantom?: { solana?: SolanaInjected };
    solflare?: SolanaInjected;
    solana?: SolanaInjected;
  };
  if (id === "phantom") {
    const p = w.phantom?.solana;
    if (p) return p;
    if (w.solana?.isPhantom) return w.solana;
    return null;
  }
  if (w.solflare) return w.solflare;
  if (w.solana?.isSolflare) return w.solana;
  return null;
}

export function detectSolWallet(id: SolWalletId): boolean {
  return Boolean(readSolInjected(id));
}

export async function connectSolWallet(id: SolWalletId): Promise<string> {
  const provider = readSolInjected(id);
  const name = id === "phantom" ? "Phantom" : "Solflare";
  if (!provider) {
    throw new Error(`${name} extension not found. Install it, or pay from your phone.`);
  }
  const res = await provider.connect();
  const pk = res?.publicKey?.toString() || provider.publicKey?.toString();
  if (!pk) throw new Error(`${name} returned no account.`);
  return pk;
}


/**
 * Desktop / in-wallet WebView: connect (if needed) and signAndSend a native SOL
 * transfer for the exact invoice amount to the invoice address.
 */
export async function sendSolWithWallet(opts: {
  wallet: SolWalletId;
  to: string;
  amountSol: string;
}): Promise<{ signature: string; from: string }> {
  const to = opts.to.trim();
  const amount = formatSolAmount(opts.amountSol);
  if (!isSolanaAddress(to)) throw new Error("Invoice address is not a valid Solana address.");
  if (!amount || amount === "0") throw new Error("Invoice amount is not ready.");

  const provider = readSolInjected(opts.wallet);
  const name = opts.wallet === "phantom" ? "Phantom" : "Solflare";
  if (!provider) throw new Error(`${name} extension not found.`);

  if (!provider.publicKey) {
    await provider.connect();
  }
  const from = provider.publicKey?.toString();
  if (!from) throw new Error(`${name} returned no account.`);

  const lamports = solToLamports(amount);
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount too large to send from this browser.");
  }

  const { PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(from),
      toPubkey: new PublicKey(to),
      lamports: Number(lamports),
    }),
  );
  tx.feePayer = new PublicKey(from);
  // Same-origin Worker API — never browser→public Solana RPC (403 from many origins).
  let latest;
  try {
    latest = await fetchRecentBlockhashFromApi();
  } catch (err) {
    throw new Error(friendlySolPrepareError(err));
  }
  tx.recentBlockhash = latest.blockhash;

  const result = await provider.signAndSendTransaction(tx);
  const signature = typeof result === "string" ? result : result?.signature;
  if (!signature) throw new Error(`${name} did not return a signature.`);
  return { signature, from };
}

export type WalletDeepLinkOpts = {
  checkoutUrl?: string;
  /** Optional UA override for tests / SSR. */
  userAgent?: string;
  /** NOWPayments pay_currency (usdterc20 for USDT). */
  payCurrency?: string | null;
};

export type WalletDeepLinkLaunch =
  | { kind: "open"; href: string; message: string }
  | { kind: "copy"; text: string; href?: string; message: string };

/**
 * Coinbase Wallet / Base has no documented universal-link params that prefill
 * Send (To / asset / amount). Official + community reports: `https://go.cb-w.com/send?`
 * opens a blank To field with Paste. EIP-681 works in-app but cannot target Coinbase
 * when multiple wallets are installed. Merchants copy address + guide Paste → USDT.
 * @see https://github.com/coinbase/coinbase-wallet-sdk/issues/1679
 */
export const COINBASE_USDT_SEND_HREF = "https://go.cb-w.com/send?";

/** Clipboard must be address-only so Coinbase Send "Paste" fills To correctly. */
export function coinbaseUsdtPasteMessage(amount: string): string {
  const amt = (amount || "").trim();
  return amt
    ? `Address copied. Tap Paste in To, then choose USDT (Ethereum). Send exactly ${amt} USDT.`
    : "Address copied. Tap Paste in To, then choose USDT (Ethereum).";
}

/**
 * MetaMask ERC-20 send universal link (not /dapp/ — bare address opens a blank browser).
 * @see https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks/
 */
export function metamaskUsdtErc20SendHref(payAddress: string, amount: string): string {
  const uri = usdtErc20PaymentUri(payAddress, amount);
  if (!uri) return "";
  // ethereum:0xdAC…@1/transfer?address=…&uint256=… → metamask.app.link/send/0xdAC…@1/transfer?…
  return `https://metamask.app.link/send/${uri.slice("ethereum:".length)}`;
}

/**
 * Trust Wallet USDT ERC-20 send — UAI asset `c60_t<contract>` (Ethereum slip44=60).
 * Amount is human USDT units. @see https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
 */
export function trustUsdtErc20SendHref(payAddress: string, amount: string): string {
  const addr = (payAddress || "").trim();
  if (!addr) return "";
  const asset = `c60_t${USDT_ERC20_CONTRACT}`;
  const q = new URLSearchParams({
    asset,
    address: addr,
    amount: (amount || "").trim(),
  });
  // Also pass coin+token (legacy) so older Trust builds still open the Ethereum token send sheet.
  return `https://link.trustwallet.com/send?${q.toString()}&coin=60&token=${USDT_ERC20_CONTRACT}`;
}

export function walletDeepLink(
  wallet: string,
  asset: CryptoAsset,
  address: string,
  amount: string,
  opts?: WalletDeepLinkOpts,
) {
  const uri = paymentUri(asset, address, amount, "SHE UNDRESSES", {
    payCurrency: opts?.payCurrency,
  });
  const encoded = encodeURIComponent(uri);
  const usdtErc20 = isUsdtErc20(asset, opts?.payCurrency);
  switch (wallet) {
    case "metamask":
      if (asset === "ETH") {
        return `https://metamask.app.link/send/${address}@1?value=${ethToWei(amount).toString()}`;
      }
      if (usdtErc20) {
        return metamaskUsdtErc20SendHref(address, amount);
      }
      return `https://metamask.app.link/dapp/${encoded}`;
    case "rainbow":
      return `https://rnbwapp.com/wc?uri=${encoded}`;
    case "coinbase":
      if (usdtErc20) {
        // go.cb-w.com/dapp?cb_url= expects an https URL — bare address / EIP-681 → "Invalid URL".
        // No documented send prefill; launchWalletDeepLink copies address + opens send home.
        return COINBASE_USDT_SEND_HREF;
      }
      return `https://go.cb-w.com/dapp?cb_url=${encoded}`;
    case "trust":
      if (asset === "ETH") {
        return `https://link.trustwallet.com/send?coin=60&address=${address}&amount=${amount}`;
      }
      if (asset === "BTC") {
        return `https://link.trustwallet.com/send?coin=0&address=${address}&amount=${amount}`;
      }
      if (asset === "LTC") {
        // SLIP-44 coin type 2 = Litecoin (same Trust send pattern as BTC).
        return `https://link.trustwallet.com/send?coin=2&address=${address}&amount=${amount}`;
      }
      if (usdtErc20) {
        return trustUsdtErc20SendHref(address, amount);
      }
      return `https://link.trustwallet.com/send?address=${address}&amount=${amount}`;
    case "phantom":
    case "solflare": {
      // Prefer native / copy — never default to wallet in-app browse (logged-out).
      // LOCKED: do not change SOL mobile deeplink / SOL pay paths here.
      if (asset !== "SOL") return uri;
      const launch = launchSolWallet(wallet, address, amount, {
        userAgent: opts?.userAgent,
        checkoutUrl: opts?.checkoutUrl,
      });
      return launch.kind === "open" ? launch.href : launch.uri;
    }
    default:
      return uri;
  }
}

/**
 * Open a mobile wallet for an invoice.
 * Coinbase / Base is not offered for USDT in WALLET_OPTIONS (no reliable Tether send).
 * Harmless legacy path: if called for Coinbase + usdterc20, copies address only and
 * opens go.cb-w.com/send (never dapp?cb_url= bare address → Invalid URL).
 */
export function launchWalletDeepLink(
  wallet: string,
  asset: CryptoAsset,
  address: string,
  amount: string,
  opts?: WalletDeepLinkOpts,
): WalletDeepLinkLaunch {
  const usdtErc20 = isUsdtErc20(asset, opts?.payCurrency);
  if (wallet === "coinbase" && usdtErc20) {
    const addr = (address || "").trim();
    const amt = (amount || "").trim();
    // Address only — Coinbase Send To has a Paste control; multi-line clipboard breaks it.
    return {
      kind: "copy",
      text: addr,
      href: COINBASE_USDT_SEND_HREF,
      message: coinbaseUsdtPasteMessage(amt),
    };
  }
  const href = walletDeepLink(wallet, asset, address, amount, opts);
  if (!href) {
    return {
      kind: "copy",
      text: (address || "").trim(),
      message: "Copy the invoice address and send the exact amount in your wallet.",
    };
  }
  const name =
    wallet === "metamask"
      ? "MetaMask"
      : wallet === "trust"
        ? "Trust Wallet"
        : wallet === "coinbase"
          ? "Coinbase Wallet"
          : "wallet";
  const message = usdtErc20
    ? `Opened ${name}. Confirm USDT (ERC-20) on Ethereum — wrong network risks lost funds.`
    : `Opened ${name}. Send to the invoice address, then mark sent.`;
  return { kind: "open", href, message };
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
    assets: ["ETH", "BTC", "LTC", "USDT"],
  },
  {
    id: "coinbase",
    name: "Coinbase / Base Wallet",
    hint: "Opens Coinbase / Base Wallet with the pay link.",
    kind: "deeplink",
    assets: ["ETH"],
  },
  {
    id: "phantom",
    name: "Phantom",
    hint: "Connect & pay in one tap (extension), or open Phantom on iPhone via branded link.",
    kind: "deeplink",
    assets: ["SOL"],
  },
  {
    id: "solflare",
    name: "Solflare",
    hint: "Connect & pay in one tap (extension), or open Solflare on iPhone via branded link.",
    kind: "deeplink",
    assets: ["SOL"],
  },
];

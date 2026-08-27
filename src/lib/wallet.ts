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

export function detectInjected(): { name: string } | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: Record<string, unknown> }).ethereum;
  if (!eth) return null;
  if (eth.isMetaMask) return { name: "MetaMask" };
  if (eth.isRainbow) return { name: "Rainbow" };
  if (eth.isCoinbaseWallet) return { name: "Coinbase Wallet" };
  if (eth.isTrust) return { name: "Trust Wallet" };
  return { name: "Browser wallet" };
}

export async function connectInjected(): Promise<string> {
  const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
  if (!eth) throw new Error("No browser wallet found.");
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

export function walletDeepLink(
  wallet: string,
  asset: CryptoAsset,
  address: string,
  amount: string,
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
      return `https://phantom.app/ul/browse/${encoded}`;
    default:
      return uri;
  }
}

export function demoTxHash(invoiceId: string, wallet: string) {
  return `0x${randomHex(32).slice(0, 8)}${invoiceId.replace(/[^a-f0-9]/gi, "").slice(0, 24).padEnd(24, "0")}${wallet.replace(/[^a-f0-9]/gi, "").slice(0, 32).padEnd(32, "a")}`.slice(0, 66);
}

export function authorizeMessage(invoiceId: string, amount: string, asset: string, address: string) {
  return `SHE UNDRESSES\nAuthorize grant ${invoiceId}\nPay ${amount} ${asset}\nTo ${address}\nThis signature is the yes.`;
}

export const WALLET_OPTIONS: WalletOption[] = [
  {
    id: "vault",
    name: "Vault wallet",
    hint: "Created here. One tap. Works in this preview.",
    kind: "vault",
    assets: ["ETH", "USDT", "BTC", "SOL"],
  },
  {
    id: "injected",
    name: "Browser wallet",
    hint: "MetaMask, Rainbow, Rabby, Coinbase extension.",
    kind: "injected",
    assets: ["ETH", "USDT"],
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
    id: "phantom",
    name: "Phantom",
    hint: "Solana pay link.",
    kind: "deeplink",
    assets: ["SOL"],
  },
];

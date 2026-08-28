import type { CryptoAsset } from "./types";

export const CRYPTO_ASSETS: {
  id: CryptoAsset;
  name: string;
  network: string;
}[] = [
  { id: "ETH", name: "Ethereum", network: "Wallet · ERC-20" },
  { id: "USDT", name: "Tether", network: "ERC-20" },
  { id: "SOL", name: "Solana", network: "Phantom" },
  { id: "BTC", name: "Bitcoin", network: "On-chain" },
];

/** Demo rates — production would pull NOWPayments /estimate. */
export const DEMO_RATES: Record<CryptoAsset, number> = {
  BTC: 64_250,
  ETH: 3_180,
  USDT: 1,
  SOL: 148,
};

export function nowPayCurrency(asset: CryptoAsset) {
  if (asset === "USDT") return "usdterc20";
  return asset.toLowerCase();
}

export function usdToCrypto(cents: number, asset: CryptoAsset) {
  const usd = cents / 100;
  const rate = DEMO_RATES[asset];
  const decimals = asset === "USDT" ? 2 : 8;
  return (usd / rate).toFixed(decimals);
}

function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexRepeat(seed: string, len: number) {
  let out = "";
  let n = 0;
  while (out.length < len) {
    out += fnv(`${seed}:${n}`).toString(16).padStart(8, "0");
    n += 1;
  }
  return out.slice(0, len);
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58(seed: string, len: number) {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += B58[fnv(`${seed}:${i}`) % B58.length];
  }
  return out;
}

/** Deterministic demo addresses — production uses NOWPayments `pay_address`. */
export function demoAddress(invoiceId: string, asset: CryptoAsset) {
  const seed = `${invoiceId}:${asset}`;
  switch (asset) {
    case "BTC":
      return `bc1q${b58(seed, 38).toLowerCase()}`;
    case "ETH":
      return `0x${hexRepeat(seed, 40)}`;
    case "USDT":
      return `0x${hexRepeat(seed, 40)}`;
    case "SOL":
      return b58(seed, 44);
  }
}

export function giftCode(seed: string) {
  return b58(`gift:${seed}`, 8).toUpperCase();
}

export function invoiceId() {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `inv_${rand.slice(0, 20)}`;
}

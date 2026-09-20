/**
 * Solana Pay amount / address helpers (pure — safe on Worker and browser).
 *
 * Spec: amount is user units (SOL), ≤9 decimals, no scientific notation,
 * leading 0 before `.` for values < 1. Excess decimals → wallet rejects URI
 * as malformed. NOWPayments often returns float dust like
 * `0.011459100000000001` via `String(number)` — that alone made pay links invalid.
 */

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isSolanaAddress(address: string): boolean {
  return BASE58_RE.test(address.trim());
}

export function lamportsToSolString(lamports: bigint): string {
  if (lamports < 0n) return "";
  const w = lamports / 1_000_000_000n;
  const f = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return f ? `${w}.${f}` : `${w}`;
}

/**
 * Normalize a SOL amount for Solana Pay URIs and SystemProgram transfers.
 * Truncates past 9 decimals (lamport precision) and strips trailing zeros.
 */
export function formatSolAmount(raw: string | number): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  if (/[eE]/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return "";
    s = n.toFixed(9);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return "";
  const [wholeRaw, frac = ""] = s.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const trimmed = frac.slice(0, 9).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/** Parse a decimal SOL string into lamports (after formatSolAmount). */
export function solToLamports(raw: string | number): bigint {
  const sol = formatSolAmount(raw);
  if (!sol) throw new Error("Invalid SOL amount.");
  const [whole, frac = ""] = sol.split(".");
  const padded = `${frac}000000000`.slice(0, 9);
  return BigInt(whole || "0") * 1_000_000_000n + BigInt(padded || "0");
}

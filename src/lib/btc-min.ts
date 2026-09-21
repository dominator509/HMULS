/**
 * Bitcoin NOWPayments gating (pure helpers — no I/O).
 *
 * Two gates, both required to offer BTC:
 * 1. Shot-count: invoice unlocks ≥ BTC_MIN_SHOTS photos (bundled / multi-shot upsells).
 * 2. Fiat min: USD invoice ≥ live NOWPayments BTC→BTC minimum fiat
 *    (GET /v1/min-amount?currency_from=btc&currency_to=btc&fiat_equivalent=usd), plus buffer.
 * We apply a small buffer so borderline invoices do not fail at create after the picker showed BTC.
 */

/** Minimum photos unlocked by the invoice before BTC is offered. */
export const BTC_MIN_SHOTS = 3;

/** 5% headroom over live fiat_equivalent (document: optional 5–10%; we use 5%). */
export const BTC_MIN_BUFFER = 1.05;

/**
 * Gated USD floor in cents: live fiat USD × buffer, rounded up to the next cent.
 */
export function gatedBtcMinUsdCents(fiatUsd: number, buffer: number = BTC_MIN_BUFFER): number {
  if (!Number.isFinite(fiatUsd) || fiatUsd <= 0) return 0;
  const b = Number.isFinite(buffer) && buffer >= 1 ? buffer : BTC_MIN_BUFFER;
  return Math.ceil(fiatUsd * b * 100);
}

/** Whole-dollar tip floor (round up), e.g. 2107¢ → $22 for “about $22”. */
export function btcMinTipDollars(minUsdCents: number): number {
  if (!Number.isFinite(minUsdCents) || minUsdCents <= 0) return 0;
  return Math.ceil(minUsdCents / 100);
}

export function isBtcBelowMin(amountCents: number, minUsdCents: number): boolean {
  if (!Number.isFinite(minUsdCents) || minUsdCents <= 0) return false;
  return amountCents < minUsdCents;
}

/** True when this unlock grants fewer than BTC_MIN_SHOTS photos. */
export function isBtcBelowShotMin(shotCount: number): boolean {
  if (!Number.isFinite(shotCount)) return true;
  return shotCount < BTC_MIN_SHOTS;
}

/** Buyer tip when BTC is hidden for the fiat floor (no backend jargon). */
export function btcMinBuyerTip(minUsdCents: number): string {
  const dollars = btcMinTipDollars(minUsdCents);
  return `Bitcoin available from about $${dollars}`;
}

/** Buyer tip when BTC is hidden because the unlock is under 3 shots. */
export const BTC_SHOT_MIN_BUYER_TIP =
  "Bitcoin is available when unlocking 3 or more photos";

/** Same clear buyer message when createInvoice rejects BTC below the gated min. */
export function btcBelowMinCreateError(minUsdCents: number): string {
  const dollars = btcMinTipDollars(minUsdCents);
  return `Bitcoin is available from about $${dollars} — pick Solana, USDT, Ethereum, or Litecoin for this unlock, or choose a larger set.`;
}

/** Same clear buyer message when createInvoice rejects BTC below the shot-count gate. */
export function btcBelowShotMinCreateError(): string {
  return `${BTC_SHOT_MIN_BUYER_TIP} — pick Solana, USDT, Ethereum, or Litecoin for this unlock, or choose a larger set.`;
}

/**
 * Why BTC is hidden in the asset picker. Shot-count takes precedence over amount
 * so buyers see the actionable “unlock 3+” tip on single/2-shot gates.
 */
export type BtcHideReason = "shots" | "amount" | null;

export function btcHideReason(
  shotCount: number,
  amountCents: number,
  minUsdCents: number | null | undefined,
): BtcHideReason {
  if (isBtcBelowShotMin(shotCount)) return "shots";
  if (
    minUsdCents != null &&
    minUsdCents > 0 &&
    isBtcBelowMin(amountCents, minUsdCents)
  ) {
    return "amount";
  }
  return null;
}

/** Picker tip for the active hide reason (null when BTC should show). */
export function btcBuyerTipForHide(
  reason: BtcHideReason,
  minUsdCents: number | null | undefined,
): string | null {
  if (reason === "shots") return BTC_SHOT_MIN_BUYER_TIP;
  if (reason === "amount" && minUsdCents != null && minUsdCents > 0) {
    return btcMinBuyerTip(minUsdCents);
  }
  return null;
}

/** Fallback when live min is unknown but NOWPayments said “less than minimal”. */
export const BTC_BELOW_MIN_FALLBACK =
  "Bitcoin is below the minimum for this unlock — pick Solana, USDT, Ethereum, or Litecoin, or choose a larger set.";

export type NowpaymentsMinAmountBody = {
  min_amount?: number | string;
  fiat_equivalent?: number | string;
  currency_from?: string;
  currency_to?: string;
  message?: string;
};

/** Parse NOWPayments min-amount JSON; returns null if fiat is missing/invalid. */
export function parseBtcMinFiatUsd(body: NowpaymentsMinAmountBody): {
  fiatUsd: number;
  minAmount: number;
} | null {
  const fiat = Number(body.fiat_equivalent);
  const minAmount = Number(body.min_amount);
  if (!Number.isFinite(fiat) || fiat <= 0) return null;
  return {
    fiatUsd: fiat,
    minAmount: Number.isFinite(minAmount) && minAmount > 0 ? minAmount : 0,
  };
}

/**
 * Litecoin NOWPayments gating (pure helpers — no I/O).
 *
 * Fiat min only: USD invoice ≥ live NOWPayments LTC→LTC minimum fiat
 * (GET /v1/min-amount?currency_from=ltc&currency_to=ltc&fiat_equivalent=usd), plus buffer.
 * No shot-count gate — LTC is offered on every unlock type (single shot, any count, bundles)
 * when the live min is met. Do not add LTC_MIN_SHOTS.
 */

/** 5% headroom over live fiat_equivalent (same buffer policy as BTC). */
export const LTC_MIN_BUFFER = 1.05;

/**
 * Gated USD floor in cents: live fiat USD × buffer, rounded up to the next cent.
 */
export function gatedLtcMinUsdCents(fiatUsd: number, buffer: number = LTC_MIN_BUFFER): number {
  if (!Number.isFinite(fiatUsd) || fiatUsd <= 0) return 0;
  const b = Number.isFinite(buffer) && buffer >= 1 ? buffer : LTC_MIN_BUFFER;
  return Math.ceil(fiatUsd * b * 100);
}

/** Whole-dollar tip floor (round up), e.g. 2107¢ → $22 for “about $22”. */
export function ltcMinTipDollars(minUsdCents: number): number {
  if (!Number.isFinite(minUsdCents) || minUsdCents <= 0) return 0;
  return Math.ceil(minUsdCents / 100);
}

export function isLtcBelowMin(amountCents: number, minUsdCents: number): boolean {
  if (!Number.isFinite(minUsdCents) || minUsdCents <= 0) return false;
  return amountCents < minUsdCents;
}

/** Buyer tip when LTC is hidden for the fiat floor (no backend jargon). */
export function ltcMinBuyerTip(minUsdCents: number): string {
  const dollars = ltcMinTipDollars(minUsdCents);
  return `Litecoin available from about $${dollars}`;
}

/** Same clear buyer message when createInvoice rejects LTC below the gated min. */
export function ltcBelowMinCreateError(minUsdCents: number): string {
  const dollars = ltcMinTipDollars(minUsdCents);
  return `Litecoin is available from about $${dollars} — pick Solana, USDT, Ethereum, or Bitcoin for this unlock, or choose a larger set.`;
}

/** Why LTC is hidden in the asset picker (amount only — never shot-count). */
export type LtcHideReason = "amount" | null;

export function ltcHideReason(
  amountCents: number,
  minUsdCents: number | null | undefined,
): LtcHideReason {
  if (
    minUsdCents != null &&
    minUsdCents > 0 &&
    isLtcBelowMin(amountCents, minUsdCents)
  ) {
    return "amount";
  }
  return null;
}

/** Picker tip for the active hide reason (null when LTC should show). */
export function ltcBuyerTipForHide(
  reason: LtcHideReason,
  minUsdCents: number | null | undefined,
): string | null {
  if (reason === "amount" && minUsdCents != null && minUsdCents > 0) {
    return ltcMinBuyerTip(minUsdCents);
  }
  return null;
}

/** Fallback when live min is unknown but NOWPayments said “less than minimal”. */
export const LTC_BELOW_MIN_FALLBACK =
  "Litecoin is below the minimum for this unlock — pick Solana, USDT, Ethereum, or Bitcoin, or choose a larger set.";

export type NowpaymentsLtcMinAmountBody = {
  min_amount?: number | string;
  fiat_equivalent?: number | string;
  currency_from?: string;
  currency_to?: string;
  message?: string;
};

/** Parse NOWPayments min-amount JSON; returns null if fiat is missing/invalid. */
export function parseLtcMinFiatUsd(body: NowpaymentsLtcMinAmountBody): {
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

/**
 * Bitcoin NOWPayments minimum gating (pure helpers — no I/O).
 *
 * Live fiat min comes from GET /v1/min-amount?currency_from=btc&currency_to=btc&fiat_equivalent=usd.
 * We apply a small buffer so borderline invoices do not fail at create after the picker showed BTC.
 */

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

/** Buyer tip when BTC is hidden from the asset picker (no backend jargon). */
export function btcMinBuyerTip(minUsdCents: number): string {
  const dollars = btcMinTipDollars(minUsdCents);
  return `Bitcoin available from about $${dollars}`;
}

/** Same clear buyer message when createInvoice rejects BTC below the gated min. */
export function btcBelowMinCreateError(minUsdCents: number): string {
  const dollars = btcMinTipDollars(minUsdCents);
  return `Bitcoin is available from about $${dollars} — pick Solana, USDT, or Ethereum for this unlock, or choose a larger set.`;
}

/** Fallback when live min is unknown but NOWPayments said “less than minimal”. */
export const BTC_BELOW_MIN_FALLBACK =
  "Bitcoin is below the minimum for this unlock — pick Solana, USDT, or Ethereum, or choose a larger set.";

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

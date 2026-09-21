import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BTC_MIN_SHOTS,
  isBtcBelowShotMin,
} from "./btc-min.ts";
import {
  LTC_BELOW_MIN_FALLBACK,
  LTC_MIN_BUFFER,
  gatedLtcMinUsdCents,
  isLtcBelowMin,
  ltcBelowMinCreateError,
  ltcBuyerTipForHide,
  ltcHideReason,
  ltcMinBuyerTip,
  ltcMinTipDollars,
  parseLtcMinFiatUsd,
} from "./ltc-min.ts";

describe("ltc min gating (fiat only — no shot gate)", () => {
  it("applies 5% buffer and rounds up to cents", () => {
    assert.equal(LTC_MIN_BUFFER, 1.05);
    // Live ~$21 → 21 * 1.05 = 22.05 → 2205¢
    assert.equal(gatedLtcMinUsdCents(21), 2205);
    assert.equal(gatedLtcMinUsdCents(20), 2100);
    assert.equal(gatedLtcMinUsdCents(21.07), Math.ceil(21.07 * 1.05 * 100));
  });

  it("rejects invalid fiat", () => {
    assert.equal(gatedLtcMinUsdCents(0), 0);
    assert.equal(gatedLtcMinUsdCents(-1), 0);
    assert.equal(gatedLtcMinUsdCents(Number.NaN), 0);
  });

  it("rounds tip dollars up for buyer copy", () => {
    assert.equal(ltcMinTipDollars(2100), 21);
    assert.equal(ltcMinTipDollars(2101), 22);
    assert.equal(ltcMinTipDollars(1), 1);
  });

  it("gates amount_cents against min", () => {
    assert.equal(isLtcBelowMin(499, 2205), true);
    assert.equal(isLtcBelowMin(2205, 2205), false);
    assert.equal(isLtcBelowMin(5000, 2205), false);
    // Unknown min → do not hide
    assert.equal(isLtcBelowMin(100, 0), false);
  });

  it("buyer tip and create error share the about-$XX phrasing", () => {
    assert.equal(ltcMinBuyerTip(2205), "Litecoin available from about $23");
    assert.match(ltcBelowMinCreateError(2205), /about \$23/);
    assert.match(ltcBelowMinCreateError(2205), /Solana|USDT|Ethereum|Bitcoin/);
    assert.ok(LTC_BELOW_MIN_FALLBACK.includes("Litecoin"));
  });

  it("parses NOWPayments min-amount body (mocked)", () => {
    const parsed = parseLtcMinFiatUsd({
      currency_from: "ltc",
      currency_to: "ltc",
      min_amount: 0.05,
      fiat_equivalent: 4.2,
    });
    assert.ok(parsed);
    assert.equal(parsed!.fiatUsd, 4.2);
    assert.equal(parsed!.minAmount, 0.05);
    assert.equal(parseLtcMinFiatUsd({ min_amount: 0.001 }), null);
    assert.equal(parseLtcMinFiatUsd({ fiat_equivalent: "bad" }), null);
  });

  it("hide reason is amount-only (never shot-count)", () => {
    // Single-shot under min → amount
    assert.equal(ltcHideReason(499, 2205), "amount");
    // Single-shot above min → show LTC
    assert.equal(ltcHideReason(5000, 2205), null);
    // Unknown min → show LTC
    assert.equal(ltcHideReason(100, null), null);
    assert.equal(ltcHideReason(100, 0), null);
  });

  it("picker tip follows hide reason", () => {
    assert.equal(ltcBuyerTipForHide("amount", 2205), "Litecoin available from about $23");
    assert.equal(ltcBuyerTipForHide(null, 2205), null);
    assert.equal(ltcBuyerTipForHide("amount", null), null);
  });

  it("BTC still requires 3+ shots while LTC has no shot gate", () => {
    assert.equal(BTC_MIN_SHOTS, 3);
    assert.equal(isBtcBelowShotMin(1), true);
    assert.equal(isBtcBelowShotMin(2), true);
    assert.equal(isBtcBelowShotMin(3), false);
    // LTC: single-shot above fiat min is eligible (no shot-count argument)
    assert.equal(ltcHideReason(5000, 2205), null);
  });
});

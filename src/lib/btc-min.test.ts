import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BTC_BELOW_MIN_FALLBACK,
  BTC_MIN_BUFFER,
  BTC_MIN_SHOTS,
  BTC_SHOT_MIN_BUYER_TIP,
  btcBelowMinCreateError,
  btcBelowShotMinCreateError,
  btcBuyerTipForHide,
  btcHideReason,
  btcMinBuyerTip,
  btcMinTipDollars,
  gatedBtcMinUsdCents,
  isBtcBelowMin,
  isBtcBelowShotMin,
  parseBtcMinFiatUsd,
} from "./btc-min.ts";

describe("btc min gating", () => {
  it("applies 5% buffer and rounds up to cents", () => {
    assert.equal(BTC_MIN_BUFFER, 1.05);
    // Live ~$21 → 21 * 1.05 = 22.05 → 2205¢
    assert.equal(gatedBtcMinUsdCents(21), 2205);
    // Exact cent boundary after buffer
    assert.equal(gatedBtcMinUsdCents(20), 2100);
    // Fractional fiat rounds up after buffer
    assert.equal(gatedBtcMinUsdCents(21.07), Math.ceil(21.07 * 1.05 * 100));
  });

  it("rejects invalid fiat", () => {
    assert.equal(gatedBtcMinUsdCents(0), 0);
    assert.equal(gatedBtcMinUsdCents(-1), 0);
    assert.equal(gatedBtcMinUsdCents(Number.NaN), 0);
  });

  it("rounds tip dollars up for buyer copy", () => {
    assert.equal(btcMinTipDollars(2100), 21);
    assert.equal(btcMinTipDollars(2101), 22);
    assert.equal(btcMinTipDollars(1), 1);
  });

  it("gates amount_cents against min", () => {
    assert.equal(isBtcBelowMin(499, 2205), true);
    assert.equal(isBtcBelowMin(2205, 2205), false);
    assert.equal(isBtcBelowMin(5000, 2205), false);
    // Unknown min → do not hide
    assert.equal(isBtcBelowMin(100, 0), false);
  });

  it("buyer tip and create error share the about-$XX phrasing", () => {
    assert.equal(btcMinBuyerTip(2205), "Bitcoin available from about $23");
    assert.match(btcBelowMinCreateError(2205), /about \$23/);
    assert.match(btcBelowMinCreateError(2205), /Solana, USDT, or Ethereum/);
    assert.ok(BTC_BELOW_MIN_FALLBACK.includes("Bitcoin"));
  });

  it("parses NOWPayments min-amount body (mocked)", () => {
    const parsed = parseBtcMinFiatUsd({
      currency_from: "btc",
      currency_to: "btc",
      min_amount: 0.0002625,
      fiat_equivalent: 21.04,
    });
    assert.ok(parsed);
    assert.equal(parsed!.fiatUsd, 21.04);
    assert.equal(parsed!.minAmount, 0.0002625);
    assert.equal(parseBtcMinFiatUsd({ min_amount: 0.001 }), null);
    assert.equal(parseBtcMinFiatUsd({ fiat_equivalent: "bad" }), null);
  });
});

describe("btc shot-count gating", () => {
  it("requires at least 3 shots", () => {
    assert.equal(BTC_MIN_SHOTS, 3);
    assert.equal(isBtcBelowShotMin(0), true);
    assert.equal(isBtcBelowShotMin(1), true);
    assert.equal(isBtcBelowShotMin(2), true);
    assert.equal(isBtcBelowShotMin(3), false);
    assert.equal(isBtcBelowShotMin(10), false);
    assert.equal(isBtcBelowShotMin(Number.NaN), true);
  });

  it("buyer tip and create error share plain 3-or-more photos wording", () => {
    assert.equal(
      BTC_SHOT_MIN_BUYER_TIP,
      "Bitcoin is available when unlocking 3 or more photos",
    );
    assert.match(btcBelowShotMinCreateError(), /3 or more photos/);
    assert.match(btcBelowShotMinCreateError(), /Solana, USDT, or Ethereum/);
    assert.ok(btcBelowShotMinCreateError().startsWith(BTC_SHOT_MIN_BUYER_TIP));
  });

  it("hide reason prefers shot-count over fiat floor", () => {
    // 1-shot under min → shots
    assert.equal(btcHideReason(1, 499, 2205), "shots");
    // 2-shot above min → still shots
    assert.equal(btcHideReason(2, 5000, 2205), "shots");
    // 3-shot under min → amount
    assert.equal(btcHideReason(3, 499, 2205), "amount");
    // 3-shot at/above min → show BTC
    assert.equal(btcHideReason(3, 2205, 2205), null);
    assert.equal(btcHideReason(5, 5000, 2205), null);
    // 3-shot with unknown min → show BTC
    assert.equal(btcHideReason(3, 100, null), null);
    assert.equal(btcHideReason(3, 100, 0), null);
  });

  it("picker tip follows hide reason", () => {
    assert.equal(btcBuyerTipForHide("shots", 2205), BTC_SHOT_MIN_BUYER_TIP);
    assert.equal(btcBuyerTipForHide("amount", 2205), "Bitcoin available from about $23");
    assert.equal(btcBuyerTipForHide(null, 2205), null);
    assert.equal(btcBuyerTipForHide("amount", null), null);
  });
});

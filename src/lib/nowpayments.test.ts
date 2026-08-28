import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { ipnCanonicalJson, ipnFulfillsInvoice, normalizePaymentId, sortObject } from "./nowpayments.ts";
import { nowPayCurrency } from "./crypto.ts";
import { dropLine, rivalLine, DEFAULT_DIALS } from "./psychology.ts";

describe("nowpayments ipn canonicalization", () => {
  it("sorts keys recursively so HMAC is stable", () => {
    const body = { b: 1, a: { d: 2, c: 3 } };
    assert.equal(ipnCanonicalJson(body), '{"a":{"c":3,"d":2},"b":1}');
    const secret = "test-secret";
    const digest = createHmac("sha512", secret).update(ipnCanonicalJson(body)).digest("hex");
    const again = createHmac("sha512", secret).update(JSON.stringify(sortObject(body))).digest("hex");
    assert.equal(digest, again);
  });
});

describe("payment_id normalization", () => {
  it("treats the provider's JSON number as the stored text id", () => {
    assert.equal(normalizePaymentId(123456789), "123456789");
    assert.equal(normalizePaymentId("123456789"), "123456789");
    assert.equal(normalizePaymentId(null), "");
  });
});

describe("ipn economic match", () => {
  const inv = {
    id: "inv_1",
    amountCents: 499,
    asset: "ETH",
    payCurrency: "eth",
    providerPaymentId: "123456789",
    payAddress: "0xabc",
  };

  const finished = {
    payment_id: 123456789 as string | number,
    payment_status: "finished",
    order_id: "inv_1",
    price_amount: 4.99,
    price_currency: "usd",
    pay_currency: "eth",
    pay_amount: 0.001,
    actually_paid: 0.001,
    pay_address: "0xabc",
  };

  it("accepts a finished matching payment with numeric payment_id", () => {
    const r = ipnFulfillsInvoice(finished, inv);
    assert.equal(r.ok, true);
  });

  it("accepts the same id as a string", () => {
    const r = ipnFulfillsInvoice({ ...finished, payment_id: "123456789" }, inv);
    assert.equal(r.ok, true);
  });

  it("fails closed when fulfillment fields are absent", () => {
    assert.equal(ipnFulfillsInvoice({ payment_status: "finished", order_id: "inv_1" }, inv).ok, false);
    assert.equal(
      ipnFulfillsInvoice({ ...finished, payment_id: undefined }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, price_currency: undefined }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, pay_currency: undefined }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, pay_amount: undefined }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, actually_paid: undefined }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, pay_address: undefined }, inv).ok,
      false,
    );
  });

  it("rejects confirming, underpay, wrong asset, wrong order", () => {
    assert.equal(
      ipnFulfillsInvoice({ payment_status: "confirmed", order_id: "inv_1", price_amount: 4.99 }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, price_amount: 1.0 }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, pay_currency: "btc" }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice({ ...finished, order_id: "inv_other" }, inv).ok,
      false,
    );
  });
});

describe("USDT network ticker", () => {
  it("sends USDTERC20, not a generic usdt ticker", () => {
    assert.equal(nowPayCurrency("USDT"), "usdterc20");
    assert.equal(nowPayCurrency("ETH"), "eth");
  });
});

describe("public social proof", () => {
  it("does not invent drop-off percentages", () => {
    const stored =
      "61% of collectors never see her sit. They wanted a dump. She doesn't dump.";
    const line = dropLine(4, DEFAULT_DIALS, stored);
    assert.equal(line.includes("%"), false);
    assert.match(line, /dump/i);
    assert.equal(dropLine(4, DEFAULT_DIALS, ""), "");
  });

  it("hides rival lines without a real today count", () => {
    assert.equal(rivalLine(DEFAULT_DIALS, 3, 0), "");
    assert.equal(rivalLine(DEFAULT_DIALS, 3, 2), "");
    assert.match(rivalLine(DEFAULT_DIALS, 3, 4), /4/);
  });
});

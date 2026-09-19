import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentUri, walletDeepLink } from "./wallet.ts";

describe("walletDeepLink phantom", () => {
  const addr = "So11111111111111111111111111111111111111112";
  const amount = "0.05";

  it("with https checkoutUrl returns phantom.app/ul/browse + encoded https + ref", () => {
    const checkoutUrl = "https://example.com/checkout/inv_123?x=1";
    const link = walletDeepLink("phantom", "SOL", addr, amount, { checkoutUrl });
    assert.match(link, /^https:\/\/phantom\.app\/ul\/browse\//);
    assert.equal(link.includes(encodeURIComponent(checkoutUrl)), true);
    assert.equal(link.includes(`ref=${encodeURIComponent("https://example.com")}`), true);
    // Never wrap solana: inside browse (blank screen).
    assert.doesNotMatch(link, /solana%3A/i);
    assert.doesNotMatch(link, /browse\/solana:/);
  });

  it("without checkoutUrl returns raw solana: pay URI", () => {
    const link = walletDeepLink("phantom", "SOL", addr, amount);
    assert.equal(link.startsWith("solana:"), true);
    assert.match(link, new RegExp(addr));
    assert.match(link, /amount=0\.05/);
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
  });

  it("falls back to solana: when checkoutUrl is not https", () => {
    const link = walletDeepLink("phantom", "SOL", addr, "0.1", {
      checkoutUrl: "http://localhost:3000/pay",
    });
    assert.equal(link.startsWith("solana:"), true);
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
  });

  it("falls back to solana: when checkoutUrl is invalid", () => {
    const link = walletDeepLink("phantom", "SOL", addr, "0.1", {
      checkoutUrl: "not-a-url",
    });
    assert.equal(link.startsWith("solana:"), true);
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
  });

  it("falls back safely when address is missing", () => {
    const link = walletDeepLink("phantom", "SOL", "", "0.1");
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
  });
});

describe("walletDeepLink solflare", () => {
  const addr = "So11111111111111111111111111111111111111112";
  const amount = "0.05";

  it("with https checkoutUrl returns solflare.com/ul/v1/browse + encoded https + ref", () => {
    const checkoutUrl = "https://example.com/checkout/inv_123?x=1";
    const link = walletDeepLink("solflare", "SOL", addr, amount, { checkoutUrl });
    assert.match(link, /^https:\/\/solflare\.com\/ul\/v1\/browse\//);
    assert.equal(link.includes(encodeURIComponent(checkoutUrl)), true);
    assert.equal(link.includes(`ref=${encodeURIComponent("https://example.com")}`), true);
    // Never wrap solana: inside browse (blank screen).
    assert.doesNotMatch(link, /solana%3A/i);
    assert.doesNotMatch(link, /browse\/solana:/);
  });

  it("without checkoutUrl returns raw solana: pay URI", () => {
    const link = walletDeepLink("solflare", "SOL", addr, amount);
    assert.equal(link.startsWith("solana:"), true);
    assert.match(link, new RegExp(addr));
    assert.match(link, /amount=0\.05/);
    assert.doesNotMatch(link, /solflare\.com\/ul\/v1\/browse/);
  });

  it("falls back to solana: when checkoutUrl is not https", () => {
    const link = walletDeepLink("solflare", "SOL", addr, "0.1", {
      checkoutUrl: "http://localhost:3000/pay",
    });
    assert.equal(link.startsWith("solana:"), true);
    assert.doesNotMatch(link, /solflare\.com\/ul\/v1\/browse/);
  });

  it("falls back to solana: when checkoutUrl is invalid", () => {
    const link = walletDeepLink("solflare", "SOL", addr, "0.1", {
      checkoutUrl: "not-a-url",
    });
    assert.equal(link.startsWith("solana:"), true);
    assert.doesNotMatch(link, /solflare\.com\/ul\/v1\/browse/);
  });

  it("falls back safely when address is missing", () => {
    const link = walletDeepLink("solflare", "SOL", "", "0.1");
    assert.doesNotMatch(link, /solflare\.com\/ul\/v1\/browse/);
  });
});

describe("paymentUri SOL", () => {
  it("builds native Solana Pay URI with decimal amount", () => {
    const uri = paymentUri("SOL", "So11111111111111111111111111111111111111112", "1.25");
    assert.equal(uri.startsWith("solana:"), true);
    assert.match(uri, /amount=1\.25/);
    assert.doesNotMatch(uri, /spl-token/);
  });
});

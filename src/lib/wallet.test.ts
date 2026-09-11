import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentUri, walletDeepLink } from "./wallet.ts";

describe("walletDeepLink phantom", () => {
  it("returns Solana Pay URI, not phantom.app/ul/browse", () => {
    const addr = "So11111111111111111111111111111111111111112";
    const amount = "0.05";
    const link = walletDeepLink("phantom", "SOL", addr, amount);
    assert.equal(link.startsWith("solana:"), true);
    assert.match(link, new RegExp(addr));
    assert.match(link, /amount=0\.05/);
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
  });

  it("falls back safely when address is missing", () => {
    const link = walletDeepLink("phantom", "SOL", "", "0.1");
    assert.doesNotMatch(link, /phantom\.app\/ul\/browse/);
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
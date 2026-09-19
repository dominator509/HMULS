import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paymentUri, walletDeepLink } from "./wallet.ts";

const checkoutUrl = "https://example.com/checkout/inv_123?x=1";
const addr = "So11111111111111111111111111111111111111112";
const amount = "0.05";

function assertBrowseLink(link: string, hostPath: string) {
  assert.equal(
    link,
    `https://${hostPath}/${encodeURIComponent(checkoutUrl)}?ref=${encodeURIComponent("https://example.com")}`,
  );
  assert.doesNotMatch(link, /solana:/i);
  assert.doesNotMatch(link, /browse\/solana:/i);
}

describe("walletDeepLink phantom", () => {
  it("returns a Phantom browse link for an HTTPS checkout", () => {
    const link = walletDeepLink("phantom", "SOL", addr, amount, { checkoutUrl });
    assertBrowseLink(link, "phantom.app/ul/browse");
  });

  it("requires an HTTPS checkout URL instead of returning solana:", () => {
    assert.throws(
      () => walletDeepLink("phantom", "SOL", addr, amount),
      /require an HTTPS checkout URL/,
    );
    assert.throws(
      () => walletDeepLink("phantom", "SOL", addr, amount, { checkoutUrl: "http://localhost:3000/pay" }),
      /require an HTTPS checkout URL/,
    );
  });
});

describe("walletDeepLink solflare", () => {
  it("returns a Solflare browse link for an HTTPS checkout", () => {
    const link = walletDeepLink("solflare", "SOL", addr, amount, { checkoutUrl });
    assertBrowseLink(link, "solflare.com/ul/v1/browse");
  });

  it("requires an HTTPS checkout URL instead of returning solana:", () => {
    assert.throws(
      () => walletDeepLink("solflare", "SOL", addr, amount),
      /require an HTTPS checkout URL/,
    );
    assert.throws(
      () => walletDeepLink("solflare", "SOL", addr, amount, { checkoutUrl: "http://localhost:3000/pay" }),
      /require an HTTPS checkout URL/,
    );
  });
});

describe("paymentUri SOL", () => {
  it("builds native Solana Pay URI with decimal amount for copy escape hatch", () => {
    const uri = paymentUri("SOL", addr, "1.25");
    assert.equal(uri.startsWith("solana:"), true);
    assert.match(uri, /amount=1\.25/);
    assert.doesNotMatch(uri, /spl-token/);
  });
});

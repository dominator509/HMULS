import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  androidSolanaPayIntent,
  launchSolWallet,
  paymentUri,
  PHANTOM_ANDROID_PACKAGE,
  SOLFLARE_ANDROID_PACKAGE,
  walletDeepLink,
} from "./wallet.ts";

const addr = "So11111111111111111111111111111111111111112";
const amount = "0.05";

describe("paymentUri SOL", () => {
  it("builds native Solana Pay URI with decimal amount for copy escape hatch", () => {
    const uri = paymentUri("SOL", addr, "1.25");
    assert.equal(uri.startsWith("solana:"), true);
    assert.match(uri, /amount=1\.25/);
    assert.doesNotMatch(uri, /spl-token/);
  });
});

describe("androidSolanaPayIntent", () => {
  it("package-pins solana: so Base/other wallets cannot hijack", () => {
    const uri = paymentUri("SOL", addr, amount);
    const intent = androidSolanaPayIntent(uri, PHANTOM_ANDROID_PACKAGE);
    assert.equal(intent.startsWith("intent://"), true);
    assert.match(intent, /scheme=solana/);
    assert.match(intent, new RegExp(`package=${PHANTOM_ANDROID_PACKAGE}`));
    assert.doesNotMatch(intent, /ul\/browse/i);
    assert.doesNotMatch(intent, /sheundresses\.com/i);
  });
});

describe("launchSolWallet", () => {
  it("Android Phantom → package-scoped intent (no site browse)", () => {
    const launch = launchSolWallet("phantom", addr, amount, {
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.match(launch.href, /package=app\.phantom/);
    assert.doesNotMatch(launch.href, /ul\/browse/i);
  });

  it("Android Solflare → package-scoped intent", () => {
    const launch = launchSolWallet("solflare", addr, amount, {
      userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.match(launch.href, new RegExp(`package=${SOLFLARE_ANDROID_PACKAGE}`));
  });

  it("iOS / desktop → copy Solana Pay URI (no browse, no bare window.open solana:)", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
    ]) {
      const launch = launchSolWallet("phantom", addr, amount, { userAgent: ua });
      assert.equal(launch.kind, "copy");
      if (launch.kind !== "copy") return;
      assert.equal(launch.uri.startsWith("solana:"), true);
      assert.match(launch.message, /wallet browser/i);
    }
  });
});

describe("walletDeepLink phantom/solflare", () => {
  it("does not emit Phantom/Solflare browse links", () => {
    const phantom = walletDeepLink("phantom", "SOL", addr, amount, {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    const solflare = walletDeepLink("solflare", "SOL", addr, amount, {
      userAgent: "Mozilla/5.0 (Linux; Android 14)",
    });
    assert.doesNotMatch(phantom, /ul\/browse/i);
    assert.doesNotMatch(solflare, /ul\/browse/i);
    assert.equal(phantom.startsWith("solana:"), true);
    assert.match(solflare, /package=com\.solflare\.mobile/);
  });
});

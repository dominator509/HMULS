import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  androidSolanaPayIntent,
  formatSolAmount,
  launchSolWallet,
  paymentUri,
  PHANTOM_ANDROID_PACKAGE,
  SOLFLARE_ANDROID_PACKAGE,
  walletDeepLink,
} from "./wallet.ts";

const addr = "So11111111111111111111111111111111111111112";
const amount = "0.05";

describe("formatSolAmount", () => {
  it("truncates float dust to 9 decimals (root cause of invalid pay links)", () => {
    assert.equal(formatSolAmount("0.011459100000000001"), "0.0114591");
    assert.equal(formatSolAmount("1.23e-7"), "0.000000123");
    assert.equal(formatSolAmount("0.05"), "0.05");
  });
});

describe("paymentUri SOL", () => {
  it("builds native Solana Pay URI with decimal amount", () => {
    const uri = paymentUri("SOL", addr, "1.25");
    assert.equal(uri.startsWith("solana:"), true);
    assert.match(uri, /amount=1\.25/);
    assert.doesNotMatch(uri, /spl-token/);
  });

  it("normalizes >9 decimal amounts so wallets accept the URI", () => {
    const uri = paymentUri("SOL", addr, "0.011459100000000001");
    assert.match(uri, /amount=0\.0114591(?:&|$)/);
    assert.doesNotMatch(uri, /0000000001/);
  });

  it("returns empty string for missing address or amount", () => {
    assert.equal(paymentUri("SOL", "", amount), "");
    assert.equal(paymentUri("SOL", addr, ""), "");
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

  it("iOS → open Solana Pay URI (native confirm, not copy-first)", () => {
    const launch = launchSolWallet("phantom", addr, amount, {
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.equal(launch.href.startsWith("solana:"), true);
    assert.match(launch.message, /Confirm/i);
  });

  it("desktop → copy fallback for extension-less browsers", () => {
    const launch = launchSolWallet("phantom", addr, amount, {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
    });
    assert.equal(launch.kind, "copy");
    if (launch.kind !== "copy") return;
    assert.equal(launch.uri.startsWith("solana:"), true);
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

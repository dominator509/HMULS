import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  androidSolanaPayIntent,
  formatSolAmount,
  launchSolWallet,
  paymentUri,
  PHANTOM_ANDROID_PACKAGE,
  SOLFLARE_ANDROID_PACKAGE,
  walletDeepLink,
} from "./wallet.ts";
import {
  buildSolConnectHref,
  buildSolRedirectLink,
  buildSolSignAndSendHref,
  cleanSolUlUrl,
  clearSolCheckoutAck,
  clearSolMobileSession,
  isBrandedSolWalletHref,
  isSolUlReturnPending,
  parseSolUlReturn,
  peekSolCheckoutAck,
  persistSolCheckoutAck,
  shouldRestoreSolCheckoutAck,
  startSolMobileConnect,
} from "./sol-mobile-deeplink.ts";

const addr = "So11111111111111111111111111111111111111112";
const amount = "0.05";
const checkout = "https://sheundresses.com/checkout/inv_test123";
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const androidUA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36";

/** Minimal sessionStorage for Node tests. */
function installMemorySessionStorage() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as unknown as { sessionStorage: typeof store }).sessionStorage = store;
  return store;
}

beforeEach(() => {
  installMemorySessionStorage();
});

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

describe("branded sol UL helpers", () => {
  it("connect hrefs are wallet-owned HTTPS hosts", () => {
    const phantom = buildSolConnectHref({
      wallet: "phantom",
      appUrl: "https://sheundresses.com/",
      redirectLink: checkout,
      dappEncryptionPublicKey: "11111111111111111111111111111111",
    });
    const solflare = buildSolConnectHref({
      wallet: "solflare",
      appUrl: "https://sheundresses.com/",
      redirectLink: checkout,
      dappEncryptionPublicKey: "11111111111111111111111111111111",
    });
    assert.equal(phantom.startsWith("https://phantom.app/ul/v1/connect"), true);
    assert.equal(solflare.startsWith("https://solflare.com/ul/v1/connect"), true);
    assert.equal(isBrandedSolWalletHref(phantom, "phantom"), true);
    assert.equal(isBrandedSolWalletHref(solflare, "solflare"), true);
    assert.equal(isBrandedSolWalletHref("solana:" + addr, "phantom"), false);
  });

  it("signAndSendTransaction hrefs stay on wallet hosts", () => {
    const href = buildSolSignAndSendHref({
      wallet: "phantom",
      dappEncryptionPublicKey: "11111111111111111111111111111111",
      nonce: "22222222222222222222222222222222",
      redirectLink: checkout,
      encryptedPayload: "33333333333333333333333333333333",
    });
    assert.equal(href.startsWith("https://phantom.app/ul/v1/signAndSendTransaction"), true);
    assert.doesNotMatch(href, /^solana:/);
  });
});

describe("launchSolWallet", () => {
  it("Android Phantom → package-scoped intent (no site browse)", () => {
    const launch = launchSolWallet("phantom", addr, amount, {
      userAgent: androidUA,
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.match(launch.href, /package=app\.phantom/);
    assert.doesNotMatch(launch.href, /ul\/browse/i);
  });

  it("Android Solflare → package-scoped intent", () => {
    const launch = launchSolWallet("solflare", addr, amount, {
      userAgent: androidUA,
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.match(launch.href, new RegExp(`package=${SOLFLARE_ANDROID_PACKAGE}`));
  });

  it("iOS Phantom → https://phantom.app/ connect UL (never bare solana:)", () => {
    const launch = launchSolWallet("phantom", addr, amount, {
      userAgent: iosUA,
      checkoutUrl: checkout,
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.equal(launch.href.startsWith("https://phantom.app/"), true);
    assert.match(launch.href, /\/ul\/v1\/connect/);
    assert.equal(launch.href.startsWith("solana:"), false);
    assert.doesNotMatch(launch.href, /ul\/browse/i);
    assert.match(launch.message, /Phantom|SOL/i);
  });

  it("iOS Solflare → https://solflare.com/ connect UL (never bare solana:)", () => {
    const launch = launchSolWallet("solflare", addr, amount, {
      userAgent: iosUA,
      checkoutUrl: checkout,
    });
    assert.equal(launch.kind, "open");
    if (launch.kind !== "open") return;
    assert.equal(launch.href.startsWith("https://solflare.com/"), true);
    assert.match(launch.href, /\/ul\/v1\/connect/);
    assert.equal(launch.href.startsWith("solana:"), false);
    assert.doesNotMatch(launch.href, /ul\/browse/i);
  });

  it("startSolMobileConnect persists session keys and redirect markers", () => {
    const started = startSolMobileConnect({
      wallet: "phantom",
      to: addr,
      amountSol: amount,
      checkoutUrl: checkout,
    });
    assert.equal(started.href.startsWith("https://phantom.app/ul/v1/connect"), true);
    assert.match(started.href, /dapp_encryption_public_key=/);
    assert.match(started.href, /redirect_link=/);
    const redirect = decodeURIComponent(
      new URL(started.href).searchParams.get("redirect_link") || "",
    );
    assert.match(redirect, /hmuls_sol=1/);
    assert.match(redirect, /hmuls_wallet=phantom/);
    assert.match(redirect, /hmuls_step=connect/);
    assert.equal(globalThis.sessionStorage.getItem("sheundresses.sol.deeplink.v1") != null, true);
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
  it("iOS deeplink is branded Phantom host, not solana: or browse", () => {
    const phantom = walletDeepLink("phantom", "SOL", addr, amount, {
      userAgent: iosUA,
      checkoutUrl: checkout,
    });
    assert.equal(phantom.startsWith("https://phantom.app/"), true);
    assert.equal(phantom.startsWith("solana:"), false);
    assert.doesNotMatch(phantom, /ul\/browse/i);
  });

  it("Android deeplink stays package-scoped intent", () => {
    const solflare = walletDeepLink("solflare", "SOL", addr, amount, {
      userAgent: androidUA,
    });
    assert.doesNotMatch(solflare, /ul\/browse/i);
    assert.match(solflare, /package=com\.solflare\.mobile/);
  });
});

describe("sol UL return resume helpers", () => {
  it("parseSolUlReturn detects connect return with Phantom encryption params", () => {
    const url =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect" +
      "&phantom_encryption_public_key=pk&data=enc&nonce=n1";
    const parsed = parseSolUlReturn(url);
    assert.equal(parsed.active, true);
    assert.equal(parsed.wallet, "phantom");
    assert.equal(parsed.step, "connect");
    assert.equal(parsed.encryptionPublicKey, "pk");
    assert.equal(parsed.data, "enc");
    assert.equal(parsed.nonce, "n1");
    assert.equal(isSolUlReturnPending(url), true);
  });

  it("parseSolUlReturn detects Solflare sign return", () => {
    const url =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=solflare&hmuls_step=sign" +
      "&solflare_encryption_public_key=pk&data=enc&nonce=n2";
    const parsed = parseSolUlReturn(url);
    assert.equal(parsed.active, true);
    assert.equal(parsed.wallet, "solflare");
    assert.equal(parsed.step, "sign");
    assert.equal(parsed.encryptionPublicKey, "pk");
  });

  it("parseSolUlReturn inactive without markers", () => {
    const url = "https://sheundresses.com/checkout/inv_abc";
    assert.equal(parseSolUlReturn(url).active, false);
    assert.equal(isSolUlReturnPending(url), false);
  });

  it("cleanSolUlUrl strips hmuls_* and wallet response params", () => {
    const url =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect" +
      "&phantom_encryption_public_key=pk&data=enc&nonce=n1&keep=1";
    const cleaned = cleanSolUlUrl(url);
    assert.match(cleaned, /^\/checkout\/inv_abc/);
    assert.match(cleaned, /keep=1/);
    assert.doesNotMatch(cleaned, /hmuls_sol/);
    assert.doesNotMatch(cleaned, /phantom_encryption/);
    assert.doesNotMatch(cleaned, /\bdata=/);
    assert.doesNotMatch(cleaned, /nonce=/);
  });

  it("buildSolRedirectLink sets step markers and strips prior wallet params", () => {
    const dirty =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect&data=old&nonce=old";
    const link = buildSolRedirectLink(dirty, "solflare", "sign");
    const u = new URL(link);
    assert.equal(u.searchParams.get("hmuls_sol"), "1");
    assert.equal(u.searchParams.get("hmuls_wallet"), "solflare");
    assert.equal(u.searchParams.get("hmuls_step"), "sign");
    assert.equal(u.searchParams.get("data"), null);
    assert.equal(u.searchParams.get("nonce"), null);
  });

  it("persist/peek/clear checkout ack scoped to invoice id", () => {
    assert.equal(peekSolCheckoutAck("inv_a"), false);
    persistSolCheckoutAck("inv_a");
    assert.equal(peekSolCheckoutAck("inv_a"), true);
    assert.equal(peekSolCheckoutAck("inv_b"), false);
    clearSolCheckoutAck();
    assert.equal(peekSolCheckoutAck("inv_a"), false);
  });

  it("shouldRestoreSolCheckoutAck true when ack persisted or UL return pending", () => {
    const returnUrl =
      "https://sheundresses.com/checkout/inv_a?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect&data=x&nonce=y";
    assert.equal(shouldRestoreSolCheckoutAck("inv_a", returnUrl), true);
    assert.equal(
      shouldRestoreSolCheckoutAck("inv_a", "https://sheundresses.com/checkout/inv_a"),
      false,
    );
    persistSolCheckoutAck("inv_a");
    assert.equal(
      shouldRestoreSolCheckoutAck("inv_a", "https://sheundresses.com/checkout/inv_a"),
      true,
    );
  });

  it("startSolMobileConnect with invoiceId persists ack for resume", () => {
    clearSolMobileSession();
    clearSolCheckoutAck();
    startSolMobileConnect({
      wallet: "phantom",
      to: addr,
      amountSol: amount,
      checkoutUrl: checkout,
      invoiceId: "inv_test123",
    });
    assert.equal(peekSolCheckoutAck("inv_test123"), true);
  });
});

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  androidSolanaPayIntent,
  formatSolAmount,
  launchSolWallet,
  metamaskUsdtErc20SendHref,
  paymentUri,
  PHANTOM_ANDROID_PACKAGE,
  SOLFLARE_ANDROID_PACKAGE,
  trustUsdtErc20SendHref,
  USDT_ERC20_CONTRACT,
  usdtErc20PaymentUri,
  usdtToBaseUnits,
  WALLET_OPTIONS,
  walletDeepLink,
} from "./wallet.ts";
import {
  buildSolConnectHref,
  buildSolRedirectLink,
  buildSolSignAndSendHref,
  buildSolSignTransactionHref,
  cleanSolUlUrl,
  clearSolCheckoutAck,
  clearSolMobileSession,
  continueSolMobileAfterConnect,
  decodeSolResumeBlob,
  encodeSolResumeBlob,
  decodeSignedTxBytes,
  finishSolMobileAfterSign,
  getSolMobileSession,
  isBrandedSolWalletHref,
  isSolUlReturnPending,
  normalizePhantomSignedTxForBroadcast,
  parseSolUlReturn,
  peekSolCheckoutAck,
  persistSolCheckoutAck,
  shouldRestoreSolCheckoutAck,
  startSolMobileConnect,
} from "./sol-mobile-deeplink.ts";
import nacl from "tweetnacl";
import bs58 from "bs58";

const addr = "So11111111111111111111111111111111111111112";
const amount = "0.05";
const checkout = "https://sheundresses.com/checkout/inv_test123";
const iosUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const androidUA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36";

/** Minimal Web Storage for Node tests. */
function installMemoryStorage(name: "localStorage" | "sessionStorage") {
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
  (globalThis as unknown as Record<string, typeof store>)[name] = store;
  return store;
}

beforeEach(() => {
  installMemoryStorage("localStorage");
  installMemoryStorage("sessionStorage");
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

  it("Phantom signTransaction href stays on phantom.app (not deprecated signAndSend)", () => {
    const href = buildSolSignTransactionHref({
      wallet: "phantom",
      dappEncryptionPublicKey: "11111111111111111111111111111111",
      nonce: "22222222222222222222222222222222",
      redirectLink: checkout,
      encryptedPayload: "33333333333333333333333333333333",
    });
    assert.equal(href.startsWith("https://phantom.app/ul/v1/signTransaction"), true);
    assert.doesNotMatch(href, /signAndSendTransaction/);
    assert.doesNotMatch(href, /^solana:/);
  });

  it("Solflare signAndSendTransaction href stays on solflare.com", () => {
    const href = buildSolSignAndSendHref({
      wallet: "solflare",
      dappEncryptionPublicKey: "11111111111111111111111111111111",
      nonce: "22222222222222222222222222222222",
      redirectLink: checkout,
      encryptedPayload: "33333333333333333333333333333333",
    });
    assert.equal(href.startsWith("https://solflare.com/ul/v1/signAndSendTransaction"), true);
    assert.doesNotMatch(href, /^solana:/);
  });

  it("connect UL always includes cluster=mainnet-beta", () => {
    for (const wallet of ["phantom", "solflare"] as const) {
      const href = buildSolConnectHref({
        wallet,
        appUrl: "https://sheundresses.com/",
        redirectLink: checkout,
        dappEncryptionPublicKey: "11111111111111111111111111111111",
      });
      assert.match(href, /[?&]cluster=mainnet-beta/);
    }
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

  it("startSolMobileConnect persists session keys in localStorage and redirect markers+blob", () => {
    const started = startSolMobileConnect({
      wallet: "phantom",
      to: addr,
      amountSol: amount,
      checkoutUrl: checkout,
      invoiceId: "inv_test123",
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
    assert.match(redirect, /hmuls_blob=/);
    assert.equal(globalThis.localStorage.getItem("sheundresses.sol.deeplink.v1") != null, true);
    const blobParam = new URL(redirect).searchParams.get("hmuls_blob");
    const blob = decodeSolResumeBlob(blobParam);
    assert.ok(blob);
    assert.equal(blob!.wallet, "phantom");
    assert.equal(blob!.to, addr);
    assert.equal(blob!.amountSol, amount);
    assert.equal(blob!.invoiceId, "inv_test123");
    assert.ok(blob!.dappPublicKey);
    assert.ok(blob!.dappSecretKey);
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

  it("cleanSolUlUrl strips hmuls_* including blob and wallet response params", () => {
    const url =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect" +
      "&hmuls_blob=abc&phantom_encryption_public_key=pk&data=enc&nonce=n1&keep=1";
    const cleaned = cleanSolUlUrl(url);
    assert.match(cleaned, /^\/checkout\/inv_abc/);
    assert.match(cleaned, /keep=1/);
    assert.doesNotMatch(cleaned, /hmuls_sol/);
    assert.doesNotMatch(cleaned, /hmuls_blob/);
    assert.doesNotMatch(cleaned, /phantom_encryption/);
    assert.doesNotMatch(cleaned, /\bdata=/);
    assert.doesNotMatch(cleaned, /nonce=/);
  });

  it("buildSolRedirectLink sets step markers, optional blob, strips prior wallet params", () => {
    const dirty =
      "https://sheundresses.com/checkout/inv_abc?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect&data=old&nonce=old&hmuls_blob=old";
    const link = buildSolRedirectLink(dirty, "solflare", "sign", {
      dappPublicKey: "pk",
      dappSecretKey: "sk",
      to: addr,
      amountSol: amount,
      wallet: "solflare",
    });
    const u = new URL(link);
    assert.equal(u.searchParams.get("hmuls_sol"), "1");
    assert.equal(u.searchParams.get("hmuls_wallet"), "solflare");
    assert.equal(u.searchParams.get("hmuls_step"), "sign");
    assert.equal(u.searchParams.get("data"), null);
    assert.equal(u.searchParams.get("nonce"), null);
    const blob = decodeSolResumeBlob(u.searchParams.get("hmuls_blob"));
    assert.ok(blob);
    assert.equal(blob!.wallet, "solflare");
    assert.equal(blob!.dappSecretKey, "sk");
  });

  it("persist/peek/clear checkout ack scoped to invoice id (localStorage)", () => {
    assert.equal(peekSolCheckoutAck("inv_a"), false);
    persistSolCheckoutAck("inv_a");
    assert.equal(peekSolCheckoutAck("inv_a"), true);
    assert.equal(peekSolCheckoutAck("inv_b"), false);
    assert.equal(globalThis.localStorage.getItem("sheundresses.sol.checkout.ack.v1") != null, true);
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

  it("resume from localStorage when sessionStorage is empty (Phantom new-tab)", async () => {
    const started = startSolMobileConnect({
      wallet: "phantom",
      to: addr,
      amountSol: amount,
      checkoutUrl: checkout,
      invoiceId: "inv_test123",
    });
    // Simulate Phantom HTTPS return opening a new tab: wipe sessionStorage only.
    globalThis.sessionStorage.clear();
    assert.equal(globalThis.sessionStorage.getItem("sheundresses.sol.deeplink.v1"), null);
    assert.ok(globalThis.localStorage.getItem("sheundresses.sol.deeplink.v1"));

    const stored = getSolMobileSession();
    assert.ok(stored);
    assert.equal(stored!.wallet, "phantom");

    // Encrypt a fake connect response with the stored dapp secret + a wallet keypair.
    const walletKp = nacl.box.keyPair();
    const shared = nacl.box.before(
      bs58.decode(stored!.dappPublicKey),
      walletKp.secretKey,
    );
    // sharedSecretFromConnect uses nacl.box.before(walletEncPub, dappSecret)
    const sharedFromDapp = nacl.box.before(walletKp.publicKey, bs58.decode(stored!.dappSecretKey));
    assert.deepEqual([...shared], [...sharedFromDapp]);

    const nonce = nacl.randomBytes(24);
    const payloadObj = { public_key: addr, session: "sess_abc" };
    const encrypted = nacl.box.after(
      Buffer.from(JSON.stringify(payloadObj), "utf8"),
      nonce,
      sharedFromDapp,
    );
    const returnUrl =
      "https://sheundresses.com/checkout/inv_test123?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect" +
      `&phantom_encryption_public_key=${bs58.encode(walletKp.publicKey)}` +
      `&data=${bs58.encode(encrypted)}&nonce=${bs58.encode(nonce)}`;

    // Avoid live RPC: stub will fail at buildSign — we only assert session load path succeeds past null.
    // Instead verify load + decrypt by calling continue and accepting network error OR success.
    const result = await continueSolMobileAfterConnect(returnUrl);
    // Either ok (if RPC works) or a build-transfer error — never "No pending wallet session" / lost session.
    if (!result.ok) {
      assert.doesNotMatch(result.error, /No pending wallet session|storage and return link empty/i);
    } else {
      assert.equal(result.href.startsWith("https://phantom.app/"), true);
      assert.match(result.href, /\/ul\/v1\/signTransaction/);
      assert.doesNotMatch(result.href, /signAndSendTransaction/);
      assert.doesNotMatch(result.href, /^solana:/);
    }
    // Session was written before navigation; still never solana: on iOS path.
    assert.equal(started.href.startsWith("solana:"), false);
  });

  it("resume from hmuls_blob when both storages are empty", async () => {
    const started = startSolMobileConnect({
      wallet: "phantom",
      to: addr,
      amountSol: amount,
      checkoutUrl: checkout,
      invoiceId: "inv_blob",
    });
    const redirect = decodeURIComponent(
      new URL(started.href).searchParams.get("redirect_link") || "",
    );
    const blobParam = new URL(redirect).searchParams.get("hmuls_blob");
    assert.ok(blobParam);

    // Wipe all storage — only blob on URL remains (storage blocked / new context).
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    assert.equal(getSolMobileSession(), null);

    const blob = decodeSolResumeBlob(blobParam)!;
    const walletKp = nacl.box.keyPair();
    const sharedFromDapp = nacl.box.before(
      walletKp.publicKey,
      bs58.decode(blob.dappSecretKey),
    );
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      Buffer.from(JSON.stringify({ public_key: addr, session: "sess_blob" }), "utf8"),
      nonce,
      sharedFromDapp,
    );
    const returnUrl =
      `https://sheundresses.com/checkout/inv_blob?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect` +
      `&hmuls_blob=${encodeURIComponent(blobParam!)}` +
      `&phantom_encryption_public_key=${bs58.encode(walletKp.publicKey)}` +
      `&data=${bs58.encode(encrypted)}&nonce=${bs58.encode(nonce)}`;

    assert.ok(getSolMobileSession(returnUrl));
    const result = await continueSolMobileAfterConnect(returnUrl);
    if (!result.ok) {
      assert.doesNotMatch(result.error, /No pending wallet session|storage and return link empty/i);
    } else {
      assert.equal(result.href.startsWith("https://phantom.app/"), true);
      assert.match(result.href, /\/ul\/v1\/signTransaction/);
      assert.doesNotMatch(result.href, /signAndSendTransaction/);
      assert.doesNotMatch(result.href, /^solana:/);
    }
  });

  it("better error when storage and blob both missing", async () => {
    globalThis.localStorage.clear();
    globalThis.sessionStorage.clear();
    const returnUrl =
      "https://sheundresses.com/checkout/inv_x?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=connect" +
      "&phantom_encryption_public_key=pk&data=enc&nonce=n1";
    const result = await continueSolMobileAfterConnect(returnUrl);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /storage and return link empty/i);
  });

  it("finishSolMobileAfterSign (Solflare) takes signature and clears session", async () => {
    const dapp = nacl.box.keyPair();
    const wallet = nacl.box.keyPair();
    const shared = nacl.box.before(wallet.publicKey, dapp.secretKey);
    const session = {
      wallet: "solflare" as const,
      to: addr,
      amountSol: amount,
      dappPublicKey: bs58.encode(dapp.publicKey),
      dappSecretKey: bs58.encode(dapp.secretKey),
      sharedSecret: bs58.encode(shared),
      session: "sess",
      walletPublicKey: addr,
      stage: "sign" as const,
      at: Date.now(),
    };
    globalThis.localStorage.setItem("sheundresses.sol.deeplink.v1", JSON.stringify(session));

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      Buffer.from(JSON.stringify({ signature: "sig123" }), "utf8"),
      nonce,
      shared,
    );
    const returnUrl =
      "https://sheundresses.com/checkout/inv?hmuls_sol=1&hmuls_wallet=solflare&hmuls_step=sign" +
      `&data=${bs58.encode(encrypted)}&nonce=${bs58.encode(nonce)}`;
    const done = await finishSolMobileAfterSign(returnUrl);
    assert.equal(done.ok, true);
    if (!done.ok) return;
    assert.equal(done.signature, "sig123");
    assert.equal(globalThis.localStorage.getItem("sheundresses.sol.deeplink.v1"), null);
  });

  it("finishSolMobileAfterSign (Phantom) broadcasts signed tx via /api/sol/send-raw", async () => {
    const dapp = nacl.box.keyPair();
    const wallet = nacl.box.keyPair();
    const shared = nacl.box.before(wallet.publicKey, dapp.secretKey);
    const session = {
      wallet: "phantom" as const,
      to: addr,
      amountSol: amount,
      dappPublicKey: bs58.encode(dapp.publicKey),
      dappSecretKey: bs58.encode(dapp.secretKey),
      sharedSecret: bs58.encode(shared),
      session: "sess",
      walletPublicKey: addr,
      stage: "sign" as const,
      at: Date.now(),
    };
    globalThis.localStorage.setItem("sheundresses.sol.deeplink.v1", JSON.stringify(session));

    const signedTxB58 = bs58.encode(Buffer.from("fake-signed-tx"));
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      Buffer.from(JSON.stringify({ transaction: signedTxB58 }), "utf8"),
      nonce,
      shared,
    );
    const returnUrl =
      "https://sheundresses.com/checkout/inv?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=sign" +
      `&data=${bs58.encode(encrypted)}&nonce=${bs58.encode(nonce)}`;

    const prevFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(input));
      assert.equal(String(input), "/api/sol/send-raw");
      const body = JSON.parse(String(init?.body ?? "{}")) as { transaction?: string };
      assert.equal(body.transaction, signedTxB58);
      return Response.json({ signature: "broadcastSig999" });
    }) as typeof fetch;
    try {
      const done = await finishSolMobileAfterSign(returnUrl);
      assert.equal(done.ok, true);
      if (!done.ok) return;
      assert.equal(done.signature, "broadcastSig999");
      assert.equal(done.wallet, "phantom");
      assert.deepEqual(calls, ["/api/sol/send-raw"]);
      assert.equal(globalThis.localStorage.getItem("sheundresses.sol.deeplink.v1"), null);
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  it("finishSolMobileAfterSign (Phantom) refuses broadcast when blockhash expired", async () => {
    const dapp = nacl.box.keyPair();
    const wallet = nacl.box.keyPair();
    const shared = nacl.box.before(wallet.publicKey, dapp.secretKey);
    const session = {
      wallet: "phantom" as const,
      to: addr,
      amountSol: amount,
      dappPublicKey: bs58.encode(dapp.publicKey),
      dappSecretKey: bs58.encode(dapp.secretKey),
      sharedSecret: bs58.encode(shared),
      session: "sess",
      walletPublicKey: addr,
      stage: "sign" as const,
      blockhash: "StaleHash",
      lastValidBlockHeight: 50,
      at: Date.now(),
    };
    globalThis.localStorage.setItem("sheundresses.sol.deeplink.v1", JSON.stringify(session));

    const signedTxB58 = bs58.encode(Buffer.from("fake-signed-tx"));
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      Buffer.from(JSON.stringify({ transaction: signedTxB58 }), "utf8"),
      nonce,
      shared,
    );
    const returnUrl =
      "https://sheundresses.com/checkout/inv?hmuls_sol=1&hmuls_wallet=phantom&hmuls_step=sign" +
      `&data=${bs58.encode(encrypted)}&nonce=${bs58.encode(nonce)}`;

    const prevFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      assert.equal(String(input), "/api/sol/recent-blockhash");
      return Response.json({ blockhash: "New", lastValidBlockHeight: 999, blockHeight: 80 });
    }) as typeof fetch;
    try {
      const done = await finishSolMobileAfterSign(returnUrl);
      assert.equal(done.ok, false);
      if (done.ok) return;
      assert.match(done.error, /took too long|Tap Pay with Phantom/i);
      assert.deepEqual(calls, ["/api/sol/recent-blockhash"]);
      assert.equal(globalThis.localStorage.getItem("sheundresses.sol.deeplink.v1"), null);
    } finally {
      globalThis.fetch = prevFetch;
    }
  });

  it("encode/decode resume blob round-trip", () => {
    const raw = encodeSolResumeBlob({
      dappPublicKey: "pk",
      dappSecretKey: "sk",
      to: addr,
      amountSol: "0.01",
      wallet: "solflare",
      invoiceId: "inv1",
    });
    assert.doesNotMatch(raw, /[+/=]/);
    const decoded = decodeSolResumeBlob(raw);
    assert.equal(decoded?.wallet, "solflare");
    assert.equal(decoded?.invoiceId, "inv1");
  });
});


describe("normalizePhantomSignedTxForBroadcast", () => {
  it("re-serializes via Transaction.from (Phantom demo pattern)", async () => {
    const { Keypair, PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");
    const from = Keypair.generate();
    const to = Keypair.generate();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to.publicKey,
        lamports: 1000,
      }),
    );
    tx.feePayer = from.publicKey;
    tx.recentBlockhash = Keypair.generate().publicKey.toBase58(); // valid-length base58 stand-in
    tx.partialSign(from);
    const original = tx.serialize();
    const b58 = bs58.encode(original);
    const out = await normalizePhantomSignedTxForBroadcast(b58);
    const again = Transaction.from(bs58.decode(out));
    assert.equal(again.signatures.length > 0, true);
    assert.ok(out.length > 0);
  });

  it("accepts base64 signed tx when base58 fails", async () => {
    const { Keypair, SystemProgram, Transaction } = await import("@solana/web3.js");
    const from = Keypair.generate();
    const to = Keypair.generate();
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: from.publicKey,
        toPubkey: to.publicKey,
        lamports: 500,
      }),
    );
    tx.feePayer = from.publicKey;
    tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
    tx.partialSign(from);
    const wire = tx.serialize();
    const b64 = Buffer.from(wire).toString("base64");
    // Ensure it is not valid-looking as our primary path alone: decodeSignedTxBytes tries b58 first.
    const bytes = decodeSignedTxBytes(b64);
    assert.deepEqual(Buffer.from(bytes), Buffer.from(wire));
    const out = await normalizePhantomSignedTxForBroadcast(b64);
    assert.ok(out.length > 0);
    // Output is always base58 for send-raw
    assert.doesNotThrow(() => bs58.decode(out));
  });

  it("falls back to original bytes when Transaction.from fails", async () => {
    const junk = bs58.encode(Buffer.from("not-a-real-tx"));
    const out = await normalizePhantomSignedTxForBroadcast(junk);
    assert.equal(out, junk);
  });
});


describe("USDT ERC-20 paymentUri + deeplinks", () => {
  const pay = "0xEaf6123456789012345678901234567890abcdEF";
  const amount = "12.34"; // → 12340000 base units (6 decimals)

  it("usdtToBaseUnits floors to 6 decimals", () => {
    assert.equal(usdtToBaseUnits("12.34").toString(), "12340000");
    assert.equal(usdtToBaseUnits("1").toString(), "1000000");
    assert.equal(usdtToBaseUnits("0.000001").toString(), "1");
    assert.equal(usdtToBaseUnits("0.0000009").toString(), "0");
  });

  it("paymentUri USDT is EIP-681 ERC-20 transfer (not bare address)", () => {
    const uri = paymentUri("USDT", pay, amount);
    assert.equal(
      uri,
      `ethereum:${USDT_ERC20_CONTRACT}@1/transfer?address=${pay}&uint256=12340000`,
    );
    assert.doesNotMatch(uri, /^0x/);
  });

  it("usdtErc20PaymentUri rejects empty/invalid address or zero amount", () => {
    assert.equal(usdtErc20PaymentUri("", amount), "");
    assert.equal(usdtErc20PaymentUri("not-an-address", amount), "");
    assert.equal(usdtErc20PaymentUri(pay, "0"), "");
  });

  it("MetaMask USDT uses /send/…/transfer (not /dapp/)", () => {
    const href = walletDeepLink("metamask", "USDT", pay, amount, {
      payCurrency: "usdterc20",
    });
    assert.equal(href.startsWith("https://metamask.app.link/send/"), true);
    assert.match(href, new RegExp(`${USDT_ERC20_CONTRACT}@1/transfer`));
    assert.match(href, new RegExp(`address=${pay}`));
    assert.match(href, /uint256=12340000/);
    assert.doesNotMatch(href, /\/dapp\//);
    assert.equal(href, metamaskUsdtErc20SendHref(pay, amount));
  });

  it("Trust USDT opens send with Ethereum coin + USDT token", () => {
    const href = walletDeepLink("trust", "USDT", pay, amount, {
      payCurrency: "usdterc20",
    });
    assert.equal(href.startsWith("https://link.trustwallet.com/send?"), true);
    assert.match(href, /coin=60/);
    assert.match(href, new RegExp(`token=${USDT_ERC20_CONTRACT}`));
    assert.match(href, new RegExp(`asset=c60_t${USDT_ERC20_CONTRACT}`));
    assert.match(href, new RegExp(`address=${encodeURIComponent(pay)}|address=${pay}`));
    assert.match(href, /amount=12\.34/);
    assert.equal(href, trustUsdtErc20SendHref(pay, amount));
  });

  it("USDT mobile wallet options are MetaMask + Trust only (no Coinbase)", () => {
    const usdt = WALLET_OPTIONS.filter((w) => w.assets.includes("USDT") && w.kind === "deeplink");
    assert.deepEqual(
      usdt.map((w) => w.id).sort(),
      ["metamask", "trust"],
    );
    const coinbase = WALLET_OPTIONS.find((w) => w.id === "coinbase");
    assert.ok(coinbase);
    assert.equal(coinbase.assets.includes("USDT"), false);
    assert.equal(coinbase.assets.includes("ETH"), true);
  });

  it("defaults USDT to ERC-20 when payCurrency omitted", () => {
    const uri = paymentUri("USDT", pay, "1");
    assert.match(uri, new RegExp(USDT_ERC20_CONTRACT));
    const mm = walletDeepLink("metamask", "USDT", pay, "1");
    assert.match(mm, /metamask\.app\.link\/send/);
  });
});

describe("paymentUri BTC/LTC", () => {
  it("builds bitcoin: and litecoin: URIs", () => {
    const btc = paymentUri("BTC", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "0.001");
    assert.match(btc, /^bitcoin:bc1q/);
    assert.match(btc, /amount=0\.001/);
    const ltc = paymentUri("LTC", "ltc1qtestaddress000000000000000000000000", "0.12");
    assert.match(ltc, /^litecoin:ltc1q/);
    assert.match(ltc, /amount=0\.12/);
  });
});

describe("Trust Wallet BTC/LTC deeplinks", () => {
  it("uses UAI asset=c0 for BTC and asset=c2 for LTC (prefills address+amount)", () => {
    const btc = walletDeepLink("trust", "BTC", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", "0.001");
    assert.match(btc, /link\.trustwallet\.com\/send/);
    assert.match(btc, /asset=c0/);
    assert.match(btc, /address=bc1q/);
    assert.match(btc, /amount=0\.001/);
    assert.match(btc, /coin=0/);
    const ltc = walletDeepLink(
      "trust",
      "LTC",
      "MWemXfnBWFT25S8frdiMYiYs5TmxJZVpUV",
      "0.00819924",
    );
    assert.match(ltc, /link\.trustwallet\.com\/send/);
    assert.match(ltc, /asset=c2/);
    assert.match(ltc, /address=MWemXfnBWFT25S8frdiMYiYs5TmxJZVpUV/);
    assert.match(ltc, /amount=0\.00819924/);
    assert.match(ltc, /coin=2/);
  });
});

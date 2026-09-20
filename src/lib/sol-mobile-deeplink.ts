/**
 * iOS Safari → Phantom / Solflare branded universal links (encrypted connect +
 * signAndSendTransaction). Never use bare `solana:` on iOS — Base (or whatever
 * registered first) hijacks the shared scheme with no app chooser.
 *
 * Docs:
 * - https://phantom.app/ul/v1/connect | …/signAndSendTransaction
 * - https://solflare.com/ul/v1/connect | …/signAndSendTransaction
 */
import bs58 from "bs58";
import nacl from "tweetnacl";
import { formatSolAmount, isSolanaAddress, solToLamports } from "./sol-amount.ts";

export type SolWalletId = "phantom" | "solflare";

const STORAGE_KEY = "sheundresses.sol.deeplink.v1";
/** Terms/ack checkbox — must survive iOS wallet UL round-trip (full Safari reload). */
const ACK_STORAGE_KEY = "sheundresses.sol.checkout.ack.v1";

/** Query markers on checkout HTTPS redirect_link so we can resume after wallet return. */
export const SOL_UL_QUERY = {
  flag: "hmuls_sol",
  wallet: "hmuls_wallet",
  step: "hmuls_step",
} as const;

export type SolUlStep = "connect" | "sign";

type StoredSession = {
  wallet: SolWalletId;
  to: string;
  amountSol: string;
  dappPublicKey: string;
  dappSecretKey: string;
  sharedSecret?: string;
  session?: string;
  walletPublicKey?: string;
  stage: SolUlStep;
};

const UL_BASE: Record<SolWalletId, string> = {
  phantom: "https://phantom.app/ul/v1",
  solflare: "https://solflare.com/ul/v1",
};

function solRpcUrl() {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const fromEnv = env?.VITE_SOLANA_RPC_URL?.trim();
    if (fromEnv) return fromEnv;
  } catch {
    /* non-vite */
  }
  return "https://api.mainnet-beta.solana.com";
}

function bytesToB58(bytes: Uint8Array): string {
  return bs58.encode(bytes);
}

function b58ToBytes(s: string): Uint8Array {
  return bs58.decode(s);
}

/** Prefer Buffer when present (Node tests); TextEncoder in the browser. */
function utf8Encode(s: string): Uint8Array {
  if (typeof Buffer !== "undefined") return Buffer.from(s, "utf8");
  return new TextEncoder().encode(s);
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("utf8");
  return new TextDecoder().decode(bytes);
}

export function encryptPayload(payload: object, sharedSecret: Uint8Array): {
  nonce: string;
  payload: string;
} {
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.box.after(utf8Encode(JSON.stringify(payload)), nonce, sharedSecret);
  return { nonce: bytesToB58(nonce), payload: bytesToB58(encrypted) };
}

export function decryptPayload(
  data: string,
  nonce: string,
  sharedSecret: Uint8Array,
): Record<string, unknown> {
  const opened = nacl.box.open.after(b58ToBytes(data), b58ToBytes(nonce), sharedSecret);
  if (!opened) throw new Error("Unable to decrypt wallet response.");
  return JSON.parse(utf8Decode(opened)) as Record<string, unknown>;
}

function loadSession(): StoredSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s?.wallet || !s.dappSecretKey || !s.dappPublicKey) return null;
    return s;
  } catch {
    return null;
  }
}

function saveSession(s: StoredSession | null) {
  if (typeof sessionStorage === "undefined") return;
  if (!s) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function clearSolMobileSession() {
  saveSession(null);
}

export function getSolMobileSession(): StoredSession | null {
  return loadSession();
}

type StoredAck = { invoiceId: string; at: number };

/** Persist terms acknowledgement for this invoice across Phantom/Solflare return. */
export function persistSolCheckoutAck(invoiceId: string) {
  if (typeof sessionStorage === "undefined" || !invoiceId) return;
  const payload: StoredAck = { invoiceId, at: Date.now() };
  sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(payload));
}

export function peekSolCheckoutAck(invoiceId: string): boolean {
  if (typeof sessionStorage === "undefined" || !invoiceId) return false;
  try {
    const raw = sessionStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as StoredAck;
    return s?.invoiceId === invoiceId;
  } catch {
    return false;
  }
}

export function clearSolCheckoutAck() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ACK_STORAGE_KEY);
}

/**
 * True when the current URL is a wallet UL return we must resume (connect→sign or
 * sign→waiting). Used to restore ack UI and skip the disabled gate.
 */
export function isSolUlReturnPending(
  url: string = typeof location !== "undefined" ? location.href : "",
): boolean {
  if (!url) return false;
  return parseSolUlReturn(url).active;
}

/**
 * Should the checkout terms checkbox auto-check on load?
 * Yes if we persisted ack for this invoice, or URL is a mid-flow wallet return.
 */
export function shouldRestoreSolCheckoutAck(
  invoiceId: string,
  url: string = typeof location !== "undefined" ? location.href : "",
): boolean {
  if (peekSolCheckoutAck(invoiceId)) return true;
  return isSolUlReturnPending(url);
}

function newDappKeyPair() {
  const kp = nacl.box.keyPair();
  return {
    publicKey: bytesToB58(kp.publicKey),
    secretKey: bytesToB58(kp.secretKey),
  };
}

/**
 * Build checkout HTTPS redirect_link with step markers (wallet returns here).
 * Strips prior hmuls_* markers so returns stay clean.
 */
export function buildSolRedirectLink(
  checkoutHttpsUrl: string,
  wallet: SolWalletId,
  step: SolUlStep,
): string {
  const u = new URL(checkoutHttpsUrl);
  if (u.protocol !== "https:") {
    throw new Error("Wallet redirect must be an HTTPS checkout URL.");
  }
  u.searchParams.delete(SOL_UL_QUERY.flag);
  u.searchParams.delete(SOL_UL_QUERY.wallet);
  u.searchParams.delete(SOL_UL_QUERY.step);
  // Drop leftover wallet response params if any.
  for (const k of [
    "phantom_encryption_public_key",
    "solflare_encryption_public_key",
    "data",
    "nonce",
    "errorCode",
    "errorMessage",
  ]) {
    u.searchParams.delete(k);
  }
  u.searchParams.set(SOL_UL_QUERY.flag, "1");
  u.searchParams.set(SOL_UL_QUERY.wallet, wallet);
  u.searchParams.set(SOL_UL_QUERY.step, step);
  return u.toString();
}

export function parseSolUlReturn(url: string | URL): {
  active: boolean;
  wallet: SolWalletId | null;
  step: SolUlStep | null;
  errorCode: string | null;
  errorMessage: string | null;
  encryptionPublicKey: string | null;
  data: string | null;
  nonce: string | null;
} {
  const u = typeof url === "string" ? new URL(url, "https://sheundresses.com") : url;
  const walletRaw = u.searchParams.get(SOL_UL_QUERY.wallet);
  const wallet =
    walletRaw === "phantom" || walletRaw === "solflare" ? walletRaw : null;
  const stepRaw = u.searchParams.get(SOL_UL_QUERY.step);
  const step = stepRaw === "connect" || stepRaw === "sign" ? stepRaw : null;
  const active = u.searchParams.get(SOL_UL_QUERY.flag) === "1" && Boolean(wallet && step);
  const encryptionPublicKey =
    u.searchParams.get("phantom_encryption_public_key") ||
    u.searchParams.get("solflare_encryption_public_key");
  return {
    active,
    wallet,
    step,
    errorCode: u.searchParams.get("errorCode"),
    errorMessage: u.searchParams.get("errorMessage"),
    encryptionPublicKey,
    data: u.searchParams.get("data"),
    nonce: u.searchParams.get("nonce"),
  };
}

/** Strip hmuls_* + wallet response query params from the address bar after handling. */
export function cleanSolUlUrl(url: string = typeof location !== "undefined" ? location.href : ""): string {
  if (!url) return url;
  const u = new URL(url);
  for (const k of [
    SOL_UL_QUERY.flag,
    SOL_UL_QUERY.wallet,
    SOL_UL_QUERY.step,
    "phantom_encryption_public_key",
    "solflare_encryption_public_key",
    "data",
    "nonce",
    "errorCode",
    "errorMessage",
  ]) {
    u.searchParams.delete(k);
  }
  return u.pathname + u.search + u.hash;
}

export function buildSolConnectHref(opts: {
  wallet: SolWalletId;
  appUrl: string;
  redirectLink: string;
  dappEncryptionPublicKey: string;
}): string {
  const params = new URLSearchParams({
    app_url: opts.appUrl,
    dapp_encryption_public_key: opts.dappEncryptionPublicKey,
    redirect_link: opts.redirectLink,
    cluster: "mainnet-beta",
  });
  return `${UL_BASE[opts.wallet]}/connect?${params.toString()}`;
}

export function buildSolSignAndSendHref(opts: {
  wallet: SolWalletId;
  dappEncryptionPublicKey: string;
  nonce: string;
  redirectLink: string;
  encryptedPayload: string;
}): string {
  const params = new URLSearchParams({
    dapp_encryption_public_key: opts.dappEncryptionPublicKey,
    nonce: opts.nonce,
    redirect_link: opts.redirectLink,
    payload: opts.encryptedPayload,
  });
  return `${UL_BASE[opts.wallet]}/signAndSendTransaction?${params.toString()}`;
}

/**
 * Start iOS pay: persist session keys + pending invoice, return branded connect UL.
 * href always starts with https://phantom.app/ or https://solflare.com/ — never solana:.
 */
export function startSolMobileConnect(opts: {
  wallet: SolWalletId;
  to: string;
  amountSol: string;
  /** Current checkout page (HTTPS). */
  checkoutUrl: string;
  /** Origin shown in wallet approve dialog (defaults to checkout origin). */
  appUrl?: string;
  /** Invoice id — persists terms ack so return is not blocked by unchecked box. */
  invoiceId?: string;
}): { href: string; message: string } {
  const to = opts.to.trim();
  const amountSol = formatSolAmount(opts.amountSol);
  if (!isSolanaAddress(to) || !amountSol || amountSol === "0") {
    throw new Error("Payment address or amount is not ready yet.");
  }
  const checkout = new URL(opts.checkoutUrl);
  if (checkout.protocol !== "https:") {
    throw new Error("Checkout must be HTTPS for wallet return.");
  }
  const appUrl = opts.appUrl ?? checkout.origin + "/";
  const kp = newDappKeyPair();
  const redirectLink = buildSolRedirectLink(opts.checkoutUrl, opts.wallet, "connect");
  if (opts.invoiceId) persistSolCheckoutAck(opts.invoiceId);
  saveSession({
    wallet: opts.wallet,
    to,
    amountSol,
    dappPublicKey: kp.publicKey,
    dappSecretKey: kp.secretKey,
    stage: "connect",
  });
  const href = buildSolConnectHref({
    wallet: opts.wallet,
    appUrl,
    redirectLink,
    dappEncryptionPublicKey: kp.publicKey,
  });
  const name = opts.wallet === "phantom" ? "Phantom" : "Solflare";
  return {
    href,
    message: `Opening ${name}… Approve the connection, then confirm ${amountSol} SOL.`,
  };
}

function sharedSecretFromConnect(
  walletEncryptionPublicKey: string,
  dappSecretKeyB58: string,
): Uint8Array {
  return nacl.box.before(b58ToBytes(walletEncryptionPublicKey), b58ToBytes(dappSecretKeyB58));
}

/**
 * After connect redirect: decrypt session, build SystemProgram.transfer, return
 * branded signAndSendTransaction UL (or error).
 */
export async function continueSolMobileAfterConnect(returnUrl: string): Promise<
  | { ok: true; href: string; message: string; wallet: SolWalletId }
  | { ok: false; error: string }
> {
  const parsed = parseSolUlReturn(returnUrl);
  if (!parsed.active || parsed.step !== "connect" || !parsed.wallet) {
    return { ok: false, error: "Unexpected wallet return." };
  }
  if (parsed.errorCode) {
    clearSolMobileSession();
    return {
      ok: false,
      error: parsed.errorMessage || `Wallet declined (${parsed.errorCode}).`,
    };
  }
  if (!parsed.encryptionPublicKey || !parsed.data || !parsed.nonce) {
    return { ok: false, error: "Wallet connect response was incomplete." };
  }

  const stored = loadSession();
  if (!stored || stored.wallet !== parsed.wallet) {
    return { ok: false, error: "No pending wallet session. Tap Pay again." };
  }

  const sharedSecret = sharedSecretFromConnect(
    parsed.encryptionPublicKey,
    stored.dappSecretKey,
  );
  let connectData: Record<string, unknown>;
  try {
    connectData = decryptPayload(parsed.data, parsed.nonce, sharedSecret);
  } catch {
    clearSolMobileSession();
    return { ok: false, error: "Could not read wallet connect response." };
  }
  const session = typeof connectData.session === "string" ? connectData.session : "";
  const walletPublicKey =
    typeof connectData.public_key === "string" ? connectData.public_key : "";
  if (!session || !walletPublicKey) {
    clearSolMobileSession();
    return { ok: false, error: "Wallet did not return a session." };
  }

  saveSession({
    ...stored,
    sharedSecret: bytesToB58(sharedSecret),
    session,
    walletPublicKey,
    stage: "sign",
  });

  try {
    const href = await buildSignHrefForPending({
      ...stored,
      sharedSecret: bytesToB58(sharedSecret),
      session,
      walletPublicKey,
      stage: "sign",
    }, returnUrl);
    const name = parsed.wallet === "phantom" ? "Phantom" : "Solflare";
    return {
      ok: true,
      href,
      wallet: parsed.wallet,
      message: `Confirm ${stored.amountSol} SOL in ${name}.`,
    };
  } catch (err) {
    clearSolMobileSession();
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not build transfer.",
    };
  }
}

async function buildSignHrefForPending(stored: StoredSession, currentUrl: string): Promise<string> {
  if (!stored.sharedSecret || !stored.session || !stored.walletPublicKey) {
    throw new Error("Missing wallet session.");
  }
  const lamports = solToLamports(stored.amountSol);
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount too large to send from this browser.");
  }

  const { Connection, PublicKey, SystemProgram, Transaction } = await import("@solana/web3.js");
  const connection = new Connection(solRpcUrl(), "confirmed");
  const from = new PublicKey(stored.walletPublicKey);
  const to = new PublicKey(stored.to);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports: Number(lamports),
    }),
  );
  tx.feePayer = from;
  const latest = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = latest.blockhash;

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const payload = {
    session: stored.session,
    transaction: bytesToB58(serialized),
  };
  const shared = b58ToBytes(stored.sharedSecret);
  const { nonce, payload: encryptedPayload } = encryptPayload(payload, shared);
  const redirectLink = buildSolRedirectLink(currentUrl, stored.wallet, "sign");
  return buildSolSignAndSendHref({
    wallet: stored.wallet,
    dappEncryptionPublicKey: stored.dappPublicKey,
    nonce,
    redirectLink,
    encryptedPayload,
  });
}

/**
 * After signAndSendTransaction redirect: decrypt signature.
 */
export function finishSolMobileAfterSign(returnUrl: string):
  | { ok: true; signature: string; from: string; wallet: SolWalletId }
  | { ok: false; error: string } {
  const parsed = parseSolUlReturn(returnUrl);
  if (!parsed.active || parsed.step !== "sign" || !parsed.wallet) {
    return { ok: false, error: "Unexpected wallet return." };
  }
  if (parsed.errorCode) {
    clearSolMobileSession();
    return {
      ok: false,
      error: parsed.errorMessage || `Wallet declined (${parsed.errorCode}).`,
    };
  }
  if (!parsed.data || !parsed.nonce) {
    return { ok: false, error: "Wallet sign response was incomplete." };
  }
  const stored = loadSession();
  if (!stored?.sharedSecret || stored.wallet !== parsed.wallet) {
    return { ok: false, error: "No pending wallet session. Tap Pay again." };
  }
  let signData: Record<string, unknown>;
  try {
    signData = decryptPayload(parsed.data, parsed.nonce, b58ToBytes(stored.sharedSecret));
  } catch {
    clearSolMobileSession();
    return { ok: false, error: "Could not read wallet sign response." };
  }
  const signature = typeof signData.signature === "string" ? signData.signature : "";
  if (!signature) {
    clearSolMobileSession();
    return { ok: false, error: "Wallet did not return a signature." };
  }
  const from = stored.walletPublicKey || "";
  clearSolMobileSession();
  return { ok: true, signature, from, wallet: parsed.wallet };
}

/** True when href is a wallet-owned HTTPS UL (or custom scheme), never bare solana:. */
export function isBrandedSolWalletHref(href: string, wallet: SolWalletId): boolean {
  if (!href || href.startsWith("solana:")) return false;
  if (wallet === "phantom") {
    return (
      href.startsWith("https://phantom.app/") ||
      href.startsWith("phantom://")
    );
  }
  return (
    href.startsWith("https://solflare.com/") ||
    href.startsWith("solflare://")
  );
}

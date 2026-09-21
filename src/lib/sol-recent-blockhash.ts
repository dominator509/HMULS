/**
 * Solana RPC helpers used by Worker APIs and browser clients.
 * Browser never hits public Solana RPC (often 403 from browser origins) — use same-origin
 * `/api/sol/*` instead. Worker uses optional `SOLANA_RPC_URL`, then mainnet, then publicnode.
 */

export type RecentBlockhash = {
  blockhash: string;
  lastValidBlockHeight: number;
  /** Current chain block height when known (from getBlockHeight alongside getLatestBlockhash). */
  blockHeight?: number;
};

/** Buyer-facing copy when blockhash prep fails. Tech detail stays in logs / Error.cause. */
export const SOL_PREPARE_TRANSFER_ERROR =
  "Couldn't prepare the transfer. Try again in a moment.";

/** Buyer toast when wallet cannot cover transfer + fee (from simulate). */
export const SOL_INSUFFICIENT_FUNDS_ERROR =
  "Not enough SOL in that wallet for this payment + fee";

/** Buyer toast when signed tx cannot be submitted. */
export const SOL_BROADCAST_ERROR =
  "Couldn't submit the payment. Try again in a moment.";

/** Buyer toast when the signed tx's recent blockhash / lastValidBlockHeight expired (Phantom confirm took too long). */
export const SOL_BLOCKHASH_EXPIRED_ERROR =
  "That confirm took too long. Tap Pay with Phantom again.";

/** Machine codes returned by POST /api/sol/send-raw for client mapping (not shown to buyers). */
export type SolBroadcastErrorCode =
  | "BLOCKHASH_EXPIRED"
  | "INSUFFICIENT_FUNDS"
  | "BROADCAST_FAILED";

/** Primary public mainnet + secondary CORS-friendly free endpoint (verified from Worker/box). */
export const DEFAULT_SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
] as const;

/** publicnode is fine for getLatestBlockhash / sendRaw; do NOT use for getBlockHeight. */
export const PUBLICNODE_RPC_URL = "https://solana-rpc.publicnode.com";

export function resolveSolanaRpcUrls(envUrl?: string | null): string[] {
  const urls: string[] = [];
  const trimmed = envUrl?.trim();
  if (trimmed) urls.push(trimmed);
  for (const u of DEFAULT_SOLANA_RPC_URLS) {
    if (!urls.includes(u)) urls.push(u);
  }
  return urls;
}

/** True when URL is publicnode (misimplements getBlockHeight as slot-scale). */
export function isPublicnodeRpcUrl(url: string): boolean {
  return /solana-rpc\.publicnode\.com/i.test(url);
}

/**
 * RPCs safe for getBlockHeight: SOLANA_RPC_URL / mainnet-beta only.
 * publicnode getBlockHeight returns slot numbers (~448M) while lastValidBlockHeight
 * stays real (~426M) — pairing them always looks "expired".
 */
export function rpcUrlsForBlockHeight(rpcUrls: string[]): string[] {
  return rpcUrls.filter((u) => !isPublicnodeRpcUrl(u));
}

/**
 * Pair blockHeight with lastValidBlockHeight only when sane.
 * Fresh pairs must have blockHeight < lastValidBlockHeight (typically lastValid ≈ height + ~150).
 * Slot-scale junk (>= lastValid) is discarded — treat as missing.
 */
export function sanitizePairedBlockHeight(
  blockHeight: number | undefined,
  lastValidBlockHeight: number,
): number | undefined {
  if (typeof blockHeight !== "number" || !Number.isFinite(blockHeight)) return undefined;
  if (blockHeight >= lastValidBlockHeight) return undefined;
  return blockHeight;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export function isInsufficientFundsMessage(msg: string): boolean {
  return /insufficient(?:\s+lamports|\s+funds|Funds)|InsufficientFunds|Attempt to debit an account but found no record of a prior credit/i.test(
    msg,
  );
}

/** Preflight / RPC wording for expired recent blockhash. */
export function isBlockhashExpiredMessage(msg: string): boolean {
  return /BlockhashNotFound|blockhash not found|block height exceeded|blockhash.?expired|Transaction expired|expired blockhash/i.test(
    msg,
  );
}

export function solBroadcastErrorCode(message: string): SolBroadcastErrorCode {
  if (message === SOL_INSUFFICIENT_FUNDS_ERROR) return "INSUFFICIENT_FUNDS";
  if (message === SOL_BLOCKHASH_EXPIRED_ERROR || isBlockhashExpiredMessage(message)) {
    return "BLOCKHASH_EXPIRED";
  }
  return "BROADCAST_FAILED";
}

/** Truncate RPC / cause text for JSON `detail` (buyer toast stays friendly). */
export function safeRpcDetail(raw: unknown, max = 160): string {
  const s = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Prefer SOLANA_RPC_URL / mainnet-beta for sendRaw; keep publicnode last.
 * (resolveSolanaRpcUrls already orders this way — helper documents intent for callers.)
 */
export function rpcUrlsForSend(rpcUrls: string[]): string[] {
  const preferred: string[] = [];
  const publicnode: string[] = [];
  for (const u of rpcUrls) {
    if (isPublicnodeRpcUrl(u)) publicnode.push(u);
    else preferred.push(u);
  }
  return [...preferred, ...publicnode];
}

type RpcJson = {
  result?: {
    value?: {
      blockhash?: string;
      lastValidBlockHeight?: number;
    };
  };
  error?: { message?: string; code?: number };
};

/**
 * JSON-RPC getLatestBlockhash against one or more endpoints (first success wins).
 * Pure helper — inject fetch for tests.
 */
export async function fetchRecentBlockhashFromRpc(
  rpcUrls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<RecentBlockhash> {
  if (!rpcUrls.length) {
    throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
      cause: "no rpc urls",
    });
  }
  const errors: string[] = [];
  for (const url of rpcUrls) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "confirmed" }],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(`${url}: HTTP ${res.status}${body ? ` ${body.slice(0, 120)}` : ""}`);
        continue;
      }
      const json = (await res.json()) as RpcJson;
      if (json.error) {
        errors.push(`${url}: ${json.error.message || String(json.error.code)}`);
        continue;
      }
      const value = json.result?.value;
      if (!value?.blockhash || typeof value.lastValidBlockHeight !== "number") {
        errors.push(`${url}: missing blockhash`);
        continue;
      }
      // Prefer SOLANA_RPC_URL / mainnet for height — never trust publicnode getBlockHeight.
      let blockHeight: number | undefined;
      const heightUrls = rpcUrlsForBlockHeight(rpcUrls);
      if (heightUrls.length) {
        try {
          const rawHeight = await fetchBlockHeightFromRpc(heightUrls, fetchImpl);
          blockHeight = sanitizePairedBlockHeight(rawHeight, value.lastValidBlockHeight);
        } catch {
          /* optional — omit rather than return junk */
        }
      }
      return {
        blockhash: value.blockhash,
        lastValidBlockHeight: value.lastValidBlockHeight,
        ...(typeof blockHeight === "number" ? { blockHeight } : {}),
      };
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
    cause: errors.join("; "),
  });
}

/**
 * JSON-RPC getBlockHeight — used to detect expired lastValidBlockHeight before broadcast.
 */
export async function fetchBlockHeightFromRpc(
  rpcUrls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  // Skip publicnode — its getBlockHeight is slot-scale and unusable for expiry.
  const urls = rpcUrlsForBlockHeight(rpcUrls);
  if (!urls.length) {
    throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
      cause: "no trusted rpc urls for getBlockHeight",
    });
  }
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getBlockHeight",
          params: [{ commitment: "confirmed" }],
        }),
      });
      if (!res.ok) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as { result?: number; error?: { message?: string } };
      if (json.error) {
        errors.push(`${url}: ${json.error.message || "rpc error"}`);
        continue;
      }
      if (typeof json.result === "number") return json.result;
      errors.push(`${url}: missing block height`);
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
    cause: errors.join("; "),
  });
}

/** Same-origin current block height (via recent-blockhash which may include blockHeight). */
export async function fetchBlockHeightFromApi(
  fetchImpl: typeof fetch = fetch,
  apiPath = "/api/sol/recent-blockhash",
): Promise<number> {
  const latest = await fetchRecentBlockhashFromApi(fetchImpl, apiPath);
  if (typeof latest.blockHeight === "number") return latest.blockHeight;
  // Fallback: lastValid from a fresh hash is ahead of current — not usable as current height.
  throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
    cause: "api missing blockHeight",
  });
}

/** True when current height has reached/passed the tx's lastValidBlockHeight. */
export function isBlockHeightExpired(currentHeight: number, lastValidBlockHeight: number): boolean {
  return currentHeight >= lastValidBlockHeight;
}

/** Same-origin Worker API used by browser wallet / iOS UL sign builders. */
export async function fetchRecentBlockhashFromApi(
  fetchImpl: typeof fetch = fetch,
  apiPath = "/api/sol/recent-blockhash",
): Promise<RecentBlockhash> {
  try {
    const res = await fetchImpl(apiPath, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) {
      throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
        cause: `api HTTP ${res.status}`,
      });
    }
    const json = (await res.json()) as Partial<RecentBlockhash> & { error?: string };
    if (!json.blockhash || typeof json.lastValidBlockHeight !== "number") {
      throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
        cause: "api missing blockhash",
      });
    }
    const blockHeight = sanitizePairedBlockHeight(json.blockHeight, json.lastValidBlockHeight);
    return {
      blockhash: json.blockhash,
      lastValidBlockHeight: json.lastValidBlockHeight,
      ...(typeof blockHeight === "number" ? { blockHeight } : {}),
    };
  } catch (err) {
    if (err instanceof Error && err.message === SOL_PREPARE_TRANSFER_ERROR) throw err;
    throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
      cause: err instanceof Error ? err.message : "api fetch failed",
    });
  }
}

export type SimulateTransactionResult =
  | { ok: true }
  | { ok: false; insufficientFunds: boolean; detail: string; infraFailure?: boolean };

type SimRpcJson = {
  result?: {
    value?: {
      err?: unknown;
      logs?: string[] | null;
    };
  };
  error?: { message?: string; code?: number };
};

/**
 * simulateTransaction (sigVerify false, replaceRecentBlockhash true).
 * Used before opening wallet sign UL so buyers see our toast instead of wallet "Simulation failed".
 */
export async function simulateTransactionViaRpc(
  rpcUrls: string[],
  txBytes: Uint8Array,
  fetchImpl: typeof fetch = fetch,
): Promise<SimulateTransactionResult> {
  if (!rpcUrls.length) {
    return { ok: false, insufficientFunds: false, detail: "no rpc urls", infraFailure: true };
  }
  const encoded = bytesToBase64(txBytes);
  const errors: string[] = [];
  for (const url of rpcUrls) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateTransaction",
          params: [
            encoded,
            {
              encoding: "base64",
              sigVerify: false,
              replaceRecentBlockhash: true,
              commitment: "confirmed",
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(`${url}: HTTP ${res.status}${body ? ` ${body.slice(0, 120)}` : ""}`);
        continue;
      }
      const json = (await res.json()) as SimRpcJson;
      if (json.error) {
        errors.push(`${url}: ${json.error.message || String(json.error.code)}`);
        continue;
      }
      const value = json.result?.value;
      if (!value) {
        errors.push(`${url}: missing simulate value`);
        continue;
      }
      if (value.err == null) return { ok: true };
      const detail =
        typeof value.err === "string"
          ? value.err
          : JSON.stringify(value.err) +
            (value.logs?.length ? ` | ${value.logs.slice(-3).join(" ")}` : "");
      return {
        ok: false,
        insufficientFunds: isInsufficientFundsMessage(detail),
        detail,
      };
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  return {
    ok: false,
    insufficientFunds: false,
    detail: errors.join("; ") || "simulate failed",
    infraFailure: true,
  };
}

type SendRpcJson = {
  result?: string;
  error?: { message?: string; code?: number; data?: unknown };
};

export type SendRawTransactionOptions = {
  /** When set, blockhash-expiry errors map to re-sign toast. */
  lastValidBlockHeight?: number;
  /**
   * After a successful sendRaw, optionally poll getSignatureStatuses (best-effort).
   * A returned signature is ALWAYS success — confirm timeout / pending must NOT become BROADCAST_FAILED.
   * Default true (poll for observability only).
   */
  confirm?: boolean;
  /**
   * Phantom mobile send-raw: prefer skipPreflight true first (default).
   * Set false to try preflight first (legacy).
   */
  preferSkipPreflight?: boolean;
};

/**
 * True when this RPC endpoint refused submit — try the next URL (do not burn
 * skipPreflight variants on the same dead host).
 * HTTP 403 / IP blocked, or JSON-RPC -32601 Method not found.
 */
export function isRpcSubmitEndpointRefuse(message: string, httpStatus?: number): boolean {
  if (httpStatus === 403) return true;
  return /Method not found|-32601|HTTP 403|Access forbidden|Your IP or provider is blocked/i.test(
    message,
  );
}

/**
 * One JSON-RPC send against a single URL.
 * Solana JSON-RPC method is **`sendTransaction`** (what `@solana/web3.js`
 * `Connection.sendRawTransaction` POSTs). There is no `sendRawTransaction` RPC method.
 */
async function rpcSendRawOnce(
  url: string,
  encoded: string,
  opts: { skipPreflight: boolean; maxRetries?: number },
  fetchImpl: typeof fetch,
): Promise<{ ok: true; signature: string } | { ok: false; message: string; httpStatus?: number }> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      // Correct Solana JSON-RPC method — NOT "sendRawTransaction" (that returns -32601).
      method: "sendTransaction",
      params: [
        encoded,
        {
          encoding: "base64",
          skipPreflight: opts.skipPreflight,
          preflightCommitment: "confirmed",
          ...(typeof opts.maxRetries === "number" ? { maxRetries: opts.maxRetries } : {}),
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      message: `HTTP ${res.status}${body ? ` ${body.slice(0, 160)}` : ""}`,
      httpStatus: res.status,
    };
  }
  const json = (await res.json()) as SendRpcJson;
  if (json.error) {
    return {
      ok: false,
      message: json.error.message || String(json.error.code),
      httpStatus: json.error.code === -32601 ? 404 : undefined,
    };
  }
  if (typeof json.result === "string" && json.result.length > 0) {
    return { ok: true, signature: json.result };
  }
  return { ok: false, message: "missing signature" };
}

/** Best-effort confirmation — returns without throwing if status is still pending. */
export async function confirmSignatureViaRpc(
  rpcUrls: string[],
  signature: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ confirmed: boolean; err?: string }> {
  for (const url of rpcUrls) {
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getSignatureStatuses",
          params: [[signature], { searchTransactionHistory: true }],
        }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        result?: { value?: Array<{ confirmationStatus?: string; err?: unknown } | null> };
        error?: { message?: string };
      };
      if (json.error) continue;
      const st = json.result?.value?.[0];
      if (!st) continue;
      if (st.err != null) {
        return {
          confirmed: false,
          err: typeof st.err === "string" ? st.err : JSON.stringify(st.err),
        };
      }
      const status = st.confirmationStatus;
      if (status === "confirmed" || status === "finalized") {
        return { confirmed: true };
      }
      // processed / unknown — treat as landed enough for unlock path
      if (status === "processed") return { confirmed: true };
    } catch {
      /* try next */
    }
  }
  return { confirmed: false };
}

/**
 * Broadcast signed bytes via JSON-RPC **`sendTransaction`** (JS helper name keeps sendRaw*).
 * Default: skipPreflight:true + maxRetries first (Phantom mobile resilience), then
 * optional preflight attempt. Tries every RPC URL (SOLANA_RPC_URL / mainnet before publicnode).
 * On HTTP 403 / Method not found, continues to the next URL. If any send returns a signature,
 * that is success — confirm poll never converts to BROADCAST_FAILED.
 */
export async function sendRawTransactionViaRpc(
  rpcUrls: string[],
  signedTxBytes: Uint8Array,
  fetchImpl: typeof fetch = fetch,
  options: SendRawTransactionOptions = {},
): Promise<string> {
  const urls = rpcUrlsForSend(rpcUrls);
  if (!urls.length) {
    throw Object.assign(new Error(SOL_BROADCAST_ERROR), { cause: "no rpc urls" });
  }
  const encoded = bytesToBase64(signedTxBytes);
  const errors: string[] = [];
  let sawBlockhashExpiry = false;
  const preferSkip = options.preferSkipPreflight !== false;

  const attemptOrders: Array<{ skipPreflight: boolean; maxRetries?: number }> = preferSkip
    ? [
        { skipPreflight: true, maxRetries: 3 },
        { skipPreflight: false },
      ]
    : [
        { skipPreflight: false },
        { skipPreflight: true, maxRetries: 3 },
      ];

  for (const url of urls) {
    for (const attempt of attemptOrders) {
      try {
        const sent = await rpcSendRawOnce(url, encoded, attempt, fetchImpl);
        if (sent.ok) {
          // Best-effort confirm only — never fail a successful send on slow/pending status.
          if (options.confirm !== false) {
            try {
              await confirmSignatureViaRpc(
                [url, ...urls.filter((u) => u !== url)],
                sent.signature,
                fetchImpl,
              );
            } catch {
              /* ignore */
            }
          }
          return sent.signature;
        }

        const msg = sent.message;
        if (isInsufficientFundsMessage(msg)) {
          throw Object.assign(new Error(SOL_INSUFFICIENT_FUNDS_ERROR), { cause: msg });
        }
        if (isBlockhashExpiredMessage(msg)) {
          sawBlockhashExpiry = true;
          // Do not burn remaining attempts on this URL once hash is dead.
          errors.push(`${url}: ${msg}`);
          break;
        }
        // 403 / Method not found → next RPC URL (publicnode / SOLANA_RPC_URL after mainnet).
        if (isRpcSubmitEndpointRefuse(msg, sent.httpStatus)) {
          errors.push(`${url} skipPreflight=${attempt.skipPreflight}: ${msg}`);
          break;
        }
        errors.push(`${url} skipPreflight=${attempt.skipPreflight}: ${msg}`);
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message === SOL_INSUFFICIENT_FUNDS_ERROR ||
            err.message === SOL_BLOCKHASH_EXPIRED_ERROR)
        ) {
          throw err;
        }
        errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
      }
    }
  }

  const cause = errors.join("; ");
  if (sawBlockhashExpiry || isBlockhashExpiredMessage(cause)) {
    throw Object.assign(new Error(SOL_BLOCKHASH_EXPIRED_ERROR), { cause });
  }
  throw Object.assign(new Error(SOL_BROADCAST_ERROR), { cause });
}

/** Same-origin simulate for unsigned/partial txs before opening wallet UL. */
export async function simulateTransactionViaApi(
  txBase58: string,
  fetchImpl: typeof fetch = fetch,
  apiPath = "/api/sol/simulate",
): Promise<SimulateTransactionResult> {
  try {
    const res = await fetchImpl(apiPath, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ transaction: txBase58 }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      insufficientFunds?: boolean;
      detail?: string;
      error?: string;
      infraFailure?: boolean;
    };
    if (!res.ok) {
      return {
        ok: false,
        insufficientFunds: false,
        detail: json.error || `api HTTP ${res.status}`,
        infraFailure: true,
      };
    }
    if (json.ok === true) return { ok: true };
    return {
      ok: false,
      insufficientFunds: Boolean(json.insufficientFunds),
      detail: json.detail || json.error || "simulate failed",
      infraFailure: Boolean(json.infraFailure),
    };
  } catch (err) {
    return {
      ok: false,
      insufficientFunds: false,
      detail: err instanceof Error ? err.message : "api fetch failed",
      infraFailure: true,
    };
  }
}

/** Same-origin sendRaw for Phantom signTransaction return (signed tx base58). */
export async function sendRawTransactionViaApi(
  txBase58: string,
  fetchImpl: typeof fetch = fetch,
  apiPath = "/api/sol/send-raw",
  options: { lastValidBlockHeight?: number } = {},
): Promise<string> {
  try {
    const body: { transaction: string; lastValidBlockHeight?: number } = {
      transaction: txBase58,
    };
    if (typeof options.lastValidBlockHeight === "number") {
      body.lastValidBlockHeight = options.lastValidBlockHeight;
    }
    const res = await fetchImpl(apiPath, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      signature?: string;
      error?: string;
      code?: SolBroadcastErrorCode;
      detail?: string;
    };
    const detail = safeRpcDetail(json.detail);
    if (!res.ok) {
      if (detail) console.warn("[sol/send-raw]", detail);
      if (json.error === SOL_INSUFFICIENT_FUNDS_ERROR || json.code === "INSUFFICIENT_FUNDS") {
        throw Object.assign(new Error(SOL_INSUFFICIENT_FUNDS_ERROR), {
          cause: detail || "insufficient funds",
          detail: detail || undefined,
        });
      }
      if (json.error === SOL_BLOCKHASH_EXPIRED_ERROR || json.code === "BLOCKHASH_EXPIRED") {
        throw Object.assign(new Error(SOL_BLOCKHASH_EXPIRED_ERROR), {
          cause: detail || "blockhash expired",
          detail: detail || undefined,
        });
      }
      throw Object.assign(new Error(json.error || SOL_BROADCAST_ERROR), {
        cause: detail || `api HTTP ${res.status}`,
        detail: detail || undefined,
      });
    }
    if (typeof json.signature !== "string" || !json.signature) {
      throw Object.assign(new Error(SOL_BROADCAST_ERROR), { cause: "api missing signature" });
    }
    return json.signature;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === SOL_BROADCAST_ERROR ||
        err.message === SOL_INSUFFICIENT_FUNDS_ERROR ||
        err.message === SOL_BLOCKHASH_EXPIRED_ERROR)
    ) {
      throw err;
    }
    throw Object.assign(new Error(SOL_BROADCAST_ERROR), {
      cause: err instanceof Error ? err.message : "api fetch failed",
    });
  }
}

/** Map raw RPC / wallet errors to the buyer toast (tech detail already in logs if logged). */
export function friendlySolPrepareError(err: unknown): string {
  if (err instanceof Error && err.message === SOL_PREPARE_TRANSFER_ERROR) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  if (err instanceof Error && err.message === SOL_INSUFFICIENT_FUNDS_ERROR) {
    return SOL_INSUFFICIENT_FUNDS_ERROR;
  }
  if (err instanceof Error && err.message === SOL_BLOCKHASH_EXPIRED_ERROR) {
    return SOL_BLOCKHASH_EXPIRED_ERROR;
  }
  if (err instanceof Error && err.message === SOL_BROADCAST_ERROR) {
    return SOL_BROADCAST_ERROR;
  }
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (isInsufficientFundsMessage(raw)) {
    return SOL_INSUFFICIENT_FUNDS_ERROR;
  }
  if (isBlockhashExpiredMessage(raw) || /took too long|Tap Pay with Phantom/i.test(raw)) {
    return SOL_BLOCKHASH_EXPIRED_ERROR;
  }
  // Generic "blockhash" during *prepare* (fetch latest) — not post-sign expiry.
  if (/403|Access forbidden|failed to get recent|jsonrpc/i.test(raw)) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  if (/blockhash/i.test(raw) && !/sendRaw|broadcast|preflight|submit/i.test(raw)) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  if (/sendRaw|broadcast|preflight|submit the payment/i.test(raw)) {
    return SOL_BROADCAST_ERROR;
  }
  return raw || SOL_PREPARE_TRANSFER_ERROR;
}

/**
 * Solana RPC helpers used by Worker APIs and browser clients.
 * Browser never hits public Solana RPC (often 403 from browser origins) — use same-origin
 * `/api/sol/*` instead. Worker uses optional `SOLANA_RPC_URL`, then mainnet, then publicnode.
 */

export type RecentBlockhash = {
  blockhash: string;
  lastValidBlockHeight: number;
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

/** Primary public mainnet + secondary CORS-friendly free endpoint (verified from Worker/box). */
export const DEFAULT_SOLANA_RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
] as const;

export function resolveSolanaRpcUrls(envUrl?: string | null): string[] {
  const urls: string[] = [];
  const trimmed = envUrl?.trim();
  if (trimmed) urls.push(trimmed);
  for (const u of DEFAULT_SOLANA_RPC_URLS) {
    if (!urls.includes(u)) urls.push(u);
  }
  return urls;
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
      return {
        blockhash: value.blockhash,
        lastValidBlockHeight: value.lastValidBlockHeight,
      };
    } catch (err) {
      errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  throw Object.assign(new Error(SOL_PREPARE_TRANSFER_ERROR), {
    cause: errors.join("; "),
  });
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
    return {
      blockhash: json.blockhash,
      lastValidBlockHeight: json.lastValidBlockHeight,
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
  error?: { message?: string; code?: number };
};

/** sendRawTransaction — returns base58 signature. */
export async function sendRawTransactionViaRpc(
  rpcUrls: string[],
  signedTxBytes: Uint8Array,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!rpcUrls.length) {
    throw Object.assign(new Error(SOL_BROADCAST_ERROR), { cause: "no rpc urls" });
  }
  const encoded = bytesToBase64(signedTxBytes);
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
          method: "sendRawTransaction",
          params: [
            encoded,
            {
              encoding: "base64",
              skipPreflight: false,
              preflightCommitment: "confirmed",
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        errors.push(`${url}: HTTP ${res.status}${body ? ` ${body.slice(0, 160)}` : ""}`);
        continue;
      }
      const json = (await res.json()) as SendRpcJson;
      if (json.error) {
        const msg = json.error.message || String(json.error.code);
        if (isInsufficientFundsMessage(msg)) {
          throw Object.assign(new Error(SOL_INSUFFICIENT_FUNDS_ERROR), { cause: msg });
        }
        errors.push(`${url}: ${msg}`);
        continue;
      }
      if (typeof json.result === "string" && json.result.length > 0) {
        return json.result;
      }
      errors.push(`${url}: missing signature`);
    } catch (err) {
      if (err instanceof Error && err.message === SOL_INSUFFICIENT_FUNDS_ERROR) throw err;
      errors.push(`${url}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  throw Object.assign(new Error(SOL_BROADCAST_ERROR), {
    cause: errors.join("; "),
  });
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
): Promise<string> {
  try {
    const res = await fetchImpl(apiPath, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ transaction: txBase58 }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      signature?: string;
      error?: string;
    };
    if (!res.ok) {
      if (json.error === SOL_INSUFFICIENT_FUNDS_ERROR) {
        throw new Error(SOL_INSUFFICIENT_FUNDS_ERROR);
      }
      throw Object.assign(new Error(json.error || SOL_BROADCAST_ERROR), {
        cause: `api HTTP ${res.status}`,
      });
    }
    if (typeof json.signature !== "string" || !json.signature) {
      throw Object.assign(new Error(SOL_BROADCAST_ERROR), { cause: "api missing signature" });
    }
    return json.signature;
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === SOL_BROADCAST_ERROR || err.message === SOL_INSUFFICIENT_FUNDS_ERROR)
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
  if (err instanceof Error && err.message === SOL_BROADCAST_ERROR) {
    return SOL_BROADCAST_ERROR;
  }
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (isInsufficientFundsMessage(raw)) {
    return SOL_INSUFFICIENT_FUNDS_ERROR;
  }
  if (/blockhash|403|Access forbidden|failed to get recent|jsonrpc/i.test(raw)) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  if (/sendRaw|broadcast|preflight|submit the payment/i.test(raw)) {
    return SOL_BROADCAST_ERROR;
  }
  return raw || SOL_PREPARE_TRANSFER_ERROR;
}

/**
 * Recent blockhash for SOL transfers — fetched server-side via Worker API so the
 * browser never hits public Solana RPC (often 403 from browser origins).
 */

export type RecentBlockhash = {
  blockhash: string;
  lastValidBlockHeight: number;
};

/** Buyer-facing copy when blockhash prep fails. Tech detail stays in logs / Error.cause. */
export const SOL_PREPARE_TRANSFER_ERROR =
  "Couldn't prepare the transfer. Try again in a moment.";

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

/** Map raw RPC / wallet errors to the buyer toast (tech detail already in logs if logged). */
export function friendlySolPrepareError(err: unknown): string {
  if (err instanceof Error && err.message === SOL_PREPARE_TRANSFER_ERROR) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  const raw = err instanceof Error ? err.message : String(err ?? "");
  if (/blockhash|403|Access forbidden|failed to get recent|jsonrpc/i.test(raw)) {
    return SOL_PREPARE_TRANSFER_ERROR;
  }
  return raw || SOL_PREPARE_TRANSFER_ERROR;
}

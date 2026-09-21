import { createFileRoute } from "@tanstack/react-router";
import {
  fetchRecentBlockhashFromRpc,
  resolveSolanaRpcUrls,
  SOL_PREPARE_TRANSFER_ERROR,
} from "@/lib/sol-recent-blockhash";

/**
 * GET /api/sol/recent-blockhash — server-side Solana getLatestBlockhash.
 * Browser clients must use this (same-origin) instead of public RPC (often 403).
 * Optional Worker env `SOLANA_RPC_URL` (Helius/QuickNode recommended); falls back to
 * public mainnet then publicnode.
 */
export const Route = createFileRoute("/api/sol/recent-blockhash")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const urls = resolveSolanaRpcUrls(process.env.SOLANA_RPC_URL);
          const latest = await fetchRecentBlockhashFromRpc(urls);
          return Response.json(latest, {
            headers: { "Cache-Control": "no-store" },
          });
        } catch (err) {
          const detail =
            err instanceof Error
              ? String((err as Error & { cause?: unknown }).cause ?? err.message)
              : "unknown";
          console.warn("[sol/recent-blockhash]", detail);
          return Response.json({ error: SOL_PREPARE_TRANSFER_ERROR }, { status: 502 });
        }
      },
    },
  },
});

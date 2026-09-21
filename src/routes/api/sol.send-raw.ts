import { createFileRoute } from "@tanstack/react-router";
import bs58 from "bs58";
import {
  resolveSolanaRpcUrls,
  sendRawTransactionViaRpc,
  SOL_BROADCAST_ERROR,
  SOL_INSUFFICIENT_FUNDS_ERROR,
} from "@/lib/sol-recent-blockhash";

/**
 * POST /api/sol/send-raw — server-side sendRawTransaction.
 * Body: `{ transaction: "<base58 signed serialized tx>" }`.
 * Used after Phantom `signTransaction` UL return (signAndSendTransaction deeplink
 * is deprecated — see https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction).
 */
export const Route = createFileRoute("/api/sol/send-raw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            transaction?: unknown;
          } | null;
          const txB58 = typeof body?.transaction === "string" ? body.transaction.trim() : "";
          if (!txB58) {
            return Response.json({ error: "transaction required" }, { status: 400 });
          }
          let bytes: Uint8Array;
          try {
            bytes = bs58.decode(txB58);
          } catch {
            return Response.json({ error: "invalid base58 transaction" }, { status: 400 });
          }
          if (!bytes.length) {
            return Response.json({ error: "empty transaction" }, { status: 400 });
          }
          const urls = resolveSolanaRpcUrls(process.env.SOLANA_RPC_URL);
          const signature = await sendRawTransactionViaRpc(urls, bytes);
          return Response.json(
            { signature },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : SOL_BROADCAST_ERROR;
          const detail =
            err instanceof Error
              ? String((err as Error & { cause?: unknown }).cause ?? err.message)
              : "unknown";
          console.warn("[sol/send-raw]", detail);
          if (message === SOL_INSUFFICIENT_FUNDS_ERROR) {
            return Response.json({ error: SOL_INSUFFICIENT_FUNDS_ERROR }, { status: 400 });
          }
          return Response.json({ error: SOL_BROADCAST_ERROR }, { status: 502 });
        }
      },
    },
  },
});

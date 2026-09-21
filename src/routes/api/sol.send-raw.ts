import { createFileRoute } from "@tanstack/react-router";
import bs58 from "bs58";
import {
  resolveSolanaRpcUrls,
  safeRpcDetail,
  sendRawTransactionViaRpc,
  solBroadcastErrorCode,
  SOL_BLOCKHASH_EXPIRED_ERROR,
  SOL_BROADCAST_ERROR,
  SOL_INSUFFICIENT_FUNDS_ERROR,
} from "@/lib/sol-recent-blockhash";

/**
 * POST /api/sol/send-raw — server-side broadcast of signed bytes via JSON-RPC `sendTransaction`.
 * Body: `{ transaction: "<base58 signed serialized tx>", lastValidBlockHeight?: number }`.
 * Used after Phantom `signTransaction` UL return (signAndSendTransaction deeplink
 * is deprecated — see https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction).
 *
 * On failure returns `{ error, code, detail? }` where `code` is BLOCKHASH_EXPIRED | INSUFFICIENT_FUNDS | BROADCAST_FAILED
 * for client toast mapping. `detail` is a short truncated RPC message (safe for logs / optional secondary toast).
 */

export const Route = createFileRoute("/api/sol/send-raw")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            transaction?: unknown;
            lastValidBlockHeight?: unknown;
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
          const lastValidBlockHeight =
            typeof body?.lastValidBlockHeight === "number" &&
            Number.isFinite(body.lastValidBlockHeight)
              ? body.lastValidBlockHeight
              : undefined;
          const urls = resolveSolanaRpcUrls(process.env.SOLANA_RPC_URL);
          const signature = await sendRawTransactionViaRpc(urls, bytes, fetch, {
            lastValidBlockHeight,
            confirm: true,
          });
          return Response.json(
            { signature },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : SOL_BROADCAST_ERROR;
          const rawDetail =
            err instanceof Error
              ? String((err as Error & { cause?: unknown }).cause ?? err.message)
              : "unknown";
          const detail = safeRpcDetail(rawDetail);
          console.warn("[sol/send-raw]", detail || rawDetail);
          const code = solBroadcastErrorCode(message);
          const payload = detail ? { detail } : {};
          if (message === SOL_INSUFFICIENT_FUNDS_ERROR) {
            return Response.json(
              { error: SOL_INSUFFICIENT_FUNDS_ERROR, code, ...payload },
              { status: 400 },
            );
          }
          if (message === SOL_BLOCKHASH_EXPIRED_ERROR) {
            return Response.json(
              { error: SOL_BLOCKHASH_EXPIRED_ERROR, code, ...payload },
              { status: 409 },
            );
          }
          return Response.json(
            { error: SOL_BROADCAST_ERROR, code, ...payload },
            { status: 502 },
          );
        }
      },
    },
  },
});

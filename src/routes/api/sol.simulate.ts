import { createFileRoute } from "@tanstack/react-router";
import bs58 from "bs58";
import {
  resolveSolanaRpcUrls,
  simulateTransactionViaRpc,
  SOL_PREPARE_TRANSFER_ERROR,
} from "@/lib/sol-recent-blockhash";

/**
 * POST /api/sol/simulate — server-side simulateTransaction (sigVerify: false,
 * replaceRecentBlockhash: true). Body: `{ transaction: "<base58 serialized tx>" }`.
 * Used before opening Phantom/Solflare sign UL so buyers get a clear toast instead
 * of the wallet "Simulation failed" sheet when the tx is bad / underfunded.
 */
export const Route = createFileRoute("/api/sol/simulate")({
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
            return Response.json(
              { ok: false, insufficientFunds: false, detail: "invalid base58 transaction" },
              { status: 400 },
            );
          }
          if (!bytes.length) {
            return Response.json(
              { ok: false, insufficientFunds: false, detail: "empty transaction" },
              { status: 400 },
            );
          }
          const urls = resolveSolanaRpcUrls(process.env.SOLANA_RPC_URL);
          const result = await simulateTransactionViaRpc(urls, bytes);
          if (result.ok) {
            return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
          }
          if (result.infraFailure) {
            console.warn("[sol/simulate] infra", result.detail);
          }
          return Response.json(
            {
              ok: false,
              insufficientFunds: result.insufficientFunds,
              detail: result.detail,
              infraFailure: Boolean(result.infraFailure),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (err) {
          const detail =
            err instanceof Error
              ? String((err as Error & { cause?: unknown }).cause ?? err.message)
              : "unknown";
          console.warn("[sol/simulate]", detail);
          return Response.json(
            {
              ok: false,
              insufficientFunds: false,
              detail: SOL_PREPARE_TRANSFER_ERROR,
              infraFailure: true,
            },
            { status: 502 },
          );
        }
      },
    },
  },
});

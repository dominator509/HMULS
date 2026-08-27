import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { settleVerifiedInvoice } from "@/lib/server/purchases";
import { verifyNowpaymentsSignature } from "@/lib/server/payments";

/**
 * NOWPayments IPN. Access grants only after HMAC verification.
 * Unsigned or unverified callbacks never settle an invoice.
 */
export const Route = createFileRoute("/api/payments/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
        if (!secret) {
          return new Response("payment verification is not configured", { status: 503 });
        }
        const raw = await request.text();
        const sig =
          request.headers.get("x-nowpayments-sig") ||
          request.headers.get("x-nowpayments-signature") ||
          "";
        if (!verifyNowpaymentsSignature(raw, sig, secret)) {
          return new Response("invalid signature", { status: 401 });
        }
        let body: {
          order_id?: string;
          payment_status?: string;
          pay_status?: string;
        } = {};
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const status = (body.payment_status || body.pay_status || "").toLowerCase();
        if (status !== "finished" && status !== "confirmed") {
          return new Response("ignored", { status: 200 });
        }
        const orderId = body.order_id?.trim();
        if (!orderId) return new Response("missing order_id", { status: 400 });
        try {
          const sql = await getSql();
          await settleVerifiedInvoice(sql, orderId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "settle failed";
          if (/already|paid/i.test(msg)) return new Response("ok", { status: 200 });
          return new Response(msg, { status: 409 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

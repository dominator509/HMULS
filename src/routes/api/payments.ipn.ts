import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { settleVerifiedInvoice } from "@/lib/server/purchases";
import { verifyNowpaymentsSignature } from "@/lib/server/payments";
import { ipnFulfillsInvoice, type IpnPayment } from "@/lib/nowpayments";

/**
 * NOWPayments IPN. Access grants only after HMAC + economic match.
 * Status must be finished. Amount, currency, order, and payment id are checked.
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
        let body: IpnPayment = {};
        try {
          body = JSON.parse(raw) as IpnPayment;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        const orderId = body.order_id?.trim();
        if (!orderId) return new Response("missing order_id", { status: 400 });
        try {
          const sql = await getSql();
          const rows = await sql<{
            id: string;
            amount_cents: number;
            asset: string;
            provider_payment_id: string | null;
            pay_address: string | null;
            status: string;
          }>`
            select id, amount_cents, asset, provider_payment_id, pay_address, status
            from invoices where id = ${orderId}
          `;
          const inv = rows[0];
          if (!inv) return new Response("unknown invoice", { status: 404 });
          const match = ipnFulfillsInvoice(body, {
            id: inv.id,
            amountCents: inv.amount_cents,
            asset: inv.asset,
            providerPaymentId: inv.provider_payment_id,
            payAddress: inv.pay_address,
          });
          if (!match.ok) return new Response(match.reason, { status: 409 });
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

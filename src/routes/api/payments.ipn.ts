import { createFileRoute } from "@tanstack/react-router";

/**
 * NOWPayments IPN (Instant Payment Notification) landing pad.
 * Production: verify `x-nowpayments-sig` HMAC, look up invoice by order_id,
 * then mark paid and write unlocks. Demo confirmations use confirmInvoice().
 */
export const Route = createFileRoute("/api/payments/ipn")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: { order_id?: string; payment_status?: string } = {};
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          return new Response("invalid json", { status: 400 });
        }
        if (body.payment_status !== "finished" && body.payment_status !== "confirmed") {
          return new Response("ignored", { status: 200 });
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

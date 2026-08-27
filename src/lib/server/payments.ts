import { createHmac, timingSafeEqual } from "node:crypto";
import { ipnCanonicalJson, type IpnPayment } from "@/lib/nowpayments";
import type { CryptoAsset } from "@/lib/types";

export function paymentsLive() {
  return Boolean(
    process.env.NOWPAYMENTS_IPN_SECRET?.trim() &&
      process.env.NOWPAYMENTS_API_KEY?.trim() &&
      process.env.NOWPAYMENTS_IPN_URL?.trim(),
  );
}

export function nowpaymentsApiKey() {
  return process.env.NOWPAYMENTS_API_KEY?.trim() || "";
}

export function verifyNowpaymentsSignature(rawBody: string, signature: string, secret: string) {
  if (!signature || !secret) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const digest = createHmac("sha512", secret).update(ipnCanonicalJson(payload)).digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type ProviderPayment = {
  address: string;
  provider: "nowpayments";
  paymentId: string;
  payAmount: string;
  payCurrency: string;
  priceAmount: number;
  expiresAt: string | null;
};

export async function createNowpaymentsPayment(opts: {
  invoiceId: string;
  asset: CryptoAsset;
  amountCents: number;
}): Promise<ProviderPayment> {
  const key = nowpaymentsApiKey();
  const ipn = process.env.NOWPAYMENTS_IPN_URL?.trim();
  if (!key || !ipn) {
    throw new Error("NOWPayments is not fully configured.");
  }
  const res = await fetch("https://api.nowpayments.io/v1/payment", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: opts.amountCents / 100,
      price_currency: "usd",
      pay_currency: opts.asset.toLowerCase(),
      order_id: opts.invoiceId,
      order_description: "SHE UNDRESSES grant",
      ipn_callback_url: ipn,
    }),
  });
  const body = (await res.json()) as {
    payment_id?: string | number;
    pay_address?: string;
    pay_amount?: string | number;
    pay_currency?: string;
    price_amount?: string | number;
    expiration_estimate_date?: string;
    message?: string;
  };
  if (!res.ok || !body.pay_address || body.payment_id == null) {
    throw new Error(body.message || "NOWPayments did not return a payment.");
  }
  return {
    address: body.pay_address,
    provider: "nowpayments",
    paymentId: String(body.payment_id),
    payAmount: String(body.pay_amount ?? ""),
    payCurrency: String(body.pay_currency || opts.asset).toLowerCase(),
    priceAmount: Number(body.price_amount ?? opts.amountCents / 100),
    expiresAt: body.expiration_estimate_date ?? null,
  };
}

export function parseIpnBody(raw: string): IpnPayment {
  return JSON.parse(raw) as IpnPayment;
}

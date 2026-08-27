import { createHmac, timingSafeEqual } from "node:crypto";
import { usdToCrypto } from "@/lib/crypto";
import type { CryptoAsset } from "@/lib/types";
import { ipnCanonicalJson } from "@/lib/nowpayments";

export function paymentsLive() {
  return Boolean(process.env.NOWPAYMENTS_IPN_SECRET?.trim());
}

export function nowpaymentsApiKey() {
  return process.env.NOWPAYMENTS_API_KEY?.trim() || "";
}

export function envPayAddress(asset: CryptoAsset) {
  const key = `PAY_ADDRESS_${asset}`;
  return process.env[key]?.trim() || "";
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

export async function quoteCrypto(cents: number, asset: CryptoAsset) {
  const key = nowpaymentsApiKey();
  if (key) {
    try {
      const usd = (cents / 100).toFixed(2);
      const to = asset.toLowerCase();
      const res = await fetch(
        `https://api.nowpayments.io/v1/estimate?amount=${usd}&currency_from=usd&currency_to=${to}`,
        { headers: { "x-api-key": key } },
      );
      if (res.ok) {
        const body = (await res.json()) as { estimated_amount?: string | number };
        if (body.estimated_amount != null) return String(body.estimated_amount);
      }
    } catch {
      /* fall through to local estimate */
    }
  }
  return usdToCrypto(cents, asset);
}

export async function resolvePayAddress(opts: {
  invoiceId: string;
  asset: CryptoAsset;
  cryptoAmount: string;
  amountCents: number;
}): Promise<{ address: string; provider: "nowpayments" | "env" | "none" }> {
  const key = nowpaymentsApiKey();
  if (key) {
    try {
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
          ipn_callback_url: process.env.NOWPAYMENTS_IPN_URL?.trim() || undefined,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { pay_address?: string };
        if (body.pay_address) return { address: body.pay_address, provider: "nowpayments" };
      }
    } catch {
      /* fall through */
    }
  }
  const env = envPayAddress(opts.asset);
  if (env) return { address: env, provider: "env" };
  return { address: "", provider: "none" };
}

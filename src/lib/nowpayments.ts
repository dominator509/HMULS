/** NOWPayments IPN signature helpers and economic match. Pure — no secrets, no I/O. */

export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o).sort()) {
      out[key] = sortObject(o[key]);
    }
    return out;
  }
  return value;
}

export function ipnCanonicalJson(body: unknown) {
  return JSON.stringify(sortObject(body));
}

export type IpnPayment = {
  payment_id?: string | number;
  payment_status?: string;
  pay_status?: string;
  order_id?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  pay_address?: string;
};

export function normalizePaymentId(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

export type InvoiceExpect = {
  id: string;
  amountCents: number;
  asset: string;
  payCurrency?: string;
  providerPaymentId?: string | null;
  payAddress?: string | null;
};

/** Accept underpays within 2% (Coinbase/rounding vs exact pay_amount). */
export const PAY_TOLERANCE = 0.98;

/**
 * NOWPayments terminal / near-terminal statuses we may settle.
 * - finished: full (or dashboard-forced) completion
 * - partially_paid: completed underpay (funds received; may never become finished)
 * - confirmed / sending: amount known on-chain / in flight to merchant
 * Never settle waiting / confirming / expired / failed / refunded here.
 */
const TOLERANT_STATUSES = new Set(["partially_paid", "confirmed", "sending"]);

function num(v: number | string | undefined) {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export type UnderpayDetail = {
  paid: number;
  due: number;
  currency: string;
};

export type FulfillResult =
  | { ok: true }
  | { ok: false; reason: string; underpaid?: UnderpayDetail };

export function paidWithinTolerance(paid: number, due: number) {
  return paid + 1e-12 >= due * PAY_TOLERANCE;
}

/** Whether payment_status alone is eligible before amount checks. */
export function settleablePaymentStatus(status: string) {
  const s = status.toLowerCase().trim();
  return s === "finished" || TOLERANT_STATUSES.has(s);
}

export function ipnFulfillsInvoice(ipn: IpnPayment, inv: InvoiceExpect): FulfillResult {
  const status = String(ipn.payment_status || ipn.pay_status || "").toLowerCase().trim();
  if (!status) return { ok: false, reason: "status missing" };
  if (status === "waiting" || status === "expired" || status === "failed" || status === "refunded") {
    return { ok: false, reason: `status ${status} is not settleable` };
  }
  if (status === "confirming") {
    return { ok: false, reason: "status confirming is not finished" };
  }
  if (!settleablePaymentStatus(status)) {
    return { ok: false, reason: `status ${status} is not finished` };
  }

  if (!ipn.order_id) return { ok: false, reason: "missing order_id" };
  if (ipn.order_id !== inv.id) return { ok: false, reason: "order_id mismatch" };

  const gotId = normalizePaymentId(ipn.payment_id);
  if (!gotId) return { ok: false, reason: "missing payment_id" };
  const wantId = normalizePaymentId(inv.providerPaymentId);
  if (!wantId) return { ok: false, reason: "invoice missing provider payment id" };
  if (gotId !== wantId) return { ok: false, reason: "payment_id mismatch" };

  const currency = String(ipn.price_currency || "").toLowerCase();
  if (!currency) return { ok: false, reason: "missing price_currency" };
  if (currency !== "usd") return { ok: false, reason: "price_currency is not usd" };

  const price = num(ipn.price_amount);
  if (price == null) return { ok: false, reason: "missing price_amount" };
  const expected = inv.amountCents / 100;
  if (Math.abs(price - expected) > 0.02) {
    return { ok: false, reason: "price_amount does not match invoice" };
  }

  const payCur = String(ipn.pay_currency || "").toLowerCase();
  if (!payCur) return { ok: false, reason: "missing pay_currency" };
  const wantCur = (inv.payCurrency || inv.asset).toLowerCase();
  if (payCur !== wantCur) return { ok: false, reason: "pay_currency mismatch" };

  const due = num(ipn.pay_amount);
  if (due == null) return { ok: false, reason: "missing pay_amount" };
  const paid = num(ipn.actually_paid);
  if (paid == null) return { ok: false, reason: "missing actually_paid" };

  if (!paidWithinTolerance(paid, due)) {
    return {
      ok: false,
      reason: "underpaid",
      underpaid: { paid, due, currency: payCur },
    };
  }

  // partially_paid / confirmed / sending only settle inside tolerance (checked above).
  // finished also requires tolerance so dashboard-forced finished underpays stay gated.

  if (!ipn.pay_address) return { ok: false, reason: "missing pay_address" };
  if (!inv.payAddress) return { ok: false, reason: "invoice missing pay address" };
  if (ipn.pay_address !== inv.payAddress) return { ok: false, reason: "pay_address mismatch" };

  return { ok: true };
}
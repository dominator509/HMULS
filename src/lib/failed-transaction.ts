/**
 * Failed-transaction report helpers (client-safe).
 * Structured tickets for stranded on-chain payments → AgentMail / contact@.
 */

import type { CryptoAsset } from "./types";

export const FAILED_TX_ASSETS: { id: CryptoAsset; label: string }[] = [
  { id: "SOL", label: "SOL (Solana)" },
  { id: "ETH", label: "ETH (Ethereum)" },
  { id: "USDT", label: "USDT (Ethereum)" },
  { id: "BTC", label: "BTC (Bitcoin)" },
];

export const FAILED_TX_CONTACT = "contact@sheundresses.com";

/** Max screenshot bytes accepted by the report endpoint (~3.5 MiB). */
export const FAILED_TX_SCREENSHOT_MAX_BYTES = 3_500_000;

export type FailedTxReportInput = {
  accountEmail: string;
  asset: CryptoAsset;
  /** Txid or full explorer URL. */
  txidOrLink: string;
  payAddress?: string;
  invoiceId?: string;
  unlockDescription?: string;
  approxTime?: string;
  timezone?: string;
  notes?: string;
  /** Honeypot — must be empty. */
  company?: string;
  /** Optional base64 screenshot (no data: prefix). */
  screenshotBase64?: string;
  screenshotFilename?: string;
  screenshotContentType?: string;
};

export type FailedTxNormalized = {
  accountEmail: string;
  asset: CryptoAsset;
  txid: string;
  txidShort: string;
  explorerUrl: string | null;
  payAddress: string;
  invoiceId: string;
  unlockDescription: string;
  approxTime: string;
  timezone: string;
  notes: string;
};

function trim(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

/** Pull a tx hash from a raw id or common explorer URL. */
export function extractTxId(raw: string): { txid: string; explorerUrl: string | null } {
  const s = trim(raw, 2000);
  if (!s) return { txid: "", explorerUrl: null };

  const asUrl = (() => {
    try {
      if (/^https?:\/\//i.test(s)) return new URL(s);
    } catch {
      /* ignore */
    }
    return null;
  })();

  if (asUrl) {
    const path = asUrl.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    // .../tx/<hash> or .../transaction/<hash>
    const txIdx = parts.findIndex((p) => p === "tx" || p === "transaction");
    if (txIdx >= 0 && parts[txIdx + 1]) {
      return { txid: parts[txIdx + 1], explorerUrl: s };
    }
    const last = parts[parts.length - 1] || "";
    if (last.length >= 16) return { txid: last, explorerUrl: s };
    return { txid: s, explorerUrl: s };
  }

  return { txid: s.replace(/\s+/g, ""), explorerUrl: null };
}

export function shortTxId(txid: string): string {
  const t = txid.trim();
  if (t.length <= 12) return t || "unknown";
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

export function isFailedTxAsset(v: unknown): v is CryptoAsset {
  return FAILED_TX_ASSETS.some((a) => a.id === v);
}

export function normalizeFailedTxReport(
  input: FailedTxReportInput,
): { ok: true; data: FailedTxNormalized } | { ok: false; error: string } {
  const accountEmail = trim(input.accountEmail, 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
    return { ok: false, error: "Enter the account email you use on this site." };
  }
  if (!isFailedTxAsset(input.asset)) {
    return { ok: false, error: "Pick the asset you sent (SOL, ETH, USDT, or BTC)." };
  }
  const { txid, explorerUrl } = extractTxId(input.txidOrLink);
  if (txid.length < 8) {
    return { ok: false, error: "Paste the transaction ID or an explorer link." };
  }

  return {
    ok: true,
    data: {
      accountEmail,
      asset: input.asset,
      txid,
      txidShort: shortTxId(txid),
      explorerUrl,
      payAddress: trim(input.payAddress, 200),
      invoiceId: trim(input.invoiceId, 120),
      unlockDescription: trim(input.unlockDescription, 500),
      approxTime: trim(input.approxTime, 120),
      timezone: trim(input.timezone, 80),
      notes: trim(input.notes, 2000),
    },
  };
}

/** Machine-parseable subject for AgentMail / watchdog. */
export function failedTxSubject(data: Pick<FailedTxNormalized, "asset" | "txidShort" | "accountEmail">): string {
  return `[FAILED-TX] ${data.asset} ${data.txidShort} ${data.accountEmail}`;
}

/** Labeled key=value body + JSON block for parsers. */
export function failedTxBody(
  data: FailedTxNormalized,
  extras?: { screenshotR2Key?: string | null; screenshotAttached?: boolean },
): string {
  const payload = {
    type: "FAILED_TX",
    account_email: data.accountEmail,
    asset: data.asset,
    txid: data.txid,
    explorer_url: data.explorerUrl,
    pay_address: data.payAddress || null,
    invoice_id: data.invoiceId || null,
    unlock_description: data.unlockDescription || null,
    approx_time: data.approxTime || null,
    timezone: data.timezone || null,
    notes: data.notes || null,
    screenshot_r2_key: extras?.screenshotR2Key || null,
    screenshot_attached: Boolean(extras?.screenshotAttached),
    policy: {
      unlock: "agent_may_settle_one_matched_invoice",
      refund: "human_approval_only_never_automatic",
      underpay_tolerance: "0.98",
    },
  };

  const lines = [
    "type=FAILED_TX",
    `account_email=${data.accountEmail}`,
    `asset=${data.asset}`,
    `txid=${data.txid}`,
    `explorer_url=${data.explorerUrl || ""}`,
    `pay_address=${data.payAddress}`,
    `invoice_id=${data.invoiceId}`,
    `unlock_description=${data.unlockDescription}`,
    `approx_time=${data.approxTime}`,
    `timezone=${data.timezone}`,
    `notes=${data.notes}`,
    `screenshot_r2_key=${extras?.screenshotR2Key || ""}`,
    `screenshot_attached=${extras?.screenshotAttached ? "true" : "false"}`,
    "policy_unlock=agent_may_settle_one_matched_invoice",
    "policy_refund=human_approval_only_never_automatic",
    "",
    "--- JSON ---",
    JSON.stringify(payload, null, 2),
  ];
  return lines.join("\n");
}

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  sendAuthEmail,
  authMailConfigured,
  AGENTMAIL_INLINE_ATTACHMENT_MAX_BYTES,
} from "@/lib/auth/send-mail.server";
import { getSessionUser } from "@/lib/auth/verify.server";
import {
  FAILED_TX_CONTACT,
  FAILED_TX_SCREENSHOT_MAX_BYTES,
  failedTxBody,
  failedTxSubject,
  normalizeFailedTxReport,
  type FailedTxReportInput,
} from "@/lib/failed-transaction";
import { putFailedTxEvidence } from "./object-store";

/** Best-effort per-isolate rate limit (Workers memory is not global). */
const recent = new Map<string, number[]>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function clientKey(): string {
  try {
    const req = getRequest();
    if (!req) return "unknown";
    const h = req.headers;
    return (
      h.get("cf-connecting-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

function rateLimited(key: string): boolean {
  const now = Date.now();
  const prev = (recent.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) {
    recent.set(key, prev);
    return true;
  }
  prev.push(now);
  recent.set(key, prev);
  return false;
}

function extForContentType(ct: string): string {
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  return "jpg";
}

export const getFailedTxPrefill = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser().catch(() => null);
  return { email: user?.email ?? null };
});

export const submitFailedTransaction = createServerFn({ method: "POST" })
  .validator((d: FailedTxReportInput) => d)
  .handler(async ({ data }) => {
    // Honeypot — pretend success so bots leave.
    if (typeof data.company === "string" && data.company.trim()) {
      return { ok: true as const, ticket: "discarded" };
    }

    const ip = clientKey();
    if (rateLimited(`ftx:${ip}`)) {
      throw new Error("Too many reports from this network. Try again in an hour, or email contact@sheundresses.com.");
    }

    const normalized = normalizeFailedTxReport(data);
    if (!normalized.ok) throw new Error(normalized.error);

    const { data: report } = normalized;
    if (rateLimited(`ftx-email:${report.accountEmail}`)) {
      throw new Error("Too many reports for that email. Try again later.");
    }

    let screenshotAttached = false;
    let screenshotR2Key: string | null = null;
    let attachment:
      | { filename: string; contentType: string; content: string }
      | undefined;

    const b64 = typeof data.screenshotBase64 === "string" ? data.screenshotBase64.trim() : "";
    if (b64) {
      // Rough size check before decode (base64 ≈ 4/3 raw).
      if (b64.length > Math.ceil(FAILED_TX_SCREENSHOT_MAX_BYTES * 1.4)) {
        throw new Error("Screenshot is too large. Use an image under about 3.5 MB.");
      }
      let bytes: Buffer;
      try {
        bytes = Buffer.from(b64, "base64");
      } catch {
        throw new Error("Could not read the screenshot. Try a PNG or JPEG.");
      }
      if (bytes.length === 0) throw new Error("Screenshot file was empty.");
      if (bytes.length > FAILED_TX_SCREENSHOT_MAX_BYTES) {
        throw new Error("Screenshot is too large. Use an image under about 3.5 MB.");
      }
      const contentType =
        typeof data.screenshotContentType === "string" && data.screenshotContentType.startsWith("image/")
          ? data.screenshotContentType.slice(0, 80)
          : "image/jpeg";
      const safeName =
        (typeof data.screenshotFilename === "string" && data.screenshotFilename.replace(/[^\w.-]+/g, "_").slice(0, 80)) ||
        `screenshot.${extForContentType(contentType)}`;
      const stamp = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const storeName = `${stamp}-${safeName}`.slice(0, 160);
      screenshotR2Key = await putFailedTxEvidence(storeName, bytes);
      // AgentMail caps the entire send JSON at 6 MB; large phone PNGs still land in R2.
      if (b64.length <= AGENTMAIL_INLINE_ATTACHMENT_MAX_BYTES) {
        attachment = { filename: safeName, contentType, content: b64 };
      } else {
        console.warn(
          "[failed-tx] screenshot stored in object store only — too large for AgentMail inline attach",
          bytes.length,
        );
      }
      screenshotAttached = true;
    }

    const subject = failedTxSubject(report);
    const text = failedTxBody(report, { screenshotR2Key, screenshotAttached });

    if (!authMailConfigured()) {
      console.error("[failed-tx] AgentMail not configured — ticket not delivered", subject);
      throw new Error(
        "We could not deliver the report right now. Email contact@sheundresses.com with your txid and screenshot.",
      );
    }

    const inbox = process.env.AGENTMAIL_INBOX?.trim();
    const recipients = [FAILED_TX_CONTACT];
    if (inbox && inbox.toLowerCase() !== FAILED_TX_CONTACT.toLowerCase()) {
      recipients.push(inbox);
    }

    const sent = await sendAuthEmail({
      to: recipients,
      subject,
      text,
      replyTo: [report.accountEmail],
      labels: ["failed-tx", "payment-recovery"],
      attachments: attachment ? [attachment] : undefined,
    });

    if (!sent.ok) {
      console.error("[failed-tx] AgentMail send failed", sent.reason, subject);
      throw new Error(
        "We could not deliver the report right now. Email contact@sheundresses.com with your txid and screenshot.",
      );
    }

    return { ok: true as const, ticket: subject };
  });

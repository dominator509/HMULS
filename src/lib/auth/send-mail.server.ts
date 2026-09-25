/**
 * Outbound mail (password reset + ops tickets). Uses AgentMail when configured.
 *
 * Cloudflare Email Routing only receives @sheundresses.com — it cannot send.
 * Set Worker secrets AGENTMAIL_API_KEY + AGENTMAIL_INBOX (e.g. sheundresses@agentmail.to)
 * to enable mail. Until then sendAuthEmail no-ops after a warn log;
 * Better Auth endpoints + UI still work once mail is wired.
 */
export type AuthMailAttachment = {
  filename: string;
  contentType: string;
  /** Base64-encoded file bytes (no data: prefix). */
  content: string;
};

export type AuthMailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string[];
  labels?: string[];
  attachments?: AuthMailAttachment[];
};

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v ? v : undefined;
}

/**
 * Production AgentMail send-from inbox (same org as AGENTMAIL_API_KEY).
 * Worker must set AGENTMAIL_INBOX; this default avoids soft-fail if only the
 * API key was configured. Inbound role mail still routes to
 * dswmarketingllc@agentmail.to via Cloudflare Email Routing.
 */
export const DEFAULT_AGENTMAIL_INBOX = "sheundresses@agentmail.to";

/** AgentMail inline (base64) send limit is 6 MB for the entire JSON request. */
export const AGENTMAIL_INLINE_REQUEST_MAX_BYTES = 6_000_000;
/** Keep headroom for subject/body/recipients when attaching base64 content. */
export const AGENTMAIL_INLINE_ATTACHMENT_MAX_BYTES = 3_500_000;

export function resolveAgentmailInbox(): string | undefined {
  return env("AGENTMAIL_INBOX") || DEFAULT_AGENTMAIL_INBOX;
}

/** True when AgentMail API key is present (inbox defaults if unset). */
export function authMailConfigured(): boolean {
  return Boolean(env("AGENTMAIL_API_KEY") && resolveAgentmailInbox());
}

/**
 * Fire-and-forget friendly: resolves when the provider accepts the message.
 * Throws only when configured and the provider rejects — callers may void+catch.
 */
export async function sendAuthEmail(
  msg: AuthMailMessage,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = env("AGENTMAIL_API_KEY");
  const inbox = resolveAgentmailInbox();
  if (!apiKey || !inbox) {
    console.warn(
      "[auth-mail] AGENTMAIL_API_KEY unset — email not sent. Wire AgentMail on the Worker.",
    );
    return { ok: false, reason: "mail_not_configured" };
  }

  const to = Array.isArray(msg.to) ? msg.to : [msg.to];
  const inboxId = encodeURIComponent(inbox);

  /** Prefer omitting oversized base64 so AgentMail's 6 MB request limit is not hit. */
  let attachments = msg.attachments;
  if (attachments?.length) {
    const tooBig = attachments.some(
      (a) => (a.content?.length || 0) > AGENTMAIL_INLINE_ATTACHMENT_MAX_BYTES,
    );
    if (tooBig) {
      console.warn(
        "[auth-mail] omitting inline attachment(s) — base64 exceeds AgentMail-safe size; rely on R2 evidence key in body",
      );
      attachments = undefined;
    }
  }

  function serialize(withAttachments: boolean): string {
    const body: Record<string, unknown> = {
      to,
      subject: msg.subject,
      text: msg.text,
    };
    if (msg.html) body.html = msg.html;
    if (msg.replyTo?.length) body.replyTo = msg.replyTo;
    if (msg.labels?.length) body.labels = msg.labels;
    if (withAttachments && attachments?.length) {
      body.attachments = attachments.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        content: a.content,
        contentDisposition: "attachment",
      }));
    }
    return JSON.stringify(body);
  }

  let payload = serialize(true);
  if (attachments?.length && payload.length > AGENTMAIL_INLINE_REQUEST_MAX_BYTES) {
    console.warn(
      `[auth-mail] omitting inline attachment(s) — serialized request ${payload.length} exceeds AgentMail ${AGENTMAIL_INLINE_REQUEST_MAX_BYTES} byte limit`,
    );
    attachments = undefined;
    payload = serialize(false);
  }

  async function post(body: string) {
    return fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });
  }

  let res = await post(payload);
  if (!res.ok && res.status === 413 && attachments?.length) {
    console.warn("[auth-mail] AgentMail 413 — retrying without inline attachments");
    attachments = undefined;
    res = await post(serialize(false));
  }

  if (!res.ok) {
    const errBody = (await res.text()).slice(0, 240);
    console.error(`[auth-mail] AgentMail ${res.status}: ${errBody}`);
    return { ok: false, reason: `agentmail_${res.status}` };
  }
  return { ok: true };
}

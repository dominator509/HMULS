/**
 * Outbound mail (password reset + ops tickets). Uses AgentMail when configured.
 *
 * Cloudflare Email Routing only receives @sheundresses.com — it cannot send.
 * Set Worker secrets AGENTMAIL_API_KEY + AGENTMAIL_INBOX (e.g. dswmarketingllc@agentmail.to)
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

/** True when AgentMail credentials are present on the Worker. */
export function authMailConfigured(): boolean {
  return Boolean(env("AGENTMAIL_API_KEY") && env("AGENTMAIL_INBOX"));
}

/**
 * Fire-and-forget friendly: resolves when the provider accepts the message.
 * Throws only when configured and the provider rejects — callers may void+catch.
 */
export async function sendAuthEmail(
  msg: AuthMailMessage,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = env("AGENTMAIL_API_KEY");
  const inbox = env("AGENTMAIL_INBOX");
  if (!apiKey || !inbox) {
    console.warn(
      "[auth-mail] AGENTMAIL_API_KEY / AGENTMAIL_INBOX unset — email not sent. Wire AgentMail on the Worker.",
    );
    return { ok: false, reason: "mail_not_configured" };
  }

  const to = Array.isArray(msg.to) ? msg.to : [msg.to];
  const inboxId = encodeURIComponent(inbox);
  const body: Record<string, unknown> = {
    to,
    subject: msg.subject,
    text: msg.text,
  };
  if (msg.html) body.html = msg.html;
  if (msg.replyTo?.length) body.replyTo = msg.replyTo;
  if (msg.labels?.length) body.labels = msg.labels;
  if (msg.attachments?.length) {
    body.attachments = msg.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      content: a.content,
      contentDisposition: "attachment",
    }));
  }

  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = (await res.text()).slice(0, 240);
    console.error(`[auth-mail] AgentMail ${res.status}: ${errBody}`);
    return { ok: false, reason: `agentmail_${res.status}` };
  }
  return { ok: true };
}

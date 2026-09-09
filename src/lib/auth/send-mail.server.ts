/**
 * Outbound mail for auth (password reset). Uses AgentMail when configured.
 *
 * Cloudflare Email Routing only receives @sheundresses.com — it cannot send.
 * Set Worker secrets AGENTMAIL_API_KEY + AGENTMAIL_INBOX (e.g. dswmarketingllc@agentmail.to)
 * to enable reset emails. Until then sendAuthEmail no-ops after a warn log;
 * Better Auth endpoints + UI still work once mail is wired.
 */
export type AuthMailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
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
export async function sendAuthEmail(msg: AuthMailMessage): Promise<{ ok: true } | { ok: false; reason: string }> {
  const apiKey = env("AGENTMAIL_API_KEY");
  const inbox = env("AGENTMAIL_INBOX");
  if (!apiKey || !inbox) {
    console.warn(
      "[auth-mail] AGENTMAIL_API_KEY / AGENTMAIL_INBOX unset — password-reset email not sent. Wire AgentMail on the Worker.",
    );
    return { ok: false, reason: "mail_not_configured" };
  }

  const inboxId = encodeURIComponent(inbox);
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      ...(msg.html ? { html: msg.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 240);
    console.error(`[auth-mail] AgentMail ${res.status}: ${body}`);
    return { ok: false, reason: `agentmail_${res.status}` };
  }
  return { ok: true };
}

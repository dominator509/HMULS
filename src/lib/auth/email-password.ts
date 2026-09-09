/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Toggle + password-reset mail live here so `server.ts` stays a thin consumer.
 * Forms use `authClient.signUp.email` / `signIn.email` / `requestPasswordReset`
 * / `resetPassword` from `@/lib/auth/client`.
 */
import { sendAuthEmail } from "./send-mail.server";

export const emailAndPasswordEnabled = true;

/** Better Auth `emailAndPassword` block (only spread when enabled). */
export const emailAndPasswordConfig = {
  enabled: true as const,
  /** Invalidate other sessions after a successful reset. */
  revokeSessionsOnPasswordReset: true,
  /**
   * Do not await send — avoids timing oracles. AgentMail is optional; see
   * `send-mail.server.ts`. Reset tokens are still minted when mail is off.
   */
  sendResetPassword: async ({
    user,
    url,
  }: {
    user: { email: string; name?: string | null };
    url: string;
    token: string;
  }) => {
    void sendAuthEmail({
      to: user.email,
      subject: "Reset your SHE UNDRESSES password",
      text: [
        "Someone requested a password reset for your SHE UNDRESSES vault.",
        "",
        `Open this link to choose a new password (expires soon):`,
        url,
        "",
        "If you did not ask for this, you can ignore this email.",
      ].join("\n"),
      html: `<p>Someone requested a password reset for your SHE UNDRESSES vault.</p><p><a href="${url}">Choose a new password</a> (link expires soon).</p><p>If you did not ask for this, you can ignore this email.</p>`,
    }).catch((err) => {
      console.error("[auth-mail] sendResetPassword failed:", err);
    });
  },
};

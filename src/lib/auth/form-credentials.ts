/**
 * Read login fields from the live form DOM.
 *
 * Wallet in-app browsers (Phantom/Solflare WKWebView / Android WebView) often
 * autofill email/password into the input nodes WITHOUT firing React `onChange`.
 * Controlled `useState` then still holds "" while the field looks filled — and
 * `authClient.signIn.email({ password: state })` posts an empty/stale password.
 * Better Auth correctly answers `INVALID_EMAIL_OR_PASSWORD`.
 *
 * Always prefer FormData / input.value at submit time over React state alone.
 */
export type LoginFormCredentials = {
  email: string;
  password: string;
  name: string;
};

export function readLoginFormCredentials(
  form: HTMLFormElement,
  fallback: Partial<LoginFormCredentials> = {},
): LoginFormCredentials {
  const fd = new FormData(form);
  const fromFd = (key: string) => {
    const v = fd.get(key);
    return typeof v === "string" ? v : "";
  };
  // Prefer named fields; fall back to type selectors if name attrs missing.
  const emailInput =
    (form.elements.namedItem("email") as HTMLInputElement | null) ??
    form.querySelector<HTMLInputElement>('input[type="email"]');
  const passwordInput =
    (form.elements.namedItem("password") as HTMLInputElement | null) ??
    form.querySelector<HTMLInputElement>('input[type="password"]');
  const nameInput =
    (form.elements.namedItem("name") as HTMLInputElement | null) ??
    form.querySelector<HTMLInputElement>('input[autocomplete="name"]');

  const emailRaw =
    emailInput?.value || fromFd("email") || fallback.email || "";
  const passwordRaw =
    passwordInput?.value || fromFd("password") || fallback.password || "";
  const nameRaw = nameInput?.value || fromFd("name") || fallback.name || "";

  return {
    email: emailRaw.trim().toLowerCase(),
    // Trim edges only — inner spaces are significant for some passwords.
    password: passwordRaw.trim(),
    name: nameRaw.trim(),
  };
}

/** Operator inbox. Override with INITIAL_ADMIN_EMAIL. Not a secret. */
export const DESIGNATED_OPERATOR_EMAIL = "doministic@gmail.com";

export function ownerEmailFromEnv() {
  return (process.env.INITIAL_ADMIN_EMAIL || DESIGNATED_OPERATOR_EMAIL).trim().toLowerCase();
}

export function ownerUserIdFromEnv() {
  return (process.env.INITIAL_ADMIN_USER_ID || "").trim();
}

export function bootstrapSecretFromEnv() {
  return (process.env.BOOTSTRAP_SECRET || "").trim();
}

function productionRuntime() {
  if (typeof process === "undefined") return false;
  if (process.env.VERCEL === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** Production never elects the first signup. Preview (no DATABASE_URL, not Vercel) may, unless an owner is configured. */
export function firstUserAdminAllowed() {
  if (productionRuntime()) return false;
  if (ownerEmailFromEnv() || ownerUserIdFromEnv() || bootstrapSecretFromEnv()) return false;
  return !process.env.DATABASE_URL?.trim();
}

export function emailMatchesOwner(email: string | null | undefined) {
  const want = ownerEmailFromEnv();
  if (!want || !email) return false;
  return email.trim().toLowerCase() === want;
}

export function userIdMatchesOwner(userId: string) {
  const want = ownerUserIdFromEnv();
  return Boolean(want) && want === userId;
}

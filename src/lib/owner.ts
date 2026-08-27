export function ownerEmailFromEnv() {
  return (process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
}

export function ownerUserIdFromEnv() {
  return (process.env.INITIAL_ADMIN_USER_ID || "").trim();
}

export function bootstrapSecretFromEnv() {
  return (process.env.BOOTSTRAP_SECRET || "").trim();
}

/** Production Postgres never elects the first random signup. Preview (no DATABASE_URL) may, unless an owner is configured. */
export function firstUserAdminAllowed() {
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

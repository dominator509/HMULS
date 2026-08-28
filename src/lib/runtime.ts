/** Deployed Vercel / production Node — never treat as the PGLite preview. */
export function isProductionRuntime() {
  if (typeof process === "undefined") return false;
  if (process.env.VERCEL === "1") return true;
  return process.env.NODE_ENV === "production";
}

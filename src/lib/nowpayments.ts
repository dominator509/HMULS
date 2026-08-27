/** NOWPayments IPN signature helpers. Pure — no secrets, no I/O. */

export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o).sort()) {
      out[key] = sortObject(o[key]);
    }
    return out;
  }
  return value;
}

export function ipnCanonicalJson(body: unknown) {
  return JSON.stringify(sortObject(body));
}

/** Normalize a price to whole non-negative cents. Pure; unit-tested. */
export function normalizePriceCents(priceCents: number): number {
  if (!Number.isFinite(priceCents)) return 0;
  return Math.max(0, Math.round(priceCents));
}

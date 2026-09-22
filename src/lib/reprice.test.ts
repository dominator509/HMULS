import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePriceCents } from "./pricing.ts";

describe("normalizePriceCents (admin reprice helper)", () => {
  it("keeps whole cents as-is", () => {
    assert.equal(normalizePriceCents(50), 50);
    assert.equal(normalizePriceCents(499), 499);
  });

  it("rounds fractional cents", () => {
    assert.equal(normalizePriceCents(49.6), 50);
    assert.equal(normalizePriceCents(49.4), 49);
  });

  it("floors negatives and non-finite input at zero", () => {
    assert.equal(normalizePriceCents(-10), 0);
    assert.equal(normalizePriceCents(NaN), 0);
    assert.equal(normalizePriceCents(Infinity), 0);
  });
});

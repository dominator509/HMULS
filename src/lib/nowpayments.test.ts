import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { ipnCanonicalJson, sortObject } from "./nowpayments.ts";
import { dropLine, rivalLine, DEFAULT_DIALS } from "./psychology.ts";

describe("nowpayments ipn canonicalization", () => {
  it("sorts keys recursively so HMAC is stable", () => {
    const body = { b: 1, a: { d: 2, c: 3 } };
    assert.equal(ipnCanonicalJson(body), '{"a":{"c":3,"d":2},"b":1}');
    const secret = "test-secret";
    const digest = createHmac("sha512", secret).update(ipnCanonicalJson(body)).digest("hex");
    const again = createHmac("sha512", secret).update(JSON.stringify(sortObject(body))).digest("hex");
    assert.equal(digest, again);
  });
});

describe("public social proof", () => {
  it("does not invent drop-off percentages", () => {
    const stored =
      "61% of collectors never see her sit. They wanted a dump. She doesn't dump.";
    const line = dropLine(4, DEFAULT_DIALS, stored);
    assert.equal(line.includes("%"), false);
    assert.match(line, /dump/i);
    assert.equal(dropLine(4, DEFAULT_DIALS, ""), "");
  });

  it("hides rival lines without a real today count", () => {
    assert.equal(rivalLine(DEFAULT_DIALS, 3, 0), "");
    assert.equal(rivalLine(DEFAULT_DIALS, 3, 2), "");
    assert.match(rivalLine(DEFAULT_DIALS, 3, 4), /4/);
  });
});

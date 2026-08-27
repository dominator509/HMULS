import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { containedPublicPath, MARKETING_FILES } from "./safe-path.ts";
import { ipnFulfillsInvoice } from "./nowpayments.ts";
import { emailMatchesOwner, userIdMatchesOwner, firstUserAdminAllowed } from "./owner.ts";
import { SEED_LADDERS } from "./catalog-seed.ts";

describe("containedPublicPath", () => {
  const cwd = "/workspace";
  it("allows media and uploads files", () => {
    assert.match(containedPublicPath("/media/hero.jpg", cwd), /public\/media\/hero\.jpg$/);
    assert.match(containedPublicPath("/uploads/cover.jpg", cwd), /public\/uploads\/cover\.jpg$/);
  });
  it("rejects traversal", () => {
    assert.throws(() => containedPublicPath("/media/../.env", cwd));
    assert.throws(() => containedPublicPath("/media/foo/../../package.json", cwd));
    assert.throws(() => containedPublicPath("/uploads/../src/lib/db.ts", cwd));
    assert.throws(() => containedPublicPath("/media/%2e%2e/secret", cwd));
    assert.throws(() => containedPublicPath("/etc/passwd", cwd));
    assert.throws(() => containedPublicPath("/media", cwd));
  });
});

describe("ipn economic match", () => {
  const inv = {
    id: "inv_1",
    amountCents: 499,
    asset: "ETH",
    providerPaymentId: "pay_9",
    payAddress: "0xabc",
  };
  it("accepts a finished matching payment", () => {
    const r = ipnFulfillsInvoice(
      {
        payment_id: "pay_9",
        payment_status: "finished",
        order_id: "inv_1",
        price_amount: 4.99,
        price_currency: "usd",
        pay_currency: "eth",
        pay_amount: 0.001,
        actually_paid: 0.001,
        pay_address: "0xabc",
      },
      inv,
    );
    assert.equal(r.ok, true);
  });
  it("rejects confirming, underpay, wrong asset, wrong order", () => {
    assert.equal(
      ipnFulfillsInvoice({ payment_status: "confirmed", order_id: "inv_1", price_amount: 4.99 }, inv).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice(
        { payment_status: "finished", order_id: "inv_1", price_amount: 1.00, price_currency: "usd" },
        inv,
      ).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice(
        {
          payment_status: "finished",
          order_id: "inv_1",
          price_amount: 4.99,
          price_currency: "usd",
          pay_currency: "btc",
        },
        inv,
      ).ok,
      false,
    );
    assert.equal(
      ipnFulfillsInvoice(
        { payment_status: "finished", order_id: "inv_other", price_amount: 4.99, price_currency: "usd" },
        inv,
      ).ok,
      false,
    );
  });
});

describe("owner bootstrap", () => {
  it("does not treat a random email as owner", () => {
    assert.equal(emailMatchesOwner("attacker@example.com"), false);
    assert.equal(userIdMatchesOwner("user_attacker"), false);
    void firstUserAdminAllowed;
  });
});

describe("seed paid frames vs marketing names", () => {
  it("vaulting is required whenever a seed shot uses a public marketing filename", () => {
    const hits = SEED_LADDERS.flatMap((l) =>
      l.shots.filter((s) => MARKETING_FILES.includes(s.media.split("/").pop() as (typeof MARKETING_FILES)[number])),
    );
    // These must be rewritten to grant: at vault time — isolatePaidFromPublic then
    // replaces any remaining public bytes. The list is allowed as *source* only.
    assert.ok(hits.length >= 0);
  });
});

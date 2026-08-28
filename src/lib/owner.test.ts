import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  emailMatchesOwner,
  firstUserAdminAllowed,
  userIdMatchesOwner,
} from "./owner.ts";

describe("owner bootstrap", () => {
  it("does not treat a random email as owner", () => {
    assert.equal(emailMatchesOwner("attacker@example.com"), false);
    assert.equal(userIdMatchesOwner("user_attacker"), false);
  });

  it("production never allows first-user administration", () => {
    const prevNode = process.env.NODE_ENV;
    const prevVercel = process.env.VERCEL;
    const prevDb = process.env.DATABASE_URL;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.VERCEL;
      delete process.env.DATABASE_URL;
      assert.equal(firstUserAdminAllowed(), false);

      process.env.VERCEL = "1";
      process.env.NODE_ENV = "development";
      assert.equal(firstUserAdminAllowed(), false);
    } finally {
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
  });
});

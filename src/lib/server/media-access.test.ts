import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorizeMediaGrant, type MediaGrantLookup } from "./media-access.ts";

function lookup(partial: Partial<MediaGrantLookup> = {}): MediaGrantLookup {
  return {
    userIdForStamp: async () => null,
    sessionUser: async () => null,
    hasUnlock: async () => false,
    isAdmin: async () => false,
    ...partial,
  };
}

describe("media grant gate", () => {
  it("returns 403 without a grant", async () => {
    const denied = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "",
      lookup: lookup(),
    });
    assert.deepEqual(denied, { ok: false, status: 403 });

    const stranger = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "",
      lookup: lookup({
        sessionUser: async () => ({ id: "user_stranger" }),
      }),
    });
    assert.deepEqual(stranger, { ok: false, status: 403 });

    const badToken = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "forged",
      lookup: lookup({
        sessionUser: async () => ({ id: "user_stranger" }),
      }),
    });
    assert.deepEqual(badToken, { ok: false, status: 403 });
  });

  it("allows an entitled collector via stamp token", async () => {
    const ok = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "GOODTOKEN",
      lookup: lookup({
        userIdForStamp: async (token, shotId) =>
          token === "GOODTOKEN" && shotId === "rev_9" ? "user_collector" : null,
      }),
    });
    assert.deepEqual(ok, { ok: true, userId: "user_collector" });
  });

  it("allows an entitled collector via session unlock", async () => {
    const ok = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "",
      lookup: lookup({
        sessionUser: async () => ({ id: "user_collector" }),
        hasUnlock: async (userId, shotId) => userId === "user_collector" && shotId === "rev_9",
      }),
    });
    assert.deepEqual(ok, { ok: true, userId: "user_collector" });
  });

  it("allows admin override and rejects non-matching stamp+session", async () => {
    const admin = await authorizeMediaGrant({
      shotId: "rev_9",
      mediaToken: "",
      lookup: lookup({
        sessionUser: async () => ({ id: "user_admin" }),
        isAdmin: async (id) => id === "user_admin",
      }),
    });
    assert.deepEqual(admin, { ok: true, userId: "user_admin" });
  });
});

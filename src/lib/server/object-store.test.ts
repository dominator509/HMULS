import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  blobWriteOptions,
  installBlobSdkForTests,
  putPrivateOriginal,
  putPublicTeaser,
  putStampCache,
  readPrivateOriginal,
  readRuntimeFile,
} from "./object-store.ts";
import { authorizeMediaGrant } from "./media-access.ts";

type Stored = {
  bytes: Buffer;
  access: "public" | "private";
  url: string;
  pathname: string;
};

describe("blob write options", () => {
  it("paid writes must request private access", () => {
    assert.deepEqual(blobWriteOptions("private").access, "private");
    assert.equal(blobWriteOptions("public").access, "public");
  });
});

describe("paid blob privacy", () => {
  const blobs = new Map<string, Stored>();
  const putCalls: Array<{ pathname: string; access: string; token?: string }> = [];
  const getCalls: Array<{ pathname: string; access: string; token?: string }> = [];
  let prevToken: string | undefined;
  let origFetch: typeof fetch;
  let anonymousBlobFetches = 0;

  const sdk = {
    async put(pathname: string, body: Buffer, opts: { access: "public" | "private"; token?: string }) {
      putCalls.push({ pathname, access: opts.access, token: opts.token });
      const url = `https://blob.vercel-storage.com/${pathname}`;
      blobs.set(pathname, { bytes: Buffer.from(body), access: opts.access, url, pathname });
      return { url, pathname };
    },
    async get(pathname: string, opts: { access: "public" | "private"; token?: string }) {
      getCalls.push({ pathname, access: opts.access, token: opts.token });
      if (!opts.token) return null;
      const hit = blobs.get(pathname);
      if (!hit) return null;
      if (hit.access === "private" && opts.access !== "private") return null;
      return { statusCode: 200 as const, stream: new Blob([new Uint8Array(hit.bytes)]).stream() };
    },
  };

  function anonymousFetchBlobUrl(url: string) {
    for (const b of blobs.values()) {
      if (b.url === url) {
        if (b.access === "private") return { ok: false, status: 401 as const };
        return { ok: true, status: 200 as const, body: b.bytes };
      }
    }
    return { ok: false, status: 404 as const };
  }

  before(() => {
    prevToken = process.env.BLOB_READ_WRITE_TOKEN;
    process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
    installBlobSdkForTests(sdk);
    origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("blob.vercel-storage.com")) {
        anonymousBlobFetches += 1;
        const headers = new Headers(init?.headers);
        if (!headers.get("authorization") && !headers.get("Authorization")) {
          return new Response("forbidden", { status: 403 });
        }
      }
      return origFetch(input as RequestInfo, init);
    }) as typeof fetch;
  });

  after(() => {
    installBlobSdkForTests(null);
    if (prevToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = prevToken;
    globalThis.fetch = origFetch;
  });

  it("uploads a production-style private original that anonymous URL fetch cannot read", async () => {
    const bytes = Buffer.from("PAID-ORIGINAL-BYTES-NOT-FOR-CDN");
    const grant = await putPrivateOriginal("audit_r4_private.jpg", bytes);
    assert.equal(grant, "grant:audit_r4_private.jpg");

    const vaultPuts = putCalls.filter((c) => c.pathname.startsWith("vault/"));
    assert.equal(vaultPuts.length > 0, true);
    assert.equal(
      vaultPuts.every((c) => c.access === "private"),
      true,
      "putPrivateOriginal must call Blob put with access: private",
    );

    const stored = [...blobs.values()].find((b) => b.pathname.startsWith("vault/"));
    assert.ok(stored);
    assert.equal(stored.access, "private");
    const anon = anonymousFetchBlobUrl(stored.url);
    assert.equal(anon.ok, false);
    assert.equal(anon.status, 401);
  });

  it("reads paid originals through authenticated get({ access: private }), not anonymous fetch", async () => {
    getCalls.length = 0;
    anonymousBlobFetches = 0;
    const got = await readPrivateOriginal("audit_r4_private.jpg");
    assert.ok(got);
    assert.equal(got.toString(), "PAID-ORIGINAL-BYTES-NOT-FOR-CDN");
    assert.equal(getCalls.length > 0, true);
    assert.equal(
      getCalls.every((c) => c.access === "private" && Boolean(c.token)),
      true,
    );
    assert.equal(anonymousBlobFetches, 0, "paid reads must not anonymous-fetch Blob CDN URLs");
  });

  it("returns 403 without a grant and serves entitled collectors from private storage", async () => {
    const denied = await authorizeMediaGrant({
      shotId: "audit_r4",
      mediaToken: "",
      lookup: {
        userIdForStamp: async () => null,
        sessionUser: async () => null,
        hasUnlock: async () => false,
        isAdmin: async () => false,
      },
    });
    assert.deepEqual(denied, { ok: false, status: 403 });

    const entitled = await authorizeMediaGrant({
      shotId: "audit_r4",
      mediaToken: "",
      lookup: {
        userIdForStamp: async () => null,
        sessionUser: async () => ({ id: "user_collector" }),
        hasUnlock: async (userId, shotId) => userId === "user_collector" && shotId === "audit_r4",
        isAdmin: async () => false,
      },
    });
    assert.deepEqual(entitled, { ok: true, userId: "user_collector" });
    const bytes = await readPrivateOriginal("audit_r4_private.jpg");
    assert.equal(bytes?.toString(), "PAID-ORIGINAL-BYTES-NOT-FOR-CDN");
  });

  it("stamp cache is private; teasers stay public", async () => {
    const stamp = Buffer.from("stamp-png");
    await putStampCache("user_collector", "shot_1", stamp);
    const stampPuts = putCalls.filter((c) => c.pathname.startsWith("stamps/"));
    assert.equal(stampPuts.length > 0, true);
    assert.equal(
      stampPuts.every((c) => c.access === "private"),
      true,
    );

    const teaser = await putPublicTeaser("/media/audit-tease.jpg", Buffer.from("teaser"));
    assert.match(teaser, /^https:\/\/blob\.vercel-storage\.com\//);
    const mediaPuts = putCalls.filter((c) => c.pathname.startsWith("media/"));
    assert.equal(
      mediaPuts.every((c) => c.access === "public"),
      true,
    );
    const teaserStored = [...blobs.values()].find((b) => b.pathname.startsWith("media/"));
    assert.ok(teaserStored);
    const anon = anonymousFetchBlobUrl(teaserStored.url);
    assert.equal(anon.ok, true);

    const stampBytes = await readRuntimeFile("stamps/user_collector/shot_1.png");
    assert.ok(stampBytes);
    assert.equal(stampBytes.toString(), "stamp-png");
  });

  it("blobPut forwards the access argument instead of hardcoding public", () => {
    const src = readFileSync(fileURLToPath(new URL("./object-store.ts", import.meta.url)), "utf8");
    assert.match(src, /blobWriteOptions\(access\)/);
    assert.doesNotMatch(src, /sdk\.put\([\s\S]{0,240}access:\s*"public"/);
    assert.match(src, /sdk\.get\(pathname, \{[\s\S]*access,/);
  });
});

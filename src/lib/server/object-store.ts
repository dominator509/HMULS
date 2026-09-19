import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants, existsSync, readdirSync } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { isProductionRuntime } from "../runtime.ts";
import { isInside } from "../safe-path.ts";

export type BlobAccess = "public" | "private";

/** Minimal R2 bucket surface (Workers binding or test double). */
export type R2BucketLike = {
  head: (key: string) => Promise<{ key: string; size: number } | null>;
  get: (
    key: string,
  ) => Promise<{
    arrayBuffer: () => Promise<ArrayBuffer>;
    body: ReadableStream | null;
  } | null>;
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

/**
 * Roots where vite `copy-private-media` (and local/dev) may place seed originals.
 * Order: cwd first, then Nitro `.output/server`, then Vercel function bundles.
 */
export function privateMediaDirCandidates(): string[] {
  const cwd = process.cwd();
  const roots: string[] = [
    resolve(cwd, "private-media"),
    resolve(cwd, ".output/server/private-media"),
    resolve(cwd, ".output/private-media"),
  ];
  const fnRoot = resolve(cwd, ".vercel/output/functions");
  if (existsSync(fnRoot)) {
    try {
      for (const ent of readdirSync(fnRoot, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        roots.push(join(fnRoot, ent.name, "private-media"));
      }
    } catch {
      /* ignore */
    }
  }
  return roots;
}

/** First existing private-media root, else cwd/private-media (for mkdir writes). */
export function privateMediaDir() {
  for (const root of privateMediaDirCandidates()) {
    if (existsSync(root)) return root;
  }
  return resolve(process.cwd(), "private-media");
}

export function runtimeDataDir() {
  if (isProductionRuntime()) return join(tmpdir(), "she-undresses-runtime");
  return resolve(process.cwd(), "data");
}

export function grantsDir() {
  return privateMediaDir();
}

export function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

/** Sanitize grant / object basenames. Rejects path escape. */
export function safeObjectKey(key: string) {
  const name = key.replace(/^grant:/, "").replace(/^\/+/, "").replace(/[^a-zA-Z0-9._/-]/g, "");
  if (!name || name.includes("..")) throw new Error("Rejected object key.");
  return name;
}

function safeKey(key: string) {
  return safeObjectKey(key);
}

/** R2 / binding object key for a paid vault original (plain basename, not Blob HMAC path). */
export function vaultObjectKey(key: string) {
  return `vault/${safeObjectKey(key)}`;
}

function stampRel(userId: string, shotId: string) {
  return `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}/${shotId}.png`;
}

/** R2 / binding object key for a stamped PNG cache entry. */
export function stampObjectKey(userId: string, shotId: string) {
  return `stamps/${stampRel(userId, shotId)}`;
}

export function r2AccountId() {
  return process.env.R2_ACCOUNT_ID?.trim() || "";
}

export function r2BucketName() {
  return process.env.R2_BUCKET?.trim() || "hmuls-vault";
}

/** Cloudflare API token for R2 REST object API (preferred secret name or alias). */
export function r2ApiToken() {
  return (
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    process.env.R2_CF_API_TOKEN?.trim() ||
    ""
  );
}

/** True when account + bucket + API token are set for the REST fallback. */
export function r2RestConfigured() {
  return Boolean(r2AccountId() && r2BucketName() && r2ApiToken());
}

let testR2Bucket: R2BucketLike | null = null;
let resolvedBinding: R2BucketLike | null | undefined;

/** Test-only. Throws outside node:test so production cannot swap the R2 client. */
export function installR2BucketForTests(bucket: R2BucketLike | null) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error("installR2BucketForTests is only available under node:test.");
  }
  testR2Bucket = bucket;
  resolvedBinding = undefined;
}

function isR2Like(value: unknown): value is R2BucketLike {
  if (!value || typeof value !== "object") return false;
  const b = value as R2BucketLike;
  return (
    typeof b.head === "function" &&
    typeof b.get === "function" &&
    typeof b.put === "function"
  );
}

/**
 * Resolve native Workers R2 binding `HMULS_VAULT` when present.
 * Soft-fails outside Cloudflare (dynamic import of cloudflare:workers).
 */
export async function resolveR2Binding(): Promise<R2BucketLike | null> {
  if (testR2Bucket) return testR2Bucket;
  if (resolvedBinding !== undefined) return resolvedBinding;
  try {
    const mod = await import(/* @vite-ignore */ "cloudflare:workers");
    const env = (mod as { env?: Record<string, unknown> }).env;
    const bucket = env?.HMULS_VAULT;
    resolvedBinding = isR2Like(bucket) ? bucket : null;
  } catch {
    resolvedBinding = null;
  }
  return resolvedBinding;
}

/**
 * R2 is usable when the Workers binding is available and/or REST token creds are set.
 * Sync: REST env or test/cached binding. Prefer `r2Ready()` when an await is fine.
 */
export function r2Configured() {
  if (testR2Bucket) return true;
  if (resolvedBinding) return true;
  return r2RestConfigured();
}

/** Async readiness: binding and/or REST. */
export async function r2Ready() {
  if (await resolveR2Binding()) return true;
  return r2RestConfigured();
}

async function exists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfInside(root: string, file: string): Promise<Buffer | null> {
  if (!isInside(root, file)) return null;
  if (!(await exists(file))) return null;
  return readFile(file);
}

function blobPathname(kind: "vault" | "stamps" | "media", name: string) {
  const token = blobToken();
  const salt = token || "preview";
  const digest = createHmac("sha256", salt).update(`${kind}:${name}`).digest("hex").slice(0, 20);
  return `${kind}/${digest}/${name}`;
}

export function blobWriteOptions(access: BlobAccess) {
  if (access !== "public" && access !== "private") {
    throw new Error("Blob access must be public or private.");
  }
  return {
    access,
    addRandomSuffix: false as const,
    allowOverwrite: true as const,
  };
}

type BlobSdk = {
  put: (
    pathname: string,
    body: Buffer,
    opts: {
      access: BlobAccess;
      token?: string;
      addRandomSuffix?: boolean;
      allowOverwrite?: boolean;
    },
  ) => Promise<{ url: string; pathname: string }>;
  get: (
    pathname: string,
    opts: { access: BlobAccess; token?: string; useCache?: boolean },
  ) => Promise<{ statusCode: 200 | 304; stream: ReadableStream<Uint8Array> | null } | null>;
  head?: (
    pathname: string,
    opts: { access: BlobAccess; token?: string },
  ) => Promise<boolean>;
};

let testBlobSdk: BlobSdk | null = null;

/** Test-only. Throws outside node:test so production cannot swap the Blob client. */
export function installBlobSdkForTests(sdk: BlobSdk | null) {
  if (!process.env.NODE_TEST_CONTEXT) {
    throw new Error("installBlobSdkForTests is only available under node:test.");
  }
  testBlobSdk = sdk;
}

/**
 * Cloudflare Workers' nodejs_compat does not implement undici's ALPNProtocols.
 * @vercel/blob's Node build imports undici fetch, so get()/put() fail at runtime with:
 *   "The options.ALPNProtocols option is not implemented"
 * Use globalThis.fetch against the public Blob HTTP API instead (Workers-safe).
 */
function storeIdFromBlobToken(token: string) {
  // vercel_blob_rw_<STORE_ID>_<SECRET>
  return token.split("_")[3] || "";
}

function constructBlobUrl(storeId: string, pathname: string, access: BlobAccess) {
  const path = pathname.replace(/^\/+/, "");
  return `https://${storeId}.${access}.blob.vercel-storage.com/${path}`;
}

function guessBlobContentType(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function isBlobSuspendedError(err: unknown) {
  const msg = String(err ?? "");
  return /suspend|transfer.?cap|hobby|quota|402|403/i.test(msg);
}

/** Encode R2 object key for REST path: keep `/` literal, encode other reserved chars. */
export function encodeR2RestObjectKey(key: string) {
  return key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

function r2RestObjectUrl(objectKey: string) {
  const account = r2AccountId();
  const bucket = r2BucketName();
  const encoded = encodeR2RestObjectKey(objectKey);
  return `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${encoded}`;
}

function r2RestListUrl(prefix: string) {
  const account = r2AccountId();
  const bucket = r2BucketName();
  const u = new URL(
    `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects`,
  );
  u.searchParams.set("prefix", prefix);
  u.searchParams.set("per_page", "1");
  return u.toString();
}

async function r2RestPut(objectKey: string, bytes: Buffer, contentType: string) {
  const token = r2ApiToken();
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN (or R2_CF_API_TOKEN) required for R2 REST put.");
  const res = await globalThis.fetch(r2RestObjectUrl(objectKey), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": contentType,
    },
    body: new Uint8Array(bytes),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`R2 REST put failed ${res.status}${msg ? `: ${msg.slice(0, 180)}` : ""}`);
  }
}

async function r2RestGet(objectKey: string): Promise<Buffer | null> {
  const token = r2ApiToken();
  if (!token) return null;
  const res = await globalThis.fetch(r2RestObjectUrl(objectKey), {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`R2 REST get failed ${res.status}${msg ? `: ${msg.slice(0, 180)}` : ""}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Existence via HEAD, else list(prefix) — never a full object GET.
 */
async function r2RestHead(objectKey: string): Promise<boolean> {
  const token = r2ApiToken();
  if (!token) return false;
  try {
    const headRes = await globalThis.fetch(r2RestObjectUrl(objectKey), {
      method: "HEAD",
      headers: { authorization: `Bearer ${token}` },
    });
    if (headRes.status === 200 || headRes.status === 204) return true;
    if (headRes.status === 404) return false;
    // Some gateways reject HEAD; fall through to list.
  } catch {
    /* try list */
  }
  try {
    const listRes = await globalThis.fetch(r2RestListUrl(objectKey), {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) return false;
    const json = (await listRes.json().catch(() => null)) as {
      success?: boolean;
      result?: Array<{ key?: string }> | { objects?: Array<{ key?: string }> };
    } | null;
    if (!json) return false;
    const items = Array.isArray(json.result)
      ? json.result
      : Array.isArray(json.result?.objects)
        ? json.result.objects
        : [];
    return items.some((o) => o.key === objectKey);
  } catch {
    return false;
  }
}

async function r2Put(objectKey: string, bytes: Buffer) {
  const contentType = guessBlobContentType(objectKey);
  const binding = await resolveR2Binding();
  if (binding) {
    await binding.put(objectKey, bytes, { httpMetadata: { contentType } });
    return;
  }
  if (r2RestConfigured()) {
    await r2RestPut(objectKey, bytes, contentType);
    return;
  }
  throw new Error("R2 is not configured (HMULS_VAULT binding or CLOUDFLARE_API_TOKEN).");
}

async function r2Get(objectKey: string): Promise<Buffer | null> {
  const binding = await resolveR2Binding();
  if (binding) {
    const obj = await binding.get(objectKey);
    if (!obj) return null;
    return Buffer.from(await obj.arrayBuffer());
  }
  if (r2RestConfigured()) return r2RestGet(objectKey);
  return null;
}

async function r2Head(objectKey: string): Promise<boolean> {
  const binding = await resolveR2Binding();
  if (binding) {
    const meta = await binding.head(objectKey);
    return meta != null;
  }
  if (r2RestConfigured()) return r2RestHead(objectKey);
  return false;
}

const nativeBlobSdk: BlobSdk = {
  async put(pathname, body, opts) {
    const token = opts.token || blobToken();
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN required for blob put.");
    const storeId = storeIdFromBlobToken(token);
    if (!storeId) throw new Error("Invalid BLOB_READ_WRITE_TOKEN (missing store id).");
    const url = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`;
    const res = await globalThis.fetch(url, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "x-api-version": "12",
        "x-vercel-blob-access": opts.access,
        "x-add-random-suffix": opts.addRandomSuffix ? "1" : "0",
        "x-allow-overwrite": opts.allowOverwrite === false ? "0" : "1",
        "x-content-type": guessBlobContentType(pathname),
        "x-vercel-blob-store-id": storeId,
        "x-api-blob-request-id": `${storeId}:${Date.now()}:${Math.random().toString(16).slice(2)}`,
        "x-api-blob-request-attempt": "0",
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(`Blob put failed ${res.status}${msg ? `: ${msg.slice(0, 180)}` : ""}`);
    }
    const json = (await res.json().catch(() => null)) as { url?: string; pathname?: string } | null;
    return {
      url: json?.url || constructBlobUrl(storeId, pathname, opts.access),
      pathname: json?.pathname || pathname,
    };
  },
  async get(pathname, opts) {
    const token = opts.token || blobToken();
    if (!token) return null;
    const storeId = storeIdFromBlobToken(token);
    if (!storeId) return null;
    let fetchUrl = constructBlobUrl(storeId, pathname, opts.access);
    if (opts.useCache === false && opts.access === "private") {
      const u = new URL(fetchUrl);
      u.searchParams.set("cache", "0");
      fetchUrl = u.toString();
    }
    const res = await globalThis.fetch(fetchUrl, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return null;
    if (res.status === 304) return { statusCode: 304 as const, stream: null };
    if (!res.ok || !res.body) return null;
    return { statusCode: 200 as const, stream: res.body };
  },
  async head(pathname, opts) {
    const token = opts.token || blobToken();
    if (!token) return false;
    const storeId = storeIdFromBlobToken(token);
    if (!storeId) return false;
    const fetchUrl = constructBlobUrl(storeId, pathname, opts.access);
    try {
      const res = await globalThis.fetch(fetchUrl, {
        method: "HEAD",
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.status === 404) return false;
      return res.ok;
    } catch {
      return false;
    }
  },
};

async function loadBlobSdk(): Promise<BlobSdk> {
  if (testBlobSdk) return testBlobSdk;
  return nativeBlobSdk;
}

async function blobPut(pathname: string, bytes: Buffer, access: BlobAccess) {
  const token = blobToken();
  if (!token) return null;
  const sdk = await loadBlobSdk();
  const res = await sdk.put(pathname, bytes, { ...blobWriteOptions(access), token });
  if (access === "private") {
    // Paid objects are never handed out as CDN URLs. Read via blobRead / get({ access: "private" }).
    return { access: "private" as const, pathname: res.pathname || pathname, url: null as string | null };
  }
  return { access: "public" as const, pathname: res.pathname || pathname, url: res.url };
}

async function blobRead(kind: "vault" | "stamps" | "media", name: string): Promise<Buffer | null> {
  const token = blobToken();
  if (!token) return null;
  try {
    const sdk = await loadBlobSdk();
    const pathname = blobPathname(kind, name);
    const access: BlobAccess = kind === "media" ? "public" : "private";
    const result = await sdk.get(pathname, {
      access,
      token,
      useCache: kind !== "stamps",
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  } catch (err) {
    if (isBlobSuspendedError(err)) return null;
    return null;
  }
}

async function blobExists(kind: "vault" | "stamps" | "media", name: string): Promise<boolean> {
  const token = blobToken();
  if (!token) return false;
  try {
    const sdk = await loadBlobSdk();
    const pathname = blobPathname(kind, name);
    const access: BlobAccess = kind === "media" ? "public" : "private";
    if (typeof sdk.head === "function") {
      return sdk.head(pathname, { access, token });
    }
    // Test doubles without head: do not full-download in production path.
    return false;
  } catch (err) {
    if (isBlobSuspendedError(err)) return false;
    return false;
  }
}

export async function readPrivateOriginal(key: string): Promise<Buffer | null> {
  const name = safeKey(key);
  const fromDisk = await readDiskBundledOriginal(name);
  if (fromDisk) return fromDisk;

  try {
    const fromR2 = await r2Get(vaultObjectKey(name));
    if (fromR2) return fromR2;
  } catch (err) {
    console.error("[object-store] R2 read failed", name, err);
  }

  try {
    const fromBlob = await blobRead("vault", name);
    if (fromBlob) return fromBlob;
  } catch (err) {
    if (!isBlobSuspendedError(err)) console.error("[object-store] Blob read failed", name, err);
  }

  const legacyGrant = join(process.cwd(), "data", "grants", name);
  const grantBytes = await readFileIfInside(join(process.cwd(), "data", "grants"), legacyGrant);
  if (grantBytes) return grantBytes;

  const orig = join(process.cwd(), "data", "originals", name);
  const origBytes = await readFileIfInside(join(process.cwd(), "data", "originals"), orig);
  if (origBytes) return origBytes;

  const runtimeOrig = join(runtimeDataDir(), "originals", name);
  const runtimeBytes = await readFileIfInside(join(runtimeDataDir(), "originals"), runtimeOrig);
  if (runtimeBytes) return runtimeBytes;

  return null;
}

/** Existence without downloading object bodies (disk / R2 HEAD|list / Blob HEAD). */
export async function privateOriginalExists(key: string) {
  const name = safeKey(key);
  if (resolveBundledOriginal(name)) return true;
  try {
    if (await r2Head(vaultObjectKey(name))) return true;
  } catch {
    /* continue */
  }
  try {
    if (await blobExists("vault", name)) return true;
  } catch {
    /* continue */
  }
  const legacyGrant = join(process.cwd(), "data", "grants", name);
  if (isInside(join(process.cwd(), "data", "grants"), legacyGrant) && (await exists(legacyGrant))) {
    return true;
  }
  const orig = join(process.cwd(), "data", "originals", name);
  if (isInside(join(process.cwd(), "data", "originals"), orig) && (await exists(orig))) {
    return true;
  }
  const runtimeOrig = join(runtimeDataDir(), "originals", name);
  if (isInside(join(runtimeDataDir(), "originals"), runtimeOrig) && (await exists(runtimeOrig))) {
    return true;
  }
  return false;
}

export async function putPrivateOriginal(name: string, bytes: Buffer) {
  const key = safeKey(name);
  if (await r2Ready()) {
    await r2Put(vaultObjectKey(key), bytes);
    return `grant:${key}`;
  }
  const token = blobToken();
  if (token) {
    try {
      const stored = await blobPut(blobPathname("vault", key), bytes, "private");
      if (!stored || stored.access !== "private") {
        throw new Error("Refusing to persist a paid original without private blob access.");
      }
      return `grant:${key}`;
    } catch (err) {
      if (isBlobSuspendedError(err)) {
        throw new Error(
          "Vercel Blob is unavailable (suspended/transfer cap). Configure R2 (HMULS_VAULT binding or CLOUDFLARE_API_TOKEN).",
        );
      }
      throw err;
    }
  }
  if (isProductionRuntime()) {
    throw new Error(
      "R2 (HMULS_VAULT / CLOUDFLARE_API_TOKEN) or BLOB_READ_WRITE_TOKEN is required to store new paid originals in production. Seed originals ship in private-media/.",
    );
  }
  await writeRuntimeFile(`originals/${key}`, bytes);
  const bundled = join(privateMediaDir(), key);
  if (isInside(privateMediaDir(), bundled)) {
    await mkdir(dirname(bundled), { recursive: true });
    await writeFile(bundled, bytes);
  }
  return `grant:${key}`;
}

export async function putPublicTeaser(relUrl: string, bytes: Buffer) {
  const url = relUrl.startsWith("/") ? relUrl : `/${relUrl}`;
  if (!url.startsWith("/media/")) throw new Error("Public teasers must live under /media.");
  const name = url.replace(/^\/media\//, "");
  const token = blobToken();
  if (token) {
    const stored = await blobPut(blobPathname("media", name), bytes, "public");
    return stored?.url || url;
  }
  if (isProductionRuntime()) {
    throw new Error("Cannot write public teasers on a read-only production filesystem. Commit teasers or set BLOB_READ_WRITE_TOKEN.");
  }
  const dest = join(process.cwd(), "public", "media", name);
  if (!isInside(join(process.cwd(), "public", "media"), dest)) throw new Error("Rejected teaser path.");
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return url;
}

export async function writeRuntimeFile(rel: string, bytes: Buffer) {
  const name = safeKey(rel);
  const root = runtimeDataDir();
  const dest = join(root, name);
  if (!isInside(root, dest)) throw new Error("Rejected runtime path.");
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return dest;
}

export async function readRuntimeFile(rel: string): Promise<Buffer | null> {
  const name = safeKey(rel);
  if (name.startsWith("stamps/")) {
    const stampKey = name; // already stamps/<user>/<shot>.png
    try {
      const fromR2 = await r2Get(stampKey);
      if (fromR2) return fromR2;
    } catch {
      /* fall through */
    }
    const fromBlob = await blobRead("stamps", name.slice("stamps/".length));
    if (fromBlob) return fromBlob;
  }
  const root = runtimeDataDir();
  const dest = join(root, name);
  return readFileIfInside(root, dest);
}

export async function putStampCache(userId: string, shotId: string, bytes: Buffer) {
  const rel = `stamps/${stampRel(userId, shotId)}`;
  if (await r2Ready()) {
    try {
      await r2Put(stampObjectKey(userId, shotId), bytes);
    } catch (err) {
      console.error("[object-store] R2 stamp put failed", err);
    }
  } else {
    const token = blobToken();
    if (token) {
      try {
        const stored = await blobPut(blobPathname("stamps", stampRel(userId, shotId)), bytes, "private");
        if (stored && stored.access !== "private") {
          throw new Error("Refusing to cache a stamp that is not private.");
        }
      } catch (err) {
        if (/not private/i.test(String(err))) throw err;
      }
    }
  }
  return writeRuntimeFile(rel, bytes);
}

export function resolveBundledOriginal(key: string) {
  const name = safeKey(key);
  for (const root of privateMediaDirCandidates()) {
    const bundled = join(root, name);
    if (isInside(root, bundled) && existsSync(bundled)) return bundled;
  }
  return null;
}

/** Known seed grant filenames shipped in private-media/ (rev/crv/ped ladders). */
export function seedVaultOriginalFilenames(): string[] {
  const out: string[] = [];
  for (const prefix of ["rev", "crv", "ped"] as const) {
    for (let i = 1; i <= 9; i++) {
      if (prefix === "rev" && i === 6) out.push("rev_6.mp4");
      else out.push(`${prefix}_${i}.jpg`);
    }
  }
  return out;
}

async function readDiskBundledOriginal(name: string): Promise<Buffer | null> {
  const key = safeKey(name);
  for (const root of privateMediaDirCandidates()) {
    const bundled = join(root, key);
    const bytes = await readFileIfInside(root, bundled);
    if (bytes) return bytes;
  }
  return null;
}

async function listSeedVaultCandidates(): Promise<string[]> {
  const set = new Set(seedVaultOriginalFilenames());
  for (const root of privateMediaDirCandidates()) {
    try {
      const names = await readdir(root);
      for (const n of names) {
        if (!/\.(jpe?g|png|webp|mp4|webm)$/i.test(n)) continue;
        if (n.includes("..") || n.includes("/") || n.includes("\\")) continue;
        set.add(n);
      }
    } catch {
      /* Cloudflare Worker / read-only deploy may have no private-media disk. */
    }
  }
  return [...set].sort();
}

/**
 * Bootstrap git private-media/ seed originals into R2 (preferred) or private Vercel Blob.
 * Idempotent: if the vault object already exists (HEAD), skip (never overwrite studio uploads).
 * No-ops without R2 or BLOB_READ_WRITE_TOKEN. Does not throw on per-file failures.
 */
export async function syncBundledVaultOriginals(): Promise<{
  uploaded: string[];
  skipped: string[];
  missing: string[];
}> {
  const uploaded: string[] = [];
  const skipped: string[] = [];
  const missing: string[] = [];
  const ready = (await r2Ready()) || Boolean(blobToken());
  if (!ready) {
    return { uploaded, skipped, missing };
  }
  const names = await listSeedVaultCandidates();
  for (const name of names) {
    try {
      if (await privateOriginalExists(name)) {
        skipped.push(name);
        continue;
      }
      const bytes = await readDiskBundledOriginal(name);
      if (!bytes || bytes.length < 32) {
        missing.push(name);
        continue;
      }
      await putPrivateOriginal(name, bytes);
      uploaded.push(name);
    } catch (err) {
      console.error("[vault-sync] file failed", name, err);
      missing.push(name);
    }
  }
  return { uploaded, skipped, missing };
}

/** @deprecated Alias — prefer syncBundledVaultOriginals (R2 first, Blob fallback). */
export async function syncBundledVaultOriginalsToBlob() {
  return syncBundledVaultOriginals();
}

/** Sync a single bundled seed original (e.g. first /api/media miss after deploy). */
export async function syncBundledVaultOriginal(
  filename: string,
): Promise<"uploaded" | "skipped" | "missing" | "noop"> {
  const ready = (await r2Ready()) || Boolean(blobToken());
  if (!ready) return "noop";
  let name: string;
  try {
    name = safeKey(filename);
  } catch {
    return "missing";
  }
  try {
    if (await privateOriginalExists(name)) return "skipped";
    const bytes = await readDiskBundledOriginal(name);
    if (!bytes || bytes.length < 32) return "missing";
    await putPrivateOriginal(name, bytes);
    return "uploaded";
  } catch (err) {
    console.error("[vault-sync] single file failed", name, err);
    return "missing";
  }
}

/** @deprecated Alias — prefer syncBundledVaultOriginal. */
export async function syncBundledVaultOriginalToBlob(filename: string) {
  return syncBundledVaultOriginal(filename);
}

/** Materialize a paid original to a local path FFmpeg can read. */
export async function materializeOriginal(key: string): Promise<string | null> {
  const name = safeKey(key);
  const bundled = resolveBundledOriginal(name);
  if (bundled && (await exists(bundled))) return bundled;
  const bytes = await readPrivateOriginal(name);
  if (!bytes) return null;
  return writeRuntimeFile(`originals/${name}`, bytes);
}
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { isProductionRuntime } from "../runtime.ts";
import { isInside } from "../safe-path.ts";

export type BlobAccess = "public" | "private";

export function privateMediaDir() {
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

function safeKey(key: string) {
  const name = key.replace(/^grant:/, "").replace(/^\/+/, "").replace(/[^a-zA-Z0-9._/-]/g, "");
  if (!name || name.includes("..")) throw new Error("Rejected object key.");
  return name;
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
  } catch {
    return null;
  }
}

export async function readPrivateOriginal(key: string): Promise<Buffer | null> {
  const name = safeKey(key);
  const bundled = join(privateMediaDir(), name);
  const fromDisk = await readFileIfInside(privateMediaDir(), bundled);
  if (fromDisk) return fromDisk;

  const fromBlob = await blobRead("vault", name);
  if (fromBlob) return fromBlob;

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

export async function privateOriginalExists(key: string) {
  return (await readPrivateOriginal(key)) != null;
}

export async function putPrivateOriginal(name: string, bytes: Buffer) {
  const key = safeKey(name);
  const token = blobToken();
  if (token) {
    const stored = await blobPut(blobPathname("vault", key), bytes, "private");
    if (!stored || stored.access !== "private") {
      throw new Error("Refusing to persist a paid original without private blob access.");
    }
    return `grant:${key}`;
  }
  if (isProductionRuntime()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is required to store new paid originals in production. Seed originals ship in private-media/.",
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
  const fromBlob = name.startsWith("stamps/")
    ? await blobRead("stamps", name.slice("stamps/".length))
    : null;
  if (fromBlob) return fromBlob;
  const root = runtimeDataDir();
  const dest = join(root, name);
  return readFileIfInside(root, dest);
}

function stampRel(userId: string, shotId: string) {
  return `${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}/${shotId}.png`;
}

export async function putStampCache(userId: string, shotId: string, bytes: Buffer) {
  const rel = `stamps/${stampRel(userId, shotId)}`;
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
  return writeRuntimeFile(rel, bytes);
}

export function resolveBundledOriginal(key: string) {
  const name = safeKey(key);
  const bundled = join(privateMediaDir(), name);
  return isInside(privateMediaDir(), bundled) ? bundled : null;
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
  const bundled = join(privateMediaDir(), key);
  return readFileIfInside(privateMediaDir(), bundled);
}

async function listSeedVaultCandidates(): Promise<string[]> {
  const set = new Set(seedVaultOriginalFilenames());
  try {
    const names = await readdir(privateMediaDir());
    for (const n of names) {
      if (!/\.(jpe?g|png|webp|mp4|webm)$/i.test(n)) continue;
      if (n.includes("..") || n.includes("/") || n.includes("\\")) continue;
      set.add(n);
    }
  } catch {
    /* Cloudflare Worker / read-only deploy may have no private-media disk. */
  }
  return [...set].sort();
}

/**
 * Bootstrap git private-media/ seed originals into private Vercel Blob.
 * Idempotent: if the vault blob already exists, skip (never overwrite studio uploads).
 * No-ops without BLOB_READ_WRITE_TOKEN. Does not throw on per-file failures.
 */
export async function syncBundledVaultOriginalsToBlob(): Promise<{
  uploaded: string[];
  skipped: string[];
  missing: string[];
}> {
  const uploaded: string[] = [];
  const skipped: string[] = [];
  const missing: string[] = [];
  if (!blobToken()) {
    return { uploaded, skipped, missing };
  }
  const names = await listSeedVaultCandidates();
  for (const name of names) {
    try {
      const inBlob = await blobRead("vault", name);
      if (inBlob) {
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

/** Sync a single bundled seed original (e.g. first /api/media miss after deploy). */
export async function syncBundledVaultOriginalToBlob(
  filename: string,
): Promise<"uploaded" | "skipped" | "missing" | "noop"> {
  if (!blobToken()) return "noop";
  let name: string;
  try {
    name = safeKey(filename);
  } catch {
    return "missing";
  }
  try {
    if (await blobRead("vault", name)) return "skipped";
    const bytes = await readDiskBundledOriginal(name);
    if (!bytes || bytes.length < 32) return "missing";
    await putPrivateOriginal(name, bytes);
    return "uploaded";
  } catch (err) {
    console.error("[vault-sync] single file failed", name, err);
    return "missing";
  }
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
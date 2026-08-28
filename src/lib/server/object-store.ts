import { access, mkdir, readFile, writeFile } from "node:fs/promises";
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

async function loadBlobSdk(): Promise<BlobSdk> {
  if (testBlobSdk) return testBlobSdk;
  const mod = await import("@vercel/blob");
  return { put: mod.put as BlobSdk["put"], get: mod.get as BlobSdk["get"] };
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

/** Materialize a paid original to a local path FFmpeg can read. */
export async function materializeOriginal(key: string): Promise<string | null> {
  const name = safeKey(key);
  const bundled = resolveBundledOriginal(name);
  if (bundled && (await exists(bundled))) return bundled;
  const bytes = await readPrivateOriginal(name);
  if (!bytes) return null;
  return writeRuntimeFile(`originals/${name}`, bytes);
}

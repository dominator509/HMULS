import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { privateMediaDir, runtimeDataDir, materializeOriginal, readPrivateOriginal } from "./object-store";

const exec = promisify(execFile);
const FFMPEG = "/usr/local/bin/ffmpeg";
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const MAGIC = Buffer.from("SHE1");
const TOKEN_LEN = 10;
const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function mintToken() {
  const bytes = randomBytes(TOKEN_LEN);
  let s = "";
  for (const b of bytes) s += ALPHA[b % ALPHA.length];
  return s;
}

function crc16(buf: Buffer) {
  let c = 0xffff;
  for (const b of buf) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 1 ? (c >>> 1) ^ 0x8408 : c >>> 1;
  }
  return c & 0xffff;
}

export function payloadOf(token: string) {
  const t = Buffer.from(token, "ascii");
  const crc = Buffer.alloc(2);
  crc.writeUInt16BE(crc16(t));
  return Buffer.concat([MAGIC, t, crc]);
}

export function tokenFromPayload(buf: Buffer) {
  if (buf.length < 16) return null;
  if (!buf.subarray(0, 4).equals(MAGIC)) return null;
  const token = buf.subarray(4, 14).toString("ascii");
  if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{10}$/.test(token)) return null;
  const crc = buf.readUInt16BE(14);
  if (crc !== crc16(Buffer.from(token, "ascii"))) return null;
  return token;
}

export function embedLsb(rgb: Buffer, payload: Buffer) {
  const bits = payload.length * 8;
  const stride = 3;
  const out = Buffer.from(rgb);
  for (let i = 0; i < bits; i++) {
    const pi = (64 + i) * stride + 2;
    if (pi >= out.length) break;
    const bit = (payload[i >> 3] >> (7 - (i & 7))) & 1;
    out[pi] = (out[pi] & 0xfe) | bit;
  }
  return out;
}

export function extractLsb(rgb: Buffer, bytes = 16) {
  const stride = 3;
  const out = Buffer.alloc(bytes);
  for (let i = 0; i < bytes * 8; i++) {
    const pi = (64 + i) * stride + 2;
    if (pi >= rgb.length) break;
    const bit = rgb[pi] & 1;
    out[i >> 3] |= bit << (7 - (i & 7));
  }
  return tokenFromPayload(out);
}

/** Odd/even cell-mean bits. Light JPEG may keep this; crop often does not. */
export function embedSpatial(rgb: Buffer, w: number, h: number, payload: Buffer) {
  const out = Buffer.from(rgb);
  const cols = 16;
  const rows = 8;
  const cw = Math.max(8, Math.floor(w / cols));
  const ch = Math.max(8, Math.floor(h / rows));
  const bits = payload.length * 8;
  for (let i = 0; i < bits && i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bit = (payload[i >> 3] >> (7 - (i & 7))) & 1;
    const x0 = col * cw;
    const y0 = row * ch;
    const idx = ((y0 + 2) * w + (x0 + 2)) * 3 + 1;
    if (idx >= out.length) continue;
    const cur = out[idx];
    const wantOdd = bit === 1;
    if ((cur % 2 === 1) !== wantOdd) {
      out[idx] = cur === 0 ? 1 : cur - 1;
    }
  }
  return out;
}

export function extractSpatial(rgb: Buffer, w: number, h: number, bytes = 16) {
  const cols = 16;
  const rows = 8;
  const cw = Math.max(8, Math.floor(w / cols));
  const ch = Math.max(8, Math.floor(h / rows));
  const out = Buffer.alloc(bytes);
  for (let i = 0; i < bytes * 8 && i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = col * cw;
    const y0 = row * ch;
    const idx = ((y0 + 2) * w + (x0 + 2)) * 3 + 1;
    if (idx >= rgb.length) break;
    const bit = rgb[idx] % 2 === 1 ? 1 : 0;
    out[i >> 3] |= bit << (7 - (i & 7));
  }
  return tokenFromPayload(out);
}

function publicFile(url: string) {
  if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/api/")) return null;
  const full = resolve(join(process.cwd(), "public", url.replace(/^\/+/, "")));
  const root = resolve(join(process.cwd(), "public"));
  if (full !== root && !full.startsWith(root + "/")) return null;
  return full;
}

export function originalsDir() {
  return join(runtimeDataDir(), "originals");
}

export function stampsDir() {
  return join(runtimeDataDir(), "stamps");
}

export function grantsDir() {
  return privateMediaDir();
}

function under(root: string, file: string) {
  const r = resolve(root);
  const f = resolve(file);
  return f === r || f.startsWith(r + "/");
}

/** Resolve a DB media_url (grant:…, /media/…, or a leftover public path) to a file. */
export function resolveMediaPath(mediaUrl: string) {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith("grant:")) {
    const name = mediaUrl.slice(6).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name) return null;
    const full = join(privateMediaDir(), name);
    return under(privateMediaDir(), full) ? full : null;
  }
  if (mediaUrl.startsWith("/grants/")) {
    const full = join(privateMediaDir(), mediaUrl.replace(/^\/grants\//, ""));
    return under(privateMediaDir(), full) ? full : null;
  }
  const pub = publicFile(mediaUrl);
  if (pub) return pub;
  const orig = join(originalsDir(), mediaUrl.replace(/^\/+/, ""));
  return under(originalsDir(), orig) ? orig : null;
}

export async function copyOriginal(mediaUrl: string) {
  const local = await materializeOriginal(mediaUrl);
  if (local) return local;
  const src = resolveMediaPath(mediaUrl);
  if (!src) return mediaUrl;
  if (mediaUrl.startsWith("grant:")) return src;
  const dest = join(originalsDir(), mediaUrl.replace(/^\/+/, ""));
  if (!under(originalsDir(), dest)) return src;
  await mkdir(dirname(dest), { recursive: true });
  try {
    await writeFile(dest, await readFile(src), { flag: "wx" });
  } catch {
    /* already copied */
  }
  return dest;
}

async function probe(path: string) {
  const msg = await new Promise<string>((resolve) => {
    execFile(FFMPEG, ["-hide_banner", "-i", path], { timeout: 15000 }, (err, _out, stderr) => {
      resolve(`${stderr || ""} ${err instanceof Error ? err.message : ""}`);
    });
  });
  const m = msg.match(/(\d{2,5})x(\d{2,5})/);
  if (m) return { w: Number(m[1]), h: Number(m[2]) };
  throw new Error("Could not read frame size.");
}

async function toRgb(path: string, w: number, h: number) {
  const { stdout } = await exec(
    FFMPEG,
    ["-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-vframes", "1", "pipe:1"],
    { encoding: "buffer", maxBuffer: w * h * 3 + 65_536, timeout: 20000 },
  );
  const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  return buf.subarray(0, w * h * 3);
}

async function fromRgb(rgb: Buffer, w: number, h: number, dest: string) {
  const tmp = join(tmpdir(), `st_${randomBytes(4).toString("hex")}.rgb`);
  await writeFile(tmp, rgb);
  try {
    await exec(
      FFMPEG,
      ["-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${w}x${h}`, "-i", tmp, "-frames:v", "1", dest],
      { timeout: 20000 },
    );
  } finally {
    await writeFile(tmp, Buffer.alloc(0)).catch(() => undefined);
  }
}

async function drawVisible(src: string, dest: string, token: string) {
  try {
    await exec(
      FFMPEG,
      [
        "-y",
        "-i",
        src,
        "-vf",
        `drawtext=fontfile=${FONT}:text='SHE ${token.slice(-4)}':fontcolor=white@0.12:fontsize=18:x=w-tw-24:y=h-th-18`,
        dest,
      ],
      { timeout: 20000 },
    );
    return dest;
  } catch {
    return src;
  }
}

export async function stampStill(opts: {
  sourcePath: string;
  destPath: string;
  token: string;
  visible: boolean;
}) {
  await mkdir(dirname(opts.destPath), { recursive: true });
  const { w, h } = await probe(opts.sourcePath);
  const rgb = await toRgb(opts.sourcePath, w, h);
  const payload = payloadOf(opts.token);
  const marked = embedSpatial(embedLsb(rgb, payload), w, h, payload);
  const mid = join(tmpdir(), `st_${opts.token}.png`);
  await fromRgb(marked, w, h, mid);
  if (opts.visible) {
    const out = await drawVisible(mid, opts.destPath, opts.token);
    if (out !== opts.destPath) await writeFile(opts.destPath, await readFile(out));
  } else {
    await writeFile(opts.destPath, await readFile(mid));
  }
  return opts.destPath;
}

export async function extractFromFile(path: string) {
  try {
    const { w, h } = await probe(path);
    const rgb = await toRgb(path, w, h);
    return extractLsb(rgb) ?? extractSpatial(rgb, w, h);
  } catch {
    return null;
  }
}

export async function extractFromBuffer(bytes: Buffer) {
  const tmp = join(tmpdir(), `leak_${randomBytes(6).toString("hex")}${guessExt(bytes)}`);
  await writeFile(tmp, bytes);
  try {
    return await extractFromFile(tmp);
  } finally {
    await writeFile(tmp, Buffer.alloc(0)).catch(() => undefined);
  }
}

function guessExt(bytes: Buffer) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return ".png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return ".jpg";
  return ".bin";
}

export function cachePath(userId: string, shotId: string) {
  return join(stampsDir(), userId.replace(/[^a-zA-Z0-9_-]/g, "_"), `${shotId}.png`);
}

export function isVideoUrl(url: string, mediaType: string) {
  return mediaType === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

export { extname, materializeOriginal, readPrivateOriginal };

import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import { SEE_FRAMES_SYSTEM, seeFramesUserMessage } from "@/lib/prompt-pack";

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return "";
  return text.slice(start, end + 1);
}

const execFileAsync = promisify(execFile);

export type VisionShot = {
  id: string;
  step: number;
  title: string;
  mediaType: string;
  mediaUrl: string;
};

export type SeenBeat = { id: string; visualBeat: string; error?: string };

function isVideo(url: string, mediaType: string) {
  if (mediaType === "video") return true;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

async function ffmpegStill(input: string) {
  const out = join(tmpdir(), `see_${randomBytes(6).toString("hex")}.jpg`);
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      "0.6",
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      "scale='min(768,iw)':-2",
      "-q:v",
      "5",
      out,
    ],
    { timeout: 20000 },
  );
  const bytes = await readFile(out);
  await unlink(out).catch(() => undefined);
  return bytes;
}

async function loadFrameBytes(url: string, mediaType: string): Promise<Buffer> {
  const { resolveMediaPath } = await import("./stamp.server");
  const local = resolveMediaPath(url);
  if (local) {
    if (isVideo(url, mediaType)) return ffmpegStill(local);
    try {
      return await ffmpegStill(local);
    } catch {
      return readFile(local);
    }
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Media must be a public /media path or https URL.");
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch media (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (isVideo(url, mediaType)) {
    const tmp = join(tmpdir(), `see_in_${randomBytes(6).toString("hex")}${extname(url) || ".mp4"}`);
    await writeFile(tmp, buf);
    try {
      return await ffmpegStill(tmp);
    } finally {
      await unlink(tmp).catch(() => undefined);
    }
  }
  return buf;
}

export async function frameDataUrl(url: string, mediaType: string) {
  const bytes = await loadFrameBytes(url, mediaType);
  const b64 = bytes.toString("base64");
  return `data:image/jpeg;base64,${b64}`;
}

export function parseSeen(text: string): { looks: string; shots: { id: string; visualBeat: string }[] } {
  try {
    const json = JSON.parse(extractJson(text) || "{}") as {
      looks?: string;
      shots?: { id?: string; visualBeat?: string; visual_beat?: string }[];
    };
    const shots = (json.shots ?? [])
      .map((s) => ({
        id: (s.id ?? "").trim(),
        visualBeat: (s.visualBeat ?? s.visual_beat ?? "").trim(),
      }))
      .filter((s) => s.id && s.visualBeat);
    return { looks: (json.looks ?? "").trim(), shots };
  } catch {
    return { looks: "", shots: [] };
  }
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function grokVision(system: string, parts: ContentPart[], maxTokens: number) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "Grok is not available in this environment." };
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0.4,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: parts },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false as const, error: `Grok vision error ${res.status}${err ? `: ${err.slice(0, 180)}` : ""}` };
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
}

async function seeBatch(museName: string, ladderTitle: string, theme: string, batch: VisionShot[]) {
  const parts: ContentPart[] = [
    {
      type: "text",
      text: seeFramesUserMessage({
        museName,
        ladderTitle,
        theme,
        shots: batch.map((s) => ({
          id: s.id,
          step: s.step,
          title: s.title,
          mediaType: s.mediaType,
        })),
      }),
    },
  ];
  const failed: SeenBeat[] = [];
  for (const s of batch) {
    try {
      const url = await frameDataUrl(s.mediaUrl, s.mediaType);
      parts.push({ type: "text", text: `Shot ${s.step} id=${s.id} "${s.title}"` });
      parts.push({ type: "image_url", image_url: { url } });
    } catch (err) {
      failed.push({
        id: s.id,
        visualBeat: "",
        error: err instanceof Error ? err.message : "Could not read frame.",
      });
    }
  }
  if (parts.length <= 1) {
    return { looks: "", shots: [] as { id: string; visualBeat: string }[], failed };
  }
  const grok = await grokVision(SEE_FRAMES_SYSTEM, parts, 1600);
  if (!grok.ok) {
    return {
      looks: "",
      shots: [] as { id: string; visualBeat: string }[],
      failed: [
        ...failed,
        ...batch
          .filter((s) => !failed.some((f) => f.id === s.id))
          .map((s) => ({ id: s.id, visualBeat: "", error: grok.error })),
      ],
    };
  }
  const parsed = parseSeen(grok.text);
  return { looks: parsed.looks, shots: parsed.shots, failed };
}

export async function seeShotFrames(input: {
  museName: string;
  ladderTitle: string;
  theme: string;
  shots: VisionShot[];
}) {
  if (!input.shots.length) {
    return { looks: "", seen: [] as SeenBeat[], failed: [] as SeenBeat[] };
  }
  let looks = "";
  const seen: SeenBeat[] = [];
  const failed: SeenBeat[] = [];
  const chunkSize = 4;
  for (let i = 0; i < input.shots.length; i += chunkSize) {
    const chunk = input.shots.slice(i, i + chunkSize);
    const batch = await seeBatch(input.museName, input.ladderTitle, input.theme, chunk);
    if (batch.looks && !looks) looks = batch.looks;
    const found = new Set(batch.shots.map((s) => s.id));
    for (const s of batch.shots) seen.push({ id: s.id, visualBeat: s.visualBeat });
    for (const f of batch.failed) failed.push(f);
    for (const s of chunk) {
      if (!found.has(s.id) && !failed.some((f) => f.id === s.id)) {
        failed.push({ id: s.id, visualBeat: "", error: "No frame note returned." });
      }
    }
  }
  return { looks, seen, failed };
}

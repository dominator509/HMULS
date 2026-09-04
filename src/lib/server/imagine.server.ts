import { seoStem } from "@/lib/seo";
import {
  isModerationStatus,
  promptsDiffer,
  softenHeavy,
  softenLight,
  type NudgeRung,
  type NudgeTrace,
} from "@/lib/imagine-nudge";
import { extractJson } from "./transporter";
import { IMAGINE_NUDGE_SYSTEM, imagineNudgeUserMessage } from "@/lib/prompt-pack";

const IMAGE_MODEL = "grok-imagine-image-2.0";
const VIDEO_MODEL = "grok-imagine-video-1.5";
const MAX_RUNGS = 3;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(JSON.stringify({ error: { message: "timed out" } }), { status: 504 });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}



export type ImagineResult =
  | { ok: true; bytes: Buffer; mime: "image/jpeg" | "video/mp4" }
  | { ok: false; error: string; blocked: boolean; detail?: string };

export type ImagineAttempt = ImagineResult & {
  usedPrompt: string;
  originalPrompt: string;
  nudged: boolean;
  rung: NudgeRung;
  delta?: string;
  trace: NudgeTrace[];
};

function blockedFrom(status: number, text: string) {
  return isModerationStatus(status, text);
}

type ImageBody = {
  data?: {
    b64_json?: string;
    url?: string;
    b64?: string;
    respect_moderation?: boolean;
  }[];
  respect_moderation?: boolean;
  error?: { message?: string; code?: string };
};

async function readImageBody(res: Response): Promise<ImagineResult> {
  const body = (await res.json()) as ImageBody;
  if (body.respect_moderation === false || body.data?.[0]?.respect_moderation === false) {
    return {
      ok: false,
      error: "Imagine filtered the still after generate.",
      blocked: true,
      detail: "respect_moderation=false",
    };
  }
  const row = body.data?.[0];
  const b64 = row?.b64_json || row?.b64;
  if (b64) {
    const bytes = Buffer.from(b64, "base64");
    if (bytes.length < 2048) {
      return { ok: false, error: "Imagine returned an empty still.", blocked: true };
    }
    return { ok: true, bytes, mime: "image/jpeg" };
  }
  if (row?.url) {
    const img = await fetch(row.url);
    if (!img.ok) return { ok: false, error: "Imagine URL could not be fetched.", blocked: false };
    const bytes = Buffer.from(await img.arrayBuffer());
    if (bytes.length < 2048) {
      return { ok: false, error: "Imagine returned an empty still.", blocked: true };
    }
    return { ok: true, bytes, mime: "image/jpeg" };
  }
  const msg = body.error?.message || "Imagine returned no image.";
  return { ok: false, error: msg, blocked: isModerationStatus(400, msg), detail: msg };
}

async function grokEase(input: {
  prompt: string;
  rejection: string;
  mode: "image" | "video";
  previous?: string;
  stronger?: boolean;
}): Promise<{ prompt: string; delta: string } | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: input.stronger ? 0.25 : 0.15,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: IMAGINE_NUDGE_SYSTEM },
          { role: "user", content: imagineNudgeUserMessage(input) },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(extractJson(text) || "{}") as { prompt?: string; delta?: string };
    const prompt = (json.prompt || "").trim();
    if (!prompt || !promptsDiffer(prompt, input.prompt)) return null;
    return { prompt, delta: (json.delta || "minimum wording change").trim() };
  } catch {
    return null;
  }
}

async function withModerationNudge(
  original: string,
  mode: "image" | "video",
  attempt: (prompt: string) => Promise<ImagineResult>,
): Promise<ImagineAttempt> {
  const trace: NudgeTrace[] = [{ rung: 0, prompt: original, delta: "original" }];
  const first = await attempt(original);
  if (first.ok) {
    return { ...first, usedPrompt: original, originalPrompt: original, nudged: false, rung: 0, trace };
  }
  if (!first.blocked) {
    return { ...first, usedPrompt: original, originalPrompt: original, nudged: false, rung: 0, trace };
  }

  let current = original;
  let lastError = first.detail || first.error;
  const rejection = lastError;

  for (let rung = 1; rung <= MAX_RUNGS; rung++) {
    let next = current;
    let delta = "";
    if (rung === 1) {
      const light = softenLight(original);
      next = light.prompt;
      delta = light.delta;
    } else {
      const eased = await grokEase({
        prompt: original,
        rejection,
        mode,
        previous: current,
        stronger: rung >= 3,
      });
      if (eased) {
        next = eased.prompt;
        delta = eased.delta;
      } else {
        const heavy = softenHeavy(original);
        next = heavy.prompt;
        delta = heavy.delta;
      }
    }
    if (!promptsDiffer(next, current) && rung > 1) continue;
    current = next;
    trace.push({ rung: rung as NudgeRung, prompt: current, delta });
    const result = await attempt(current);
    if (result.ok) {
      return {
        ...result,
        usedPrompt: current,
        originalPrompt: original,
        nudged: true,
        rung: rung as NudgeRung,
        delta,
        trace,
      };
    }
    if (!result.blocked) {
      return {
        ...result,
        usedPrompt: current,
        originalPrompt: original,
        nudged: true,
        rung: rung as NudgeRung,
        delta,
        trace,
      };
    }
    lastError = result.detail || result.error;
  }

  return {
    ok: false,
    error:
      "Imagine still declined after easing the prompt. Original is kept — upload the still on Ladders or try Generate again.",
    blocked: true,
    detail: lastError,
    usedPrompt: current,
    originalPrompt: original,
    nudged: true,
    rung: MAX_RUNGS,
    delta: trace.at(-1)?.delta,
    trace,
  };
}

async function imagineGenerateRaw(prompt: string): Promise<ImagineResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Grok Imagine is not available in this environment.", blocked: false };
  const payload = JSON.stringify({
    model: IMAGE_MODEL,
    prompt,
    n: 1,
    aspect_ratio: "2:3",
    resolution: "1k",
    quality: "medium",
    response_format: "b64_json",
  });
  const transient = new Set([408, 425, 429, 500, 502, 503, 504]);
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithTimeout(
      "https://api.x.ai/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: payload,
      },
      55_000,
    );
    lastStatus = res.status;
    if (res.ok) return readImageBody(res);
    lastText = await res.text().catch(() => "");
    const blocked = blockedFrom(res.status, lastText);
    if (blocked || !transient.has(res.status) || attempt === 2) {
      return {
        ok: false,
        error: blocked
          ? "Imagine declined this frame."
          : res.status === 503 || res.status === 504
            ? "Grok Imagine is overloaded or timed out. Wait a minute and try Image 0 again."
            : `Imagine error ${res.status}`,
        blocked,
        detail: lastText.slice(0, 400),
      };
    }
    await sleep(800 * (attempt + 1));
  }
  return {
    ok: false,
    error: `Imagine error ${lastStatus}`,
    blocked: false,
    detail: lastText.slice(0, 400),
  };
}

async function imagineEditRaw(prompt: string, dataUris: string[]): Promise<ImagineResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Grok Imagine is not available in this environment.", blocked: false };
  const refs = dataUris.filter(Boolean).slice(0, 3);
  if (!refs.length) return imagineGenerateRaw(prompt);
  const payload: Record<string, unknown> = {
    model: IMAGE_MODEL,
    n: 1,
    aspect_ratio: "2:3",
    resolution: "1k",
    quality: "medium",
    response_format: "b64_json",
    prompt,
  };
  if (refs.length === 1) {
    payload.image = { url: refs[0], type: "image_url" };
  } else {
    payload.images = refs.map((url) => ({ url, type: "image_url" }));
  }
  const res = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const blocked = blockedFrom(res.status, text);
    if (!blocked) {
      const fallback = await imagineGenerateRaw(
        `${prompt}\nKeep the same woman described. Photoreal vertical still.`,
      );
      if (fallback.ok) return fallback;
    }
    return {
      ok: false,
      error: blocked ? "Imagine declined this frame." : `Imagine edit error ${res.status}`,
      blocked,
      detail: text.slice(0, 400),
    };
  }
  return readImageBody(res);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type VideoStatus = {
  request_id?: string;
  status?: string;
  url?: string;
  video_url?: string;
  video?: { url?: string };
  respect_moderation?: boolean;
  error?: { message?: string; code?: string };
};

async function imagineVideoRaw(prompt: string): Promise<ImagineResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Grok Imagine is not available in this environment.", blocked: false };
  const start = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      prompt,
      duration: 6,
      aspect_ratio: "9:16",
      resolution: "720p",
    }),
  });
  const startText = await start.text().catch(() => "");
  if (!start.ok) {
    const blocked = blockedFrom(start.status, startText);
    return {
      ok: false,
      error: blocked ? "Imagine declined this clip." : `Imagine video error ${start.status}`,
      blocked,
      detail: startText.slice(0, 400),
    };
  }
  let startBody: VideoStatus = {};
  try {
    startBody = JSON.parse(startText) as VideoStatus;
  } catch {
    return { ok: false, error: "Imagine video returned no request id.", blocked: false };
  }
  const id = startBody.request_id;
  if (!id) return { ok: false, error: "Imagine video returned no request id.", blocked: false };

  for (let i = 0; i < 40; i++) {
    await sleep(3000);
    const poll = await fetch(`https://api.x.ai/v1/videos/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const text = await poll.text().catch(() => "");
    let body: VideoStatus = {};
    try {
      body = JSON.parse(text) as VideoStatus;
    } catch {
      continue;
    }
    const status = (body.status || "").toLowerCase();
    if (status === "pending" || status === "processing" || status === "queued") continue;
    if (status === "done" || status === "completed" || status === "succeeded") {
      if (body.respect_moderation === false) {
        return { ok: false, error: "Imagine filtered the clip after generate.", blocked: true };
      }
      const url = body.video?.url || body.video_url || body.url;
      if (!url) return { ok: false, error: "Imagine returned no clip URL.", blocked: false };
      const clip = await fetch(url);
      if (!clip.ok) return { ok: false, error: "Imagine clip URL could not be fetched.", blocked: false };
      const bytes = Buffer.from(await clip.arrayBuffer());
      if (bytes.length < 4096) {
        return { ok: false, error: "Imagine returned an empty clip.", blocked: true };
      }
      return { ok: true, bytes, mime: "video/mp4" };
    }
    const msg = body.error?.message || text || `Imagine video ${status || "failed"}`;
    return {
      ok: false,
      error: isModerationStatus(poll.status, msg) ? "Imagine declined this clip." : msg.slice(0, 180),
      blocked: isModerationStatus(poll.status, msg) || /invalid_argument/i.test(body.error?.code || ""),
      detail: msg.slice(0, 400),
    };
  }
  return { ok: false, error: "Imagine video timed out.", blocked: false };
}

export async function imagineGenerate(prompt: string): Promise<ImagineAttempt> {
  return withModerationNudge(prompt, "image", imagineGenerateRaw);
}

export async function imagineEdit(prompt: string, dataUris: string[]): Promise<ImagineAttempt> {
  return withModerationNudge(prompt, "image", (p) => imagineEditRaw(p, dataUris));
}

export async function imagineGenerateVideo(prompt: string): Promise<ImagineAttempt> {
  return withModerationNudge(prompt, "video", imagineVideoRaw);
}

export async function persistOriginal(bytes: Buffer, id: string, ext = ".jpg") {
  const { putPrivateOriginal } = await import("./object-store");
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const name = `${id.replace(/[^a-zA-Z0-9._-]/g, "_")}${safeExt}`;
  return putPrivateOriginal(name, bytes);
}

export async function persistPublicCover(bytes: Buffer, museSlug: string, title: string) {
  const { putPublicTeaser } = await import("./object-store");
  const stem = seoStem([museSlug, "00", title]).slice(0, 56);
  const url = `/media/${stem || museSlug}-cover.jpg`;
  return putPublicTeaser(url, bytes);
}

export async function writeAwaitingStill(shotId: string) {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { readFile, unlink } = await import("node:fs/promises");
  const exec = promisify(execFile);
  const tmp = join(tmpdir(), `${shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}.jpg`);
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x1a1516:s=768x1152",
    "-frames:v",
    "1",
    "-q:v",
    "6",
    tmp,
  ];
  try {
    await exec(process.env.FFMPEG || "/usr/local/bin/ffmpeg", args, { timeout: 12000 });
  } catch {
    await exec("ffmpeg", args, { timeout: 12000 });
  }
  const bytes = await readFile(tmp);
  await unlink(tmp).catch(() => undefined);
  const { putPrivateOriginal } = await import("./object-store");
  return putPrivateOriginal(`${shotId.replace(/[^a-zA-Z0-9._-]/g, "_")}.jpg`, bytes);
}

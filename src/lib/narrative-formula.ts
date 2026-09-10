/**
 * Muse / photoset narrative formula — prompt builders + JSON schemas.
 * Tone: second person, present tense, her voice. Adult 24–34 fictional OC only.
 * Manual edits are source of truth; Generate/Respin only run when the operator clicks them.
 */

export const NARRATIVE_AGE_BAND = { min: 24, max: 34 } as const;

/** Buyer-psych levers every generated field must use (consensual adult only). */
export const PSYCH_LEVERS = [
  {
    id: "progressive_revelation",
    label: "Progressive revelation / edging",
    tip: "Each tease sells the NEXT layer. Never dump the climax early. Delay gratification.",
  },
  {
    id: "specificity",
    label: "Specificity > adjectives",
    tip: "Name garment, jewelry, pose, what’s covered. Concrete beats “sexy/hot.”",
  },
  {
    id: "power_withhold",
    label: "Power / withhold / choose-you",
    tip: "She decides. Buyer feels selected. She never begs.",
  },
  {
    id: "scarcity_social",
    label: "Scarcity + social proof (honest)",
    tip: "Drop % / collectors / “most men stop here.” No fake “0 collectors.” FOMO on limited climax.",
  },
  {
    id: "possession",
    label: "Possession / private-set framing",
    tip: "“For you / not a room / not a feed.” Private vs public.",
  },
  {
    id: "anticipation_loop",
    label: "Anticipation loop",
    tip: "Story opens a loop the next unlock closes. Cliffhangers between shots.",
  },
  {
    id: "collector_gacha",
    label: "Collector / gacha brain",
    tip: "Roster + limited lore-drop language in photoset hooks (nerd/crypto audience).",
  },
  {
    id: "second_person",
    label: "Second person present",
    tip: "“You” in the scene now. Present tense. Her voice.",
  },
  {
    id: "desire_first",
    label: "Desire first, price second",
    tip: "Never lead with “exclusive content” spam. Story first.",
  },
  {
    id: "archetype",
    label: "Archetype congruence",
    tip: "Psych levers match THIS muse (dominant cyber, soft control silk…), not generic baddie paste.",
  },
] as const;

export type PsychLeverId = (typeof PSYCH_LEVERS)[number]["id"];

export const PSYCH_TIPS_SHORT = PSYCH_LEVERS.map((l) => `• ${l.label}: ${l.tip}`).join("\n");

export type ShotNarrative = {
  visual: string;
  tease: string;
  grant: string;
  story: string;
  drop: string;
};

export type PhotosetNarrative = {
  ladderId?: string;
  theme?: string;
  hook: string;
  tease: string;
  shots: Record<string, ShotNarrative> | ShotNarrative[];
};

export type MuseNarrativeOutput = {
  looks: string;
  voice: string;
  teaseStyle: string;
  /** Short sexualized backstory / scenario — adult 24–34, second-person curiosity hook. */
  scenario: string;
  photosets: PhotosetNarrative[];
};

export const MUSE_NARRATIVE_JSON_SCHEMA = {
  type: "object",
  required: ["looks", "voice", "teaseStyle", "scenario", "photosets"],
  additionalProperties: false,
  properties: {
    looks: { type: "string" },
    voice: { type: "string" },
    teaseStyle: { type: "string" },
    scenario: { type: "string" },
    photosets: {
      type: "array",
      items: {
        type: "object",
        required: ["hook", "tease", "shots"],
        properties: {
          ladderId: { type: "string" },
          theme: { type: "string" },
          hook: { type: "string" },
          tease: { type: "string" },
          shots: {
            oneOf: [
              {
                type: "object",
                additionalProperties: {
                  type: "object",
                  required: ["visual", "tease", "grant", "story", "drop"],
                  properties: {
                    visual: { type: "string" },
                    tease: { type: "string" },
                    grant: { type: "string" },
                    story: { type: "string" },
                    drop: { type: "string" },
                  },
                },
              },
              {
                type: "array",
                items: {
                  type: "object",
                  required: ["visual", "tease", "grant", "story", "drop"],
                  properties: {
                    visual: { type: "string" },
                    tease: { type: "string" },
                    grant: { type: "string" },
                    story: { type: "string" },
                    drop: { type: "string" },
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
} as const;

export type NarrativeMode = "from_identity" | "reverse_frames" | "respin";

export type LadderSpec = {
  ladderId?: string;
  theme: string;
  title?: string;
  shots?: {
    id?: string;
    step: number;
    title?: string;
    visualBeat?: string;
    frameCaption?: string;
  }[];
};

export type NarrativePromptInput = {
  mode: NarrativeMode;
  stageName: string;
  looks?: string;
  voice?: string;
  teaseStyle?: string;
  scenario?: string;
  archetypeTags?: string[];
  /** Freeform operator brief — personality, setting, kinks-to-lean, shoot notes, lines to hit/avoid, psych levers. */
  ownerBrief?: string;
  portrayedAgeMin?: number;
  ladders: LadderSpec[];
  /** Prior output for respin identity lock. */
  prior?: Partial<MuseNarrativeOutput>;
  respinNote?: string;
};

const HARD_RULES = `Hard rules (never break):
- Adult fictional OC only. Portrayed age band 24–34. Never minors. Never celebrities or real people.
- Consensual adult desire only. No non-con, no coercion-as-kink framing, no force, no "unwilling."
- Second person, present tense, HER voice. Complete native-English sentences.
- Specific garments/jewelry/pose; sell the NEXT unlock. Story first, price second.
- No "exclusive content" spam. No broken English. No "yeses" as jargon. No emoji/hashtags.
- Never change the portrayed age band on respin. Never invent Dominic or personal emails into public copy.
- She never begs. Power/withhold/choose-you appropriate to her archetype.`;

const PSYCH_SYSTEM_BLOCK = `Mandatory male sexual / buyer psychology (bake into EVERY field — muse bible, photoset hook/tease, and each shot visual/tease/grant/story/drop):

1. Progressive revelation / edging — each tease sells the NEXT layer; never dump climax early; delay gratification (sequential unlock product).
2. Specificity > adjectives — name garment, jewelry, pose, what’s still covered; concrete beats arousal more than "sexy/hot."
3. Power / withhold / choose-you — she decides; buyer feels selected (parasocial competence); she never begs.
4. Scarcity + social proof without lies — drop % / collectors / "most men stop here" filters; no fake "0 collectors"; FOMO on limited climax.
5. Possession / private-set framing — "for you / not a room / not a feed"; private vs public.
6. Anticipation loop — story opens a loop the next unlock closes; cliffhangers between shots.
7. Collector / gacha brain — roster + limited lore-drop language for photoset hooks (nerd/crypto audience).
8. Second person present — "you" in the scene now.
9. Desire first, price second — never lead with "exclusive content" spam.
10. Archetype congruence — psych levers match THIS muse (dominant cyber, soft control silk, etc.), not generic baddie paste.

Shot field map (match ShotVoice / PhotosetVoice):
- visual: what the frame shows (specific).
- tease: 1–2 sentences FROM the frame; last clause makes NEXT shot inevitable.
- grant: one line after payment; name her; confirm the buy.
- story: 1–2 sentences of THIS set's arc; N requires N+1.
- drop: social-proof sting about quitters; empty string on step 1. Leading "38% of men…" is fine.`;

export function narrativeSystemPrompt(): string {
  return `You are the muse narrative writer for SHE UNDRESSES — a sequential paid-unlock vault of adult photo/video sets for adult men.

${HARD_RULES}

${PSYCH_SYSTEM_BLOCK}

Return ONLY JSON matching this shape:
{
  "looks": "identity lock string",
  "voice": "how she talks in teases",
  "teaseStyle": "how to write from her frames",
  "scenario": "1 short paragraph sexualized adult 24–34 backstory/scenario — second-person curiosity hook",
  "photosets": [
    {
      "ladderId": "optional id",
      "theme": "frontal|worship|feet|custom",
      "hook": "one line unique to this set",
      "tease": "2–4 sentences photoset story",
      "shots": {
        "shot_id_or_step": { "visual": "", "tease": "", "grant": "", "story": "", "drop": "" }
      }
    }
  ]
}`;
}

function formatLadders(ladders: LadderSpec[]): string {
  return ladders
    .map((l) => {
      const shots = (l.shots ?? [])
        .map((s) => {
          const beat = s.visualBeat?.trim() || s.frameCaption?.trim() || "";
          return `  ${s.step}. ${s.id ?? `step_${s.step}`} — "${s.title ?? `Shot ${s.step}`}"${beat ? ` | FRAME: ${beat}` : ""}`;
        })
        .join("\n");
      return `Photoset: ${l.title ?? l.theme} (theme=${l.theme}${l.ladderId ? `, id=${l.ladderId}` : ""})
Shots:
${shots || "  (invent a classic 9-step dressed→nude ladder congruent with theme)"}`;
    })
    .join("\n\n");
}

function briefBlock(input: NarrativePromptInput): string {
  const parts: string[] = [];
  if (input.ownerBrief?.trim()) {
    parts.push(`Owner brief (inject into voice, scenario, and every photoset — honor lines to hit/avoid and psych levers named):\n${input.ownerBrief.trim()}`);
  }
  if (input.archetypeTags?.length) {
    parts.push(`Archetype tags: ${input.archetypeTags.join(", ")}`);
  }
  if (input.respinNote?.trim()) {
    parts.push(`Respin direction (keep identity lock; do not change age band): ${input.respinNote.trim()}`);
  }
  return parts.length ? `\n${parts.join("\n\n")}\n` : "";
}

export function buildFromIdentityUserMessage(input: NarrativePromptInput): string {
  const age = input.portrayedAgeMin ?? NARRATIVE_AGE_BAND.min;
  return `Mode: FROM IDENTITY
Stage name: ${input.stageName}
Portrayed age (lock): ${age} (band ${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max})
Looks (lock / invent congruent details if thin): ${input.looks?.trim() || "(invent a distinctive adult OC look — jewelry, skin, hair, signature garment)"}
Existing voice (keep if strong): ${input.voice?.trim() || "(invent)"}
Existing teaseStyle: ${input.teaseStyle?.trim() || "(invent)"}
Existing scenario: ${input.scenario?.trim() || "(invent 1 short paragraph curiosity hook)"}
${briefBlock(input)}
Invent congruent backstory + full photoset voices for the ladder(s) below. Identity must stay locked to looks + stage name.
${formatLadders(input.ladders)}

Write looks/voice/teaseStyle/scenario PLUS hook+tease and per-shot visual/tease/grant/story/drop for every shot. Escalate intimacy each step. Shot 9 is the nude men should feel stupid for missing.`;
}

export function buildReverseFromFramesUserMessage(input: NarrativePromptInput): string {
  return `Mode: REVERSE FROM FRAMES
Stage name: ${input.stageName}
Portrayed age band lock: ${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max}
Known looks (may refine FROM frames, never celeb/minor): ${input.looks?.trim() || "(reverse-engineer from FRAME notes)"}
Known voice: ${input.voice?.trim() || "(infer from vibe of frames)"}
${briefBlock(input)}
Reverse-engineer muse bible + shot copy FROM the frame captions / visual beats below (like Liora teases: written from the frame, sell next layer).
${formatLadders(input.ladders)}

Every tease must be written FROM its FRAME note. If a frame note exists, do not invent a different garment/pose. Sell the NEXT unlock.`;
}

export function buildRespinUserMessage(input: NarrativePromptInput): string {
  const prior = input.prior
    ? `Prior narrative JSON (identity lock — keep stage essence, looks core, age band; regenerate copy):\n${JSON.stringify(input.prior, null, 2)}`
    : `Prior fields:
looks: ${input.looks ?? ""}
voice: ${input.voice ?? ""}
teaseStyle: ${input.teaseStyle ?? ""}
scenario: ${input.scenario ?? ""}`;

  return `Mode: RESPIN
Stage name: ${input.stageName}
${prior}
${briefBlock(input)}
Regenerate narrative without losing identity lock. Never change portrayed age band (${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max}). Never celebs/minors.
Apply respin direction if given (e.g. more dominant, less soft, more cyber) while staying archetype-congruent.
Ladders to rewrite:
${formatLadders(input.ladders)}`;
}

export function buildNarrativeUserMessage(input: NarrativePromptInput): string {
  if (input.mode === "reverse_frames") return buildReverseFromFramesUserMessage(input);
  if (input.mode === "respin") return buildRespinUserMessage(input);
  return buildFromIdentityUserMessage(input);
}

export function defaultLadderSpecs(selected?: ("frontal" | "worship" | "feet")[]): LadderSpec[] {
  const all: LadderSpec[] = [
    {
      theme: "frontal",
      title: "The Reveal",
      shots: Array.from({ length: 9 }, (_, i) => ({
        step: i + 1,
        id: `rev_${i + 1}`,
        title: `Reveal ${i + 1}`,
      })),
    },
    {
      theme: "worship",
      title: "The Curve",
      shots: Array.from({ length: 9 }, (_, i) => ({
        step: i + 1,
        id: `crv_${i + 1}`,
        title: `Curve ${i + 1}`,
      })),
    },
    {
      theme: "feet",
      title: "The Pedestal",
      shots: Array.from({ length: 9 }, (_, i) => ({
        step: i + 1,
        id: `ped_${i + 1}`,
        title: `Pedestal ${i + 1}`,
      })),
    },
  ];
  if (!selected?.length) return all;
  return all.filter((l) => selected.includes(l.theme as "frontal" | "worship" | "feet"));
}

/** Normalize LLM JSON into MuseNarrativeOutput; returns null if unusable. */
export function parseMuseNarrative(text: string): MuseNarrativeOutput | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const json = JSON.parse(text.slice(start, end + 1)) as Partial<MuseNarrativeOutput>;
    if (!json || typeof json !== "object") return null;
    const looks = typeof json.looks === "string" ? json.looks.trim() : "";
    const voice = typeof json.voice === "string" ? json.voice.trim() : "";
    const teaseStyle = typeof json.teaseStyle === "string" ? json.teaseStyle.trim() : "";
    const scenario = typeof json.scenario === "string" ? json.scenario.trim() : "";
    const photosets = Array.isArray(json.photosets) ? json.photosets : [];
    if (!looks && !voice && !scenario && !photosets.length) return null;
    return {
      looks,
      voice,
      teaseStyle,
      scenario,
      photosets: photosets.map((p) => normalizePhotoset(p)),
    };
  } catch {
    return null;
  }
}

function normalizeShot(s: Partial<ShotNarrative> | null | undefined): ShotNarrative {
  return {
    visual: typeof s?.visual === "string" ? s.visual.trim() : "",
    tease: typeof s?.tease === "string" ? s.tease.trim() : "",
    grant: typeof s?.grant === "string" ? s.grant.trim() : "",
    story: typeof s?.story === "string" ? s.story.trim() : "",
    drop: typeof s?.drop === "string" ? s.drop.trim() : "",
  };
}

function normalizePhotoset(p: Partial<PhotosetNarrative>): PhotosetNarrative {
  const shots: Record<string, ShotNarrative> = {};
  if (Array.isArray(p.shots)) {
    p.shots.forEach((s, i) => {
      shots[`step_${i + 1}`] = normalizeShot(s);
    });
  } else if (p.shots && typeof p.shots === "object") {
    for (const [k, v] of Object.entries(p.shots)) {
      shots[k] = normalizeShot(v);
    }
  }
  return {
    ladderId: typeof p.ladderId === "string" ? p.ladderId : undefined,
    theme: typeof p.theme === "string" ? p.theme : undefined,
    hook: typeof p.hook === "string" ? p.hook.trim() : "",
    tease: typeof p.tease === "string" ? p.tease.trim() : "",
    shots,
  };
}

/** Merge generated fields onto a draft without clobbering unless overwrite=true. */
export function applyNarrativeToDraft<T extends Record<string, unknown>>(
  draft: T,
  generated: MuseNarrativeOutput,
  opts: { overwrite: boolean },
): T & {
  looks: string;
  voice: string;
  teaseStyle: string;
  bio: string;
} {
  const pick = (cur: unknown, next: string) => {
    const c = typeof cur === "string" ? cur.trim() : "";
    if (opts.overwrite) return next || c;
    return c || next;
  };
  return {
    ...draft,
    looks: pick(draft.looks, generated.looks),
    voice: pick(draft.voice, generated.voice),
    teaseStyle: pick(draft.teaseStyle, generated.teaseStyle),
    bio: pick(draft.bio, generated.scenario),
  };
}

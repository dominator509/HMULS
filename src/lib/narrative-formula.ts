/**
 * Muse / photoset narrative formula — prompt builders + JSON schemas.
 * Default copyStyle: Brazzers-scenario pattern (FORMAT only — never paste studio synopses).
 * Tone: fluent native American English, dirty-but-smooth, second person present, her voice.
 * Adult 24–34 fictional OC only. Manual edits are source of truth.
 */

export const NARRATIVE_AGE_BAND = { min: 24, max: 34 } as const;

/** Default marketing-copy register for generated muse / photoset narrative. */
export const COPY_STYLE = "brazzers-scenario" as const;
export type CopyStyle = typeof COPY_STYLE;

/**
 * Pattern distilled from public adult-studio scene blurbs (structure only).
 * Encode this shape — never plagiarize copyrighted synopses.
 */
export const BRAZZERS_SCENARIO_PATTERN = {
  id: COPY_STYLE,
  label: "Brazzers-scenario (format only)",
  beats: [
    "Scene-title energy — punchy premise in the first line (WHO + situation).",
    "WHO she is — role/archetype in one concrete beat (the netrunner, the silk-robed hostess).",
    "WHERE / WHEN — specific wardrobe + setting (chrome mesh doorway, cream silk bedroom, neon after-hours).",
    "Tension — curiosity, power flip, withhold, standoff that turns invitation.",
    "Sexual promise — where the night is headed; leave the unlock ladder to deliver the layers.",
  ],
  voiceRules: [
    "Fluent native American English. Short sentences. Dirty-but-smooth.",
    "Male-buyer POV curiosity without broken grammar or ESL mush.",
    "Specific garments/jewelry/pose beats — never generic 'very sexy beautiful.'",
    "Zero Engrish / Chinglish / AI-translation artifacts.",
  ],
} as const;

/** Buyer-psych levers every generated field must use (consensual adult only). */
export const PSYCH_LEVERS = [
  {
    id: "progressive_revelation",
    label: "Progressive revelation / edging",
    tip: "Each tease sells the NEXT layer like a scene trailer — never dump the climax early. Leave the ladder to deliver.",
  },
  {
    id: "specificity",
    label: "Specificity > adjectives",
    tip: "Name garment, jewelry, pose, setting. 'Chrome mesh off one shoulder' beats 'very sexy body.'",
  },
  {
    id: "power_withhold",
    label: "Power / withhold / choose-you",
    tip: "She decides. Buyer feels selected. She never begs. Tension flips into invitation on her terms.",
  },
  {
    id: "scarcity_social",
    label: "Scarcity + social proof (honest)",
    tip: "Drop % / collectors / 'most men stop here.' No fake '0 collectors.' FOMO on limited climax.",
  },
  {
    id: "possession",
    label: "Possession / private-set framing",
    tip: "'For you / not a room / not a feed.' Private vs public — scenario intimacy, not folder spam.",
  },
  {
    id: "anticipation_loop",
    label: "Anticipation loop",
    tip: "Open a loop the next unlock closes. Cliffhangers between shots — trailer energy, not plot dump.",
  },
  {
    id: "collector_gacha",
    label: "Collector / gacha brain",
    tip: "Roster + limited lore-drop language in photoset hooks (nerd/crypto audience).",
  },
  {
    id: "second_person",
    label: "Second person present",
    tip: "'You' in the scene now. Present tense. Her voice. Native American English only.",
  },
  {
    id: "desire_first",
    label: "Desire first, price second",
    tip: "Never lead with 'exclusive content' spam. Scene story first — Brazzers-scenario energy.",
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
  /** Short sexualized backstory / scenario — adult 24–34, Brazzers-scenario curiosity hook. */
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
- copyStyle = "${COPY_STYLE}": fluent native American English. Short sentences. Dirty-but-smooth. Zero ESL artifacts.
- Second person, present tense, HER voice. Complete sentences a US native speaker would say out loud.
- Specific garments/jewelry/pose/setting; sell the NEXT unlock. Story first, price second.
- No "exclusive content" spam. No emoji/hashtags. No "yeses" as jargon.
- Never change the portrayed age band on respin. Never invent Dominic or personal emails into public copy.
- She never begs. Power/withhold/choose-you appropriate to her archetype.`;

const ENGRISH_BAN = `BAN Engrish / Chinglish / AI-translation mush (instant fail — rewrite before returning JSON):
- No broken grammar: "you is", "she want you", "very hot body", "make you feel good very much."
- No stacked empty adjectives: "very sexy beautiful hot girl", "amazing gorgeous perfect body."
- No Chinglish stock: "open the secret", "please enjoy her charm", "she is waiting your unlock", "come taste her beauty."
- No stiff ESL filler: "In this set, you will see…", "This content shows…", "She has a good figure and…"
- No robot-summary tone. Write like a premium adult-scene trailer blurb, not a product manual.
- If a sentence sounds translated, cut it and write a clean American one.`;

const BRAZZERS_STYLE_BLOCK = `copyStyle "${COPY_STYLE}" — FORMAT PATTERN ONLY (never paste or plagiarize any studio's copyrighted synopses):

Scene-blurb structure for muse scenario + photoset hook/tease:
1. Scene-title energy — punchy WHO + situation in beat one.
2. WHERE / WHEN — concrete wardrobe + setting (silk doorway, neon lounge, bed edge).
3. Tension — curiosity, power flip, withhold that turns invitation.
4. Sexual promise — where the night is headed; STOP before dumping every layer (the unlock ladder delivers).
5. Length: scenario = 2–5 fluent sentences. Photoset tease = 2–4 sentences. Hook = one sharp line.

Voice: dirty-but-smooth native American English. Male-buyer POV curiosity. Specific role beats ("she's the [role] who…"). Short sentences that land.

FEW-SHOT (invented OC only — imitate STRUCTURE + voice, not wording from any real studio):

BAD (Engrish — never output like this):
"Nyx is very sexy beautiful cyber girl with hot body. She want you look her undress step by step. You will like very much her lace and chrome. Please unlock to enjoy her charm."

GOOD (Brazzers-scenario energy for sequential unlock):
"Void Channel Invitation — Nyx Virell runs the after-hours netrunner lounge you weren't supposed to find. Chrome mesh robe tied at the waist, violet lace only hinted underneath, LED ink glowing along her collarbones. She clocks you the second you clear the doorway — and she doesn't look away. Tonight she's deciding how much chrome comes off, and on whose terms. Stay long enough and the mesh stops being polite."

BAD (Engrish):
"Liora have soft silk robe and gold moon. She is very gentle but also control. You pay then she show more sexy."

GOOD:
"Private Room Protocol — Liora doesn't open the door for a crowd. Cream silk robe, gold crescent at her throat, dark eyes that already know why you showed up. She lets the night start dressed on purpose — the silk only moves when you've earned the next inch. Lace is a test. The bed is a decision. The last frame is for men who didn't quit early."`;

const PSYCH_SYSTEM_BLOCK = `Mandatory male sexual / buyer psychology (bake into EVERY field — muse bible, photoset hook/tease, and each shot visual/tease/grant/story/drop):

1. Progressive revelation / edging — each tease sells the NEXT layer; never dump climax early; delay gratification (sequential unlock product).
2. Specificity > adjectives — name garment, jewelry, pose, what's still covered; concrete beats arousal more than "sexy/hot."
3. Power / withhold / choose-you — she decides; buyer feels selected (parasocial competence); she never begs.
4. Scarcity + social proof without lies — drop % / collectors / "most men stop here" filters; no fake "0 collectors"; FOMO on limited climax.
5. Possession / private-set framing — "for you / not a room / not a feed"; private vs public.
6. Anticipation loop — story opens a loop the next unlock closes; cliffhangers between shots.
7. Collector / gacha brain — roster + limited lore-drop language for photoset hooks (nerd/crypto audience).
8. Second person present — "you" in the scene now; fluent native American English.
9. Desire first, price second — never lead with "exclusive content" spam; scene story first.
10. Archetype congruence — psych levers match THIS muse (dominant cyber, soft control silk, etc.), not generic baddie paste.

Shot field map (match ShotVoice / PhotosetVoice):
- visual: what the frame shows (specific wardrobe/setting beat).
- tease: 1–2 dirty-smooth sentences FROM the frame; last clause makes NEXT shot inevitable.
- grant: one line after payment; name her; confirm the buy.
- story: 1–2 sentences of THIS set's arc; N requires N+1.
- drop: social-proof sting about quitters; empty string on step 1. Leading "38% of men…" is fine.`;

export function narrativeSystemPrompt(): string {
  return `You are the muse narrative writer for SHE UNDRESSES — a sequential paid-unlock vault of adult photo/video sets for adult men.
Default copyStyle: ${COPY_STYLE}. Write Brazzers-grade smut marketing (structure/voice only) — fluent, dirty-smooth, zero translation mush.

${HARD_RULES}

${ENGRISH_BAN}

${BRAZZERS_STYLE_BLOCK}

${PSYCH_SYSTEM_BLOCK}

Return ONLY JSON matching this shape:
{
  "looks": "identity lock string",
  "voice": "how she talks in teases — native American English, dirty-smooth",
  "teaseStyle": "how to write from her frames — Brazzers-scenario beats + next-unlock sell",
  "scenario": "2–5 sentence adult 24–34 scene blurb: WHO + WHERE/WHEN + tension + sexual promise (leave ladder to deliver)",
  "photosets": [
    {
      "ladderId": "optional id",
      "theme": "frontal|worship|feet|custom",
      "hook": "one sharp scene-title line unique to this set",
      "tease": "2–4 fluent sentences — setting, wardrobe, tension, promise",
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
copyStyle: ${COPY_STYLE}
Stage name: ${input.stageName}
Portrayed age (lock): ${age} (band ${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max})
Looks (lock / invent congruent details if thin): ${input.looks?.trim() || "(invent a distinctive adult OC look — jewelry, skin, hair, signature garment)"}
Existing voice (keep if strong): ${input.voice?.trim() || "(invent — low/precise or quiet/in-control; native American English)"}
Existing teaseStyle: ${input.teaseStyle?.trim() || "(invent — from-frame + next-unlock + Brazzers-scenario beats)"}
Existing scenario: ${input.scenario?.trim() || "(invent 2–5 sentence scene blurb: WHO + WHERE + tension + sexual promise)"}
${briefBlock(input)}
Invent congruent backstory + full photoset voices for the ladder(s) below. Identity must stay locked to looks + stage name.
Write scenario like a premium adult scene trailer — fluent, dirty-smooth, ZERO Engrish.
${formatLadders(input.ladders)}

Write looks/voice/teaseStyle/scenario PLUS hook+tease and per-shot visual/tease/grant/story/drop for every shot. Escalate intimacy each step. Shot 9 is the nude (or covered climax if editorial) men should feel stupid for missing.`;
}

export function buildReverseFromFramesUserMessage(input: NarrativePromptInput): string {
  return `Mode: REVERSE FROM FRAMES
copyStyle: ${COPY_STYLE}
Stage name: ${input.stageName}
Portrayed age band lock: ${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max}
Known looks (may refine FROM frames, never celeb/minor): ${input.looks?.trim() || "(reverse-engineer from FRAME notes)"}
Known voice: ${input.voice?.trim() || "(infer — native American English, dirty-smooth)"}
${briefBlock(input)}
Reverse-engineer muse bible + shot copy FROM the frame captions / visual beats below.
Scenario + photoset tease must follow Brazzers-scenario structure (WHO / WHERE / tension / promise). Every tease written FROM its FRAME note.
${formatLadders(input.ladders)}

Every tease must be written FROM its FRAME note. If a frame note exists, do not invent a different garment/pose. Sell the NEXT unlock. Ban Engrish.`;
}

export function buildRespinUserMessage(input: NarrativePromptInput): string {
  const prior = input.prior
    ? `Prior narrative JSON (identity lock — keep stage essence, looks core, age band; regenerate copy in ${COPY_STYLE}):\n${JSON.stringify(input.prior, null, 2)}`
    : `Prior fields:
looks: ${input.looks ?? ""}
voice: ${input.voice ?? ""}
teaseStyle: ${input.teaseStyle ?? ""}
scenario: ${input.scenario ?? ""}`;

  return `Mode: RESPIN
copyStyle: ${COPY_STYLE}
Stage name: ${input.stageName}
${prior}
${briefBlock(input)}
Regenerate narrative without losing identity lock. Upgrade any Engrish / generic mush into fluent Brazzers-scenario smut marketing.
Never change portrayed age band (${NARRATIVE_AGE_BAND.min}–${NARRATIVE_AGE_BAND.max}). Never celebs/minors.
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

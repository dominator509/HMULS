/** Minimum-edit prompt easing when Grok Imagine rejects a frame as too spicy. */

export type NudgeRung = 0 | 1 | 2 | 3;

export type NudgeTrace = {
  rung: NudgeRung;
  prompt: string;
  delta: string;
};

const LIGHT: [RegExp, string][] = [
  [/\bexplicit(?:ly)?\b/gi, "implied"],
  [/\bpornographic\b/gi, "editorial intimate"],
  [/\bxxx\b/gi, "adult"],
  [/\bhardcore\b/gi, "intimate"],
  [/\bnsfw\b/gi, "adult editorial"],
  [/\b(fully\s+)?nude\b/gi, "undressed"],
  [/\bnaked\b/gi, "undressed"],
  [/\btopless\b/gi, "robe open at the chest"],
  [/\bbottomless\b/gi, "silk fallen at the hips"],
  [/\bbare\s+breasts?\b/gi, "open décolletage"],
  [/\bbreasts?\s+exposed\b/gi, "chest implied under light"],
  [/\b(nipples?|areolas?)\b/gi, "collarbone and chest"],
  [/\b(vagina|pussy|labia|clitoris|clit|vulva)\b/gi, "hips and inner thigh"],
  [/\bgenitals?\b/gi, "the line of the body"],
  [/\bcrotch\b/gi, "hips"],
  [/\b(penis|cock|dick|balls)\b/gi, "body"],
  [/\b(cum|semen|ejaculat\w*|squirting)\b/gi, "skin sheen"],
  [/\b(masturbat\w*|fingering)\b/gi, "a private hand at the hip"],
  [/\b(penetration|intercourse)\b/gi, "bodies close"],
  [/\b(fucking|fuck|sex act|having sex)\b/gi, "intimate pose"],
  [/\bspread\s+(her\s+)?legs\b/gi, "knees parted"],
  [/\blegs\s+spread\b/gi, "knees parted"],
  [/\bfull(?:y)?\s+frontal\b/gi, "facing the lens, garment failing"],
  [/\bno\s+clothes\b/gi, "last layer gone"],
];

const HEAVY: [RegExp, string][] = [
  [/\bundressed\b/gi, "last garment failing"],
  [/\bbare skin\b/gi, "skin suggested by light"],
  [/\binner thigh\b/gi, "the line of the thigh"],
  [/\bopen décolletage\b/gi, "the open neckline of the robe"],
  [/\brobe open at the chest\b/gi, "robe loosened at the throat"],
  [/\bsilk fallen at the hips\b/gi, "silk pooled low"],
  [/\bgarment failing\b/gi, "garment slipping"],
];

const LIGHT_SUFFIX =
  " Tasteful photoreal editorial still of a consenting adult woman in her late 20s. Implied intimacy, not graphic. No text.";

const HEAVY_SUFFIX =
  " Editorial boudoir photography. Describe through garment, shadow, and pose. Implied, cinematic, adult 25+. No explicit anatomy, no graphic sexual act.";

function applyPairs(text: string, pairs: [RegExp, string][]) {
  let out = text;
  const changed: string[] = [];
  for (const [re, to] of pairs) {
    const next = out.replace(re, (m) => {
      changed.push(`${m} → ${to}`);
      return to;
    });
    out = next;
  }
  return { text: out.replace(/[ \t]{2,}/g, " ").trim(), changed };
}

export function isModerationText(text: string) {
  return /moderat|safet|violat|content policy|not allowed|rejected|filtered|content_policy|respect_moderation|too spicy|disallowed/i.test(
    text,
  );
}

export function isModerationStatus(status: number, text: string) {
  if (isModerationText(text)) return true;
  if (status === 400 || status === 422) return true;
  return false;
}

/** Rung 1: swap only the words that usually trip Imagine. Pose/garment/light stay. */
export function softenLight(prompt: string) {
  const { text, changed } = applyPairs(prompt, LIGHT);
  const withSuffix = /consenting adult|editorial still|implied intimacy/i.test(text)
    ? text
    : `${text}${LIGHT_SUFFIX}`;
  return {
    prompt: withSuffix,
    delta: changed.length ? changed.slice(0, 8).join("; ") : "added editorial adult framing",
    changed: changed.length > 0 || withSuffix !== prompt,
  };
}

/** Rung 3 fallback: stronger veil if Grok rewrite is unavailable. */
export function softenHeavy(prompt: string) {
  const first = applyPairs(prompt, LIGHT);
  const second = applyPairs(first.text, HEAVY);
  const withSuffix = /editorial boudoir|no explicit anatomy/i.test(second.text)
    ? second.text
    : `${second.text}${HEAVY_SUFFIX}`;
  const changed = [...first.changed, ...second.changed];
  return {
    prompt: withSuffix,
    delta: changed.length ? changed.slice(0, 10).join("; ") : "veiled through garment and light",
    changed: true,
  };
}

export function promptsDiffer(a: string, b: string) {
  return a.trim().replace(/\s+/g, " ") !== b.trim().replace(/\s+/g, " ");
}

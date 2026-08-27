export type Dials = {
  urgency: number;
  scarcity: number;
  tease: number;
  sunkCost: number;
  socialProof: number;
  fetishHeat: number;
  addiction: number;
};

export const DEFAULT_DIALS: Dials = {
  urgency: 7,
  scarcity: 6,
  tease: 8,
  sunkCost: 8,
  socialProof: 6,
  fetishHeat: 7,
  addiction: 8,
};

export type Surfaces = {
  heroKicker: string;
  heroHeadline: string;
  heroBody: string;
  stickyCta: string;
  checkoutUrge: string;
  postGrant: string;
  unfinished: string;
  loginPromise: string;
};

export function clampDial(n: number) {
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(10, Math.round(n)));
}

export function normalizeDials(raw: Partial<Dials> | null | undefined): Dials {
  return {
    urgency: clampDial(raw?.urgency ?? DEFAULT_DIALS.urgency),
    scarcity: clampDial(raw?.scarcity ?? DEFAULT_DIALS.scarcity),
    tease: clampDial(raw?.tease ?? DEFAULT_DIALS.tease),
    sunkCost: clampDial(raw?.sunkCost ?? DEFAULT_DIALS.sunkCost),
    socialProof: clampDial(raw?.socialProof ?? DEFAULT_DIALS.socialProof),
    fetishHeat: clampDial(raw?.fetishHeat ?? DEFAULT_DIALS.fetishHeat),
    addiction: clampDial(raw?.addiction ?? DEFAULT_DIALS.addiction),
  };
}

/** Higher urgency → shorter hours to keep preferred rate. */
export function continueHours(d: Dials) {
  return Math.max(2, Math.round(22 - d.urgency * 2));
}

/** Invoice lifetime in minutes. */
export function invoiceMinutes(d: Dials) {
  return Math.max(8, Math.round(48 - d.urgency * 3));
}

export function nextBlurPx(d: Dials) {
  return Math.max(2, Math.round(6 - d.tease * 0.3));
}

export function lockedBlurPx(d: Dials) {
  return Math.max(4, Math.round(10 - d.tease * 0.3));
}

export function priceBumpPct(d: Dials) {
  if (d.addiction < 4) return 0;
  return 8 + d.addiction;
}

export function bumpedCents(cents: number, pct: number) {
  if (pct <= 0) return cents;
  return Math.round(cents * (1 + pct / 100));
}

const DROP_OFF = [0, 0, 38, 51, 61, 70, 78, 84, 89, 93];

export function dropOffPct(step: number) {
  return DROP_OFF[Math.max(0, Math.min(9, step))] ?? 0;
}

export function fetishFocus(theme: string, heat: number) {
  const hot = heat >= 7;
  if (theme === "worship") {
    return hot
      ? "She turned her back on purpose. The curve is the product. Stay looking."
      : "The back is the study. She knows you're here for it.";
  }
  if (theme === "feet") {
    return hot
      ? "Start at the floor. Heels, then bare, then soles. She likes you there."
      : "This ladder is feet, in order. She doesn't rush a man who already knows.";
  }
  return hot
    ? "Frontal, sequenced. Each layer is a yes she can still take back."
    : "She faces you when you've earned the next yes.";
}

export function sunkLine(spentCents: number, unlocked: number, d: Dials) {
  if (unlocked === 0) {
    return d.tease >= 6
      ? "You haven't paid for a yes yet. That's why she still feels optional."
      : "Shot 1 is the invitation. The rest is the hook.";
  }
  if (d.sunkCost >= 8 && unlocked >= 4) {
    return `You've already been granted ${unlocked}. Walking away mid-undress is how tourists leave.`;
  }
  if (d.sunkCost >= 8 && unlocked >= 3) {
    return `${unlocked} yeses in. She doesn't restart a climb for men who hesitate.`;
  }
  if (d.sunkCost >= 5) {
    return `$${(spentCents / 100).toFixed(2)} already granted. She doesn't rewind.`;
  }
  return `${unlocked} granted. The next one is waiting.`;
}

export function scarcityLine(
  d: Dials,
  climaxLeft: number,
  collectors: number,
  clock: string | null,
) {
  if (d.scarcity >= 8 && climaxLeft <= 12) {
    return clock
      ? `${climaxLeft} climax grants left · ${clock}`
      : `${climaxLeft} climax grants left tonight`;
  }
  if (d.scarcity >= 5 && clock) return `Invitation window · ${clock}`;
  if (d.socialProof >= 5) return `${collectors} collectors already inside`;
  return clock ? clock : `${collectors} collectors`;
}

export function addictionCta(d: Dials, remaining: number) {
  if (remaining === 1) {
    return d.fetishHeat >= 7 ? "Take the last yes" : "Request the climax";
  }
  if (remaining === 2 && d.addiction >= 6) return "Two yeses from the end";
  if (d.addiction >= 8 && remaining >= 3) return "Don't stop on an even number";
  if (d.addiction >= 6) return "One more yes while she's still in the pose";
  return "Request the next permission";
}

export function dropLine(step: number, d: Dials, stored?: string) {
  if (stored) return stored;
  const pct = dropOffPct(step);
  if (d.socialProof < 4 || pct < 30) return "";
  if (d.fetishHeat >= 7) {
    return `${pct}% of men leave before this shot. That's why she priced it to sting.`;
  }
  return `${pct}% of collectors never see this frame.`;
}

export function waitingLine(expired: boolean, d: Dials) {
  if (expired && d.urgency >= 5) {
    return "She stopped holding the pose. Preferred rate is gone.";
  }
  if (d.urgency >= 7) return "She's holding still. That doesn't last.";
  return "She's waiting on your next yes.";
}

export function rivalLine(d: Dials, step: number, collectors: number) {
  if (d.socialProof < 5) return "";
  const n = Math.max(1, Math.round(collectors * 0.018));
  if (d.fetishHeat >= 7) {
    return `${n} other men requested shot ${step} today. She noticed who paused.`;
  }
  return `${n} collectors took a shot on this ladder today.`;
}

export function endowmentLine(unlocked: number, d: Dials) {
  if (unlocked === 0 || d.sunkCost < 4) return "";
  if (unlocked === 1) return "One yes is a sample. She doesn't count tourists.";
  if (d.sunkCost >= 8) {
    return `${unlocked} yeses. This ladder is already yours. Finish it.`;
  }
  return `${unlocked} granted. She doesn't rewind.`;
}

export function recoveryLine(d: Dials, bump: number, expired: boolean) {
  if (!expired || bump <= 0) return "";
  if (d.addiction >= 6) {
    return `Singles jumped +${bump}%. Next 3 still sit at the original rate. That's the sane yes.`;
  }
  return `Preferred window closed. This shot is +${bump}% now.`;
}

export function invoiceUrge(d: Dials, expired: boolean, clock: string | null) {
  if (expired) return "This invitation died. Request access again — singles may have jumped.";
  if (d.urgency >= 8 && clock) {
    return `She's holding the pose until ${clock}. After that this invoice is ash.`;
  }
  if (d.urgency >= 5 && clock) return `Invitation dies in ${clock}. Send the yes.`;
  return "Send payment. Confirmation is the grant.";
}

export function whisperLine(
  d: Dials,
  opts: { isVideo: boolean; isClimax: boolean; remaining: number },
) {
  if (opts.isClimax) {
    return d.scarcity >= 6
      ? "Last frame. She doesn't reshoot a climax because you got shy."
      : "The last permission on this ladder.";
  }
  if (opts.isVideo && d.tease >= 6) return "Motion. She only breathed like this once.";
  if (opts.remaining <= 2 && d.addiction >= 6) return "You're too close to leave her half-open.";
  return "";
}

export function fallbackSurfaces(d: Dials): Surfaces {
  return {
    heroKicker: d.tease >= 7 ? "The Nine-Yes" : "Private sequential sets",
    heroHeadline:
      d.fetishHeat >= 7 ? "She undresses for the man who stays." : "You've been invited.",
    heroBody:
      d.addiction >= 7
        ? "Free porn finishes her before you arrive. That's why nothing hits. Each muse grants nine permissions — paid, in order, each one a yes she can still take back."
        : "Nine permissions per ladder. Crypto in, the next shot opens. She does not skip.",
    stickyCta:
      d.addiction >= 8
        ? "Don't leave her half-open"
        : d.urgency >= 7
          ? "She's still in the pose"
          : "Request the next yes",
    checkoutUrge:
      d.urgency >= 7
        ? "She's holding the pose until this invoice dies. After that, you request again — at the new rate."
        : "Send payment to be granted.",
    postGrant:
      d.addiction >= 7
        ? "You've been granted. The next yes is already cheaper than the feeling of closing this tab."
        : "Access granted. The next shot is waiting.",
    unfinished:
      d.sunkCost >= 7
        ? "You left her mid-undress. She does not hold a pose for tourists."
        : "Continue where you stopped.",
    loginPromise:
      d.sunkCost >= 6
        ? "Collectors keep every grant. She remembers who paid — and who left."
        : "Sign in to keep your vault across devices.",
  };
}

export function mergeSurfaces(d: Dials, stored: Partial<Surfaces> | null | undefined): Surfaces {
  const base = fallbackSurfaces(d);
  if (!stored) return base;
  const next = { ...base };
  (Object.keys(base) as (keyof Surfaces)[]).forEach((k) => {
    const v = stored[k];
    if (typeof v === "string" && v.trim()) next[k] = v.trim();
  });
  return next;
}

export function parseSurfaces(raw: string | null | undefined): Partial<Surfaces> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const v = JSON.parse(raw) as Partial<Surfaces>;
    if (!v || typeof v !== "object") return null;
    return v;
  } catch {
    return null;
  }
}

export function dialEffects(d: Dials) {
  return {
    continueHours: continueHours(d),
    invoiceMinutes: invoiceMinutes(d),
    nextBlur: nextBlurPx(d),
    lockedBlur: lockedBlurPx(d),
    bumpPct: priceBumpPct(d),
  };
}

export function fallbackStory(theme: string, step: number) {
  const arcs: Record<string, string[]> = {
    frontal: [
      "",
      "Shot 1 is how she lets tourists in. Shot 2 is where the silk moves.",
      "A robe that moves is a delay she enjoys watching you fail. Lace is underneath.",
      "Lace is the test. She sits down in Shot 4 for men who pass it.",
      "Sitting down is a decision. The look she saves comes next.",
      "The look is the status. Motion is rarer. Shot 6 is six seconds she will not reshoot.",
      "Still frames you can pause. Motion you can't. After this, polite is over.",
      "Polite is a costume. Shot 8 is the private set. Shot 9 is the close she doesn't give the room.",
      "You can leave her uncovered and tell yourself you're satisfied. Or you take the last yes.",
      "This is the frame the ladder was built to make inevitable.",
    ],
    worship: [
      "",
      "The face is a courtesy. The back is the product.",
      "The drape is her enjoying the wait. Shot 3 is the line. Stay on it.",
      "The line is the study. Shot 4 she holds longer for men who don't rush.",
      "Held is status. Shot 5 is the study frame men save.",
      "The study is still polite. Shot 6 is cropped. No face.",
      "No face means she's done performing. Shot 7 is the curve without the pose.",
      "Unoffered is intimacy. Shot 8 is the offered frame. Shot 9 is the close with nothing left to drape.",
      "Offered is still a pose. Shot 9 is the last close-up of the curve.",
      "You didn't buy an ass shot. You finished a climb.",
    ],
    feet: [
      "",
      "Shoes are a courtesy. Shot 2 she recrosses them. That's not accidental.",
      "Awareness is the product. Shot 3 is one foot toward the lens. A test.",
      "The extend is the interview. Shot 4 is gold on the ankle.",
      "Jewelry is a private-set signal. Shot 5 is shoes off.",
      "Bare is admission. Shot 6 she holds the foot in frame. For you.",
      "Held still is obedience from her side. Shot 7 is soles.",
      "Soles are the confession. Shot 8 is the study. Shot 9 is the last inspection.",
      "The study is time. Shot 9 is the last close-up. She doesn't reshoot an inspection.",
      "You didn't buy feet. You finished a ritual.",
    ],
  };
  const list = arcs[theme] ?? arcs.frontal;
  return list[step] ?? "";
}

export const DIAL_META: {
  key: keyof Dials;
  label: string;
  hint: string;
}[] = [
  { key: "urgency", label: "Urgency", hint: "Deadline length. High = she stops holding the pose sooner. Shortens invoices and preferred windows." },
  { key: "scarcity", label: "Scarcity", hint: "Climax caps, invitation clocks, last-frame copy." },
  { key: "tease", label: "Tease", hint: "How much of the next shot leaks through the blur. High = hungrier preview." },
  { key: "sunkCost", label: "Sunk cost", hint: "How hard it feels to leave money and yeses on the ladder." },
  { key: "socialProof", label: "Social proof", hint: "Collector counts, rival lines, drop-off percentages." },
  { key: "fetishHeat", label: "Fetish heat", hint: "How directly the copy names the ladder's fetish." },
  { key: "addiction", label: "One-more", hint: "Upsell aggression, expired-rate bump on singles, 'don't stop' CTAs." },
];

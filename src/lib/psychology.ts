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
      ? "She turned her back on purpose. That's the whole product. Stay looking."
      : "This set is the back. She knows that's why you're here.";
  }
  if (theme === "feet") {
    return hot
      ? "Start at the floor. Heels, then bare, then soles. She likes you looking down."
      : "This set is feet, in order. She doesn't rush a man who already knows.";
  }
  return hot
    ? "She faces you. Each layer comes off when you pay. Not before."
    : "She looks at you when you've earned the next shot.";
}

export function sunkLine(spentCents: number, unlocked: number, d: Dials) {
  if (unlocked === 0) {
    return d.tease >= 6
      ? "You haven't bought a shot yet. That's why she still feels optional."
      : "Shot 1 is the cheap seat. The rest of the set is the hook.";
  }
  if (d.sunkCost >= 8 && unlocked >= 4) {
    return `You've already unlocked ${unlocked} shots. Closing now leaves her mid-strip.`;
  }
  if (d.sunkCost >= 8 && unlocked >= 3) {
    return `${unlocked} shots in. She doesn't restart a strip for men who hesitate.`;
  }
  if (d.sunkCost >= 5) {
    return `$${(spentCents / 100).toFixed(2)} already in. She doesn't rewind.`;
  }
  return `${unlocked} unlocked. The next one is waiting.`;
}

export function scarcityLine(
  d: Dials,
  climaxLeft: number,
  collectors: number,
  clock: string | null,
) {
  // Real scarcity only: positive remaining and a tight leftover band.
  if (d.scarcity >= 8 && climaxLeft > 0 && climaxLeft <= 12) {
    return clock
      ? `${climaxLeft} last-shot unlocks left · ${clock}`
      : `${climaxLeft} last-shot unlocks left tonight`;
  }
  // Prefer a live clock over fabricated social proof.
  if (d.scarcity >= 5 && clock) return `This rate holds for ${clock}`;
  if (d.socialProof >= 5 && collectors > 0) {
    return `${collectors} collectors already inside`;
  }
  if (clock) return clock;
  if (collectors > 0) return `${collectors} collectors`;
  // No fake zero counts — urgency-neutral fallback.
  return "Pay to keep her in this pose";
}

export function addictionCta(d: Dials, remaining: number) {
  if (remaining === 1) {
    return d.fetishHeat >= 7 ? "Unlock the last shot" : "Unlock the close";
  }
  if (remaining === 2 && d.addiction >= 6) return "Two shots from the nude";
  if (d.addiction >= 8 && remaining >= 3) return "Don't stop halfway dressed";
  if (d.addiction >= 6) return "One more while she's still in this pose";
  return "Unlock the next shot";
}

export function dropLine(_step: number, d: Dials, stored?: string) {
  if (d.socialProof < 4) return "";
  const raw = (stored || "").trim();
  if (!raw) return "";
  if (/^\d+\s*%/.test(raw)) {
    const rest = raw.replace(/^[^.]*\.\s*/, "").trim();
    return rest;
  }
  return raw;
}

export function waitingLine(expired: boolean, d: Dials) {
  if (expired && d.urgency >= 5) {
    return "She dropped the pose. The cheaper rate is gone.";
  }
  if (d.urgency >= 7) return "She's holding still. That doesn't last.";
  return "The next shot unlocks when you pay.";
}

/** `requestedToday` must be a real event count, not a formula on collectors. */
export function rivalLine(d: Dials, step: number, requestedToday: number) {
  if (d.socialProof < 5 || requestedToday < 3) return "";
  if (d.fetishHeat >= 7) {
    return `${requestedToday} other men bought shot ${step} today. She noticed who paused.`;
  }
  return `${requestedToday} collectors bought a shot on this set today.`;
}

export function endowmentLine(unlocked: number, d: Dials) {
  if (unlocked === 0 || d.sunkCost < 4) return "";
  if (unlocked === 1) return "One shot is a sample. Samples don't stick.";
  if (d.sunkCost >= 8) {
    return `${unlocked} shots in. This set is already yours. Finish it.`;
  }
  return `${unlocked} unlocked. She doesn't rewind.`;
}

export function recoveryLine(d: Dials, bump: number, expired: boolean) {
  if (!expired || bump <= 0) return "";
  if (d.addiction >= 6) {
    return `Single shots jumped +${bump}%. The next-3 bundle is still at the old rate. That's the smart buy.`;
  }
  return `The cheaper window closed. This shot is +${bump}% now.`;
}

export function invoiceUrge(d: Dials, expired: boolean, clock: string | null) {
  if (expired) return "This invoice died. Open a new one — the single-shot price may have jumped.";
  if (d.urgency >= 8 && clock) {
    return `She's holding this pose until ${clock}. After that, this invoice is dead.`;
  }
  if (d.urgency >= 5 && clock) return `This rate dies in ${clock}. Send payment.`;
  return "Send payment. When it confirms, the shot unlocks.";
}

export function whisperLine(
  d: Dials,
  opts: { isVideo: boolean; isClimax: boolean; remaining: number },
) {
  if (opts.isClimax) {
    return d.scarcity >= 6
      ? "Last shot. She doesn't reshoot the close because you got cheap."
      : "The last unlock on this set.";
  }
  if (opts.isVideo && d.tease >= 6) return "This one's moving. Six seconds she only did once.";
  if (opts.remaining <= 2 && d.addiction >= 6) return "You're too close to leave her half-dressed.";
  return "";
}

export function fallbackSurfaces(d: Dials): Surfaces {
  return {
    heroKicker: d.tease >= 7 ? "Nine shots. You cannot skip." : "Private sequential sets",
    heroHeadline:
      d.fetishHeat >= 7
        ? "Watch her take it off. One layer at a time."
        : "She starts dressed. You pay. Layers come off.",
    heroBody:
      d.addiction >= 7
        ? "Free porn flashes the nude and you're already bored. Here she starts dressed. You pay. The robe slips off one shoulder. You pay again. Black lace. Then the bed. Then skin. The last shot is the close-up she only gives men who didn't skip."
        : "Nine shots per set. Pay, the next layer comes off. You cannot skip to the nude.",
    stickyCta:
      d.addiction >= 8
        ? "Don't leave her half-dressed"
        : d.urgency >= 7
          ? "She's still in the pose"
          : "Unlock the next shot",
    checkoutUrge:
      d.urgency >= 7
        ? "She's holding this pose until the invoice dies. After that you start over — at the new rate."
        : "Send payment to unlock this shot.",
    postGrant:
      d.addiction >= 7
        ? "Unlocked. The next shot is already cheaper than the feeling of closing this tab."
        : "Unlocked. The next shot is waiting.",
    unfinished:
      d.sunkCost >= 7
        ? "You left her mid-strip. She doesn't hold a pose for men who wander off."
        : "Pick up where you stopped.",
    loginPromise:
      d.sunkCost >= 6
        ? "Sign in and every shot you buy stays in your vault. She remembers who paid — and who left."
        : "Sign in to keep your collection across devices.",
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
      "She's in the doorway. Cream robe still tied. Shot 2 is the first time the silk moves.",
      "The robe just slipped off one shoulder. Under it: black lace. That's Shot 3.",
      "Black lace. No smile. She's measuring you. Shot 4 she sits down for men who don't rush.",
      "She sat on the bed. That's a private room now. Shot 5 is the look she doesn't give a crowd.",
      "Eye contact. This-is-for-you. Shot 6 is six seconds of the robe moving — not a still.",
      "You can pause a photo. You can't pause this. After the clip, polite clothing is over.",
      "The slip is the last layer that still pretends to be clothes. Shot 8 is sheet and skin.",
      "She's uncovered. You can tell yourself that's enough. Or you take the last close-up.",
      "This is the nude the whole set was built to make you buy.",
    ],
    worship: [
      "",
      "She turned her back. The face was a courtesy. The rest of this set is the curve.",
      "Silk on her spine. That's a delay, and she knows it. Shot 3 is from the small of her back down.",
      "Hips. The line. Stay on it. Shot 4 she holds the pose longer if you don't rush.",
      "She's holding still for you. Shot 5 is rim light on the curve — the frame men save.",
      "Study light. After this she stops showing you her face. Shot 6 is cropped. Honest.",
      "No face. She's done performing. Shot 7 is the curve without the pose.",
      "Side-lying. Unposed. Rarer than an arch. Shot 8 is the frame men screenshot.",
      "That's the save-frame. Shot 9 is the close-up with nothing left to drape.",
      "You didn't buy an ass shot. You finished the back.",
    ],
    feet: [
      "",
      "Crossed ankles. Heels. That's how this set always starts. Shot 2 she recrosses them.",
      "She recrossed. That's not a fidget. Shot 3 is one foot toward the lens.",
      "One foot out. A test. Men who flinch never get the anklet — and never get bare.",
      "Gold on the ankle. Private-set jewelry. Shot 5 the shoes come off.",
      "Shoes off. Heels were a costume. Shot 6 she holds the foot still. For you.",
      "Held in frame. No fidgeting. Shot 7 is soles — the shot this set exists for.",
      "Soles. After this, the study. Then the last inspection.",
      "Close. Soft. She let you look this long. Shot 9 is arch, sole, anklet — held.",
      "You didn't buy feet. You finished the ritual.",
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
  { key: "urgency", label: "Urgency", hint: "How fast the pose expires. High = shorter invoices and cheaper-rate windows." },
  { key: "scarcity", label: "Scarcity", hint: "Last-shot caps, countdown clocks, 'when they're gone' copy." },
  { key: "tease", label: "Tease", hint: "How much of the next shot leaks through the blur. High = hungrier preview." },
  { key: "sunkCost", label: "Sunk cost", hint: "How stupid it feels to leave money and shots on the set." },
  { key: "socialProof", label: "Social proof", hint: "Collector counts, rival lines, drop-off stings." },
  { key: "fetishHeat", label: "Fetish heat", hint: "How directly the copy names the body this set is built for." },
  { key: "addiction", label: "One-more", hint: "Upsell aggression, expired-rate bump on singles, don't-stop CTAs." },
];

import type { Dials } from "./psychology";

/**
 * SHE UNDRESSES — sales bible.
 *
 * Voice: ClickFunnels closer × adult-comic panel writer.
 * Complete sentences. Specific garments. Second person. Present tense.
 * Desire already exists. Aim it at the next paid shot.
 * Stopping should feel like leaving her standing there half-dressed.
 */

export const COPY_REV = "lust-letter-2";

export const LETTER = {
  heroKicker: "Nine shots. You cannot skip.",
  heroHeadline: "Watch her take it off. One layer at a time.",
  heroBody:
    "Free porn flashes the nude and you're already bored. Here she starts dressed. You pay. The robe slips off one shoulder. You pay again. Black lace. Then the bed. Then skin. The last shot is the close-up she only gives men who didn't skip.",
  heroCta: "Unlock Shot 1",
  heroCtaContinue: "She's still waiting",
  vaultCta: "My collection",

  laddersKicker: "Pick how you want her",
  laddersTitle: "Three ways she lets you look.",
  laddersAside:
    "Front. Back. Feet. Each set is nine shots. Start one. Most men open a second before they admit they're done.",

  lieKicker: "Why free porn never hits",
  lieTitle: "You already saw the ending. That's the problem.",
  lieBody:
    "Every tube site undresses her for a million other guys, then throws the nude at you before you even want it. No build. No 'will she?' So you open the next tab. And the next. And nothing ever lands. This is the opposite.",

  mechKicker: "How this works",
  mechTitle: "Nine shots. In order. No skipping.",
  mechBody:
    "Shot 1 is the doorway. Shot 9 is full nude. Everything in between is the strip — paid, in order, saved to your account. Want to keep going? Buy the next three, or finish the set at a discount. Crypto. Nothing hits a card statement with her name on it.",

  pillars: [
    {
      t: "She starts dressed",
      d: "You don't get the nude up front. Each payment peels one layer. Leave, and she stays exactly how you left her.",
    },
    {
      t: "The further you go, the harder it is to stop",
      d: "After four shots you're not browsing. You're in the middle of taking her clothes off. Closing the tab now is the part you'll hate in the morning.",
    },
    {
      t: "Crypto. Private.",
      d: "Bitcoin, Ethereum, USDT, Solana. Confirmation unlocks the shot. Nothing hits a bank statement that says her name.",
    },
  ],

  fascinationsKicker: "Why it costs what it costs",
  fascinationsTitle: "The strip only works if the last nude stays rare.",
  fascinations: [
    {
      t: "Why Shot 3 is priced to sting",
      d: "About half the buyers quit at lace. That's on purpose. The last nude stays rare because the men who just wanted a folder of nudes already left.",
    },
    {
      t: "The look she saves for Shot 5",
      d: "Until then she's performing. Shot 5 is eye contact — the this-is-for-you frame. The six-second clip after it only exists if you buy that look.",
    },
    {
      t: "Why the last shot is capped",
      d: "She doesn't reshoot the climax because you got cheap at Shot 2. There's a finite number of last frames. When they're gone, they're gone.",
    },
  ],

  closeKicker: "The last shot is the one you came for",
  closeTitle: "Don't leave her half-dressed.",
  closeBody:
    "Full nude. The close-up. The clip. They only feel like a climax if you climbed to them. Shot 1 is cheap on purpose. Everything after that is built so walking away feels stupid.",
};

export const AGE = {
  kicker: "18+ · Sequential strip · Paid shots",
  title: "SHE UNDRESSES",
  body: "If you wanted a folder of nudes, this isn't that. She starts dressed. You pay. One layer comes off. Confirm you are 18 or older.",
  yes: "I am 18 or older",
  no: "I am not 18",
};

export const AUTH = {
  panelKicker: "Private entry",
  panelLine: "She doesn't strip for a crowd.",
  kicker: "Your vault",
  inTitle: "Welcome back.",
  upTitle: "Make an account.",
  inCta: "Sign in",
  upCta: "Create account",
  switchToUp: "New here? Make an account.",
  switchToIn: "Already have an account? Sign in.",
  granted: "You're in.",
  refused: "Couldn't sign you in.",
};

export const VAULT_COPY = {
  kicker: "Private collection",
  title: "Your vault",
  body: "Every shot you've paid for lives here. Replays are free. New frames still cost the next unlock.",
  emptyTitle: "Nothing unlocked yet.",
  emptyBody:
    "Shot 1 is the cheap seat. After that, the set does the work — each layer makes the next one harder to walk away from.",
  emptyCta: "Open the sets",
};

export const CHECKOUT_COPY = {
  kicker: "Wallet checkout",
  title: "Pay to unlock this shot.",
  sent: "I sent payment — waiting for confirmation",
  waiting: "Waiting for the chain to confirm…",
  doneKicker: "Unlocked",
  doneTitle: "It's yours. She's waiting on the next one.",
  giftTitle: "The unlock is ready for them.",
  expiredKicker: "This invoice died",
  expiredTitle: "She dropped the pose.",
  expiredCta: "Open a new invoice",
  seeUnlocked: "See what you unlocked",
};

export const PAY_SHEET = {
  kicker: "Unlock this shot",
  crypto: "Pay from a wallet. Nothing hits a card statement with her name on it.",
  gift: "You pay. Someone else gets the unlock.",
  single: "This shot",
  three: "Keep going · next 3",
  bundle: (n: number) => `Finish the set · ${n} left`,
  giftLabel: "Unlock as a gift",
  pay: (asset: string) => `Pay with ${asset}`,
};

export function offerFrame(unlocked: number, remaining: number) {
  if (remaining <= 0) {
    return {
      kicker: "You finished this set",
      headline: "She let you see everything.",
      body: "This strip is done. She has two other ways in. Men who finish one usually can't leave the others half-done.",
      single: "",
      three: "",
      bundle: "",
    };
  }
  if (unlocked === 0) {
    return {
      kicker: "The cheap seat",
      headline: "Shot 1 is how she lets you in.",
      body: "It's priced like a sample on purpose. The robe doesn't move until you pay for Shot 2.",
      single: "Unlock Shot 1",
      three: "Unlock the first 3",
      bundle: "Buy the whole strip",
    };
  }
  if (unlocked < 4) {
    return {
      kicker: "Keep her in this pose",
      headline: "One shot is a sample. Samples don't stick.",
      body: "Buying one at a time is how men stall out. The next three keep her here at a rate you won't get later.",
      single: "Unlock the next shot",
      three: "Keep going · next 3",
      bundle: "Finish this set",
    };
  }
  if (remaining === 1) {
    return {
      kicker: "Last shot",
      headline: "This is the frame you climbed for.",
      body: "The close-up. She does not reshoot a climax because you got shy at the door.",
      single: "Unlock the last shot",
      three: "",
      bundle: "",
    };
  }
  return {
    kicker: "Don't leave her half-dressed",
    headline: "You've already paid to get this far.",
    body: "Walking away now is how you spend the rest of the night thinking about the frame you didn't buy. The rest of the set is cheaper than that feeling.",
    single: "One more shot",
    three: "Next 3 at the held rate",
    bundle: "Finish the set",
  };
}

export function alsoUnlocked(slug: string) {
  const map: Record<string, string> = {
    "the-reveal": "The Curve · over the shoulder",
    "the-curve": "The Pedestal · soles",
    "the-pedestal": "The Reveal · lace",
  };
  return map[slug] ?? "another set";
}

export function statusLine(label: string, grants: number) {
  return `${label} · ${grants} shot${grants === 1 ? "" : "s"} unlocked`;
}

export function stackNote(
  kind: "shot" | "upsell" | "bundle",
  d: Dials,
  bump: number,
) {
  if (kind === "shot") {
    if (bump > 0) return `You waited. This shot is +${bump}% now.`;
    return d.urgency >= 7 ? "She's holding still. That doesn't last." : "Unlock this shot. The next one only exists after.";
  }
  if (kind === "upsell") {
    return bump > 0
      ? "Original bundle price. Single shots already jumped. This is the smart buy."
      : "Keep her in this pose. Save 22% vs buying one at a time.";
  }
  return "The rest of the set, discounted. Cheaper than stalling out.";
}

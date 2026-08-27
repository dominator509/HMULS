import type { Dials } from "./psychology";

/**
 * SHE UNDRESSES — sales bible.
 * Voice: new-school Schwartz (channel desire, name the mechanism)
 * stacked on Brunson (hook → story → offer → one-more).
 *
 * Mass desire we do NOT create: he already wants her.
 * Job of every line: aim that desire at the next paid yes,
 * and make stopping feel like leaving a woman half-open.
 */

export const COPY_REV = "nine-yes-1";

export const LETTER = {
  heroKicker: "The Nine-Yes",
  heroHeadline: "She undresses for the man who stays.",
  heroBody:
    "Free porn finishes her before you arrive. That's why nothing hits. Each muse grants nine permissions — paid, in order, each one a yes she can still take back.",
  heroCta: "Request Shot 1",
  heroCtaContinue: "Finish what you started",
  vaultCta: "Your vault",

  laddersKicker: "Pick a woman. Climb her.",
  laddersTitle: "Pick the hunger. Climb it.",
  laddersAside:
    "Frontal. Curve. Feet. Parallel ladders, no skipping. Most men pick one — then can't leave the other two unfinished.",

  lieKicker: "The reason nothing hits",
  lieTitle: "You don't have a willpower problem.",
  lieBody:
    "You have a dumping problem. A feed undresses her in four-tenths of a second for a room of nobody. You never get the yes. You get the leftover. That's why you click the next one.",

  mechKicker: "The mechanism",
  mechTitle: "Nine yeses. Paid. In order.",
  mechBody:
    "Each payment is not a file. It's a permission. She can still close at Shot 8. That's the product — and why the last frame feels like a climax instead of a thumbnail.",

  pillars: [
    {
      t: "Permission, not a dump",
      d: "The next shot does not exist until you pay. She does not skip, does not bundle the ending for tourists, does not undress for a room.",
    },
    {
      t: "The more you open, the harder it is to stop",
      d: "After four grants you are not browsing. You are finishing a woman who already said yes. Walking away mid-undress is how tourists leave.",
    },
    {
      t: "Crypto. No statement that says her name.",
      d: "Bitcoin, Ethereum, USDT, Solana. Confirmation is the grant. Preferred collectors don't leave a card trail.",
    },
  ],

  fascinations: [
    {
      t: "Why Shot 3 is priced to sting",
      d: "51% of men become tourists at lace. That's not a bug. That's the filter that keeps the last frame rare.",
    },
    {
      t: "The look she withholds until Shot 5",
      d: "She doesn't look at a crowd like this. Chosen is a status. Motion — the six-second clip — only exists after it.",
    },
    {
      t: "Why the last frame is capped",
      d: "She will not reshoot a climax because you got cheap at the door. Inner circle is finite. That's the point.",
    },
  ],

  closeKicker: "Inner circle is a status, not a folder",
  closeTitle: "The last yes is the one you came for.",
  closeBody:
    "Full nude. The close. The worship. The inspection. They only feel like a climax if you climbed. Start at Shot 1. It's priced to let you in. Everything after that is designed so you don't leave.",
};

export const AGE = {
  kicker: "18+ · Sequential · Paid permission",
  title: "SHE UNDRESSES",
  body: "If you came for a dump of nudes, leave. She undresses in nine yeses. Each shot is a paid permission. Nothing skips. Confirm you are 18 or older.",
  yes: "I am 18 or older",
  no: "I am not 18",
};

export const AUTH = {
  panelKicker: "She undresses in order",
  panelLine: "She doesn't take everyone.",
  kicker: "Private entry",
  inTitle: "Return to her.",
  upTitle: "Request an invitation.",
  inCta: "Enter the vault",
  upCta: "Create collector access",
  switchToUp: "Need an invitation? Request access.",
  switchToIn: "Already chosen? Sign in.",
  granted: "You've been granted entry.",
  refused: "Entry refused.",
};

export const VAULT_COPY = {
  kicker: "Private collection",
  title: "Your vault",
  body: "Everything you've been granted lives here. Replays are free. New frames still cost a yes.",
  emptyTitle: "Nothing granted yet.",
  emptyBody:
    "Shot 1 is priced to let you in. The rest of the ladder is designed so you don't leave as a tourist.",
  emptyCta: "Open the ladders",
};

export const CHECKOUT_COPY = {
  kicker: "Wallet settlement",
  title: "Pay the yes.",
  sent: "I sent it from another wallet",
  waiting: "Waiting for confirmations…",
  doneKicker: "Access granted",
  doneTitle: "You've been granted access.",
  giftTitle: "The grant is ready.",
  expiredKicker: "Invitation closed",
  expiredTitle: "She dropped the pose.",
  expiredCta: "Request access again",
  seeUnlocked: "See what you unlocked",
};

export const PAY_SHEET = {
  kicker: "Request access",
  crypto: "Pay with a wallet in one tap. No card statement that says her name.",
  gift: "You'll pay. Someone else receives the yes.",
  single: "This yes",
  three: "Keep the pose · next 3",
  bundle: (n: number) => `Finish her · ${n} remaining`,
  giftLabel: "Unlock as a gift",
  pay: (asset: string) => `Pay with ${asset}`,
};

export function offerFrame(unlocked: number, remaining: number) {
  if (remaining <= 0) {
    return {
      kicker: "Inner circle",
      headline: "She let you see everything.",
      body: "This ladder is fully granted. She has two other ways in. Men who finish one usually can't leave the others half-done.",
      single: "",
      three: "",
      bundle: "",
    };
  }
  if (unlocked === 0) {
    return {
      kicker: "The invitation",
      headline: "Shot 1 is how she lets you in.",
      body: "It's priced like a sample on purpose. The robe doesn't move until you pay for the next yes.",
      single: "Take the invitation",
      three: "Skip the stall · first 3",
      bundle: "Buy the whole climb",
    };
  }
  if (unlocked < 4) {
    return {
      kicker: "Keep the pose",
      headline: "One yes is a sample. She doesn't remember samples.",
      body: "Singles are how men stall. The next three keep her in the pose at the rate tourists don't get.",
      single: "Request the next yes",
      three: "Keep the pose · next 3",
      bundle: "Finish this ladder",
    };
  }
  if (remaining === 1) {
    return {
      kicker: "Last frame",
      headline: "This is the yes you climbed for.",
      body: "Full close. She does not reshoot a climax because you got shy at the door.",
      single: "Take the last yes",
      three: "",
      bundle: "",
    };
  }
  return {
    kicker: "Don't leave her half-open",
    headline: "You've already paid to get here.",
    body: "Walking now is how tourists leave. The remaining ladder is cheaper than the feeling of closing this tab.",
    single: "One more yes",
    three: "Next 3 at the held rate",
    bundle: "Finish her",
  };
}

export function alsoUnlocked(slug: string) {
  const map: Record<string, string> = {
    "the-reveal": "The Curve · Over the Shoulder",
    "the-curve": "The Pedestal · Soles",
    "the-pedestal": "The Reveal · Lace",
  };
  return map[slug] ?? "another ladder";
}

export function statusLine(label: string, grants: number) {
  return `Status · ${label} · ${grants} yes${grants === 1 ? "" : "es"}`;
}

export function stackNote(
  kind: "shot" | "upsell" | "bundle",
  d: Dials,
  bump: number,
) {
  if (kind === "shot") {
    if (bump > 0) return `Preferred died. This yes is +${bump}% now.`;
    return d.urgency >= 7 ? "She's holding still. That doesn't last." : "One permission. Then the next exists.";
  }
  if (kind === "upsell") {
    return bump > 0
      ? "Original rate. Singles already jumped. This is the sane yes."
      : "Keep her in the pose. Save 22% vs stalling shot-by-shot.";
  }
  return "The remaining climb, discounted. Cheaper than becoming a tourist.";
}

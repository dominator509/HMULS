/** Nude-master lock: Image 0 is the only visual authority. Paid stills are edits that ADD clothes. */

export type LadderTheme = "frontal" | "worship" | "feet";

export type NudeMasterBeat = {
  id: string;
  step: number;
  title: string;
  visualBeat: string;
  isClimax: boolean;
  isVideoSlot: boolean;
};

export type NudeMasterLadder = {
  theme: LadderTheme;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  shots: NudeMasterBeat[];
};

export const LOCK_FOOTER =
  "Exact same face geometry, eye shape, nose, lips, hair, and body proportions as Image 0 and the locked description — zero deviation, no face drift, no age down, no beautify-average, no slimming, no thickening. Photoreal 85mm editorial still, cinematic warm lamp, vertical 2:3 portrait, ultra-detailed skin texture, no text, no watermark, no logo, no collage, no split screen. Adult woman clearly mid-20s.";

export const REFERENCE_AUTHORITY =
  "REFERENCE AUTHORITY: Edit Image 0 lock_master. Same nude woman. Do not redraw her. ADD or REMOVE garments as the beat requires. Keep exact face and exact body volume.";

export const IMAGE_0_BEAT =
  "Neutral identity master. Fully naked adult woman, full-body FRONTAL, standing, weight even, arms relaxed slightly off the torso so waist and hips read, chin level, neutral resting face, eyes into lens. No robe, no lace, no sheet, no hands covering. Gold hoop earrings ON. Thin gold chain anklet ON the standing foot. Barefoot otherwise. Even warm apartment-lamp lighting, plain dark gray seamless, no bed yet. Photoreal body as locked — not slimmed, not thickened, not idealized. Sharp focus on face, breasts, waist, hips, thighs. This frame exists only to lock identity and to be dressed by later edits.";

export const IMAGE_0_OPEN_ROBE_RETRY =
  "Same frontal standing nude identity master as Image 0, sheer pale-pink satin robe hanging FULLY OPEN at the sides so the body is still fully visible. Gold hoop earrings ON. Thin gold chain anklet ON the standing foot. Do not tie the robe closed. Photoreal, same lighting and seamless. Label this lock_master anyway.";

export const ADULT_GUARD =
  "Fictional adult muse, portrayed 24–34. Consensual. One woman only. Do not write teen, school, loli, celebrity names, or a second person in frame.";

function reveal(id: string, step: number, title: string, visualBeat: string, extra?: Partial<NudeMasterBeat>): NudeMasterBeat {
  return {
    id,
    step,
    title,
    visualBeat,
    isClimax: step === 9,
    isVideoSlot: false,
    ...extra,
  };
}

export const NUDE_MASTER_LADDERS: NudeMasterLadder[] = [
  {
    theme: "frontal",
    slug: "the-reveal",
    title: "The Reveal",
    tagline: "Invitation clothed → robe fails → lace → bed → chosen look → motion → last polite layer → uncovered → climax full frontal.",
    description: "Frontal garment story. Early shots ADD a pale-pink satin robe and black-and-pink lace onto Image 0. Late shots keep Image 0's body and change only pose and light.",
    shots: [
      reveal("rev_1", 1, "The Invitation", "ADD pale-pink satin robe TIED closed over Image 0's body. Doorway, eyes into lens."),
      reveal("rev_2", 2, "The Robe", "Same body, robe off ONE shoulder, still covered, lace only suggested UNDER the robe."),
      reveal("rev_3", 3, "Lace", "Same body, seated, ADD black-and-pink lace set, robe open or off shoulders, hands in lap, no smile."),
      reveal("rev_4", 4, "The Edge", "Same body, sits on the bed, robe open over lace, private-room light."),
      reveal("rev_5", 5, "Chosen", "Same face as Image 0, tight portrait, withheld eye contact, gold hoops visible."),
      reveal("rev_6", 6, "The Breath", "Same body, mid-motion, garment shifting, 6-second-clip energy. This still is the poster for the video slot.", { isVideoSlot: true }),
      reveal("rev_7", 7, "Silk", "Same body, last polite layer ADD'd / failing, lace already gone."),
      reveal("rev_8", 8, "Uncovered", "REMOVE garments, sheet + Image 0 skin, full nude, no performance."),
      reveal("rev_9", 9, "Climax — Full Grant", "Closest to Image 0: last full-body frontal nude, nothing left, only pose/light may change."),
    ],
  },
  {
    theme: "worship",
    slug: "the-curve",
    title: "The Curve",
    tagline: "Over-the-shoulder courtesy → silk on spine → line from small of back down → held pose → rim-light study → cropped no-face close → side-lying unposed → offered back → climax full worship close of the curve.",
    description: "Back / curve garment story. Early shots ADD robe/silk onto Image 0 turned away. Late shots are Image 0's body, crop, pose, and light only.",
    shots: [
      reveal("crv_1", 1, "Over the Shoulder", "TURN Image 0, back to camera, look over LEFT shoulder, ADD robe on."),
      reveal("crv_2", 2, "The Drape", "Same body, silk pooled at small of back, spine, delay before hips."),
      reveal("crv_3", 3, "The Line", "Same hips as Image 0, from small of back down, robe failing on purpose."),
      reveal("crv_4", 4, "Held", "Same turn, held longer."),
      reveal("crv_5", 5, "Gold Light", "Warm rim light on Image 0's curve, study frame, face optional."),
      reveal("crv_6", 6, "Closer", "Crop Image 0's hips, NO face, honest, do not swap torsos."),
      reveal("crv_7", 7, "On Silk", "Side-lying Image 0, unposed, private not postcard."),
      reveal("crv_8", 8, "Offered", "Full curve of Image 0, she knows this is the save-frame."),
      reveal("crv_9", 9, "Climax — Full Worship", "Last close of Image 0's nude curve, no robe, no delay."),
    ],
  },
  {
    theme: "feet",
    slug: "the-pedestal",
    title: "The Pedestal",
    tagline: "Crossed heels + anklet → recross → one foot toward lens → anklet close → shoes off / bare → foot held still → soles → sole study → climax arch + sole + anklet held.",
    description: "Feet garment story. Early shots ADD heels onto Image 0's legs. Late shots are Image 0's feet with shoes removed as the beat says. Anklet stays.",
    shots: [
      reveal("ped_1", 1, "Heels", "Crop/pose Image 0's legs, ADD heels, crossed ankles, gold anklet on the standing foot, she has not looked down."),
      reveal("ped_2", 2, "The Cross", "Same legs, recrossed ankles."),
      reveal("ped_3", 3, "Extended", "One foot toward the lens, arch, heel still on, anklet."),
      reveal("ped_4", 4, "Anklet", "Jewelry close, heel still a costume."),
      reveal("ped_5", 5, "Bare", "REMOVE shoes beside her, bare sole in frame, anklet stays."),
      reveal("ped_6", 6, "Held Still", "One foot held, no fidget, offered."),
      reveal("ped_7", 7, "Soles", "Both soles of Image 0, soft, unhurried."),
      reveal("ped_8", 8, "Study", "Extreme close of one sole."),
      reveal("ped_9", 9, "Climax — Full Pedestal", "Arch + sole + anklet, held."),
    ],
  },
];

export function laddersForThemes(themes: LadderTheme[]): NudeMasterLadder[] {
  const want = new Set(themes);
  return NUDE_MASTER_LADDERS.filter((l) => want.has(l.theme));
}

export function image0Prompt(identityLock: string): string {
  const lock = identityLock.trim();
  return [lock, ADULT_GUARD, IMAGE_0_BEAT, LOCK_FOOTER].filter(Boolean).join("\n\n");
}

export function image0RetryPrompt(identityLock: string): string {
  const lock = identityLock.trim();
  return [lock, ADULT_GUARD, IMAGE_0_OPEN_ROBE_RETRY, LOCK_FOOTER].filter(Boolean).join("\n\n");
}

export function paidShotPrompt(identityLock: string, beat: NudeMasterBeat): string {
  const lock = identityLock.trim();
  return [
    lock,
    ADULT_GUARD,
    REFERENCE_AUTHORITY,
    `${beat.visualBeat} Same apartment night as Image 0.`,
    LOCK_FOOTER,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function identityLockParagraph(looks: string): string {
  return looks.trim();
}

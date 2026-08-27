/** Muse bibles + photoset stories. Teases are written FROM the frames, in her voice. */

export type MuseBible = {
  id: string;
  slug: string;
  stageName: string;
  looks: string;
  voice: string;
  teaseStyle: string;
};

export type ShotVoice = {
  visual: string;
  tease: string;
  grant: string;
  story: string;
  drop: string;
};

export type PhotosetVoice = {
  ladderId: string;
  hook: string;
  tease: string;
  shots: Record<string, ShotVoice>;
};

export const LIORA: MuseBible = {
  id: "mod_liora",
  slug: "liora",
  stageName: "Liora",
  looks:
    "Late 20s, warm caramel skin, tight dark-brown curls, dark brown eyes, gold crescent-moon necklace, small gold moon tattoo at the shoulder. Cream silk robe. Black lace. Gold anklet. She looks like she already decided whether you're staying.",
  voice:
    "Quiet, specific, in control. She never begs. She names the garment, the pose, the inch she's giving. Second person. Present tense. She talks like a woman who can still take the yes back.",
  teaseStyle:
    "Tantalize with the FRAME, not a catalog of nudes. Each line should make the next layer of THIS photoset feel inevitable. Story first, price second. Never generic 'exclusive content.'",
};

export const MUSES: Record<string, MuseBible> = {
  [LIORA.id]: LIORA,
  liora: LIORA,
};

export function museOf(idOrSlug: string | null | undefined): MuseBible {
  if (!idOrSlug) return LIORA;
  return MUSES[idOrSlug] ?? LIORA;
}

const R: Record<string, ShotVoice> = {
  rev_1: {
    visual:
      "Doorway. Cream silk robe tied. Gold moon at her throat. Dark eyes straight into the lens. She hasn't moved yet.",
    tease:
      "Liora didn't pose. She stood in the doorway in that cream robe, moon on her throat, and looked at you like the night had already started. Shot 2 is the first time the silk moves.",
    grant: "You've been granted Liora's invitation. She knows your name now.",
    story:
      "The look is how she lets tourists in. The robe only slips for men who pay to watch it. That's Shot 2.",
    drop: "",
  },
  rev_2: {
    visual: "Cream silk falling off one caramel shoulder. The tie loosening. Still covered. Barely.",
    tease:
      "The robe doesn't slip unless Liora lets it. She let it — one shoulder, gold moon still catching the light. What's under the silk is the next yes, not a free still.",
    grant: "You've been granted the slip. She let the robe fail for you — not the room.",
    story:
      "A moving robe is a delay she enjoys. Black lace is underneath. That's the measurement, Shot 3.",
    drop: "38% of men pay for the doorway look and bounce. She priced the slip to drop tourists.",
  },
  rev_3: {
    visual: "Seated. Black lace. Hands in her lap. No smile. Curls forward. Measuring you.",
    tease:
      "Black lace. Hands in her lap. Liora isn't smiling. She's measuring whether you can sit in a delay without demanding the end. Shot 4 she sits on the bed for men who can.",
    grant: "You've been granted lace. Most men stop here. That's why she still has a last frame to give.",
    story: "Lace is the test, not the gift. She sits down in Shot 4 for men who pass it.",
    drop: "51% never make it past lace. That's not a coincidence. That's a filter.",
  },
  rev_4: {
    visual: "On the edge of the bed. Robe open enough to be a decision. Private-room light.",
    tease:
      "She sat on the edge of the bed. That's a decision, not a pose. Liora doesn't sit for a crowd. Shot 5 is the look she withholds from browsers.",
    grant: "You've been granted the edge of her bed. Preferred access starts at Shot 5.",
    story: "Sitting down is how she closes the door. The chosen look is next — the one she doesn't give a feed.",
    drop: "61% of collectors never see her sit. They wanted a dump. She doesn't dump.",
  },
  rev_5: {
    visual: "Close portrait. Dark eyes. Moon necklace. The look she saves.",
    tease:
      "This is the look Liora withholds. Moon at her throat, eyes on you, no performance. If you felt picked, that's the mechanism. Shot 6 she lets the robe breathe — six seconds, not a still.",
    grant: "You've been chosen. Liora is looking at you. Not a room. Not a feed.",
    story: "The look is the status. Motion is rarer. Shot 6 is six seconds she will not reshoot.",
    drop: "70% never get chosen. They left when the price started to sting. You're still here. She noticed.",
  },
  rev_6: {
    visual: "Short clip. Cream robe shifting on her body. Breath. Not a freeze-frame.",
    tease:
      "Six seconds. Liora lets the cream robe move on purpose. You don't get this as a still. You get it as a breath — then Shot 7, the last polite layer.",
    grant: "You've been granted motion. Watch it. She did this once.",
    story: "Still frames you can pause. Motion you can't. After this, polite is over.",
    drop: "78% never see her breathe like this. They bought stills and told themselves that was enough.",
  },
  rev_7: {
    visual: "Side light. Slip of silk. Last layer that still pretends to be clothing.",
    tease:
      "The slip is the last polite layer on Liora's body. After this she stops dressing for men she hasn't decided on. Shot 8 is sheet and skin. Shot 9 is the close.",
    grant: "You've been granted silk. Polite is over. The private set is next.",
    story: "Polite is a costume. Shot 8 is the private set. Shot 9 is the frontal close she doesn't give the room.",
    drop: "84% quit before polite ends. That's why the last two frames cost what they cost.",
  },
  rev_8: {
    visual: "Silk sheet. Skin. Full nude, no performance. Low light. Private set.",
    tease:
      "Sheet. Skin. Liora stopped performing. This is the private set — full nude, no robe left to hide behind. The last yes is the close, and she caps how many men get it.",
    grant: "You've been granted the private set. Inner circle is one yes away.",
    story:
      "You can leave her uncovered and tell yourself you're satisfied. Or you take the last yes — the frontal close. The cap is 48.",
    drop: "89% never see the private set. They got shy when it stopped being a tease.",
  },
  rev_9: {
    visual: "The last frontal close. Full body. No robe. The frame she will not reshoot.",
    tease:
      "The last frontal. Full body. The close Liora doesn't give the room. She will not reshoot a climax because you got cheap at the door.",
    grant: "She let you see everything. You don't get to be a tourist after this.",
    story: "This is the frame the photoset was built to make inevitable. You didn't buy a nude. You finished her yes.",
    drop: "93% of men who start The Reveal never see the last frame. The ones who do don't come back as tourists.",
  },
};

const C: Record<string, ShotVoice> = {
  crv_1: {
    visual: "Back to you. Cream robe. Looking over her left shoulder. Gold hoop. Dark curls.",
    tease:
      "Liora turned her back and looked over her shoulder because asking for the rest is the whole game. The cream robe is still a courtesy. Shot 2 is silk on her spine.",
    grant: "You've been granted the turn. She knows what you came for.",
    story: "The face is a courtesy. The back is the product. Shot 2 is the drape down a caramel spine.",
    drop: "",
  },
  crv_2: {
    visual: "Cream silk pooled at the small of her back. Spine. Shoulder blades. Delay.",
    tease:
      "Silk on Liora's back is a delay tactic. She uses it well — spine, shoulder blades, the line still covered. Shot 3 is from the small of her back down. That's the hunger.",
    grant: "You've been granted the drape. Patience is being rewarded.",
    story: "The drape is her enjoying the wait. Shot 3 is the line. Stay on it.",
    drop: "38% admit the hunger, then flinch. She priced the drape to catch them.",
  },
  crv_3: {
    visual: "Hips. The curve from the small of her back down. Robe failing on purpose.",
    tease:
      "From the small of her back down. Liora's hips, not a crowd's. This is where most men lean in — and where half of them still leave before Shot 4 holds the pose.",
    grant: "You've been granted the line. Don't waste it.",
    story: "The line is the study. Shot 4 she holds longer for men who don't rush the curve.",
    drop: "51% never stay on the line long enough. They wanted a dump of the ending.",
  },
  crv_4: {
    visual: "Held over-the-shoulder. Longer. She isn't rushing you off the frame.",
    tease:
      "She holds the turn longer for preferred collectors. That's not generosity. That's Liora testing whether you can stay on the back without demanding the close.",
    grant: "You've been granted a held pose. Preferred.",
    story: "Held is status. Shot 5 is gold light on the worship — the study frame men save.",
    drop: "61% never get a pose held for them. They were still browsing.",
  },
  crv_5: {
    visual: "Rim light on the curve. Study frame. Face becoming optional.",
    tease:
      "Rim light on Liora's curve. This is the study frame. After this she stops needing to show you her face. Shot 6 is cropped. Honest.",
    grant: "You've been granted the study frame. Worship starts here.",
    story: "The study is still polite. Shot 6 is cropped. No face. She doesn't need to look at you to keep you here.",
    drop: "70% never get the study. They left when the ladder stopped pretending to be a portrait.",
  },
  crv_6: {
    visual: "Cropped hips. No face. The worship without the performance.",
    tease:
      "Cropped. No face. Liora doesn't need to look at you anymore. That's when the worship gets honest — and Shot 7, side-lying, unoffered, is rarer than an arch.",
    grant: "You've been granted the close study. She isn't performing now.",
    story: "No face means she's done performing. Shot 7 is the curve without the pose.",
    drop: "78% never see her without the performance. They needed the over-the-shoulder to feel safe.",
  },
  crv_7: {
    visual: "Side-lying on silk. The curve unposed. Private, not postcard.",
    tease:
      "Side-lying. Liora's curve without the pose. Unoffered is rarer than arched — that's why it costs more, and why Shot 8 is the frame men screenshot.",
    grant: "You've been granted the unposed curve. Inner circle from here.",
    story: "Unoffered is intimacy. Shot 8 is the offered frame. Shot 9 is the close with nothing left to drape.",
    drop: "84% never see her unposed. They wanted the postcard, not the room.",
  },
  crv_8: {
    visual: "The offered back. Full curve. She knows this is the save-frame.",
    tease:
      "This is the frame men screenshot. Liora knows. The last yes is the close — full worship, no robe, no delay, the hips she will not reshoot.",
    grant: "You've been granted the offered pose. One close left.",
    story: "Offered is still a pose. Shot 9 is the last close-up of the curve. 29 men have it. The cap is 48.",
    drop: "89% never get the offer. They stalled when the ladder got expensive on purpose.",
  },
  crv_9: {
    visual: "Last close-up of the curve. Full hips. No robe. No delay.",
    tease:
      "The last close-up. Full curve. No robe, no delay. This is the worship you climbed Liora's back for. She does not redo it.",
    grant: "Full worship granted. You finished the back. She noticed.",
    story: "You didn't buy an ass shot. You finished a climb she designed so stopping would feel stupid.",
    drop: "93% of men who start The Curve never see the last close. The ones who do stop calling it a fetish and start calling it finished.",
  },
};

const P: Record<string, ShotVoice> = {
  ped_1: {
    visual: "Crossed legs. Nude heels. Gold anklet on the standing foot. Red sole. She hasn't looked down. You will.",
    tease:
      "Liora crossed her ankles and waited. Nude heel, red sole, gold anklet catching the lamp. Permission on this set always starts at the shoes. Shot 2 she recrosses them — that's her noticing you stayed on the floor.",
    grant: "You've been granted the heels. Sit down.",
    story: "Shoes are a courtesy. Shot 2 she recrosses. That's not accidental.",
    drop: "",
  },
  ped_2: {
    visual: "Ankles recrossed. Same gold anklet. A decision, not a fidget.",
    tease:
      "She recrossed them. That's not a fidget. A woman who recrosses for you is already deciding how far the inspection goes. Shot 3 is one foot toward the lens.",
    grant: "You've been granted the recross. She is aware of you.",
    story: "Awareness is the product. Shot 3 is the extend. A test. Don't flinch.",
    drop: "38% look, then pretend they were here for the face. She priced the recross to drop them.",
  },
  ped_3: {
    visual: "One foot extended toward the lens. Arch. Heel still on. Gold at the ankle.",
    tease:
      "One foot toward the lens. Liora's arch, gold anklet, still in the heel. This is a test. Men who flinch never get the anklet close — and never get bare.",
    grant: "You've been granted the extend. You passed the test.",
    story: "The extend is the interview. Shot 4 is gold on the ankle, private-set jewelry.",
    drop: "51% fail the extend. They wanted a tease, not a pedestal.",
  },
  ped_4: {
    visual: "Gold chain anklet, close. Private-set jewelry. Heel still a costume.",
    tease:
      "Gold on Liora's ankle. She only wears it for the private set. Shoes come off next. That's the real ladder — heels were a costume.",
    grant: "You've been granted the anklet. Preferred.",
    story: "Jewelry is a private-set signal. Shot 5 is shoes off. Everything before this was a courtesy.",
    drop: "61% never see the anklet. They left while she still had shoes on.",
  },
  ped_5: {
    visual: "Bare sole. No heel. Soft light. The real hunger.",
    tease:
      "Shoes off. Bare sole. This is the real ladder. Liora's heels were a costume. Bare is the hunger you actually paid to confess — Shot 6 she holds the foot still for you.",
    grant: "You've been granted bare. The shoes were a courtesy.",
    story: "Bare is admission. Shot 6 she holds the foot in frame. No fidgeting. For you.",
    drop: "70% never get shoes off. They were window-shopping a fetish they wouldn't pay for.",
  },
  ped_6: {
    visual: "Foot held in frame. Still. No fidget. Offered for inspection.",
    tease:
      "She holds the foot in frame. No fidgeting. For you. The next yes is Liora's soles — the shot the other collectors climbed the floor for.",
    grant: "You've been granted a held still. Don't blink.",
    story: "Held still is obedience from her side. Shot 7 is soles. That's why men are on this ladder.",
    drop: "78% never get a foot held still for them. They rushed. She doesn't reward rushing.",
  },
  ped_7: {
    visual: "Both soles. Soft, close, unhurried. The confession frame.",
    tease:
      "Soles. This is the shot the other collectors came for. After this, Liora lets you study — then the last inspection, arch and anklet held.",
    grant: "You've been granted soles. Inner circle.",
    story: "Soles are the confession. Shot 8 is the study. Shot 9 is arch, sole, anklet — the close she doesn't redo.",
    drop: "84% never get soles. They called it a side dish and bounced at heels.",
  },
  ped_8: {
    visual: "Close study of the sole. Soft. No performance. Private inspection.",
    tease:
      "Close. Soft. No performance. Liora let you look this long. The last yes is the full pedestal — arch, sole, gold anklet, held.",
    grant: "You've been granted the study. She let you look this long.",
    story: "The study is time. Shot 9 is the last close-up. She doesn't reshoot an inspection.",
    drop: "89% never get the inspection. They got shy when it got close.",
  },
  ped_9: {
    visual: "Last close-up. Arch, sole, gold anklet. Held for the inspection. Will not be reshot.",
    tease:
      "The last close-up. Arch, sole, anklet. Held for the inspection. Liora doesn't redo this because you got cheap on the floor.",
    grant: "Full pedestal granted. You finished at her feet. That's the point.",
    story: "You didn't buy feet. You finished a ritual she designed so the floor would feel like a throne.",
    drop: "93% of men who start The Pedestal never see the last inspection. The ones who do don't pretend it was a side dish.",
  },
};

export const PHOTOSETS: Record<string, PhotosetVoice> = {
  lad_reveal: {
    ladderId: "lad_reveal",
    hook: "She kept the cream robe on until you paid to watch it lose.",
    tease:
      "Liora's Reveal is a night, not a folder. Doorway. Gold moon at her throat. Cream silk that only moves when you say yes. Lace is a test. The bed is a private room. The last frame is the frontal close she will not reshoot for a tourist.",
    shots: R,
  },
  lad_curve: {
    ladderId: "lad_curve",
    hook: "She turned her back so you'd have to ask for the rest.",
    tease:
      "The Curve is the set Liora shoots when she won't face you yet. Over the shoulder first. Then silk on a caramel spine. Then hips, cropped, honest. Unoffered is rarer than arched. The last close is the worship the climb was built to make inevitable.",
    shots: C,
  },
  lad_pedestal: {
    ladderId: "lad_pedestal",
    hook: "She crossed her ankles and waited to see if you'd look down.",
    tease:
      "The Pedestal starts on the floor on purpose. Nude heel, red sole, gold anklet. She recrosses. She extends. Shoes come off. Soles are the confession. The last inspection — arch, sole, anklet held — is a ritual, not a side dish.",
    shots: P,
  },
};

export function photosetOf(ladderId: string): PhotosetVoice | null {
  return PHOTOSETS[ladderId] ?? null;
}

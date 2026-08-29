/** Seed catalog — Liora, three parallel sets, 9 shots each.
 *  Copy: ClickFunnels closer × porn-comic panel writer.
 *  Every tease sells the NEXT shot. Grants confirm the buy. Stories make N require N+1.
 */

export type SeedShot = {
  id: string;
  step: number;
  title: string;
  tease: string;
  grant: string;
  story: string;
  drop: string;
  media: string;
  type: "photo" | "video";
  pos: string;
  price: number;
  climax?: boolean;
};

export type SeedLadder = {
  id: string;
  slug: string;
  title: string;
  theme: string;
  tagline: string;
  description: string;
  cover: string;
  sort: number;
  collectors: number;
  climax: number;
  discount: number;
  shots: SeedShot[];
};

const P = {
  1: 499,
  2: 699,
  3: 899,
  4: 1199,
  5: 1499,
  6: 1799,
  7: 2299,
  8: 2799,
  9: 3699,
};

export const SEED_LADDERS: SeedLadder[] = [
  {
    id: "lad_reveal",
    slug: "the-reveal",
    title: "The Reveal",
    theme: "frontal",
    tagline: "She faces you. Each layer comes off when you pay.",
    description:
      "Doorway. Cream silk. Black lace. Then the bed. Nine frontal shots, in order — the last one is the nude she only gives men who stayed.",
    cover: "/media/liora-00-the-reveal-cover.jpg",
    sort: 1,
    collectors: 0,
    climax: 0,
    discount: 0.32,
    shots: [
      {
        id: "rev_1",
        step: 1,
        title: "The Invitation",
        tease:
          "She's standing in the doorway in that cream robe, looking at you like the night already started. This is the cheapest shot she sells. Shot 2 is the first time the silk moves.",
        grant: "Shot 1 is unlocked. She knows your name now.",
        story:
          "The look is how she lets you in. The robe only slips for men who pay to watch it. That's Shot 2.",
        drop: "",
        media: "grant:rev_1.jpg",
        type: "photo",
        pos: "center top",
        price: P[1],
      },
      {
        id: "rev_2",
        step: 2,
        title: "The Robe",
        tease:
          "Silk doesn't slip unless she lets it. She let it — one shoulder. What's under the robe is black lace. That's Shot 3.",
        grant: "The robe slipped for you. Not for a room.",
        story:
          "A moving robe is her stalling, and she knows it. Black lace is underneath. That's the next unlock.",
        drop: "38% of men pay for the doorway look and bounce. She priced the slip to drop them.",
        media: "grant:rev_2.jpg",
        type: "photo",
        pos: "center",
        price: P[2],
      },
      {
        id: "rev_3",
        step: 3,
        title: "Lace",
        tease:
          "Black lace. Hands in her lap. No smile. She's watching to see if you can sit with a delay without demanding the nude. Shot 4 she sits on the bed.",
        grant: "You have the lace. Most men stop here. That's why she still has a last shot to give.",
        story:
          "Lace is the test, not the gift. She sits down in Shot 4 for men who don't rush the ending.",
        drop: "51% never make it past lace. That's not a coincidence. That's a filter.",
        media: "grant:rev_3.jpg",
        type: "photo",
        pos: "center",
        price: P[3],
      },
      {
        id: "rev_4",
        step: 4,
        title: "The Edge",
        tease:
          "She sat down. That's a decision, not a pose. The bed is a private room now. Shot 5 is the look she doesn't give browsers.",
        grant: "You have the edge of her bed. The chosen look starts at Shot 5.",
        story:
          "Sitting down is how she closes the door. The next shot is eye contact — the this-is-for-you frame.",
        drop: "61% of collectors never see her sit. They wanted the nude dropped on them. She doesn't work that way.",
        media: "grant:rev_4.jpg",
        type: "photo",
        pos: "center 30%",
        price: P[4],
      },
      {
        id: "rev_5",
        step: 5,
        title: "Chosen",
        tease:
          "This is the look she withholds. If you felt picked, that's the point. Shot 6 she lets the robe breathe — six seconds, not a still.",
        grant: "She's looking at you. Not a room. Not a feed.",
        story:
          "Eye contact is rarer than lace. Motion is rarer than that. Shot 6 is six seconds she will not reshoot.",
        drop: "70% never get this look. They left when the price started to sting. You're still here.",
        media: "grant:rev_5.jpg",
        type: "photo",
        pos: "center top",
        price: P[5],
      },
      {
        id: "rev_6",
        step: 6,
        title: "The Breath",
        tease:
          "Six seconds. She lets the robe move on purpose. You don't get this as a photo. You get it as a breath. Shot 7 is the last layer that still pretends to be clothes.",
        grant: "You have the clip. Watch it. She did this once.",
        story:
          "You can pause a photo. You can't pause this. After the clip, polite clothing is over.",
        drop: "78% never see her breathe like this. They bought stills and told themselves that was enough.",
        media: "grant:rev_6.mp4",
        type: "video",
        pos: "center",
        price: P[6],
      },
      {
        id: "rev_7",
        step: 7,
        title: "Silk",
        tease:
          "The slip is the last polite layer. After this she stops dressing for men she hasn't decided on. Shot 8 is sheet and skin. Shot 9 is the close.",
        grant: "The slip is yours. Polite is over. The private set is next.",
        story:
          "The slip was a costume. Shot 8 is the nude with no performance. Shot 9 is the close-up she doesn't give the room.",
        drop: "84% quit before polite ends. That's why the last two shots cost what they cost.",
        media: "grant:rev_7.jpg",
        type: "photo",
        pos: "center",
        price: P[7],
      },
      {
        id: "rev_8",
        step: 8,
        title: "Uncovered",
        tease:
          "Sheet. Skin. Full nude, no performance. This is the private set. The last unlock is the close-up — and she caps how many men get it.",
        grant: "You have the private set. One shot left.",
        story:
          "You can leave her uncovered and tell yourself you're satisfied. Or you take the last close-up. She caps it at 48.",
        drop: "89% never see the private set. They got shy when it stopped being a tease.",
        media: "grant:rev_8.jpg",
        type: "photo",
        pos: "center 40%",
        price: P[8],
      },
      {
        id: "rev_9",
        step: 9,
        title: "Climax — Full Grant",
        tease:
          "The last frontal. Full body. The close she doesn't give the room. She will not reshoot this because you got cheap at the door.",
        grant: "She let you see everything. This set is finished.",
        story:
          "This is the nude the whole strip was built to make you buy. You didn't buy a folder. You finished her.",
        drop: "93% of men who start this set never see the last frame. The ones who do don't come back hunting free nudes.",
        media: "grant:rev_9.jpg",
        type: "photo",
        pos: "center bottom",
        price: P[9],
        climax: true,
      },
    ],
  },
  {
    id: "lad_curve",
    slug: "the-curve",
    title: "The Curve",
    theme: "worship",
    tagline: "She turns around when you've earned the back.",
    description:
      "Ass worship, shot by shot. Over the shoulder, silk on her spine, then the close-ups men replay. She faces away because she can — and because that's the hunger she priced.",
    cover: "/media/liora-00-the-curve-cover.jpg",
    sort: 2,
    collectors: 0,
    climax: 0,
    discount: 0.32,
    shots: [
      {
        id: "crv_1",
        step: 1,
        title: "Over the Shoulder",
        tease:
          "She turned because asking for the back is the whole game. This is the cheapest way she lets you admit it. Shot 2 is silk on her spine.",
        grant: "You have the turn. She knows what you came for.",
        story:
          "The face was a courtesy. The rest of this set is the curve. Shot 2 is the drape.",
        drop: "",
        media: "grant:crv_1.jpg",
        type: "photo",
        pos: "center 20%",
        price: P[1],
      },
      {
        id: "crv_2",
        step: 2,
        title: "The Drape",
        tease:
          "Silk on a back is a delay tactic. She uses it well. The line underneath — from the small of her back down — is Shot 3.",
        grant: "You have the drape. Patience is being rewarded.",
        story:
          "The drape is her enjoying the wait. Shot 3 is hips. Stay on the line.",
        drop: "38% admit the hunger, then flinch. She priced the drape to catch them.",
        media: "grant:crv_2.jpg",
        type: "photo",
        pos: "center",
        price: P[2],
      },
      {
        id: "crv_3",
        step: 3,
        title: "The Line",
        tease:
          "From the small of her back down. This is where most men lean in — and where half of them still leave. Shot 4 she holds the pose.",
        grant: "You have the line. Don't waste it.",
        story:
          "Hips. The study starts here. Shot 4 she holds longer for men who don't rush the close.",
        drop: "51% never stay on the line long enough. They wanted the ending handed to them.",
        media: "grant:crv_3.jpg",
        type: "photo",
        pos: "center 30%",
        price: P[3],
      },
      {
        id: "crv_4",
        step: 4,
        title: "Held",
        tease:
          "She holds the pose longer for men who stay. That's not generosity. That's a test you already started passing. Shot 5 is gold light on the curve.",
        grant: "She's holding still for you.",
        story:
          "A held pose is the upgrade. Shot 5 is rim light — the study frame men save.",
        drop: "61% never get a pose held for them. They were still browsing.",
        media: "grant:crv_4.jpg",
        type: "photo",
        pos: "center 60%",
        price: P[4],
      },
      {
        id: "crv_5",
        step: 5,
        title: "Gold Light",
        tease:
          "Rim light on the curve. This is the study frame. After this she stops needing to show you her face. Shot 6 is cropped. Honest.",
        grant: "You have the study frame. Worship starts here.",
        story:
          "The study is still polite. Shot 6 is cropped. No face. She doesn't need to look at you to keep you here.",
        drop: "70% never get the study. They left when the set stopped pretending to be a portrait.",
        media: "grant:crv_5.jpg",
        type: "photo",
        pos: "center 70%",
        price: P[5],
      },
      {
        id: "crv_6",
        step: 6,
        title: "Closer",
        tease:
          "Cropped. No face. She doesn't need to look at you anymore. That's when it gets honest. Shot 7 is side-lying, unposed — rarer than an arch.",
        grant: "You have the close study. She isn't performing now.",
        story:
          "No face means she's done performing. Shot 7 is the curve without the pose.",
        drop: "78% never see her without the performance. They needed the over-the-shoulder to feel safe.",
        media: "grant:crv_6.jpg",
        type: "photo",
        pos: "center 55%",
        price: P[6],
      },
      {
        id: "crv_7",
        step: 7,
        title: "On Silk",
        tease:
          "Side-lying. The curve without the pose. Unposed is rarer than arched — that's why it costs more. Shot 8 is the frame men screenshot.",
        grant: "She's not posing anymore. Shot 8 is the frame men save.",
        story:
          "Unposed is intimacy. Shot 8 is the offered frame. Shot 9 is the close-up with nothing left to drape.",
        drop: "84% never see her unposed. They wanted the postcard, not the room.",
        media: "grant:crv_7.jpg",
        type: "photo",
        pos: "center 80%",
        price: P[7],
      },
      {
        id: "crv_8",
        step: 8,
        title: "Offered",
        tease:
          "This is the frame men screenshot. She knows. The last unlock is the close-up — full worship, no robe, no delay.",
        grant: "You have the offered pose. One close-up left.",
        story:
          "Offered is still a pose. Shot 9 is the last close-up of the curve. No robe left to hide behind.",
        drop: "89% never get the offer. They stalled when the set got expensive on purpose.",
        media: "grant:crv_8.jpg",
        type: "photo",
        pos: "bottom",
        price: P[8],
      },
      {
        id: "crv_9",
        step: 9,
        title: "Climax — Full Worship",
        tease:
          "The last close-up. Full curve. No robe, no delay. This is the worship you climbed for. She does not redo it.",
        grant: "Full worship. You finished the back. She noticed.",
        story:
          "You didn't buy an ass shot. You finished a strip she designed so stopping would feel stupid.",
        drop: "93% of men who start this set never see the last close. The ones who do stop calling it a fetish and start calling it finished.",
        media: "grant:crv_9.jpg",
        type: "photo",
        pos: "center bottom",
        price: P[9],
        climax: true,
      },
    ],
  },
  {
    id: "lad_pedestal",
    slug: "the-pedestal",
    title: "The Pedestal",
    theme: "feet",
    tagline: "You start at the floor. She lets you stay there.",
    description:
      "Feet, shot like a ritual. Heels first, then the extend, then soles. Built for men who already know this is not a side dish — and who will pay to be kept on the floor.",
    cover: "/media/liora-00-the-pedestal-cover.jpg",
    sort: 3,
    collectors: 0,
    climax: 0,
    discount: 0.3,
    shots: [
      {
        id: "ped_1",
        step: 1,
        title: "Heels",
        tease:
          "Crossed ankles. Permission on this set always starts at the shoes. This is how she lets you admit where you're looking. Shot 2 she recrosses them.",
        grant: "You have the heels. Sit down.",
        story:
          "Shoes are a courtesy. Shot 2 she recrosses. That's not accidental. That's her noticing you stayed on the floor.",
        drop: "",
        media: "grant:ped_1.jpg",
        type: "photo",
        pos: "center 70%",
        price: P[1],
      },
      {
        id: "ped_2",
        step: 2,
        title: "The Cross",
        tease:
          "She recrossed them. That's not a fidget. A woman who recrosses for you is already deciding how far the inspection goes. Shot 3 is one foot toward the lens.",
        grant: "You have the recross. She knows you're looking down.",
        story:
          "The recross is her noticing you. Shot 3 is one foot toward the lens. A test. Don't flinch.",
        drop: "38% look, then pretend they were here for the face. She priced the recross to drop them.",
        media: "grant:ped_2.jpg",
        type: "photo",
        pos: "center 85%",
        price: P[2],
      },
      {
        id: "ped_3",
        step: 3,
        title: "Extended",
        tease:
          "One foot toward the lens. This is a test. Men who flinch never get the anklet — and never get bare.",
        grant: "You have the extend. You passed the test.",
        story:
          "The extend is the interview. Shot 4 is gold on the ankle. She only wears it for the private set.",
        drop: "51% fail the extend. They wanted a tease, not a pedestal.",
        media: "grant:ped_3.jpg",
        type: "photo",
        pos: "center 60%",
        price: P[3],
      },
      {
        id: "ped_4",
        step: 4,
        title: "Anklet",
        tease:
          "Gold on the ankle. She only wears it for the private set. Shoes come off next. That's the real ladder.",
        grant: "The anklet is yours. Shoes come off next.",
        story:
          "Jewelry is a private-set signal. Shot 5 is shoes off. Everything before this was a costume.",
        drop: "61% never see the anklet. They left while she still had shoes on.",
        media: "grant:ped_4.jpg",
        type: "photo",
        pos: "center 80%",
        price: P[4],
      },
      {
        id: "ped_5",
        step: 5,
        title: "Bare",
        tease:
          "Shoes off. This is the real set. Heels were a costume. Bare is the hunger you actually paid to confess. Shot 6 she holds the foot still for you.",
        grant: "Shoes off. The heels were a costume.",
        story:
          "Bare is the admission. Shot 6 she holds the foot in frame. No fidgeting. For you.",
        drop: "70% never get shoes off. They were window-shopping a fetish they wouldn't pay for.",
        media: "grant:ped_5.jpg",
        type: "photo",
        pos: "center 40%",
        price: P[5],
      },
      {
        id: "ped_6",
        step: 6,
        title: "Held Still",
        tease:
          "She holds the foot in frame. No fidgeting. For you. The next unlock is soles — the shot the other collectors climbed for.",
        grant: "She's holding still. Don't blink.",
        story:
          "Held still is her side of the ritual. Shot 7 is soles. That's why men are on this set.",
        drop: "78% never get a foot held still for them. They rushed. She doesn't reward rushing.",
        media: "grant:ped_6.jpg",
        type: "photo",
        pos: "bottom",
        price: P[6],
      },
      {
        id: "ped_7",
        step: 7,
        title: "Soles",
        tease:
          "This is the shot the other collectors came for. Soles. After this, the study — then the last inspection.",
        grant: "You have her soles. That's the shot this set exists for.",
        story:
          "Soles are the confession. Shot 8 is the study: close, soft, a private inspection. Shot 9 is arch, sole, anklet — held.",
        drop: "84% never get soles. They called it a side dish and bounced at heels.",
        media: "grant:ped_7.jpg",
        type: "photo",
        pos: "center",
        price: P[7],
      },
      {
        id: "ped_8",
        step: 8,
        title: "Study",
        tease:
          "Close. Soft. No performance. A private inspection. The last unlock is the full pedestal — arch, sole, anklet, held.",
        grant: "You have the study. She let you look this long.",
        story:
          "This is her letting you look. Shot 9 is the last close-up. She doesn't reshoot an inspection.",
        drop: "89% never get the inspection. They got shy when it got close.",
        media: "grant:ped_8.jpg",
        type: "photo",
        pos: "center 20%",
        price: P[8],
      },
      {
        id: "ped_9",
        step: 9,
        title: "Climax — Full Pedestal",
        tease:
          "The last close-up. Arch, sole, anklet. Held for the inspection. She doesn't redo this because you got cheap on the floor.",
        grant: "Full pedestal. You finished at her feet. That's the point.",
        story:
          "You didn't buy feet. You finished a ritual she designed so the floor would feel like a throne.",
        drop: "93% of men who start this set never see the last inspection. The ones who do don't pretend it was a side dish.",
        media: "grant:ped_9.jpg",
        type: "photo",
        pos: "center bottom",
        price: P[9],
        climax: true,
      },
    ],
  },
];

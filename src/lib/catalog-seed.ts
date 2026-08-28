/** Seed catalog — Liora, three parallel ladders, 9 shots each.
 *  Copy: every tease sells the NEXT yes. Grants confer status.
 *  Drops sting quitters. Stories make N require N+1.
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
    tagline: "She faces you when you've earned the next yes.",
    description:
      "Nine frontal permissions. Gaze, robe, lace, then the private set. She undresses in order because men who rush never see the last close — and she knows that's what you came for.",
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
          "She looked into the lens like she'd already decided you were staying. This is the cheapest yes she sells. That's the trap.",
        grant: "You've been granted the invitation. She knows your name now.",
        story:
          "Shot 1 is how she lets tourists in. Shot 2 is where the silk moves. Men who stop at the look never find out if she meant it.",
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
          "Silk doesn't slip unless she lets it. She let it. The next yes is what the silk was covering.",
        grant: "You've been granted the robe. She let it fall for you — not the room.",
        story:
          "A robe that moves is a delay she enjoys watching you fail. Lace is underneath. That's the measurement.",
        drop: "38% of men pay for the look and bounce. She priced Shot 2 so the tourists self-select out.",
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
          "Black lace. No smile. She's measuring whether you can sit in a delay without demanding the end.",
        grant: "You've been granted lace. Most men stop here. That's why she still has a last frame to give.",
        story:
          "Lace is not the gift. Lace is the test. She sits down in Shot 4 for men who pass it.",
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
          "She sat down. That means she's not performing for a crowd anymore. The bed is a private room now.",
        grant: "You've been granted the edge of her bed. Preferred access starts at Shot 5.",
        story:
          "Sitting down is a decision. The look she saves comes next — the one she doesn't give men who are still browsing.",
        drop: "61% of collectors never see her sit. They wanted a dump. She doesn't dump.",
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
          "This is the look she withholds. If you felt picked, that's the mechanism. She doesn't look at a crowd like this.",
        grant: "You've been chosen. She is looking at you. Not a room. Not a feed.",
        story:
          "The look is the status. Motion is rarer. Shot 6 is six seconds she will not reshoot.",
        drop: "70% never get chosen. They left when the price started to sting. You're still here. She noticed.",
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
          "Six seconds. She lets the robe move on purpose. You don't get this as a still. You get it as a breath.",
        grant: "You've been granted motion. Watch it. She did this once.",
        story:
          "Still frames you can pause. Motion you can't. After this, polite is over. Shot 7 is the last layer that still pretends to be clothing.",
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
          "The slip is the last polite layer. After this she stops dressing for men she hasn't decided on.",
        grant: "You've been granted silk. Polite is over. The private set is next.",
        story:
          "Polite is a costume. Shot 8 is sheet, skin, no performance. Shot 9 is the close she doesn't give the room.",
        drop: "84% quit before polite ends. That's why the last two frames cost what they cost.",
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
          "Sheet. Skin. Full nude, no performance. This is the private set. The last yes is the close — and she caps how many men get it.",
        grant: "You've been granted the private set. Inner circle is one yes away.",
        story:
          "You can leave her uncovered and tell yourself you're satisfied. Or you take the last yes — the frontal close 37 men have. The cap is 48.",
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
          "The last frontal. Full body. The close she doesn't give the room. She will not reshoot a climax because you got cheap at the door.",
        grant: "She let you see everything. You don't get to be a tourist after this.",
        story:
          "This is the frame the ladder was built to make inevitable. You didn't buy a nude. You finished a yes.",
        drop: "93% of men who start this ladder never see the last frame. The ones who do don't come back as tourists.",
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
      "Ass worship, sequenced. The look over the shoulder, the drape, then the close studies men replay. She faces away because she can — and because that's the hunger she priced.",
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
          "She turned because asking for the back is the whole game. This is the cheapest way she lets you admit it.",
        grant: "You've been granted the turn. She knows what you came for.",
        story:
          "The face is a courtesy. The back is the product. Shot 2 is silk on a spine — a delay she uses well.",
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
          "Silk on a back is a delay tactic. She uses it well. The line underneath is what you actually bought a ticket for.",
        grant: "You've been granted the drape. Patience is being rewarded.",
        story:
          "The drape is her enjoying the wait. Shot 3 is from the small of her back down. That's the line. Stay on it.",
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
          "From the small of her back down. This is where most men lean in — and where half of them still leave.",
        grant: "You've been granted the line. Don't waste it.",
        story:
          "The line is the study. Shot 4 she holds longer for men who don't rush the curve. That's how preferred starts.",
        drop: "51% never stay on the line long enough. They wanted a dump of the ending.",
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
          "She holds the pose longer for preferred collectors. That's not generosity. That's a test you already started passing.",
        grant: "You've been granted a held pose. Preferred.",
        story:
          "Held is status. Shot 5 is rim light on the worship — the study frame men save.",
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
          "Rim light on the curve. This is the study frame. After this she stops needing to show you her face.",
        grant: "You've been granted the study frame. Worship starts here.",
        story:
          "The study is still polite. Shot 6 is cropped. No face. She doesn't need to look at you to keep you here.",
        drop: "70% never get the study. They left when the ladder stopped pretending to be a portrait.",
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
          "Cropped. No face. She doesn't need to look at you anymore. That's when the worship gets honest.",
        grant: "You've been granted the close study. She isn't performing now.",
        story:
          "No face means she's done performing. Shot 7 is the curve without the pose — side-lying, unoffered, rarer.",
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
          "Side-lying. The curve without the pose. Unoffered is rarer than arched — that's why it costs more.",
        grant: "You've been granted the unposed curve. Inner circle from here.",
        story:
          "Unoffered is intimacy. Shot 8 is the offered frame — the one men screenshot. She knows. Shot 9 is the close with nothing left to drape.",
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
          "This is the frame men screenshot. She knows. The last yes is the close — full worship, no robe, no delay.",
        grant: "You've been granted the offered pose. One close left.",
        story:
          "Offered is still a pose. Shot 9 is the last close-up of the curve. No robe left to hide behind. 29 men have it. The cap is 48.",
        drop: "89% never get the offer. They stalled when the ladder got expensive on purpose.",
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
        grant: "Full worship granted. You finished the back. She noticed.",
        story:
          "You didn't buy an ass shot. You finished a climb she designed so stopping would feel stupid.",
        drop: "93% of men who start this ladder never see the last close. The ones who do stop calling it a fetish and start calling it finished.",
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
      "Feet, sequenced like a ritual. Heels first, then the extend, then soles. Built for men who already know this is not a side dish — and who will pay to be kept on the floor.",
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
          "Crossed ankles. Permission always starts at the shoes. This is how she lets you admit where you're looking.",
        grant: "You've been granted the heels. Sit down.",
        story:
          "Shoes are a courtesy. Shot 2 she recrosses them. That's not accidental. That's her noticing you stayed on the floor.",
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
          "She recrossed them. That's not accidental. A woman who recrosses for you is already deciding how far the inspection goes.",
        grant: "You've been granted the recross. She is aware of you.",
        story:
          "Awareness is the product. Shot 3 is one foot toward the lens. A test. Don't flinch.",
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
        grant: "You've been granted the extend. You passed the test.",
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
        grant: "You've been granted the anklet. Preferred.",
        story:
          "Jewelry is a private-set signal. Shot 5 is shoes off. Everything before this was a courtesy.",
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
          "Shoes off. This is the real ladder. Heels were a costume. Bare is the hunger you actually paid to confess.",
        grant: "You've been granted bare. The shoes were a courtesy.",
        story:
          "Bare is admission. Shot 6 she holds the foot in frame. No fidgeting. For you. Don't waste it.",
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
          "She holds the foot in frame. No fidgeting. For you. The next yes is soles — the shot the other collectors climbed for.",
        grant: "You've been granted a held still. Don't blink.",
        story:
          "Held still is obedience from her side. Shot 7 is soles. That's why 156 men are on this ladder.",
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
        grant: "You've been granted soles. Inner circle.",
        story:
          "Soles are the confession. Shot 8 is the study: close, soft, a private inspection. Shot 9 is arch, sole, anklet — the close she doesn't redo.",
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
          "Close. Soft. No performance. A private inspection. The last yes is the full pedestal — arch, sole, anklet, held.",
        grant: "You've been granted the study. She let you look this long.",
        story:
          "The study is time. Shot 9 is the last close-up. 22 men have it. The cap is 48. She doesn't reshoot an inspection.",
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
        grant: "Full pedestal granted. You finished at her feet. That's the point.",
        story:
          "You didn't buy feet. You finished a ritual she designed so the floor would feel like a throne.",
        drop: "93% of men who start this ladder never see the last inspection. The ones who do don't pretend it was a side dish.",
        media: "grant:ped_9.jpg",
        type: "photo",
        pos: "center bottom",
        price: P[9],
        climax: true,
      },
    ],
  },
];

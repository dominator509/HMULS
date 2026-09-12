import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PERSONAL_FANTASY_PATTERN,
  COPY_STYLE,
  PERSONAL_FANTASY_HYBRID_PATTERN,
  PSYCH_LEVERS,
  applyNarrativeToDraft,
  buildNarrativeUserMessage,
  defaultLadderSpecs,
  narrativeSystemPrompt,
  parseMuseNarrative,
} from "./narrative-formula.ts";

describe("narrative formula", () => {
  it("defaults copyStyle to personal-fantasy-hybrid", () => {
    assert.equal(COPY_STYLE, "personal-fantasy-hybrid");
    assert.equal(PERSONAL_FANTASY_HYBRID_PATTERN.id, "personal-fantasy-hybrid");
    assert.equal(PERSONAL_FANTASY_HYBRID_PATTERN.label, "Personal fantasy hybrid");
    assert.ok(PERSONAL_FANTASY_HYBRID_PATTERN.beats.length >= 5);
    assert.equal(PERSONAL_FANTASY_PATTERN, PERSONAL_FANTASY_HYBRID_PATTERN);
  });

  it("encodes all ten psych levers and Engrish ban in system prompt", () => {
    const sys = narrativeSystemPrompt();
    assert.match(sys, /Progressive revelation/);
    assert.match(sys, /Specificity/);
    assert.match(sys, /choose-you/);
    assert.match(sys, /Scarcity/);
    assert.match(sys, /private-set|personal-fantasy/);
    assert.match(sys, /Anticipation loop/);
    assert.match(sys, /gacha/);
    assert.match(sys, /Second person/);
    assert.match(sys, /Desire first/);
    assert.match(sys, /Archetype congruence/);
    assert.match(sys, /24–34|24-34/);
    assert.match(sys, /Never minors/);
    assert.match(sys, /personal-fantasy-hybrid/);
    assert.match(sys, /BAN Engrish|Engrish/);
    assert.match(sys, /very sexy beautiful/);
    assert.match(sys, /native American English/);
    assert.match(sys, /private fantasy|FEW-SHOT|You weren't supposed to find/);
    assert.match(sys, /chosen|she kept you|for you/i);
    assert.equal(PSYCH_LEVERS.length, 10);
    const desire = PSYCH_LEVERS.find((l) => l.id === "desire_first");
    assert.ok(desire?.tip.includes("Personal-fantasy") || desire?.tip.includes("personal-fantasy"));
    const second = PSYCH_LEVERS.find((l) => l.id === "second_person");
    assert.ok(second?.tip.includes("private fantasy") || second?.tip.includes("Draw him in"));
    const poss = PSYCH_LEVERS.find((l) => l.id === "possession");
    assert.ok(poss?.tip.includes("Personal-fantasy") || poss?.tip.includes("chosen"));
  });

  it("builds from-identity user message with owner brief and copyStyle", () => {
    const msg = buildNarrativeUserMessage({
      mode: "from_identity",
      stageName: "Nyx",
      looks: "mahogany skin, LED ink",
      ownerBrief: "more dominant; lean chrome; avoid soft silk",
      ladders: defaultLadderSpecs(["frontal"]),
    });
    assert.match(msg, /FROM IDENTITY/);
    assert.match(msg, /Nyx/);
    assert.match(msg, /Owner brief/);
    assert.match(msg, /more dominant/);
    assert.match(msg, /The Reveal/);
    assert.match(msg, /personal-fantasy-hybrid/);
    assert.match(msg, /ZERO Engrish|Engrish/);
  });

  it("builds reverse-from-frames with FRAME notes", () => {
    const msg = buildNarrativeUserMessage({
      mode: "reverse_frames",
      stageName: "Liora",
      ladders: [
        {
          theme: "frontal",
          title: "The Reveal",
          shots: [
            {
              step: 1,
              id: "rev_1",
              visualBeat: "Doorway. Cream silk robe. Gold moon.",
            },
          ],
        },
      ],
    });
    assert.match(msg, /REVERSE FROM FRAMES/);
    assert.match(msg, /FRAME: Doorway/);
    assert.match(msg, /personal-fantasy-hybrid/);
  });

  it("builds respin with identity lock note", () => {
    const msg = buildNarrativeUserMessage({
      mode: "respin",
      stageName: "Nyx",
      looks: "LED violet circuitry",
      respinNote: "more cyber",
      prior: {
        looks: "LED violet circuitry",
        voice: "Low, precise",
        teaseStyle: "From the frame",
        scenario: "You found her in the void channel.",
        photosets: [],
      },
      ladders: defaultLadderSpecs(["worship"]),
    });
    assert.match(msg, /RESPIN/);
    assert.match(msg, /more cyber/);
    assert.match(msg, /age band/);
    assert.match(msg, /personal-fantasy-hybrid/);
  });

  it("parses muse narrative JSON", () => {
    const parsed = parseMuseNarrative(
      JSON.stringify({
        looks: "late 20s",
        voice: "quiet",
        teaseStyle: "from frame",
        scenario: "You stay because she already decided.",
        photosets: [
          {
            theme: "frontal",
            hook: "She kept the robe on.",
            tease: "A night, not a folder.",
            shots: {
              rev_1: {
                visual: "Doorway",
                tease: "Shot 2 moves.",
                grant: "Unlocked.",
                story: "The look lets you in.",
                drop: "",
              },
            },
          },
        ],
      }),
    );
    assert.ok(parsed);
    assert.equal(parsed!.scenario.includes("decided"), true);
    assert.equal(parsed!.photosets[0]!.hook.includes("robe"), true);
  });

  it("applyNarrativeToDraft fills empty without overwrite", () => {
    const next = applyNarrativeToDraft(
      { looks: "kept", voice: "", teaseStyle: "", bio: "kept bio" },
      {
        looks: "new looks",
        voice: "new voice",
        teaseStyle: "new style",
        scenario: "new scenario",
        photosets: [],
      },
      { overwrite: false },
    );
    assert.equal(next.looks, "kept");
    assert.equal(next.voice, "new voice");
    assert.equal(next.bio, "kept bio");
  });

  it("applyNarrativeToDraft overwrites when requested", () => {
    const next = applyNarrativeToDraft(
      { looks: "kept", voice: "old", teaseStyle: "old", bio: "old" },
      {
        looks: "new",
        voice: "new",
        teaseStyle: "new",
        scenario: "scenario",
        photosets: [],
      },
      { overwrite: true },
    );
    assert.equal(next.looks, "new");
    assert.equal(next.bio, "scenario");
  });
});

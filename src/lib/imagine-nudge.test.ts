import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isModerationStatus,
  isModerationText,
  promptsDiffer,
  softenHeavy,
  softenLight,
} from "./imagine-nudge.ts";

describe("imagine nudge", () => {
  it("detects Imagine safety rejections", () => {
    assert.equal(isModerationText("Your request was rejected as a result of our safety system."), true);
    assert.equal(isModerationStatus(400, '{"error":{"code":"content_policy_violation"}}'), true);
    assert.equal(isModerationStatus(500, "internal"), false);
  });

  it("eases explicit tokens without rewriting the pose", () => {
    const original =
      "Liora sits on the bed edge, cream silk robe, gold moon necklace, fully nude, nipples visible, legs spread toward the lens, 85mm cinematic.";
    const eased = softenLight(original);
    assert.equal(eased.changed, true);
    assert.match(eased.prompt, /Liora sits on the bed edge/);
    assert.match(eased.prompt, /gold moon necklace/);
    assert.doesNotMatch(eased.prompt, /\bnude\b/i);
    assert.doesNotMatch(eased.prompt, /\bnipples\b/i);
    assert.doesNotMatch(eased.prompt, /legs spread/i);
    assert.match(eased.prompt, /knees parted/);
    assert.match(eased.prompt, /consenting adult woman/);
  });

  it("keeps a clean prompt almost intact", () => {
    const original =
      "Photoreal editorial still of an adult woman in a cream silk robe, doorway, 85mm.";
    const eased = softenLight(original);
    assert.match(eased.prompt, /cream silk robe/);
    assert.match(eased.prompt, /doorway/);
  });

  it("heavy veil still names the garment story", () => {
    const original = "Climax still: fully nude, genitals, explicit, cream robe on the floor, gold anklet.";
    const heavy = softenHeavy(original);
    assert.match(heavy.prompt, /gold anklet/);
    assert.match(heavy.prompt, /robe/);
    assert.doesNotMatch(heavy.prompt, /\bgenitals\b/i);
    assert.match(heavy.prompt, /\bimplied\b/i);
    assert.match(heavy.prompt, /Editorial boudoir/);
  });

  it("promptsDiffer ignores whitespace", () => {
    assert.equal(promptsDiffer("a  b", "a b"), false);
    assert.equal(promptsDiffer("a", "b"), true);
  });
});

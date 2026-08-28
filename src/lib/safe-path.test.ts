import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, it } from "node:test";
import { containedPublicPath, MARKETING_FILES, isMarketingFilename } from "./safe-path.ts";
import { SEED_LADDERS } from "./catalog-seed.ts";
import { CANONICAL_ORIGIN, originOf } from "./seo.ts";

const ROOT = process.cwd();

describe("containedPublicPath", () => {
  const cwd = "/workspace";
  it("allows media and uploads files", () => {
    assert.match(containedPublicPath("/media/hero.jpg", cwd), /public\/media\/hero\.jpg$/);
    assert.match(containedPublicPath("/uploads/cover.jpg", cwd), /public\/uploads\/cover\.jpg$/);
  });
  it("rejects traversal", () => {
    assert.throws(() => containedPublicPath("/media/../.env", cwd));
    assert.throws(() => containedPublicPath("/media/foo/../../package.json", cwd));
    assert.throws(() => containedPublicPath("/uploads/../src/lib/db.ts", cwd));
    assert.throws(() => containedPublicPath("/media/%2e%2e/secret", cwd));
    assert.throws(() => containedPublicPath("/etc/passwd", cwd));
    assert.throws(() => containedPublicPath("/media", cwd));
  });
});

describe("seed paid originals", () => {
  const shots = SEED_LADDERS.flatMap((l) => l.shots);

  it("every published shot uses a grant: URL, never a public /media original", () => {
    const bad = shots.filter((s) => !s.media.startsWith("grant:"));
    assert.deepEqual(bad.map((s) => `${s.id}:${s.media}`), []);
  });

  it("every grant file exists in private-media/", () => {
    const missing = shots.filter((s) => {
      const name = s.media.slice("grant:".length);
      return !existsSync(join(ROOT, "private-media", name));
    });
    assert.deepEqual(
      missing.map((s) => s.media),
      [],
    );
  });

  it("no seed shot uses a public marketing filename as the paid original", () => {
    const hits = shots.filter((s) => {
      const base = s.media.split("/").pop() || "";
      return (MARKETING_FILES as readonly string[]).includes(base);
    });
    assert.deepEqual(
      hits.map((s) => `${s.id}:${s.media}`),
      [],
    );
  });

  it("public/media files are not byte-identical to private originals", () => {
    const priv = new Map<string, string>();
    for (const name of readdirSync(join(ROOT, "private-media"))) {
      const buf = readFileSync(join(ROOT, "private-media", name));
      priv.set(createHash("sha256").update(buf).digest("hex"), name);
    }
    const collisions: string[] = [];
    for (const name of readdirSync(join(ROOT, "public/media"))) {
      const buf = readFileSync(join(ROOT, "public/media", name));
      const hash = createHash("sha256").update(buf).digest("hex");
      const paid = priv.get(hash);
      if (paid) collisions.push(`${name}=${paid}`);
    }
    assert.deepEqual(collisions, []);
  });

  it("covers are marketing names, not grant originals", () => {
    for (const lad of SEED_LADDERS) {
      assert.equal(lad.cover.startsWith("/media/"), true);
      assert.equal(isMarketingFilename(lad.cover), true);
    }
  });
});

describe("canonical origin", () => {
  it("defaults empty legal URL to sheundresses.com", () => {
    assert.equal(originOf(""), CANONICAL_ORIGIN);
    assert.equal(originOf("sheundresses.com"), CANONICAL_ORIGIN);
    assert.equal(originOf("https://sheundresses.com/"), CANONICAL_ORIGIN);
  });
});

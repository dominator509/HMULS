import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canOfferDownload,
  downloadFilename,
  extFromContentType,
  labelForExt,
  offersForMedia,
} from "./download-media.ts";

describe("download-media", () => {
  it("maps content types to extensions", () => {
    assert.equal(extFromContentType("image/jpeg; charset=binary"), "jpg");
    assert.equal(extFromContentType("image/png"), "png");
    assert.equal(extFromContentType("video/mp4"), "mp4");
    assert.equal(extFromContentType("video/webm"), "webm");
    assert.equal(extFromContentType(null), null);
  });

  it("labels formats for a11y CTAs", () => {
    assert.equal(labelForExt("jpg"), "Download JPG");
    assert.equal(labelForExt("png"), "Download PNG");
    assert.equal(labelForExt("mp4"), "Download MP4");
  });

  it("offers JPG + canvas PNG for typical stills", () => {
    const offers = offersForMedia({ mediaType: "photo", contentType: "image/jpeg" });
    assert.deepEqual(
      offers.map((o) => [o.id, o.label, o.mode]),
      [
        ["original", "Download JPG", "direct"],
        ["png", "Download PNG", "canvas-png"],
      ],
    );
  });

  it("offers only PNG when grant is already PNG (e.g. stamped)", () => {
    const offers = offersForMedia({ mediaType: "photo", contentType: "image/png" });
    assert.equal(offers.length, 1);
    assert.equal(offers[0]!.label, "Download PNG");
    assert.equal(offers[0]!.mode, "direct");
  });

  it("offers MP4 for video and WebM only when already available", () => {
    assert.deepEqual(
      offersForMedia({ mediaType: "video" }).map((o) => o.label),
      ["Download MP4"],
    );
    assert.deepEqual(
      offersForMedia({ mediaType: "video", webmAvailable: true }).map((o) => o.label),
      ["Download MP4", "Download WebM"],
    );
    assert.deepEqual(
      offersForMedia({ mediaType: "video", contentType: "video/webm" }).map((o) => o.label),
      ["Download WebM"],
    );
  });

  it("requires a grant media URL and blocks locked shots", () => {
    assert.equal(canOfferDownload({ unlocked: true, mediaUrl: "/api/media/x?k=1" }), true);
    assert.equal(canOfferDownload({ unlocked: false, mediaUrl: "/api/media/x?k=1" }), false);
    assert.equal(canOfferDownload({ unlocked: true, mediaUrl: null }), false);
    assert.equal(canOfferDownload({ mediaUrl: "/api/media/x" }), true);
  });

  it("builds safe filenames", () => {
    assert.equal(downloadFilename("The Invitation!", "jpg"), "the-invitation.jpg");
    assert.equal(downloadFilename("!!!", "mp4"), "shot.mp4");
  });
});

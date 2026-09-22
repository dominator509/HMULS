import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractTxId,
  failedTxBody,
  failedTxSubject,
  normalizeFailedTxReport,
  shortTxId,
} from "./failed-transaction.ts";

describe("failed-transaction helpers", () => {
  it("extracts txid from explorer URLs", () => {
    const sol = extractTxId("https://solscan.io/tx/Abc123XYZ4567890abcdef");
    assert.equal(sol.txid, "Abc123XYZ4567890abcdef");
    assert.ok(sol.explorerUrl?.includes("solscan"));

    const eth = extractTxId("https://etherscan.io/tx/0xdeadbeefcafebabe0123456789");
    assert.equal(eth.txid, "0xdeadbeefcafebabe0123456789");

    const raw = extractTxId("  plainTxHashValue99  ");
    assert.equal(raw.txid, "plainTxHashValue99");
    assert.equal(raw.explorerUrl, null);
  });

  it("builds machine-parseable subject", () => {
    const subj = failedTxSubject({
      asset: "SOL",
      txidShort: "Abc12345…cdef",
      accountEmail: "buyer@example.com",
    });
    assert.equal(subj, "[FAILED-TX] SOL Abc12345…cdef buyer@example.com");
  });

  it("normalizes required fields and rejects bad email", () => {
    const bad = normalizeFailedTxReport({
      accountEmail: "not-an-email",
      asset: "SOL",
      txidOrLink: "abcdefghijklmnop",
    });
    assert.equal(bad.ok, false);

    const ok = normalizeFailedTxReport({
      accountEmail: " Buyer@Example.COM ",
      asset: "USDT",
      txidOrLink: "https://etherscan.io/tx/0xabc1234567890def",
      payAddress: "0xpay",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.data.accountEmail, "buyer@example.com");
      assert.equal(ok.data.asset, "USDT");
      assert.equal(ok.data.txid, "0xabc1234567890def");
      assert.equal(ok.data.payAddress, "0xpay");
    }
  });

  it("body includes policy flags and JSON", () => {
    const norm = normalizeFailedTxReport({
      accountEmail: "a@b.co",
      asset: "BTC",
      txidOrLink: "txidlongenough12",
    });
    assert.equal(norm.ok, true);
    if (!norm.ok) return;
    const body = failedTxBody(norm.data, { screenshotAttached: true, screenshotR2Key: "failed-tx/x.png" });
    assert.match(body, /type=FAILED_TX/);
    assert.match(body, /policy_refund=human_approval_only_never_automatic/);
    assert.match(body, /"type": "FAILED_TX"/);
    assert.match(body, /screenshot_r2_key=failed-tx\/x\.png/);
  });

  it("accepts LTC in the asset enum", () => {
    const ok = normalizeFailedTxReport({
      accountEmail: "buyer@example.com",
      asset: "LTC",
      txidOrLink: "ltctxidlongenough99",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.data.asset, "LTC");
  });

  it("shortTxId truncates long hashes", () => {
    assert.equal(shortTxId("abcdefgh"), "abcdefgh");
    assert.equal(shortTxId("abcdefghijklmnop"), "abcdefgh…mnop");
  });
});

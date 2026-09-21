import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOLANA_RPC_URLS,
  fetchRecentBlockhashFromApi,
  fetchRecentBlockhashFromRpc,
  friendlySolPrepareError,
  isInsufficientFundsMessage,
  resolveSolanaRpcUrls,
  sendRawTransactionViaApi,
  sendRawTransactionViaRpc,
  simulateTransactionViaApi,
  simulateTransactionViaRpc,
  SOL_BROADCAST_ERROR,
  SOL_INSUFFICIENT_FUNDS_ERROR,
  SOL_PREPARE_TRANSFER_ERROR,
} from "./sol-recent-blockhash.ts";

describe("resolveSolanaRpcUrls", () => {
  it("puts env URL first and keeps unique defaults", () => {
    const urls = resolveSolanaRpcUrls("https://example-rpc.test/");
    assert.equal(urls[0], "https://example-rpc.test/");
    assert.deepEqual(urls.slice(1), [...DEFAULT_SOLANA_RPC_URLS]);
  });

  it("skips blank env and does not duplicate defaults", () => {
    const urls = resolveSolanaRpcUrls("  ");
    assert.deepEqual(urls, [...DEFAULT_SOLANA_RPC_URLS]);
    const again = resolveSolanaRpcUrls(DEFAULT_SOLANA_RPC_URLS[0]);
    assert.equal(again.filter((u) => u === DEFAULT_SOLANA_RPC_URLS[0]).length, 1);
  });
});

describe("fetchRecentBlockhashFromRpc", () => {
  it("returns blockhash from first successful RPC", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("fail")) {
        return new Response("nope", { status: 403 });
      }
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          value: { blockhash: "HashABC", lastValidBlockHeight: 42 },
        },
      });
    };
    const out = await fetchRecentBlockhashFromRpc(
      ["https://fail.example", "https://ok.example"],
      fetchImpl as typeof fetch,
    );
    assert.deepEqual(out, { blockhash: "HashABC", lastValidBlockHeight: 42 });
    assert.deepEqual(calls, ["https://fail.example", "https://ok.example"]);
  });

  it("throws friendly error with cause when all RPCs fail", async () => {
    const fetchImpl = async () => new Response('{"error":"Access forbidden"}', { status: 403 });
    await assert.rejects(
      () => fetchRecentBlockhashFromRpc(["https://a.example"], fetchImpl as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_PREPARE_TRANSFER_ERROR);
        assert.match(String((err as Error & { cause?: unknown }).cause), /403/);
        return true;
      },
    );
  });

  it("skips RPC json error payloads", async () => {
    const fetchImpl = async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 403, message: "Access forbidden" },
      });
    await assert.rejects(
      () => fetchRecentBlockhashFromRpc(["https://a.example"], fetchImpl as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_PREPARE_TRANSFER_ERROR);
        return true;
      },
    );
  });
});

describe("fetchRecentBlockhashFromApi", () => {
  it("reads same-origin JSON", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      assert.equal(String(input), "/api/sol/recent-blockhash");
      return Response.json({ blockhash: "B1", lastValidBlockHeight: 9 });
    };
    const out = await fetchRecentBlockhashFromApi(fetchImpl as typeof fetch);
    assert.deepEqual(out, { blockhash: "B1", lastValidBlockHeight: 9 });
  });

  it("maps non-OK API to friendly error", async () => {
    const fetchImpl = async () => new Response("no", { status: 502 });
    await assert.rejects(
      () => fetchRecentBlockhashFromApi(fetchImpl as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_PREPARE_TRANSFER_ERROR);
        return true;
      },
    );
  });
});

describe("friendlySolPrepareError", () => {
  it("maps blockhash / 403 noise", () => {
    assert.equal(
      friendlySolPrepareError(new Error('failed to get recent blockhash: Error: 403 : {"jsonrpc":"2.0"}')),
      SOL_PREPARE_TRANSFER_ERROR,
    );
    assert.equal(friendlySolPrepareError(new Error(SOL_PREPARE_TRANSFER_ERROR)), SOL_PREPARE_TRANSFER_ERROR);
    assert.equal(friendlySolPrepareError(new Error("Wallet declined.")), "Wallet declined.");
  });
});

describe("isInsufficientFundsMessage", () => {
  it("detects common RPC / sim wording", () => {
    assert.equal(isInsufficientFundsMessage("insufficient lamports"), true);
    assert.equal(isInsufficientFundsMessage('{"InsufficientFundsForFee":{}}'), true);
    assert.equal(isInsufficientFundsMessage("AccountNotFound"), false);
  });
});

describe("simulateTransactionViaRpc", () => {
  it("ok when err is null", async () => {
    const fetchImpl = async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: { value: { err: null, logs: [] } },
      });
    const out = await simulateTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1, 2, 3]),
      fetchImpl as typeof fetch,
    );
    assert.deepEqual(out, { ok: true });
  });

  it("maps insufficient funds from sim err", async () => {
    const fetchImpl = async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          value: {
            err: "InsufficientFundsForRent",
            logs: ["Program log: insufficient lamports"],
          },
        },
      });
    const out = await simulateTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.insufficientFunds, true);
  });

  it("marks infraFailure when all RPCs fail", async () => {
    const fetchImpl = async () => new Response("no", { status: 503 });
    const out = await simulateTransactionViaRpc(
      ["https://a.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.infraFailure, true);
  });
});

describe("sendRawTransactionViaRpc", () => {
  it("returns signature from first success", async () => {
    const fetchImpl = async () =>
      Response.json({ jsonrpc: "2.0", id: 1, result: "SigABC" });
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([9, 9]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigABC");
  });

  it("throws broadcast error when all fail", async () => {
    const fetchImpl = async () => new Response("no", { status: 500 });
    await assert.rejects(
      () =>
        sendRawTransactionViaRpc(
          ["https://a.example"],
          new Uint8Array([1]),
          fetchImpl as typeof fetch,
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_BROADCAST_ERROR);
        return true;
      },
    );
  });
});

describe("simulateTransactionViaApi / sendRawTransactionViaApi", () => {
  it("simulate API maps JSON body", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      assert.equal(String(input), "/api/sol/simulate");
      assert.equal(init?.method, "POST");
      return Response.json({ ok: false, insufficientFunds: true, detail: "nope" });
    };
    const out = await simulateTransactionViaApi("txb58", fetchImpl as typeof fetch);
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.insufficientFunds, true);
  });

  it("send-raw API returns signature", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      assert.equal(String(input), "/api/sol/send-raw");
      return Response.json({ signature: "S1" });
    };
    assert.equal(await sendRawTransactionViaApi("txb58", fetchImpl as typeof fetch), "S1");
  });
});

describe("friendlySolPrepareError extras", () => {
  it("maps insufficient + broadcast", () => {
    assert.equal(
      friendlySolPrepareError(new Error(SOL_INSUFFICIENT_FUNDS_ERROR)),
      SOL_INSUFFICIENT_FUNDS_ERROR,
    );
    assert.equal(friendlySolPrepareError(new Error(SOL_BROADCAST_ERROR)), SOL_BROADCAST_ERROR);
    assert.equal(
      friendlySolPrepareError(new Error("Transaction simulation failed: insufficient lamports")),
      SOL_INSUFFICIENT_FUNDS_ERROR,
    );
  });
});

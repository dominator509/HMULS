import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_SOLANA_RPC_URLS,
  fetchBlockHeightFromRpc,
  fetchRecentBlockhashFromApi,
  fetchRecentBlockhashFromRpc,
  friendlySolPrepareError,
  isBlockhashExpiredMessage,
  isBlockHeightExpired,
  isInsufficientFundsMessage,
  isPublicnodeRpcUrl,
  isRpcSubmitEndpointRefuse,
  PUBLICNODE_RPC_URL,
  resolveSolanaRpcUrls,
  rpcUrlsForBlockHeight,
  rpcUrlsForSend,
  safeRpcDetail,
  sanitizePairedBlockHeight,
  sendRawTransactionViaApi,
  sendRawTransactionViaRpc,
  simulateTransactionViaApi,
  simulateTransactionViaRpc,
  solBroadcastErrorCode,
  SOL_BLOCKHASH_EXPIRED_ERROR,
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

describe("sanitizePairedBlockHeight / publicnode height", () => {
  it("omits slot-scale height >= lastValidBlockHeight", () => {
    // Production bug: publicnode getBlockHeight ~448M, lastValid ~426M.
    assert.equal(sanitizePairedBlockHeight(448920860, 426961656), undefined);
    assert.equal(sanitizePairedBlockHeight(426961500, 426961656), 426961500);
    assert.equal(sanitizePairedBlockHeight(undefined, 426961656), undefined);
    assert.equal(isBlockHeightExpired(448920860, 426961656), true); // raw junk would false-expire
    const trusted = sanitizePairedBlockHeight(448920860, 426961656);
    assert.equal(trusted, undefined); // callers must not feed junk into isBlockHeightExpired
  });

  it("filters publicnode from height RPC list", () => {
    assert.equal(isPublicnodeRpcUrl(PUBLICNODE_RPC_URL), true);
    assert.deepEqual(
      rpcUrlsForBlockHeight([
        "https://api.mainnet-beta.solana.com",
        PUBLICNODE_RPC_URL,
      ]),
      ["https://api.mainnet-beta.solana.com"],
    );
  });
});

describe("fetchRecentBlockhashFromRpc", () => {
  it("returns blockhash from first successful RPC", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (url.includes("fail")) {
        return new Response("nope", { status: 403 });
      }
      if (body.method === "getBlockHeight") {
        return Response.json({ jsonrpc: "2.0", id: 2, result: 40 });
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
    assert.equal(out.blockhash, "HashABC");
    assert.equal(out.lastValidBlockHeight, 42);
    assert.equal(out.blockHeight, 40);
    // fail blockhash, ok blockhash, then height walk: fail (403), ok height.
    assert.deepEqual(calls, [
      "https://fail.example",
      "https://ok.example",
      "https://fail.example",
      "https://ok.example",
    ]);
  });

  it("omits blockHeight when RPC returns slot-like height > lastValid", async () => {
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getBlockHeight") {
        // publicnode-style slot number paired with real lastValid
        return Response.json({ jsonrpc: "2.0", id: 2, result: 448920860 });
      }
      return Response.json({
        jsonrpc: "2.0",
        id: 1,
        result: {
          value: { blockhash: "HashSlot", lastValidBlockHeight: 426961656 },
        },
      });
    };
    const out = await fetchRecentBlockhashFromRpc(
      ["https://api.mainnet-beta.solana.com"],
      fetchImpl as typeof fetch,
    );
    assert.equal(out.blockhash, "HashSlot");
    assert.equal(out.lastValidBlockHeight, 426961656);
    assert.equal(out.blockHeight, undefined);
  });

  it("skips publicnode for getBlockHeight even when it supplied the blockhash", async () => {
    const heightHosts: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getBlockHeight") {
        heightHosts.push(url);
        return Response.json({ jsonrpc: "2.0", id: 2, result: 426961500 });
      }
      if (url.includes("publicnode")) {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: {
            value: { blockhash: "FromPublicnode", lastValidBlockHeight: 426961656 },
          },
        });
      }
      return new Response("nope", { status: 403 });
    };
    const out = await fetchRecentBlockhashFromRpc(
      ["https://api.mainnet-beta.solana.com", PUBLICNODE_RPC_URL],
      fetchImpl as typeof fetch,
    );
    assert.equal(out.blockhash, "FromPublicnode");
    // Height only probed on mainnet (publicnode filtered out of height list).
    assert.deepEqual(heightHosts, ["https://api.mainnet-beta.solana.com"]);
    assert.equal(out.blockHeight, 426961500);
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

  it("drops bogus API blockHeight >= lastValid so pre-broadcast expiry is not false-triggered", async () => {
    const fetchImpl = async () =>
      Response.json({
        blockhash: "B2",
        lastValidBlockHeight: 426961656,
        blockHeight: 448920860,
      });
    const out = await fetchRecentBlockhashFromApi(fetchImpl as typeof fetch);
    assert.deepEqual(out, { blockhash: "B2", lastValidBlockHeight: 426961656 });
    assert.equal("blockHeight" in out, false);
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
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        });
      }
      return Response.json({ jsonrpc: "2.0", id: 1, result: "SigABC" });
    };
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

  it("maps BlockhashNotFound to expired toast", async () => {
    const fetchImpl = async () =>
      Response.json({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32002, message: "Transaction simulation failed: BlockhashNotFound" },
      });
    await assert.rejects(
      () =>
        sendRawTransactionViaRpc(
          ["https://a.example"],
          new Uint8Array([1]),
          fetchImpl as typeof fetch,
          { lastValidBlockHeight: 1 },
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_BLOCKHASH_EXPIRED_ERROR);
        return true;
      },
    );
  });

  it("prefers skipPreflight true first with maxRetries", async () => {
    let sendCalls = 0;
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: unknown[];
      };
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        });
      }
      if (body.method === "sendTransaction") {
        sendCalls += 1;
        const opts = (body.params?.[1] ?? {}) as {
          skipPreflight?: boolean;
          maxRetries?: number;
        };
        assert.equal(opts.skipPreflight, true);
        assert.equal(opts.maxRetries, 3);
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigSkip" });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigSkip");
    assert.equal(sendCalls, 1);
  });

  it("treats send signature as success when confirm poll is pending/slow", async () => {
    let sendCalls = 0;
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getSignatureStatuses") {
        // Pending — no status yet (slow confirm). Must NOT become BROADCAST_FAILED.
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [null] },
        });
      }
      if (body.method === "sendTransaction") {
        sendCalls += 1;
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigPendingOk" });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
      { confirm: true },
    );
    assert.equal(sig, "SigPendingOk");
    assert.equal(sendCalls, 1);
  });

  it("does not convert confirm on-chain err poll into failure after successful send", async () => {
    // Even if status briefly reports an err object, a returned sendRaw signature wins.
    // (Confirm is best-effort observability only.)
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "processed", err: { InstructionError: [0, "Custom"] } }] },
        });
      }
      if (body.method === "sendTransaction") {
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigSentAnyway" });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigSentAnyway");
  });


  it("POSTs JSON-RPC method sendTransaction (not sendRawTransaction)", async () => {
    // Solana JSON-RPC has no sendRawTransaction — web3.js Connection.sendRawTransaction
    // calls method "sendTransaction" under the hood. Proving the wire method name.
    const methods: string[] = [];
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method) methods.push(body.method);
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        });
      }
      if (body.method === "sendTransaction") {
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigMethodOk" });
      }
      if (body.method === "sendRawTransaction") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32601, message: "Method not found" },
        });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigMethodOk");
    assert.ok(methods.includes("sendTransaction"));
    assert.equal(methods.includes("sendRawTransaction"), false);
  });

  it("continues to next RPC URL on HTTP 403 / Method not found", async () => {
    const hosts: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        });
      }
      if (body.method === "sendTransaction") {
        hosts.push(url);
        if (url.includes("mainnet")) {
          return new Response("Your IP or provider is blocked", { status: 403 });
        }
        if (url.includes("broken")) {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32601, message: "Method not found" },
          });
        }
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigFallback" });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      [
        "https://api.mainnet-beta.solana.com",
        "https://broken.example",
        "https://solana-rpc.publicnode.com",
      ],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigFallback");
    // mainnet 403 → break to next; broken method-not-found → break; publicnode succeeds.
    // Only one attempt per refused URL (no skipPreflight double-burn).
    assert.equal(hosts.filter((h) => h.includes("mainnet")).length, 1);
    assert.equal(hosts.filter((h) => h.includes("broken")).length, 1);
    assert.ok(hosts.some((h) => h.includes("publicnode")));
  });

  it("falls back to preflight when skipPreflight fails non-expiry", async () => {
    let sendCalls = 0;
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        method?: string;
        params?: unknown[];
      };
      if (body.method === "getSignatureStatuses") {
        return Response.json({
          jsonrpc: "2.0",
          id: 1,
          result: { value: [{ confirmationStatus: "confirmed", err: null }] },
        });
      }
      if (body.method === "sendTransaction") {
        sendCalls += 1;
        const opts = (body.params?.[1] ?? {}) as { skipPreflight?: boolean };
        if (opts.skipPreflight) {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: { message: "Node is behind" },
          });
        }
        return Response.json({ jsonrpc: "2.0", id: 1, result: "SigPreflight" });
      }
      return new Response("unexpected", { status: 500 });
    };
    const sig = await sendRawTransactionViaRpc(
      ["https://ok.example"],
      new Uint8Array([1]),
      fetchImpl as typeof fetch,
    );
    assert.equal(sig, "SigPreflight");
    assert.equal(sendCalls, 2);
  });
});

describe("safeRpcDetail / rpcUrlsForSend", () => {
  it("truncates and collapses whitespace", () => {
    assert.equal(safeRpcDetail("  hello\nworld  "), "hello world");
    assert.equal(safeRpcDetail("x".repeat(200)).length, 160);
    assert.ok(safeRpcDetail("x".repeat(200)).endsWith("…"));
  });

  it("puts publicnode last for send", () => {
    assert.deepEqual(
      rpcUrlsForSend([PUBLICNODE_RPC_URL, "https://api.mainnet-beta.solana.com"]),
      ["https://api.mainnet-beta.solana.com", PUBLICNODE_RPC_URL],
    );
  });
});

describe("isBlockhashExpiredMessage / solBroadcastErrorCode / isRpcSubmitEndpointRefuse", () => {
  it("detects expiry wording and maps codes", () => {
    assert.equal(isBlockhashExpiredMessage("BlockhashNotFound"), true);
    assert.equal(isBlockhashExpiredMessage("block height exceeded"), true);
    assert.equal(isBlockhashExpiredMessage("insufficient lamports"), false);
    assert.equal(solBroadcastErrorCode(SOL_BLOCKHASH_EXPIRED_ERROR), "BLOCKHASH_EXPIRED");
    assert.equal(solBroadcastErrorCode(SOL_INSUFFICIENT_FUNDS_ERROR), "INSUFFICIENT_FUNDS");
    assert.equal(solBroadcastErrorCode(SOL_BROADCAST_ERROR), "BROADCAST_FAILED");
    assert.equal(isBlockHeightExpired(150, 150), true);
    assert.equal(isBlockHeightExpired(149, 150), false);
  });

  it("detects 403 / method-not-found endpoint refuse", () => {
    assert.equal(isRpcSubmitEndpointRefuse("HTTP 403 Your IP or provider is blocked", 403), true);
    assert.equal(isRpcSubmitEndpointRefuse("Method not found", undefined), true);
    assert.equal(isRpcSubmitEndpointRefuse("Method not found", undefined) || isRpcSubmitEndpointRefuse("-32601", undefined), true);
    assert.equal(isRpcSubmitEndpointRefuse("BlockhashNotFound"), false);
    assert.equal(isRpcSubmitEndpointRefuse("insufficient lamports"), false);
  });
});

describe("fetchBlockHeightFromRpc", () => {
  it("returns numeric height", async () => {
    const fetchImpl = async () => Response.json({ jsonrpc: "2.0", id: 1, result: 99 });
    assert.equal(await fetchBlockHeightFromRpc(["https://ok.example"], fetchImpl as typeof fetch), 99);
  });

  it("refuses publicnode-only URL lists", async () => {
    await assert.rejects(
      () => fetchBlockHeightFromRpc([PUBLICNODE_RPC_URL], (async () => {
        throw new Error("should not call fetch");
      }) as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(String((err as Error & { cause?: unknown }).cause), /no trusted rpc/);
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

  it("send-raw API maps BLOCKHASH_EXPIRED code", async () => {
    const fetchImpl = async () =>
      Response.json(
        { error: SOL_BLOCKHASH_EXPIRED_ERROR, code: "BLOCKHASH_EXPIRED" },
        { status: 409 },
      );
    await assert.rejects(
      () => sendRawTransactionViaApi("txb58", fetchImpl as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_BLOCKHASH_EXPIRED_ERROR);
        return true;
      },
    );
  });

  it("send-raw API surfaces truncated detail on BROADCAST_FAILED", async () => {
    const fetchImpl = async () =>
      Response.json(
        {
          error: SOL_BROADCAST_ERROR,
          code: "BROADCAST_FAILED",
          detail: "Transaction failed to sanitize accounts offsets correctly",
        },
        { status: 502 },
      );
    await assert.rejects(
      () => sendRawTransactionViaApi("txb58", fetchImpl as typeof fetch),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, SOL_BROADCAST_ERROR);
        assert.match(String((err as Error & { cause?: unknown }).cause), /sanitize/);
        assert.match(String((err as Error & { detail?: string }).detail), /sanitize/);
        return true;
      },
    );
  });
});

describe("friendlySolPrepareError extras", () => {
  it("maps insufficient + broadcast + blockhash expiry", () => {
    assert.equal(
      friendlySolPrepareError(new Error(SOL_INSUFFICIENT_FUNDS_ERROR)),
      SOL_INSUFFICIENT_FUNDS_ERROR,
    );
    assert.equal(friendlySolPrepareError(new Error(SOL_BROADCAST_ERROR)), SOL_BROADCAST_ERROR);
    assert.equal(
      friendlySolPrepareError(new Error("Transaction simulation failed: insufficient lamports")),
      SOL_INSUFFICIENT_FUNDS_ERROR,
    );
    assert.equal(
      friendlySolPrepareError(new Error("BlockhashNotFound")),
      SOL_BLOCKHASH_EXPIRED_ERROR,
    );
    assert.equal(
      friendlySolPrepareError(new Error(SOL_BLOCKHASH_EXPIRED_ERROR)),
      SOL_BLOCKHASH_EXPIRED_ERROR,
    );
  });
});

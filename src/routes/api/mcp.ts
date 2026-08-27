import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { authenticateAgent, corsHeaders, json } from "@/lib/server/agent";
import { handleMcp, MCP_PROTOCOL } from "@/lib/mcp-protocol";

async function mcpPost({ request }: { request: Request }) {
  const sql = await getSql();
  const auth = await authenticateAgent(sql, request);
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
        400,
      );
    }
  }
  const result = await handleMcp(sql, body, auth);
  if (result == null) return new Response(null, { status: 202, headers: corsHeaders() });

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream") && !accept.includes("application/json")) {
    const payload = `event: message\ndata: ${JSON.stringify(result)}\n\n`;
    return new Response(payload, {
      status: 200,
      headers: corsHeaders({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
      }),
    });
  }
  return json(result);
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: () =>
        json({
          name: "she-undresses",
          protocolVersion: MCP_PROTOCOL,
          transport: "streamable-http",
          endpoint: "/api/mcp",
          auth: "Authorization: Bearer <api key> or X-Api-Key",
        }),
      POST: mcpPost,
    },
  },
});

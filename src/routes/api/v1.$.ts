import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import {
  authenticateAgent,
  corsHeaders,
  json,
  runOp,
  OPENAPI,
  type KeyScope,
} from "@/lib/server/agent";

function pathOf(request: Request) {
  const url = new URL(request.url);
  return url.pathname.replace(/^\/api\/v1\/?/, "").replace(/\/$/, "");
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handle({ request }: { request: Request }) {
  const path = pathOf(request);
  const method = request.method.toUpperCase();

  if (path === "openapi.json" || path === "openapi") {
    return json(OPENAPI);
  }
  if (!path) {
    return json({
      name: "SHE UNDRESSES Agent API",
      rest: "/api/v1",
      mcp: "/api/mcp",
      openapi: "/api/v1/openapi.json",
      llms: "/llms.txt",
      auth: "Authorization: Bearer <key> or X-Api-Key",
      operations: Object.keys(OPENAPI.paths),
    });
  }

  const sql = await getSql();
  const auth = await authenticateAgent(sql, request);
  if (path === "health") {
    const r = await runOp(sql, auth.ok ? auth.scope : "read", "health", {});
    return json(r.ok ? r.data : { error: r.error }, r.ok ? 200 : r.status);
  }
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const body = method === "GET" ? {} : await readJson(request);
  const mapped = mapRoute(method, path, body, new URL(request.url).searchParams);
  if (!mapped) return json({ error: `No route for ${method} /api/v1/${path}` }, 404);

  const result = await runOp(sql, auth.scope as KeyScope, mapped.op, mapped.params);
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(result.data);
}

function mapRoute(
  method: string,
  path: string,
  body: Record<string, unknown>,
  search: URLSearchParams,
): { op: string; params: Record<string, unknown> } | null {
  const parts = path.split("/").filter(Boolean);
  if (method === "GET" && (path === "" || path === "catalog")) return { op: "list_ladders", params: {} };
  if (method === "POST" && (path === "ladders" || path === "catalog")) {
    return { op: "create_ladder", params: body };
  }
  if (method === "GET" && parts[0] === "ladders" && parts[1]) {
    return { op: "get_ladder", params: { slug: parts[1] } };
  }
  if (method === "POST" && parts[0] === "ladders" && parts[1]) {
    return { op: "update_ladder", params: { ...body, id: parts[1] } };
  }
  if (method === "GET" && path === "analytics") return { op: "get_analytics", params: {} };
  if (method === "GET" && path === "dials") return { op: "get_dials", params: {} };
  if ((method === "PUT" || method === "POST") && path === "dials") {
    return { op: "set_dials", params: body };
  }
  if (method === "GET" && path === "models") return { op: "list_models", params: {} };
  if (method === "POST" && path === "models") return { op: "upsert_model", params: body };
  if (method === "GET" && path === "legal") {
    return { op: "get_legal", params: { slug: search.get("slug") ?? "" } };
  }
  if (method === "GET" && parts[0] === "legal" && parts[1]) {
    return { op: "get_legal", params: { slug: parts[1] } };
  }
  if (method === "POST" && path === "legal/regenerate") return { op: "regenerate_legal", params: {} };
  if (method === "POST" && path === "legal/entity") return { op: "save_legal_entity", params: body };
  if (method === "POST" && path === "transporter") return { op: "write_ladder_copy", params: body };
  if (method === "POST" && path === "transporter/auto") return { op: "auto_write_ladder", params: body };
  if (method === "POST" && path === "transporter/surfaces") return { op: "write_surfaces", params: {} };
  if (method === "POST" && path === "transporter/model-card") {
    return { op: "write_model_card", params: body };
  }
  if (method === "POST" && path === "shots") return { op: "add_shot", params: body };
  if ((method === "PATCH" || method === "POST") && parts[0] === "shots" && parts[1]) {
    return { op: "set_shot_price", params: { ...body, shotId: parts[1] } };
  }
  if (method === "GET" && path === "events") return { op: "list_events", params: {} };
  return null;
}

export const Route = createFileRoute("/api/v1/$")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
    },
  },
});

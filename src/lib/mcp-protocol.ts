import type { KeyScope } from "./server/agent";
import { runOp } from "./server/agent";
import type { Sql } from "./db";

export const MCP_PROTOCOL = "2025-03-26";

type RpcId = string | number | null;

type RpcReq = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, unknown>;
};

const TOOLS = [
  {
    name: "vault_health",
    description: "Health and connector endpoints for SHE UNDRESSES.",
    inputSchema: { type: "object", properties: {} },
    op: "health",
  },
  {
    name: "list_ladders",
    description: "List every value ladder (id, slug, theme, shot count).",
    inputSchema: { type: "object", properties: {} },
    op: "list_ladders",
  },
  {
    name: "get_ladder",
    description: "Get one ladder and its sequential shots by slug or id.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string" } },
      required: ["slug"],
    },
    op: "get_ladder",
  },
  {
    name: "get_analytics",
    description: "Revenue, unlocks, views, conversion by ladder.",
    inputSchema: { type: "object", properties: {} },
    op: "get_analytics",
  },
  {
    name: "get_dials",
    description: "Current psychology dials (0–10) and surface copy.",
    inputSchema: { type: "object", properties: {} },
    op: "get_dials",
  },
  {
    name: "set_dials",
    description: "Set psychology dials. Operator scope. Fields 0–10: urgency, scarcity, tease, sunkCost, socialProof, fetishHeat, addiction.",
    inputSchema: {
      type: "object",
      properties: {
        urgency: { type: "number" },
        scarcity: { type: "number" },
        tease: { type: "number" },
        sunkCost: { type: "number" },
        socialProof: { type: "number" },
        fetishHeat: { type: "number" },
        addiction: { type: "number" },
      },
    },
    op: "set_dials",
  },
  {
    name: "list_models",
    description: "List loaded muses and 2257 kind (synthetic/human/hybrid).",
    inputSchema: { type: "object", properties: {} },
    op: "list_models",
  },
  {
    name: "upsert_model",
    description: "Load or update a muse. Auto-generates her legal pack.",
    inputSchema: {
      type: "object",
      properties: {
        stageName: { type: "string" },
        slug: { type: "string" },
        contentKind: { type: "string", enum: ["synthetic", "human", "hybrid"] },
        portrayedAgeMin: { type: "number" },
        bio: { type: "string" },
        aliases: { type: "string" },
        ladderSlugs: { type: "string" },
        likenessOk: { type: "boolean" },
        recordsOnFile: { type: "boolean" },
        voice: { type: "string", description: "How she talks in a tease" },
        looks: { type: "string", description: "Visual lock for photoset copy" },
        teaseStyle: { type: "string" },
      },
      required: ["stageName"],
    },
    op: "upsert_model",
  },
  {
    name: "get_legal",
    description: "Legal hub, or one document by slug (terms, privacy, 2257, liora…).",
    inputSchema: { type: "object", properties: { slug: { type: "string" } } },
    op: "get_legal",
  },
  {
    name: "regenerate_legal",
    description: "Rebuild Terms, Privacy, 2257, and every model card from templates.",
    inputSchema: { type: "object", properties: {} },
    op: "regenerate_legal",
  },
  {
    name: "create_ladder",
    description: "Create a photoset/ladder for an onboarded muse. Unique teases come from her looks + visual beats.",
    inputSchema: {
      type: "object",
      properties: {
        modelId: { type: "string" },
        title: { type: "string" },
        slug: { type: "string" },
        theme: { type: "string", description: "frontal | worship | feet | custom" },
        tagline: { type: "string" },
        description: { type: "string" },
        coverUrl: { type: "string" },
      },
      required: ["modelId", "title"],
    },
    op: "create_ladder",
  },
  {
    name: "update_ladder",
    description: "Update ladder title, tagline, bundleDiscount, published.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        tagline: { type: "string" },
        bundleDiscount: { type: "number" },
        published: { type: "boolean" },
      },
      required: ["id"],
    },
    op: "update_ladder",
  },
  {
    name: "add_shot",
    description: "Append a sequential shot to a ladder.",
    inputSchema: {
      type: "object",
      properties: {
        ladderId: { type: "string" },
        title: { type: "string" },
        mediaUrl: { type: "string" },
        mediaType: { type: "string", enum: ["photo", "video"] },
        priceCents: { type: "number" },
        tease: { type: "string" },
        grantCopy: { type: "string" },
        isClimax: { type: "boolean" },
        visualBeat: { type: "string", description: "What is actually in this frame" },
      },
      required: ["ladderId", "title", "mediaUrl"],
    },
    op: "add_shot",
  },
  {
    name: "set_shot_price",
    description: "Set a shot price in cents.",
    inputSchema: {
      type: "object",
      properties: { shotId: { type: "string" }, priceCents: { type: "number" } },
      required: ["shotId", "priceCents"],
    },
    op: "set_shot_price",
  },
  {
    name: "write_ladder_copy",
    description: "Grok transporter: rewrite tease/grant/story FROM this muse's photoset frames.",
    inputSchema: {
      type: "object",
      properties: { ladderId: { type: "string" } },
      required: ["ladderId"],
    },
    op: "write_ladder_copy",
  },
  {
    name: "auto_write_ladder",
    description: "One-click: Grok vision reads the stills/video frames, fills visual beats, then writes tease/grant/story. Optional — does not replace typed beats.",
    inputSchema: {
      type: "object",
      properties: { ladderId: { type: "string" } },
      required: ["ladderId"],
    },
    op: "auto_write_ladder",
  },
  {
    name: "write_surfaces",
    description: "Grok transporter: rewrite homepage/sticky/checkout surfaces from dials.",
    inputSchema: { type: "object", properties: {} },
    op: "write_surfaces",
  },
  {
    name: "write_model_card",
    description: "Grok writes portrayal copy for a muse. Legal clauses stay locked.",
    inputSchema: {
      type: "object",
      properties: { modelId: { type: "string" } },
      required: ["modelId"],
    },
    op: "write_model_card",
  },
  {
    name: "list_events",
    description: "Recent vault events (views, unlocks).",
    inputSchema: { type: "object", properties: {} },
    op: "list_events",
  },
] as const;

const RESOURCES = [
  { uri: "vault://catalog", name: "Catalog", mimeType: "application/json", op: "list_ladders" },
  { uri: "vault://dials", name: "Psychology dials", mimeType: "application/json", op: "get_dials" },
  { uri: "vault://analytics", name: "Analytics", mimeType: "application/json", op: "get_analytics" },
  { uri: "vault://legal", name: "Legal pack index", mimeType: "application/json", op: "get_legal" },
];

function ok(id: RpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function fail(id: RpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export async function handleMcp(
  sql: Sql,
  body: unknown,
  auth: { ok: true; scope: KeyScope } | { ok: false; error: string; status: number },
): Promise<unknown> {
  if (Array.isArray(body)) {
    const out = [];
    for (const item of body) out.push(await handleOne(sql, item, auth));
    return out;
  }
  return handleOne(sql, body, auth);
}

async function handleOne(
  sql: Sql,
  raw: unknown,
  auth: { ok: true; scope: KeyScope } | { ok: false; error: string; status: number },
) {
  const req = (raw && typeof raw === "object" ? raw : {}) as RpcReq;
  const id = (req.id ?? null) as RpcId;
  const method = req.method ?? "";
  const params = (req.params ?? {}) as Record<string, unknown>;

  if (method === "initialize") {
    return ok(id, {
      protocolVersion: MCP_PROTOCOL,
      capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, prompts: {} },
      serverInfo: { name: "she-undresses", version: "1.0.0", title: "SHE UNDRESSES" },
      instructions:
        "Adult sequential unlock vault. Use tools to list ladders, turn psychology dials, load muses (auto 2257 pack), and run the Grok transporter. Authenticate with Bearer API key. Not a nudify tool.",
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }
  if (method === "ping") return ok(id, {});

  if (method === "tools/list") {
    return ok(id, {
      tools: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    });
  }
  if (method === "resources/list") {
    return ok(id, {
      resources: RESOURCES.map((r) => ({
        uri: r.uri,
        name: r.name,
        mimeType: r.mimeType,
      })),
    });
  }
  if (method === "prompts/list") {
    return ok(id, {
      prompts: [
        {
          name: "tighten_dials",
          description: "Raise urgency and addiction, keep tease high.",
        },
        {
          name: "load_synthetic_muse",
          description: "Load a new synthetic 21+ muse and generate her legal pack.",
        },
      ],
    });
  }
  if (method === "prompts/get") {
    const name = String(params.name ?? "");
    if (name === "tighten_dials") {
      return ok(id, {
        description: "Push conversion dials.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Call set_dials with urgency 9, addiction 9, tease 8, sunkCost 8, scarcity 7. Then get_dials to confirm.",
            },
          },
        ],
      });
    }
    if (name === "load_synthetic_muse") {
      return ok(id, {
        description: "New fictional adult muse.",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: "Call upsert_model with stageName, contentKind synthetic, portrayedAgeMin 24, likenessOk true, then get_legal slug equal to her slug.",
            },
          },
        ],
      });
    }
    return fail(id, -32602, "Unknown prompt.");
  }

  const needsAuth = method === "tools/call" || method === "resources/read";
  if (needsAuth && !auth.ok) {
    return fail(id, -32001, auth.error);
  }

  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const tool = TOOLS.find((t) => t.name === name);
    if (!tool) return fail(id, -32602, `Unknown tool ${name}`);
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    const result = await runOp(sql, auth.ok ? auth.scope : "read", tool.op, args);
    if (!result.ok) return fail(id, result.status === 403 ? -32002 : -32000, result.error);
    return ok(id, {
      content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      structuredContent: result.data,
      isError: false,
    });
  }

  if (method === "resources/read") {
    const uri = String(params.uri ?? "");
    const res = RESOURCES.find((r) => r.uri === uri);
    if (!res) return fail(id, -32602, "Unknown resource.");
    const result = await runOp(sql, auth.ok ? auth.scope : "read", res.op, {});
    if (!result.ok) return fail(id, -32000, result.error);
    return ok(id, {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(result.data, null, 2) },
      ],
    });
  }

  return fail(id, -32601, `Method not found: ${method}`);
}

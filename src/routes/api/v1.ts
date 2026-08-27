import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, OPENAPI } from "@/lib/server/agent";

export const Route = createFileRoute("/api/v1")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: corsHeaders() }),
      GET: () =>
        json({
          name: "SHE UNDRESSES Agent API",
          rest: "/api/v1",
          mcp: "/api/mcp",
          openapi: "/api/v1/openapi.json",
          llms: "/llms.txt",
          auth: "Authorization: Bearer <key> or X-Api-Key",
          operations: Object.keys(OPENAPI.paths),
        }),
    },
  },
});

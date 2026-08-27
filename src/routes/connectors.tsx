import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/ui/chrome";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/connectors")({
  component: ConnectorsPage,
  head: () => privateHead("/connectors", "Connectors | SHE UNDRESSES"),
});

const REST = [
  ["GET", "/api/v1/health", "Liveness"],
  ["GET", "/api/v1/catalog", "Ladders"],
  ["GET", "/api/v1/ladders/{slug}", "One ladder + shots"],
  ["GET", "/api/v1/analytics", "Revenue / conversion"],
  ["GET / PUT", "/api/v1/dials", "Psychology dials"],
  ["GET / POST", "/api/v1/models", "Muses (POST auto-builds 2257 pack)"],
  ["GET", "/api/v1/legal", "Legal hub"],
  ["POST", "/api/v1/legal/regenerate", "Rebuild templates"],
  ["POST", "/api/v1/transporter", "{ ladderId } — Grok rewrite"],
  ["POST", "/api/v1/shots", "Append a shot"],
  ["GET", "/api/v1/openapi.json", "OpenAPI 3.1"],
];

function ConnectorsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <PageHeader
        kicker="Agents"
        title="Connectors"
        body="Other software — n8n, Claude Desktop, Grok, custom MCP clients — can operate this vault over REST or the Model Context Protocol. Mint a key in Ops → Connectors. Send it as Authorization: Bearer or X-Api-Key."
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card kicker="REST" title="/api/v1" body="JSON over HTTPS. OpenAPI at /api/v1/openapi.json." />
        <Card kicker="MCP" title="/api/mcp" body="JSON-RPC 2.0, protocol 2025-03-26, Streamable HTTP + SSE." />
      </div>

      <h2 className="mt-10 font-display text-2xl text-fg">REST map</h2>
      <ul className="panel mt-4 divide-y divide-border overflow-hidden">
        {REST.map(([m, p, d]) => (
          <li key={p} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
            <span className="font-mono text-xs text-gold">
              {m} {p}
            </span>
            <span className="text-xs text-subtle">{d}</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl text-fg">MCP tools</h2>
      <p className="mt-2 text-sm text-muted">
        initialize, tools/list, tools/call, resources/list, resources/read,
        prompts/list. Tools mirror the REST operations (list_ladders, set_dials,
        upsert_model, write_ladder_copy…).
      </p>

      <h2 className="mt-10 font-display text-2xl text-fg">n8n</h2>
      <pre className="panel mt-3 overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted">
{`HTTP Request node
Method: GET
URL: {{vault}}/api/v1/catalog
Header: Authorization = Bearer {{SHE_KEY}}

MCP Client node
SSE / HTTP URL: {{vault}}/api/mcp
Header: Authorization = Bearer {{SHE_KEY}}`}
      </pre>

      <h2 className="mt-10 font-display text-2xl text-fg">Claude / MCP config</h2>
      <pre className="panel mt-3 overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted">
{`{
  "mcpServers": {
    "she-undresses": {
      "url": "https://YOUR-VAULT/api/mcp",
      "headers": { "Authorization": "Bearer she_…" }
    }
  }
}`}
      </pre>

      <p className="mt-8 text-sm text-muted">
        Discovery for models:{" "}
        <a href="/llms.txt" className="text-gold">
          /llms.txt
        </a>
        . Keys live in{" "}
        <Link to="/admin" className="text-gold">
          Ops
        </Link>
        .
      </p>
    </div>
  );
}

function Card({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <Panel>
      <p className="kicker kicker-accent">{kicker}</p>
      <p className="mt-1 font-mono text-sm text-fg">{title}</p>
      <p className="mt-2 text-xs text-subtle">{body}</p>
    </Panel>
  );
}

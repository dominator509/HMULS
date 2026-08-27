import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  listApiKeys,
  mintApiKey,
  revokeApiKey,
} from "@/lib/server/agent";
import type { AgentKey, KeyScope } from "@/lib/agent-types";
import { toast } from "sonner";

export function ConnectorsPanel() {
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [label, setLabel] = useState("n8n production");
  const [scope, setScope] = useState<KeyScope>("operator");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const rows = await listApiKeys();
    setKeys(rows);
  }

  useEffect(() => {
    refresh().catch(() => toast.error("Could not load keys."));
  }, []);

  async function mint() {
    setBusy(true);
    try {
      const created = await mintApiKey({ data: { label, scope } });
      setFresh(created.token);
      await refresh();
      toast.success("Key minted. Copy it now — it will not be shown again.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await revokeApiKey({ data: { id } });
      await refresh();
      toast.success("Key revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Revoke failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      <p className="text-sm text-muted">
        REST at <span className="text-fg">/api/v1</span> · MCP at{" "}
        <span className="text-fg">/api/mcp</span>. Scopes: read (catalog,
        analytics, legal), write (shots, models, prices), operator (dials,
        Grok transporter, legal regen). There is no default key. Mint one
        below; the secret is shown once.
      </p>
      <p className="text-sm">
        <Link to="/connectors" className="text-gold">
          Connector docs
        </Link>
        {" · "}
        <a href="/api/v1/openapi.json" className="text-gold">
          OpenAPI
        </a>
        {" · "}
        <a href="/llms.txt" className="text-gold">
          llms.txt
        </a>
      </p>

      <section className="panel p-5">
        <p className="text-xs tracking-[0.18em] text-gold uppercase">Keys</p>
        <p className="mt-2 text-xs text-subtle">
          A fresh vault starts with zero API keys. Operator mints the first one.
          Revoked keys stay listed so you can audit.
        </p>
      </section>

      {fresh ? (
        <section className="panel p-5">
          <p className="text-xs tracking-[0.18em] text-gold uppercase">
            Copy once
          </p>
          <p className="mt-2 font-mono text-xs break-all text-fg">{fresh}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(fresh);
              toast.success("Copied.");
            }}
          >
            Copy
          </Button>
        </section>
      ) : null}

      <section className="panel p-5">
        <h2 className="font-display text-2xl text-fg">Mint a key</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-subtle sm:col-span-2">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="text-xs text-subtle">
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as KeyScope)}
              className="field-input"
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="operator">operator</option>
            </select>
          </label>
        </div>
        <Button className="mt-4" variant="gold" disabled={busy} onClick={() => void mint()}>
          Mint
        </Button>
      </section>

      <section>
        <h2 className="font-display text-2xl text-fg">Keys</h2>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm text-fg">
                  {k.label}{" "}
                  <span className="font-mono text-[11px] text-gold">{k.prefix}…</span>
                </p>
                <p className="text-[11px] text-subtle">
                  {k.scope}
                  {k.revoked ? " · revoked" : ""}
                  {k.lastUsedAt ? ` · last ${new Date(k.lastUsedAt).toLocaleString()}` : ""}
                </p>
              </div>
              {!k.revoked ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void revoke(k.id)}>
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

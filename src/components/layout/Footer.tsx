import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getLegalBundle } from "@/lib/server/legal";
import { footer2257Label } from "@/lib/legal-templates";
import type { MuseModel } from "@/lib/legal-types";

const LEGAL = [
  { to: "/legal/$slug", params: { slug: "terms" }, label: "Terms" },
  { to: "/legal/$slug", params: { slug: "privacy" }, label: "Privacy" },
  { to: "/legal/$slug", params: { slug: "2257" }, label: "2257" },
  { to: "/legal/$slug", params: { slug: "ai-disclosure" }, label: "AI" },
  { to: "/legal/$slug", params: { slug: "cookies" }, label: "Cookies" },
  { to: "/legal/$slug", params: { slug: "dmca" }, label: "DMCA" },
  { to: "/legal/$slug", params: { slug: "refund" }, label: "Refunds" },
] as const;

export function Footer() {
  const [models, setModels] = useState<MuseModel[]>([]);

  useEffect(() => {
    getLegalBundle()
      .then((b) => setModels(b.models))
      .catch(() => setModels([]));
  }, []);

  const label = footer2257Label(models);

  return (
    <footer className="relative z-10 border-t border-border bg-raised/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-3">
        <div>
          <p className="kicker kicker-accent">18+ · Sequential strip</p>
          <p className="mt-3 font-display text-2xl text-fg">SHE UNDRESSES</p>
          <p className="mt-1 text-xs tracking-[0.14em] text-gold uppercase">sheundresses.com</p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-subtle">
            Not a clothes-remover. She starts dressed. You pay. One layer
            comes off. Synthetic performers are fictional adults 21+.
          </p>
        </div>
        <div>
          <p className="kicker">Legal</p>
          <nav className="mt-4 flex flex-col gap-2 text-sm">
            {LEGAL.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                params={l.params}
                className="inline-flex min-h-11 items-center text-muted hover:text-fg"
              >
                {l.label === "2257" ? label : l.label}
              </Link>
            ))}
            <Link to="/legal" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Legal hub
            </Link>
          </nav>
        </div>
        <div>
          <p className="kicker">Operators</p>
          <nav className="mt-4 flex flex-col gap-2 text-sm">
            <Link to="/admin" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Operator dashboard
            </Link>
            <Link to="/models" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Muses
            </Link>
            <Link to="/connectors" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Agent connectors
            </Link>
            <a href="/llms.txt" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              llms.txt
            </a>
            <a href="/sitemap.xml" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Sitemap
            </a>
            <Link to="/vault" className="inline-flex min-h-11 items-center text-muted hover:text-fg">
              Vault
            </Link>
          </nav>
          {models.length > 0 ? (
            <p className="mt-6 text-xs text-subtle">
              Models{" "}
              {models.map((m, i) => (
                <span key={m.id}>
                  {i > 0 ? " · " : null}
                  <Link
                    to="/models/$slug"
                    params={{ slug: m.slug }}
                    className="text-muted hover:text-fg"
                  >
                    {m.stageName}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listVault } from "@/lib/server/purchases";
import { getPsychology } from "@/lib/server/transporter";
import type { VaultItem } from "@/lib/types";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Overlay, OverlayClose, PageHeader } from "@/components/ui/chrome";
import { DEFAULT_DIALS, fallbackSurfaces, type Surfaces } from "@/lib/psychology";
import { VAULT_COPY } from "@/lib/copy";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/vault")({
  component: VaultPage,
  head: () => privateHead("/vault", "Vault | SHE UNDRESSES"),
});

function VaultPage() {
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [active, setActive] = useState<VaultItem | null>(null);
  const [surfaces, setSurfaces] = useState<Surfaces>(() => fallbackSurfaces(DEFAULT_DIALS));

  useEffect(() => {
    getPsychology()
      .then((p) => setSurfaces(p.surfaces))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    listVault()
      .then(setItems)
      .catch(() => setItems([]));
  }, [user]);

  if (isPending) {
    return <div className="px-5 py-24 text-center text-muted">Opening vault…</div>;
  }
  if (!user) return <RedirectToSignIn />;

  const latest = items?.[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <PageHeader kicker={VAULT_COPY.kicker} title={VAULT_COPY.title} body={VAULT_COPY.body} />

      {latest ? (
        <div className="panel mt-8 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg">{surfaces.unfinished}</p>
          <Link
            to="/ladders/$slug"
            params={{ slug: latest.ladderSlug }}
            search={{ pay: true }}
          >
            <Button variant="gold">Continue {latest.ladderTitle}</Button>
          </Link>
        </div>
      ) : null}

      {items === null ? (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="panel mt-12 p-8 text-center">
          <p className="font-display text-2xl text-fg">{VAULT_COPY.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{VAULT_COPY.emptyBody}</p>
          <Link to="/" className="mt-6 inline-block">
            <Button>{VAULT_COPY.emptyCta}</Button>
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <li key={item.shotId}>
              <button
                type="button"
                onClick={() => setActive(item)}
                className="panel w-full overflow-hidden text-left transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  {item.mediaType === "video" ? (
                    <video
                      src={item.mediaUrl}
                      className="h-full w-full object-cover"
                      style={{ objectPosition: item.objectPosition }}
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.mediaUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: item.objectPosition }}
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-subtle">{item.ladderTitle}</p>
                  <p className="font-display text-base text-fg">{item.title}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <Overlay onClose={() => setActive(null)} wide labelledBy="vault-title">
          <div className="relative">
            <OverlayClose onClick={() => setActive(null)} />
            <div className="aspect-[2/3] overflow-hidden">
              {active.mediaType === "video" ? (
                <video
                  src={active.mediaUrl}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: active.objectPosition }}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={active.mediaUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ objectPosition: active.objectPosition }}
                />
              )}
            </div>
            <div className="p-5">
              <p className="text-xs text-subtle">{active.ladderTitle}</p>
              <h2 id="vault-title" className="font-display text-3xl text-fg">
                {active.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{active.grantCopy}</p>
              <Link
                to="/ladders/$slug"
                params={{ slug: active.ladderSlug }}
                search={{ pay: true }}
                className="mt-5 inline-block w-full"
              >
                <Button size="xl">She's still in the pose</Button>
              </Link>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
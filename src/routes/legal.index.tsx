import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/chrome";
import { getLegalBundle } from "@/lib/server/legal";
import { getDiscover } from "@/lib/server/discover";
import { entityComplete } from "@/lib/legal-types";
import { footer2257Label } from "@/lib/legal-templates";
import { JsonLd, Crumbs } from "@/components/seo/JsonLd";
import { headTags, jsonLdGraph, originOf } from "@/lib/seo";

export const Route = createFileRoute("/legal/")({
  loader: async () => {
    const [bundle, d] = await Promise.all([
      getLegalBundle(),
      getDiscover().catch(() => null),
    ]);
    return { ...bundle, origin: d?.origin || originOf(bundle.entity.websiteUrl) };
  },
  head: ({ loaderData }) =>
    headTags({
      title: "Legal & 2257 | SHE UNDRESSES",
      description:
        "Terms, privacy, 18 U.S.C. 2257 records or exemption, AI disclosure, and per-muse model cards for SHE UNDRESSES.",
      path: "/legal",
      origin: loaderData?.origin || "",
      keywords: "SHE UNDRESSES, legal, 2257, terms, privacy, AI disclosure",
    }),
  component: LegalHub,
});

function LegalHub() {
  const { docs, models, entity, origin } = Route.useLoaderData();
  const complete = entityComplete(entity);
  const site = docs.filter((d) => d.scope === "site");
  const label = footer2257Label(models);

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <JsonLd
        data={jsonLdGraph({
          origin,
          path: "/legal",
          title: "Legal hub | SHE UNDRESSES",
          description: "Terms, privacy, 2257, and model cards.",
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Legal", path: "/legal" },
          ],
        })}
      />
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Legal" },
        ]}
      />
      <PageHeader
        kicker="Compliance"
        title="Legal hub"
        body="Templates fill from the operator entity and every model loaded into the vault. Modeled on Fanvue / OnlyFans 2257 pages and synthetic-performer exemptions. Not legal advice."
      />
      {!complete ? (
        <p className="panel mt-6 p-4 text-sm text-gold">
          Custodian name and a physical street address are still empty. Required
          before publishing actual persons. Synthetic-only exemption pages can
          still show.
        </p>
      ) : null}

      <h2 className="mt-12 font-display text-2xl text-fg">Site documents</h2>
      <ul className="panel mt-4 divide-y divide-border overflow-hidden">
        {site.map((d) => (
          <li key={d.id}>
            <Link
              to="/legal/$slug"
              params={{ slug: d.slug }}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-raised"
            >
              <span className="text-sm text-fg">
                {d.slug === "2257" ? label : d.title}
              </span>
              <span className="text-xs text-subtle">v{d.version}</span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl text-fg">Models</h2>
      <p className="mt-2 text-sm text-muted">
        Each muse gets a card and a 2257 statement or exemption the moment she
        is loaded.
      </p>
      <ul className="panel mt-4 divide-y divide-border overflow-hidden">
        {models.map((m) => (
          <li key={m.id}>
            <Link
              to="/legal/models/$slug"
              params={{ slug: m.slug }}
              className="flex min-h-11 items-center justify-between px-4 py-3 hover:bg-raised"
            >
              <span>
                <span className="text-sm text-fg">{m.stageName}</span>
                <span className="ml-2 text-xs tracking-[0.14em] text-gold uppercase">
                  {m.contentKind}
                </span>
              </span>
              <span className="text-xs text-subtle">{m.portrayedAgeMin}+</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

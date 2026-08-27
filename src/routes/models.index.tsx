import { createFileRoute, Link } from "@tanstack/react-router";
import { getDiscover } from "@/lib/server/discover";
import { FaqList, JsonLd, Crumbs } from "@/components/seo/JsonLd";
import {
  authorModelSeo,
  groupLadders,
  headTags,
  homeFaqs,
  jsonLdGraph,
  originOf,
} from "@/lib/seo";
import { Kicker } from "@/components/ui/chrome";

export const Route = createFileRoute("/models/")({
  loader: async () => getDiscover(),
  head: ({ loaderData }) => {
    const origin = loaderData?.origin || originOf();
    return headTags({
      title: "Muses — sequential adult photosets | SHE UNDRESSES",
      description:
        "Every muse on SHE UNDRESSES undresses in order. Pick a woman, pick a hunger, pay for the next yes.",
      path: "/models",
      origin,
      keywords: "SHE UNDRESSES, muses, sequential unlock, adult photosets",
    });
  },
  component: ModelsIndex,
});

function ModelsIndex() {
  const d = Route.useLoaderData();
  const groups = groupLadders(d.ladders);
  const faqs = homeFaqs(d.models);

  return (
    <div>
      <JsonLd
        data={jsonLdGraph({
          origin: d.origin,
          path: "/models",
          title: "Muses | SHE UNDRESSES",
          description: "Sequential adult photosets by muse.",
          faqs,
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Muses", path: "/models" },
          ],
        })}
      />
      <section className="mx-auto max-w-6xl px-5 py-12">
        <Crumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Muses" },
          ]}
        />
        <div className="mt-4">
          <Kicker accent>Muses</Kicker>
        </div>
        <h1 className="mt-2 font-display text-5xl text-fg sm:text-6xl">She has a name</h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Each woman is her own night. Looks, voice, and photosets do not recycle.
          Pick her. Climb in order.
        </p>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(groups.length ? groups : d.models.map((m) => ({
            modelId: m.id,
            modelName: m.stageName,
            modelSlug: m.slug,
            items: d.ladders.filter((l) => l.modelSlug === m.slug),
          }))).map((g) => {
            const cover = g.items[0]?.coverUrl || "/media/portrait.jpg";
            const seo = authorModelSeo({
              stageName: g.modelName,
              slug: g.modelSlug,
              bio: d.models.find((m) => m.slug === g.modelSlug)?.bio,
              looks: d.models.find((m) => m.slug === g.modelSlug)?.looks,
              contentKind: d.models.find((m) => m.slug === g.modelSlug)?.contentKind,
            });
            return (
              <li key={g.modelSlug}>
                <Link
                  to="/models/$slug"
                  params={{ slug: g.modelSlug }}
                  className="panel group block overflow-hidden hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                >
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img
                      src={cover}
                      alt={`${g.modelName} on SHE UNDRESSES`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h2 className="font-display text-3xl text-fg">{g.modelName}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {g.items.length} photoset{g.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <p className="p-5 text-sm text-muted">{seo.description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <FaqList items={faqs} />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { getDiscover } from "@/lib/server/discover";
import { FaqList, JsonLd, Crumbs } from "@/components/seo/JsonLd";
import {
  authorModelSeo,
  headTags,
  jsonLdGraph,
  originOf,
} from "@/lib/seo";
import { Kicker, ProgressBar } from "@/components/ui/chrome";
import { formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/models/$slug")({
  loader: async ({ params }) => {
    const d = await getDiscover();
    const model = d.models.find((m) => m.slug === params.slug) ?? null;
    const ladders = d.ladders.filter(
      (l) => l.modelSlug === params.slug || l.modelId === model?.id,
    );
    return { ...d, model, ladders };
  },
  head: ({ loaderData, params }) => {
    const origin = loaderData?.origin || originOf();
    const m = loaderData?.model;
    if (!m) {
      return headTags({
        title: "Muse not found | SHE UNDRESSES",
        description: "That muse is not loaded in this vault.",
        path: `/models/${params.slug}`,
        origin,
        noindex: true,
      });
    }
    const seo = authorModelSeo(m);
    const img = loaderData?.ladders[0]?.coverUrl;
    return headTags({
      title: seo.title,
      description: seo.description,
      path: `/models/${m.slug}`,
      origin,
      image: img,
      keywords: seo.keywords,
    });
  },
  component: ModelPage,
});

function ModelPage() {
  const { model, ladders, origin } = Route.useLoaderData();
  if (!model) {
    return (
      <div className="px-5 py-24 text-center text-muted">
        No muse at this slug.{" "}
        <Link to="/models" className="text-gold">
          All muses
        </Link>
      </div>
    );
  }
  const seo = authorModelSeo(model);
  const cover = ladders[0]?.coverUrl || "/media/portrait.jpg";

  return (
    <div>
      <JsonLd
        data={jsonLdGraph({
          origin,
          path: `/models/${model.slug}`,
          title: seo.title,
          description: seo.description,
          image: cover,
          faqs: seo.faqs,
          type: "person",
          name: model.stageName,
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Muses", path: "/models" },
            { name: model.stageName, path: `/models/${model.slug}` },
          ],
        })}
      />
      <section className="relative min-h-[70dvh] overflow-hidden">
        <img
          src={cover}
          alt={`${model.stageName} sequential unlock photosets`}
          className="absolute inset-0 h-full w-full object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/25" />
        <div className="relative mx-auto flex min-h-[70dvh] max-w-6xl flex-col justify-end px-5 pb-12 pt-28">
          <Crumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Muses", href: "/models" },
              { label: model.stageName },
            ]}
          />
          <div className="mt-4">
            <Kicker accent>
              {model.contentKind} · portrayed {model.portrayedAgeMin}+
            </Kicker>
          </div>
          <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] text-fg sm:text-7xl">
            {model.stageName}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
            {seo.description}
          </p>
          {model.looks ? (
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-subtle">{model.looks}</p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <p className="kicker">Photosets</p>
        <h2 className="mt-2 font-display text-4xl text-fg">Climb her in order</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ladders.map((lad) => {
            const first = lad.shots[0];
            return (
              <Link
                key={lad.id}
                to="/ladders/$slug"
                params={{ slug: lad.slug }}
                search={{ pay: undefined }}
                className="panel group block overflow-hidden hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
              >
                <div className="relative aspect-[3/4] overflow-hidden">
                  <img
                    src={lad.coverUrl}
                    alt={`${model.stageName} — ${lad.title}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <h3 className="font-display text-3xl text-fg">{lad.title}</h3>
                    <p className="mt-1 text-sm text-muted">{lad.photosetHook || lad.tagline}</p>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <ProgressBar value={0} />
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>From {formatUsd(first?.priceCents ?? 0)}</span>
                    <span className="text-gold">{lad.shots.length} shots</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {ladders.length === 0 ? (
          <p className="mt-8 text-sm text-muted">Her first photoset is not published yet.</p>
        ) : null}
        <div className="mt-10">
          <Link to="/legal/models/$slug" params={{ slug: model.slug }}>
            <Button variant="outline">Model card · 2257 / disclosure</Button>
          </Link>
        </div>
      </section>
      <FaqList items={seo.faqs} title={`About ${model.stageName}`} />
    </div>
  );
}

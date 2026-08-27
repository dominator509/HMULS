import { createFileRoute, Link } from "@tanstack/react-router";
import { Kicker } from "@/components/ui/chrome";
import { getLegalDoc } from "@/lib/server/legal";
import { getDiscover } from "@/lib/server/discover";
import { LegalBody } from "@/lib/legal-render";
import { Crumbs, JsonLd } from "@/components/seo/JsonLd";
import { clipMeta, headTags, jsonLdGraph } from "@/lib/seo";

export const Route = createFileRoute("/legal/models/$slug")({
  loader: async ({ params }) => {
    const [doc, d] = await Promise.all([
      getLegalDoc({ data: { slug: params.slug } }),
      getDiscover().catch(() => null),
    ]);
    return { doc, origin: d?.origin ?? "", modelSlug: params.slug };
  },
  head: ({ loaderData, params }) => {
    const doc = loaderData?.doc;
    const origin = loaderData?.origin || "";
    if (!doc) {
      return headTags({
        title: "Model card not found | SHE UNDRESSES",
        description: "That muse is not loaded.",
        path: `/legal/models/${params.slug}`,
        origin,
        noindex: true,
      });
    }
    return headTags({
      title: `${doc.title} | SHE UNDRESSES`,
      description: clipMeta(doc.body.replace(/[#*\n]+/g, " ")),
      path: `/legal/models/${params.slug}`,
      origin,
      keywords: `SHE UNDRESSES, 2257, model card, ${doc.title}`,
    });
  },
  component: ModelLegalPage,
});

function ModelLegalPage() {
  const { doc, origin, modelSlug } = Route.useLoaderData();

  if (!doc) {
    return (
      <div className="px-5 py-24 text-center text-muted">
        No model loaded at this slug.{" "}
        <Link to="/legal" className="text-gold">
          Legal hub
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <JsonLd
        data={jsonLdGraph({
          origin,
          path: `/legal/models/${modelSlug}`,
          title: doc.title,
          description: clipMeta(doc.body.replace(/[#*\n]+/g, " ")),
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Legal", path: "/legal" },
            { name: doc.title, path: `/legal/models/${modelSlug}` },
          ],
        })}
      />
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Legal", href: "/legal" },
          { label: doc.title },
        ]}
      />
      <Kicker className="mt-6">Model pack · v{doc.version}</Kicker>
      <h1 className="mt-2 font-display text-4xl text-fg">{doc.title}</h1>
      <p className="mt-2 text-xs text-subtle">
        Auto-generated when this model was loaded. Regenerates when the operator
        edits kind, age, or custodian.
      </p>
      <div className="mt-8">
        <LegalBody body={doc.body} />
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/models/$slug"
          params={{ slug: modelSlug }}
          className="inline-flex min-h-11 items-center text-sm text-gold hover:text-gold-soft"
        >
          Public muse page
        </Link>
      </div>
    </div>
  );
}

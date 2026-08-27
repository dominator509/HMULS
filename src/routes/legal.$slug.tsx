import { createFileRoute, Link } from "@tanstack/react-router";
import { Kicker } from "@/components/ui/chrome";
import { getLegalDoc } from "@/lib/server/legal";
import { getDiscover } from "@/lib/server/discover";
import { LegalBody } from "@/lib/legal-render";
import { Crumbs, JsonLd } from "@/components/seo/JsonLd";
import { clipMeta, headTags, jsonLdGraph } from "@/lib/seo";

export const Route = createFileRoute("/legal/$slug")({
  loader: async ({ params }) => {
    const [doc, d] = await Promise.all([
      getLegalDoc({ data: { slug: params.slug } }),
      getDiscover().catch(() => null),
    ]);
    return { doc, origin: d?.origin ?? "" };
  },
  head: ({ loaderData, params }) => {
    const doc = loaderData?.doc;
    const origin = loaderData?.origin || "";
    if (!doc || doc.scope === "model") {
      return headTags({
        title: "Document not found | SHE UNDRESSES",
        description: "That legal page is not published.",
        path: `/legal/${params.slug}`,
        origin,
        noindex: true,
      });
    }
    return headTags({
      title: `${doc.title} | SHE UNDRESSES`,
      description: clipMeta(doc.body.replace(/[#*\n]+/g, " ")),
      path: `/legal/${doc.slug}`,
      origin,
      keywords: `SHE UNDRESSES, ${doc.title}, legal, 2257`,
    });
  },
  component: LegalDocPage,
});

function LegalDocPage() {
  const { slug } = Route.useParams();
  const { doc, origin } = Route.useLoaderData();

  if (!doc || doc.scope === "model") {
    return (
      <div className="px-5 py-24 text-center text-muted">
        No document at this slug.{" "}
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
          path: `/legal/${doc.slug}`,
          title: doc.title,
          description: clipMeta(doc.body.replace(/[#*\n]+/g, " ")),
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Legal", path: "/legal" },
            { name: doc.title, path: `/legal/${doc.slug}` },
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
      <Kicker className="mt-6">
        {doc.kind} · v{doc.version}
      </Kicker>
      <h1 className="mt-2 font-display text-4xl text-fg">{doc.title}</h1>
      <p className="mt-2 text-xs text-subtle">
        Generated {new Date(doc.generatedAt).toLocaleDateString()}
      </p>
      <div className="mt-8">
        <LegalBody body={doc.body} />
      </div>
      <p className="mt-10 text-xs text-subtle">/{slug}</p>
    </div>
  );
}

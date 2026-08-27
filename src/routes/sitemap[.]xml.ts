import { createFileRoute } from "@tanstack/react-router";
import { getDiscover, sitemapXml } from "@/lib/server/discover";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const d = await getDiscover();
        const origin = d.origin || new URL(request.url).origin;
        return new Response(
          sitemapXml({
            origin,
            models: d.models,
            ladders: d.ladders.map((l) => ({
              slug: l.slug,
              title: l.title,
              modelName: l.modelName,
              coverUrl: l.coverUrl,
              tagline: l.photosetHook || l.tagline,
            })),
          }),
          {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=900",
            },
          },
        );
      },
    },
  },
});

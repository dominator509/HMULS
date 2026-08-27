import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders } from "@/lib/server/agent";
import { getDiscover, llmsMarkdown } from "@/lib/server/discover";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        const d = await getDiscover();
        const body = llmsMarkdown({
          models: d.models,
          ladders: d.ladders.map((l) => ({
            title: l.title,
            slug: l.slug,
            modelName: l.modelName,
            tagline: l.photosetHook || l.tagline,
            theme: l.theme,
          })),
        });
        return new Response(body, {
          status: 200,
          headers: corsHeaders({
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          }),
        });
      },
    },
  },
});

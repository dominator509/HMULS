import { createFileRoute } from "@tanstack/react-router";
import { getDiscover, robotsTxt } from "@/lib/server/discover";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const d = await getDiscover();
        const origin = d.origin || new URL(request.url).origin;
        return new Response(robotsTxt(origin), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

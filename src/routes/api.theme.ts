import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { loadTheme } from "@/lib/server/theme";
import { DEFAULT_THEME } from "@/lib/theme";

export const Route = createFileRoute("/api/theme")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sql = await getSql();
          const theme = await loadTheme(sql);
          return Response.json(theme, {
            headers: { "Cache-Control": "public, max-age=30" },
          });
        } catch {
          return Response.json(DEFAULT_THEME);
        }
      },
    },
  },
});

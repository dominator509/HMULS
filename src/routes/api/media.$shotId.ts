import { createFileRoute } from "@tanstack/react-router";
import { readFile, stat } from "node:fs/promises";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { loadStampSettings } from "@/lib/server/stamps";

const ROBOTS = {
  "X-Robots-Tag": "noindex, nofollow, noimageindex, nosnippet",
  "Cache-Control": "private, max-age=120",
};

export const Route = createFileRoute("/api/media/$shotId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const shotId = params.shotId;
        const k = new URL(request.url).searchParams.get("k") ?? "";
        const sql = await getSql();
        const settings = await loadStampSettings(sql);
        const shot = await sql<{
          id: string;
          media_url: string;
          media_type: string;
        }>`select id, media_url, media_type from shots where id = ${shotId}`;
        const row = shot[0];
        if (!row) return new Response("Not found", { status: 404, headers: ROBOTS });

        let userId: string | null = null;
        if (k) {
          const st = await sql<{ user_id: string }>`
            select user_id from media_stamps where token = ${k} and shot_id = ${shotId}
          `;
          userId = st[0]?.user_id ?? null;
        }
        if (!userId) {
          const session = await getSessionUser();
          if (session) {
            const un = await sql<{ c: number }>`
              select count(*)::int as c from unlocks
              where user_id = ${session.id} and shot_id = ${shotId}
            `;
            if ((un[0]?.c ?? 0) > 0) userId = session.id;
            if (!userId) {
              const { ensureProfile } = await import("@/lib/server/catalog");
              const role = await ensureProfile(sql, session.id);
              if (role === "admin") userId = session.id;
            }
          }
        }
        if (!userId) {
          return new Response("Granted collectors only.", { status: 403, headers: ROBOTS });
        }

        const stamp = await import("@/lib/server/stamp.server");
        if (settings.stampGrants && !stamp.isVideoUrl(row.media_url, row.media_type)) {
          const cached = stamp.cachePath(userId, shotId);
          try {
            const bytes = await readFile(cached);
            return new Response(bytes, {
              headers: {
                ...ROBOTS,
                "Content-Type": "image/png",
                "Cache-Control": "private, max-age=3600",
              },
            });
          } catch {
            /* fall through to original grant */
          }
        }

        const path = stamp.resolveMediaPath(row.media_url);
        if (!path) return new Response("Media missing.", { status: 404, headers: ROBOTS });
        try {
          await stat(path);
        } catch {
          return new Response("Media missing.", { status: 404, headers: ROBOTS });
        }
        const bytes = await readFile(path);
        const type = stamp.isVideoUrl(row.media_url, row.media_type)
          ? "video/mp4"
          : path.endsWith(".png")
            ? "image/png"
            : "image/jpeg";
        return new Response(bytes, {
          headers: {
            ...ROBOTS,
            "Content-Type": type,
          },
        });
      },
    },
  },
});

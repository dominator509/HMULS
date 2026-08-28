import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { loadStampSettings } from "@/lib/server/stamps";
import { authorizeMediaGrant } from "@/lib/server/media-access";

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

        const grant = await authorizeMediaGrant({
          shotId,
          mediaToken: k,
          lookup: {
            userIdForStamp: async (token, id) => {
              const st = await sql<{ user_id: string }>`
                select user_id from media_stamps where token = ${token} and shot_id = ${id}
              `;
              return st[0]?.user_id ?? null;
            },
            sessionUser: async () => {
              const session = await getSessionUser();
              return session ? { id: session.id } : null;
            },
            hasUnlock: async (userId, id) => {
              const un = await sql<{ c: number }>`
                select count(*)::int as c from unlocks
                where user_id = ${userId} and shot_id = ${id}
              `;
              return (un[0]?.c ?? 0) > 0;
            },
            isAdmin: async (userId) => {
              const { ensureProfile } = await import("@/lib/server/catalog");
              return (await ensureProfile(sql, userId)) === "admin";
            },
          },
        });
        if (!grant.ok) {
          return new Response("Granted collectors only.", { status: 403, headers: ROBOTS });
        }
        const userId = grant.userId;

        const stamp = await import("@/lib/server/stamp.server");
        const { grantMediaUrl } = await import("@/lib/server/stamps");
        if (settings.stampGrants && !stamp.isVideoUrl(row.media_url, row.media_type)) {
          await grantMediaUrl(sql, {
            userId,
            shotId,
            mediaUrl: row.media_url,
            mediaType: row.media_type,
          }).catch((err) => console.error("[media] stamp mint failed", err));
          const cached = await stamp.readStampCache(userId, shotId);
          if (cached) {
            return new Response(new Uint8Array(cached), {
              headers: {
                ...ROBOTS,
                "Content-Type": "image/png",
                "Cache-Control": "private, max-age=3600",
              },
            });
          }
        }

        const bytes = await stamp.readPrivateOriginal(row.media_url);
        if (bytes) {
          const type = stamp.isVideoUrl(row.media_url, row.media_type)
            ? "video/mp4"
            : row.media_url.endsWith(".png")
              ? "image/png"
              : "image/jpeg";
          return new Response(new Uint8Array(bytes), {
            headers: {
              ...ROBOTS,
              "Content-Type": type,
            },
          });
        }

        const path = stamp.resolveMediaPath(row.media_url);
        if (!path) return new Response("Media missing.", { status: 404, headers: ROBOTS });
        try {
          const { readFile, stat } = await import("node:fs/promises");
          await stat(path);
          const fileBytes = await readFile(path);
          const type = stamp.isVideoUrl(row.media_url, row.media_type)
            ? "video/mp4"
            : path.endsWith(".png")
              ? "image/png"
              : "image/jpeg";
          return new Response(new Uint8Array(fileBytes), {
            headers: {
              ...ROBOTS,
              "Content-Type": type,
            },
          });
        } catch {
          return new Response("Media missing.", { status: 404, headers: ROBOTS });
        }
      },
    },
  },
});

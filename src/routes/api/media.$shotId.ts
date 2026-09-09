import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { loadStampSettings } from "@/lib/server/stamps";
import { authorizeMediaGrant } from "@/lib/server/media-access";

const ROBOTS = {
  "X-Robots-Tag": "noindex, nofollow, noimageindex, nosnippet",
  "Cache-Control": "private, max-age=120",
};

type ShotRow = {
  id: string;
  media_url: string;
  media_type: string;
};

async function authorizeShot(shotId: string, request: Request) {
  const k = new URL(request.url).searchParams.get("k") ?? "";
  const sql = await getSql();
  const settings = await loadStampSettings(sql);
  const shot = await sql<ShotRow>`select id, media_url, media_type from shots where id = ${shotId}`;
  const row = shot[0];
  if (!row) return { ok: false as const, status: 404 as const, body: "Not found" };

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
    return { ok: false as const, status: 403 as const, body: "Granted collectors only." };
  }
  return { ok: true as const, sql, settings, row, userId: grant.userId };
}

function mediaContentType(
  row: ShotRow,
  stamp: { isVideoUrl: (url: string, type: string) => boolean },
  pathHint?: string | null,
) {
  if (stamp.isVideoUrl(row.media_url, row.media_type)) return "video/mp4";
  const hint = pathHint ?? row.media_url;
  if (hint.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

function dispositionHeaders(request: Request, contentType: string) {
  const want = new URL(request.url).searchParams.get("download");
  if (want !== "1" && want !== "true") return {};
  const ext =
    contentType === "video/mp4"
      ? "mp4"
      : contentType === "image/png"
        ? "png"
        : contentType === "video/webm"
          ? "webm"
          : "jpg";
  return {
    "Content-Disposition": `attachment; filename="shot.${ext}"`,
  };
}

export const Route = createFileRoute("/api/media/$shotId")({
  server: {
    handlers: {
      HEAD: async ({ params, request }) => {
        const auth = await authorizeShot(params.shotId, request);
        if (!auth.ok) {
          return new Response(null, { status: auth.status, headers: ROBOTS });
        }
        const stamp = await import("@/lib/server/stamp.server");
        // Extension / media_type only — avoid loading stamp cache bytes on probe.
        // Client refines labels from GET Content-Type when the collector downloads.
        const type = mediaContentType(auth.row, stamp);
        return new Response(null, {
          status: 200,
          headers: {
            ...ROBOTS,
            "Content-Type": type,
            "Cache-Control": "private, max-age=120",
          },
        });
      },
      GET: async ({ params, request }) => {
        const auth = await authorizeShot(params.shotId, request);
        if (!auth.ok) {
          return new Response(auth.body, { status: auth.status, headers: ROBOTS });
        }
        const { sql, settings, row, userId } = auth;
        const shotId = params.shotId;

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
            const type = "image/png";
            return new Response(new Uint8Array(cached), {
              headers: {
                ...ROBOTS,
                "Content-Type": type,
                "Cache-Control": "private, max-age=3600",
                ...dispositionHeaders(request, type),
              },
            });
          }
        }

        let bytes = await stamp.readPrivateOriginal(row.media_url);
        if (!bytes && row.media_url.startsWith("grant:")) {
          // Cold deploy: seed may still be only in git private-media/. Try once.
          try {
            const { syncBundledVaultOriginalToBlob } = await import(
              "@/lib/server/object-store"
            );
            const name = row.media_url.slice("grant:".length);
            await syncBundledVaultOriginalToBlob(name);
            bytes = await stamp.readPrivateOriginal(row.media_url);
          } catch (err) {
            console.error("[media] seed vault sync retry failed", err);
          }
        }
        if (bytes) {
          const type = mediaContentType(row, stamp);
          return new Response(new Uint8Array(bytes), {
            headers: {
              ...ROBOTS,
              "Content-Type": type,
              ...dispositionHeaders(request, type),
            },
          });
        }

        const path = stamp.resolveMediaPath(row.media_url);
        if (!path) return new Response("Media missing.", { status: 404, headers: ROBOTS });
        try {
          const { readFile, stat } = await import("node:fs/promises");
          await stat(path);
          const fileBytes = await readFile(path);
          const type = mediaContentType(row, stamp, path);
          return new Response(new Uint8Array(fileBytes), {
            headers: {
              ...ROBOTS,
              "Content-Type": type,
              ...dispositionHeaders(request, type),
            },
          });
        } catch {
          return new Response("Media missing.", { status: 404, headers: ROBOTS });
        }
      },
    },
  },
});

/**
 * Long-cache fingerprinted /assets/* and public /media/* marketing covers.
 * Do NOT apply to HTML SSR or private /api/media vault grants.
 *
 * Same (event, next) middleware shape as grok-pwa.ts — Nitro auto-registers
 * server/middleware/* when vite `serverDir: "./server"` is set.
 */
interface CacheEvent {
  url: URL;
  req: { method: string; headers: Headers };
}

const ASSETS_CACHE = "public, max-age=31536000, immutable";
/** Public marketing covers/teasers — longer than HTML, shorter than hashed JS. */
const MEDIA_CACHE = "public, max-age=604800, stale-while-revalidate=86400";

export default async function staticCacheMiddleware(
  event: CacheEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  const path = event.url.pathname || "";
  const result = await next();
  if (!(result instanceof Response)) return result;

  let cache: string | null = null;
  if (path.startsWith("/assets/")) {
    cache = ASSETS_CACHE;
  } else if (path.startsWith("/media/")) {
    cache = MEDIA_CACHE;
  }
  if (!cache) return result;

  // Do not override an explicit private/no-store from an upstream handler.
  const existing = result.headers.get("cache-control") || "";
  if (/private|no-store|no-cache/i.test(existing)) return result;

  const headers = new Headers(result.headers);
  headers.set("Cache-Control", cache);
  return new Response(result.body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

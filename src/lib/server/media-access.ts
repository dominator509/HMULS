/**
 * Grant gate for /api/media/:shotId.
 * A collector may read paid bytes only with a per-shot stamp token, an unlock, or admin override.
 * Storage privacy is separate: see object-store.ts (private Blob access).
 */
export type MediaGrantLookup = {
  userIdForStamp(token: string, shotId: string): Promise<string | null>;
  sessionUser(): Promise<{ id: string } | null>;
  hasUnlock(userId: string, shotId: string): Promise<boolean>;
  isAdmin(userId: string): Promise<boolean>;
};

export type MediaGrantResult =
  | { ok: true; userId: string }
  | { ok: false; status: 403 };

export async function authorizeMediaGrant(opts: {
  shotId: string;
  mediaToken: string;
  lookup: MediaGrantLookup;
}): Promise<MediaGrantResult> {
  const token = opts.mediaToken.trim();
  if (token) {
    const uid = await opts.lookup.userIdForStamp(token, opts.shotId);
    if (uid) return { ok: true, userId: uid };
  }
  const session = await opts.lookup.sessionUser();
  if (!session) return { ok: false, status: 403 };
  if (await opts.lookup.hasUnlock(session.id, opts.shotId)) {
    return { ok: true, userId: session.id };
  }
  if (await opts.lookup.isAdmin(session.id)) {
    return { ok: true, userId: session.id };
  }
  return { ok: false, status: 403 };
}

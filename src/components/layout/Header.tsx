import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { useEffect, useState } from "react";
import { getMyRole } from "@/lib/server/catalog";

export function Header() {
  const { user, isPending } = useCurrentUserState();
  const [admin, setAdmin] = useState(false);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!user) {
      setAdmin(false);
      return;
    }
    getMyRole()
      .then((r) => setAdmin(r.role === "admin"))
      .catch(() => setAdmin(false));
  }, [user]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/75 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        <Link to="/" className="flex min-h-11 min-w-0 shrink items-center gap-3">
          <span className="hidden h-5 w-px bg-gold/70 sm:block" aria-hidden />
          <span className="truncate font-display text-base tracking-[0.12em] text-fg sm:text-xl sm:tracking-[0.18em]">
            SHE UNDRESSES
          </span>
        </Link>
        <nav className="flex min-w-0 items-center gap-0.5 text-sm">
          <Link to="/models" className="nav-link px-2 sm:px-3">
            Muses
          </Link>
          <a href="/#ladders" className="nav-link hidden px-2 sm:inline-flex">
            Sets
          </a>
          <Link to="/vault" className="nav-link px-2 sm:px-3">
            Vault
          </Link>
          {admin ? (
            <Link to="/admin" className="nav-link text-gold hover:text-gold-soft">
              Ops
            </Link>
          ) : null}
          <div className="ml-1 flex min-h-11 min-w-11 items-center justify-end">
            {isPending ? (
              <div className="size-9 animate-pulse rounded-full bg-raised" />
            ) : user ? (
              <div className="flex items-center gap-1.5">
                <span className="grid size-9 place-items-center rounded-full border border-border bg-raised text-xs text-gold">
                  {(user.displayName ?? user.primaryEmail ?? "C").charAt(0).toUpperCase()}
                </span>
                <button
                  type="button"
                  disabled={out}
                  className="nav-link px-2 text-xs"
                  onClick={() => {
                    setOut(true);
                    void signOut().catch(() => setOut(false));
                  }}
                >
                  {out ? "…" : "Sign out"}
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm text-fg hover:border-gold/50 hover:text-gold sm:px-4"
              >
                Enter
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

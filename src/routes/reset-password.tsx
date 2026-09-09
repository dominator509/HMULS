import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Kicker } from "@/components/ui/chrome";
import { AUTH } from "@/lib/copy";
import { toast } from "sonner";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  head: () => privateHead("/reset-password", "Reset password | SHE UNDRESSES"),
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : undefined,
    error: typeof s.error === "string" ? s.error : undefined,
  }),
});

function ResetPassword() {
  const nav = useNavigate();
  const search = Route.useSearch();
  const token = search.token;
  const linkError = search.error;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const blocked = useMemo(() => Boolean(linkError) || !token, [linkError, token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error(AUTH.resetMissing);
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        throw new Error(error.message?.trim() || AUTH.resetMissing);
      }
      toast.success(AUTH.resetDone);
      void nav({ to: "/login" });
    } catch (err) {
      const msg = err instanceof Error ? err.message.trim() : "";
      toast.error(msg || AUTH.resetMissing);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-sm items-center px-5 py-12">
      <div className="w-full">
        <Kicker>{AUTH.kicker}</Kicker>
        <h1 className="mt-2 font-display text-4xl text-fg">{AUTH.resetTitle}</h1>
        {blocked ? (
          <p className="mt-3 text-sm text-muted">{AUTH.resetMissing}</p>
        ) : (
          <p className="mt-3 text-sm text-muted">Pick something only you know. At least 8 characters.</p>
        )}

        {!blocked ? (
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <Field label="New password">
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="field-input"
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" size="xl" disabled={busy}>
              {busy ? "Updating…" : AUTH.resetCta}
            </Button>
          </form>
        ) : null}

        <p className="mt-8 text-center text-xs text-subtle">
          <Link to="/login" className="text-muted hover:text-fg">
            {AUTH.forgotBack}
          </Link>
        </p>
      </div>
    </div>
  );
}

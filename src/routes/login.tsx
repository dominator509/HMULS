import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { getMyRole } from "@/lib/server/catalog";
import { Button } from "@/components/ui/button";
import { Field, Kicker } from "@/components/ui/chrome";
import { getPsychology } from "@/lib/server/transporter";
import { DEFAULT_DIALS, fallbackSurfaces } from "@/lib/psychology";
import { AUTH } from "@/lib/copy";
import { toast } from "sonner";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => privateHead("/login", "Enter | SHE UNDRESSES"),
});

/** Better Auth / Worker flakiness — retry only these, not bad credentials. */
function isTransientAuthError(err: { message?: string | null; status?: number } | null | undefined) {
  if (!err) return false;
  const status = err.status;
  if (status === 401 || status === 403 || status === 400 || status === 422) return false;
  if (status === 500 || status === 502 || status === 503 || status === 504 || status === 408) {
    return true;
  }
  const msg = (err.message ?? "").toLowerCase();
  if (
    msg.includes("invalid") ||
    msg.includes("credential") ||
    msg.includes("password") ||
    msg.includes("unauthorized") ||
    msg.includes("not found")
  ) {
    return false;
  }
  // Empty / generic Worker banners ("Could not log in") — treat as flaky.
  if (!msg.trim()) return true;
  return (
    msg.includes("1101") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("too many connections") ||
    msg.includes("econnreset") ||
    msg.includes("connection") ||
    msg.includes("worker threw") ||
    msg.includes("internal server") ||
    msg.includes("could not log") ||
    msg.includes("couldn't sign") ||
    msg.includes("could not sign") ||
    msg.includes("failed")
  );
}

function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [promise, setPromise] = useState(fallbackSurfaces(DEFAULT_DIALS).loginPromise);

  useEffect(() => {
    getPsychology()
      .then((p) => setPromise(p.surfaces.loginPromise))
      .catch(() => undefined);
  }, []);

  async function onForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo,
      });
      if (error) {
        throw new Error(error.message?.trim() || AUTH.refused);
      }
      toast.success(AUTH.forgotSent);
      setMode("in");
    } catch (err) {
      const msg = err instanceof Error ? err.message.trim() : "";
      toast.error(msg || AUTH.refused);
    } finally {
      setBusy(false);
    }
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const run = () =>
        mode === "up"
          ? authClient.signUp.email({
              email,
              password,
              name: name || email.split("@")[0],
            })
          : authClient.signIn.email({ email, password });

      let result = await run();
      // Workers often 1101 / Neon-pool the first pg hit (see PR #11 / #18).
      if (result.error && isTransientAuthError(result.error)) {
        await new Promise((r) => setTimeout(r, 700));
        result = await run();
      }
      // One more backoff for stubborn connection storms.
      if (result.error && isTransientAuthError(result.error)) {
        await new Promise((r) => setTimeout(r, 1200));
        result = await run();
      }
      if (result.error) {
        const transient = isTransientAuthError(result.error);
        throw new Error(
          (result.error.message?.trim() || (transient ? AUTH.refusedTransient : AUTH.refused)),
        );
      }
      let role = "buyer";
      for (let i = 0; i < 3; i++) {
        try {
          role = (await getMyRole()).role;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 400 * (i + 1)));
        }
      }
      toast.success(AUTH.granted);
      void nav({ to: role === "admin" ? "/admin" : "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message.trim() : "";
      toast.error(msg || AUTH.refused);
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "forgot" ? AUTH.forgotTitle : mode === "in" ? AUTH.inTitle : AUTH.upTitle;
  const blurb = mode === "forgot" ? AUTH.forgotHint : promise;

  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl lg:grid-cols-2">
      <div
        className="relative h-40 overflow-hidden lg:hidden"
        style={{
          backgroundImage: "url(/media/portrait.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-bg to-bg/20" />
      </div>
      <div
        className="relative hidden min-h-[28rem] lg:block"
        style={{
          backgroundImage: "url(/media/portrait.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-bg/80" />
        <div className="absolute bottom-10 left-10 right-10">
          <Kicker accent>{AUTH.panelKicker}</Kicker>
          <p className="mt-2 font-display text-4xl text-fg">{AUTH.panelLine}</p>
        </div>
      </div>
      <div className="flex items-center px-5 py-12">
        <div className="mx-auto w-full max-w-sm">
          <Kicker>{AUTH.kicker}</Kicker>
          <h1 className="mt-2 font-display text-4xl text-fg">{title}</h1>
          <p className="mt-3 text-sm text-muted">{blurb}</p>

          {mode === "forgot" ? (
            <form className="mt-8 space-y-4" onSubmit={onForgot}>
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  autoComplete="email"
                />
              </Field>
              <Button type="submit" size="xl" disabled={busy}>
                {busy ? "Sending…" : AUTH.forgotCta}
              </Button>
            </form>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={onEmail}>
              {mode === "up" ? (
                <Field label="Name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field-input"
                    autoComplete="name"
                  />
                </Field>
              ) : null}
              <Field label="Email">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  autoComplete="email"
                />
              </Field>
              <Field label="Password">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-input"
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                />
              </Field>
              <Button type="submit" size="xl" disabled={busy}>
                {busy ? "Signing in…" : mode === "in" ? AUTH.inCta : AUTH.upCta}
              </Button>
            </form>
          )}

          {mode === "in" ? (
            <button
              type="button"
              className="mt-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg"
              onClick={() => setMode("forgot")}
            >
              {AUTH.forgotLink}
            </button>
          ) : null}

          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg"
            onClick={() => setMode(mode === "forgot" ? "in" : mode === "in" ? "up" : "in")}
          >
            {mode === "forgot"
              ? AUTH.forgotBack
              : mode === "in"
                ? AUTH.switchToUp
                : AUTH.switchToIn}
          </button>

          <p className="mt-8 text-center text-xs text-subtle">
            By entering you confirm you are 18 or older.{" "}
            <Link to="/" className="text-muted hover:text-fg">
              Back to the sets
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

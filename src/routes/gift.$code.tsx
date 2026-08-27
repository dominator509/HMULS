import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { peekGift, redeemGift } from "@/lib/server/purchases";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/chrome";
import { toast } from "sonner";
import { privateHead } from "@/lib/seo";

export const Route = createFileRoute("/gift/$code")({
  component: GiftPage,
  head: () => privateHead("/gift", "Gift | SHE UNDRESSES"),
});

function GiftPage() {
  const { code } = Route.useParams();
  const nav = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [info, setInfo] = useState<{
    title: string;
    slug: string;
    count: number;
    claimed: boolean;
  } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    peekGift({ data: { code } })
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [code]);

  if (info === undefined) {
    return <div className="px-5 py-24 text-center text-muted">Checking grant…</div>;
  }
  if (!info) {
    return (
      <div className="px-5 py-24 text-center text-muted">That grant code is not real.</div>
    );
  }

  if (isPending) {
    return <div className="px-5 py-24 text-center text-muted">Checking your session…</div>;
  }
  if (!user) return <RedirectToSignIn />;

  async function claim() {
    setBusy(true);
    try {
      const res = await redeemGift({ data: { code } });
      toast.success("Grant claimed.");
      void nav({ to: "/ladders/$slug", params: { slug: res.slug }, search: { pay: undefined } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not claim.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <Kicker>A private grant</Kicker>
      <h1 className="mt-2 font-display text-4xl text-fg">{info.title}</h1>
      <p className="mt-3 text-sm text-muted">
        {info.count} shot{info.count === 1 ? "" : "s"} were paid for you.
        Someone already said yes on your behalf.
      </p>
      {info.claimed ? (
        <p className="mt-8 text-sm text-gold">This grant was already claimed.</p>
      ) : (
        <Button className="mt-8" size="xl" disabled={busy} onClick={() => void claim()}>
          {busy ? "Claiming…" : "Claim this grant"}
        </Button>
      )}
    </div>
  );
}

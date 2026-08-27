import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Kicker } from "@/components/ui/chrome";
import { AGE } from "@/lib/copy";
import { BOT_UA } from "@/lib/seo";

const KEY = "sheundresses.age.ok";

export function AgeGate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (BOT_UA.test(navigator.userAgent)) return;
    try {
      setOpen(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-bg px-5">
      <img
        src="/media/hero.jpg"
        alt="Adults only — SHE UNDRESSES sequential unlock vault"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_18%] opacity-40"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/40" />
      <div className="panel relative w-full max-w-md p-8 text-center sm:p-10">
        <Kicker accent>{AGE.kicker}</Kicker>
        <h1 className="mt-3 font-display text-4xl text-fg sm:text-5xl">{AGE.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{AGE.body}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Button
            size="xl"
            onClick={() => {
              try {
                window.localStorage.setItem(KEY, "1");
              } catch {
                /* ignore */
              }
              setOpen(false);
            }}
          >
            {AGE.yes}
          </Button>
          <a
            href="https://www.google.com"
            className="inline-flex min-h-11 items-center justify-center text-sm text-subtle hover:text-muted"
          >
            {AGE.no}
          </a>
        </div>
      </div>
    </div>
  );
}

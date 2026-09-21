import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Kicker, PageHeader, Panel, Field, inputClass } from "@/components/ui/chrome";
import { Button } from "@/components/ui/button";
import { Crumbs, JsonLd } from "@/components/seo/JsonLd";
import { getDiscover } from "@/lib/server/discover";
import { headTags, jsonLdGraph } from "@/lib/seo";
import { FAILED_TX } from "@/lib/copy";
import {
  FAILED_TX_ASSETS,
  FAILED_TX_CONTACT,
  FAILED_TX_SCREENSHOT_MAX_BYTES,
  type FailedTxReportInput,
} from "@/lib/failed-transaction";
import {
  getFailedTxPrefill,
  submitFailedTransaction,
} from "@/lib/server/failed-transaction";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { CryptoAsset } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/failed-transaction")({
  loader: async () => {
    const d = await getDiscover().catch(() => null);
    return { origin: d?.origin ?? "" };
  },
  head: ({ loaderData }) =>
    headTags({
      title: "Failed transaction? | SHE UNDRESSES",
      description:
        "Paid on-chain but the unlock did not open? Report the payment with your account email, asset, and transaction ID. Do not send another payment until we reply.",
      path: "/failed-transaction",
      origin: loaderData?.origin || "",
      keywords: "failed transaction, payment recovery, crypto unlock, SHE UNDRESSES",
    }),
  component: FailedTransactionPage,
});

function FailedTransactionPage() {
  const { origin } = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const [accountEmail, setAccountEmail] = useState("");
  const [asset, setAsset] = useState<CryptoAsset | "">("");
  const [txidOrLink, setTxidOrLink] = useState("");
  const [payAddress, setPayAddress] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [unlockDescription, setUnlockDescription] = useState("");
  const [approxTime, setApproxTime] = useState("");
  const [timezone, setTimezone] = useState("");
  const [notes, setNotes] = useState("");
  const [company, setCompany] = useState(""); // honeypot
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ticket, setTicket] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    if (prefilled.current) return;
    void (async () => {
      try {
        const pref = await getFailedTxPrefill();
        if (pref.email) {
          setAccountEmail(pref.email);
          prefilled.current = true;
          return;
        }
      } catch {
        /* ignore */
      }
      if (!isPending && user?.primaryEmail) {
        setAccountEmail(user.primaryEmail);
        prefilled.current = true;
      }
    })();
  }, [isPending, user?.primaryEmail]);

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || done) return;
    if (!asset) {
      toast.error("Pick the asset you sent.");
      return;
    }
    if (!file) {
      toast.error("Add a screenshot of the send or confirmation so we can match the payment.");
      return;
    }
    setBusy(true);
    try {
      const payload: FailedTxReportInput = {
        accountEmail,
        asset,
        txidOrLink,
        payAddress,
        invoiceId,
        unlockDescription,
        approxTime,
        timezone,
        notes,
        company,
      };

      if (file) {
        if (file.size > FAILED_TX_SCREENSHOT_MAX_BYTES) {
          throw new Error("Screenshot is too large. Use an image under about 3.5 MB.");
        }
        if (!file.type.startsWith("image/")) {
          throw new Error("Screenshot must be an image (PNG, JPEG, or WebP).");
        }
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        payload.screenshotBase64 = btoa(binary);
        payload.screenshotFilename = file.name || "screenshot.jpg";
        payload.screenshotContentType = file.type || "image/jpeg";
      }

      const res = await submitFailedTransaction({ data: payload });
      setTicket(res.ticket);
      setDone(true);
      toast.success("Report received.");
    } catch (err) {
      const msg = err instanceof Error ? err.message.trim() : "";
      toast.error(msg || "Could not send the report. Try again or email contact@sheundresses.com.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <JsonLd
        data={jsonLdGraph({
          origin,
          path: "/failed-transaction",
          title: "Failed transaction? | SHE UNDRESSES",
          description:
            "Report an on-chain payment that did not unlock. Do not send another payment until we reply.",
          crumbs: [
            { name: "Home", path: "/" },
            { name: "Failed transaction", path: "/failed-transaction" },
          ],
        })}
      />
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Failed transaction" },
        ]}
      />
      <div className="mt-6">
        <PageHeader kicker={FAILED_TX.kicker} title={FAILED_TX.title} body={FAILED_TX.body} />
      </div>

      {done ? (
        <Panel className="mt-10 border-gold/30 bg-gold/5">
          <Kicker accent>Received</Kicker>
          <h2 className="mt-1 font-display text-2xl text-fg">{FAILED_TX.confirmTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">{FAILED_TX.confirmBody}</p>
          {ticket && ticket !== "discarded" ? (
            <p className="mt-4 font-mono text-xs text-subtle break-all">Ref: {ticket}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/vault">
              <Button size="xl" className="w-full sm:w-auto">
                Open vault
              </Button>
            </Link>
            <Link to="/how-to-get-crypto">
              <Button variant="outline" size="xl" className="w-full sm:w-auto">
                How to get crypto
              </Button>
            </Link>
          </div>
        </Panel>
      ) : (
        <form className="mt-10 space-y-5" onSubmit={(e) => void onSubmit(e)} noValidate>
          <Panel>
            <p className="text-sm leading-relaxed text-muted">{FAILED_TX.intro}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-subtle">
              {FAILED_TX.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </Panel>

          {/* Honeypot — visually hidden, not display:none so some bots still fill it */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
          >
            <label>
              Company
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
          </div>

          <Field label="Account email used on this site *">
            <input
              type="email"
              required
              autoComplete="email"
              className={inputClass()}
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder="you@email.com"
            />
          </Field>

          <Field label="Asset you sent *">
            <select
              required
              className={inputClass()}
              value={asset}
              onChange={(e) => setAsset(e.target.value as CryptoAsset | "")}
            >
              <option value="">Select…</option>
              {FAILED_TX_ASSETS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Transaction ID or explorer link *">
            <input
              type="text"
              required
              className={inputClass()}
              value={txidOrLink}
              onChange={(e) => setTxidOrLink(e.target.value)}
              placeholder="Paste txid or Solscan / Etherscan / Bitcoin explorer link"
            />
          </Field>

          <Field label="Pay address from checkout (encouraged)">
            <input
              type="text"
              className={inputClass()}
              value={payAddress}
              onChange={(e) => setPayAddress(e.target.value)}
              placeholder="The address checkout showed you"
              autoComplete="off"
            />
          </Field>

          <Field label="Invoice id (if you still see it)">
            <input
              type="text"
              className={inputClass()}
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="Optional"
              autoComplete="off"
            />
          </Field>

          <Field label="What you were unlocking">
            <input
              type="text"
              className={inputClass()}
              value={unlockDescription}
              onChange={(e) => setUnlockDescription(e.target.value)}
              placeholder="e.g. Nyx · The Reveal · shot 3"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Approx date / time">
              <input
                type="text"
                className={inputClass()}
                value={approxTime}
                onChange={(e) => setApproxTime(e.target.value)}
                placeholder="e.g. Sep 20 ~ 9pm"
              />
            </Field>
            <Field label="Timezone">
              <input
                type="text"
                className={inputClass()}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/Los_Angeles"
              />
            </Field>
          </div>

          <Field label="Notes (optional)">
            <textarea
              className={inputClass("min-h-24")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else that helps us match the payment"
            />
          </Field>

          <Field label="Screenshot of send / confirmation *">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className={inputClass("cursor-pointer py-2")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1.5 text-xs text-subtle">
              Strongly encouraged — wallet or exchange confirmation showing the send. PNG / JPEG /
              WebP, under ~3.5 MB.
            </p>
          </Field>

          <Button type="submit" size="xl" className="w-full" disabled={busy}>
            {busy ? "Sending…" : FAILED_TX.submit}
          </Button>

          <p className="text-center text-xs leading-relaxed text-subtle">
            Reports go to {FAILED_TX_CONTACT}. We never ask for your seed phrase. Prefer email?{" "}
            <a href={`mailto:${FAILED_TX_CONTACT}`} className="text-gold">
              {FAILED_TX_CONTACT}
            </a>
          </p>
        </form>
      )}
    </div>
  );
}

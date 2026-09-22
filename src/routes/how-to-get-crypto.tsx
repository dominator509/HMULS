import { createFileRoute, Link } from "@tanstack/react-router";
import { Kicker, PageHeader, Panel } from "@/components/ui/chrome";
import { Button } from "@/components/ui/button";
import { Crumbs, JsonLd } from "@/components/seo/JsonLd";
import { getDiscover } from "@/lib/server/discover";
import { headTags, jsonLdGraph } from "@/lib/seo";
import { HOW_TO_CRYPTO } from "@/lib/copy";

export const Route = createFileRoute("/how-to-get-crypto")({
  loader: async () => {
    const d = await getDiscover().catch(() => null);
    return { origin: d?.origin ?? "" };
  },
  head: ({ loaderData }) =>
    headTags({
      title: "How to get crypto | SHE UNDRESSES",
      description:
        "Plain-English guide to buy and send SOL, USDT (Ethereum), ETH, BTC, or LTC so you can unlock shots on SHE UNDRESSES.",
      path: "/how-to-get-crypto",
      origin: loaderData?.origin || "",
      keywords: "how to get crypto, Solana, Phantom, USDT, Ethereum, Bitcoin, Litecoin, SHE UNDRESSES",
    }),
  component: HowToGetCryptoPage,
});

const STEPS = [
  {
    n: "1",
    title: "What you'll need",
    body: "Two things: a wallet app on your phone or computer, and a familiar place to buy a little crypto. The wallet holds your coins. Checkout shows you the exact amount and address to send.",
  },
  {
    n: "2",
    title: "Pick your coin",
    body: "At unlock you choose one of the coins we accept. Stick with the same coin on the buy app and on checkout — mixing networks is how people lose funds.",
  },
  {
    n: "3",
    title: "Buy on a familiar app",
    body: "Many people start with Coinbase, Cash App (Bitcoin where available), or another exchange they already trust. Availability depends on your country and the app. Buy only a little more than the unlock amount so you have room for network fees.",
  },
  {
    n: "4",
    title: "Send the exact amount",
    body: "Open the invoice on this site. Copy the address shown (and for USDT, stay on Ethereum). Send the exact amount listed. Do not round down. Wrong network or wrong coin can mean lost funds we cannot recover.",
  },
  {
    n: "5",
    title: "Tap “I sent payment” and wait",
    body: "After you send, tap the button on checkout and give the network a moment. When the payment confirms, the shot unlocks to your account. You do not need to paste a transaction ID unless support asks.",
  },
] as const;

const COINS = [
  {
    id: "SOL",
    name: "Solana (SOL)",
    blurb:
      "Fast and usually low fees. On checkout, pay with Phantom or Solflare — those buttons open your wallet so you can confirm the exact amount.",
    tip: "Install Phantom or Solflare before you unlock if you plan to pay with SOL.",
  },
  {
    id: "USDT",
    name: "USDT (Tether)",
    blurb:
      "We only accept USDT on Ethereum (ERC-20). The checkout screen will say Ethereum. MetaMask and Trust Wallet are common ways to send it.",
    tip: "Wrong network = lost funds. Do not send USDT on Tron, Solana, BSC, or any other chain.",
  },
  {
    id: "ETH",
    name: "Ethereum (ETH)",
    blurb:
      "Send ETH on the Ethereum network to the address on your invoice. MetaMask, Rainbow, Trust, and Coinbase Wallet are common options.",
    tip: "Send the exact amount shown. Network fees are separate and come from your wallet balance.",
  },
  {
    id: "BTC",
    name: "Bitcoin (BTC)",
    blurb:
      "Bitcoin is offered on larger multi-photo unlocks (3 or more shots in one payment), and only when the total meets Bitcoin’s minimum. If you do not see BTC in the picker, choose SOL, USDT, ETH, or Litecoin, or unlock a bigger set.",
    tip: "Cash App and Coinbase can buy Bitcoin in many regions; then send on-chain to the invoice address.",
  },
  {
    id: "LTC",
    name: "Litecoin (LTC)",
    blurb:
      "Litecoin works like Bitcoin here, but without the 3-photo rule — use it on a single shot or any size unlock when the total meets Litecoin’s minimum. If LTC is missing from the picker, the amount is below that minimum; try another asset or a larger set.",
    tip: "Many exchanges that sell Bitcoin also sell Litecoin; send on-chain to the invoice address.",
  },
] as const;

function HowToGetCryptoPage() {
  const { origin } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <JsonLd
        data={jsonLdGraph({
          origin,
          path: "/how-to-get-crypto",
          title: "How to get crypto | SHE UNDRESSES",
          description:
            "Buy and send SOL, USDT on Ethereum, ETH, BTC, or LTC to unlock shots — written for first-timers.",
          crumbs: [
            { name: "Home", path: "/" },
            { name: "How to get crypto", path: "/how-to-get-crypto" },
          ],
        })}
      />
      <Crumbs
        items={[
          { label: "Home", href: "/" },
          { label: "How to get crypto" },
        ]}
      />
      <div className="mt-6">
        <PageHeader
          kicker={HOW_TO_CRYPTO.kicker}
          title={HOW_TO_CRYPTO.title}
          body={HOW_TO_CRYPTO.body}
        />
      </div>

      <ol className="mt-10 space-y-4">
        {STEPS.map((s) => (
          <li key={s.n}>
            <Panel>
              <Kicker accent>Step {s.n}</Kicker>
              <h2 className="mt-1 font-display text-2xl text-fg">{s.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </Panel>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 font-display text-2xl text-fg">Coins we accept</h2>
      <p className="mt-2 text-sm text-muted">
        Match the coin you buy to the coin you pick at checkout. Names look similar across apps — the
        network matters.
      </p>
      <ul className="mt-4 space-y-3">
        {COINS.map((c) => (
          <li key={c.id}>
            <Panel>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-xl text-fg">{c.name}</h3>
                <span className="shrink-0 font-mono text-xs tracking-wide text-gold">{c.id}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.blurb}</p>
              <p className="mt-2 text-xs leading-relaxed text-gold">{c.tip}</p>
            </Panel>
          </li>
        ))}
      </ul>

      <Panel className="mt-10 border-gold/30 bg-gold/5">
        <Kicker accent>Quick safety check</Kicker>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>Only send to the address shown on your SHE UNDRESSES checkout for that unlock.</li>
          <li>USDT must be ERC-20 on Ethereum — not another chain.</li>
          <li>Send the exact amount. Underpaying can delay or block the unlock.</li>
          <li>After you send, stay on the checkout page and wait for confirmation.</li>
        </ul>
      </Panel>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a href="/#ladders" className="sm:w-auto">
          <Button size="xl" className="w-full sm:w-auto">
            Browse the sets
          </Button>
        </a>
        <Link to="/models" className="sm:w-auto">
          <Button variant="outline" size="xl" className="w-full sm:w-auto">
            Meet the muses
          </Button>
        </Link>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-subtle">
        Paid on-chain but the unlock stayed locked? Use the{" "}
        <Link to="/failed-transaction" className="text-gold">
          Failed transaction?
        </Link>{" "}
        form (or email{" "}
        <a href="mailto:contact@sheundresses.com" className="text-gold">
          contact@sheundresses.com
        </a>
        ). Do not send another payment until we reply. We never ask for your wallet seed phrase.
      </p>
    </div>
  );
}

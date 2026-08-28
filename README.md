# HMULS — SHE UNDRESSES

18+ sequential photo/video unlock vault. Nine-yes ladders, grant-gated paid frames, operator Studio (Grok authoring + Imagine stills/clips), theme, SEO, crypto checkout.

This is **not** a clothes-remover. Models are fictional adults. Paid files live in `private-media/` (bundled, not publicly served) and are only streamed through `/api/media` after a grant.

## Stack

TanStack Start, Better Auth, PGLite/Postgres, Tailwind v4, xAI Grok + Imagine.

## Public domain

Canonical origin: **https://sheundresses.com** (apex). `www.sheundresses.com` should 301 to the apex.

After the domain is attached to this app's Vercel project:

1. At the registrar, set:
   - `@` (apex) → `A` `10.0.1.2`
   - `www` → `CNAME` `cname.vercel-dns.com`
2. On the host, add both `sheundresses.com` and `www.sheundresses.com`, and redirect www → apex.
3. Set `BETTER_AUTH_URL=https://sheundresses.com`, `VITE_PUBLIC_HOSTNAME=sheundresses.com`, `PUBLIC_SITE_URL=https://sheundresses.com`.
4. Set `NOWPAYMENTS_IPN_URL=https://sheundresses.com/api/payments/ipn` once payments are live.
5. Ops → Legal: Public URL should read `https://sheundresses.com`. Save and regenerate the legal pack. Use `legal@sheundresses.com` / `dmca@sheundresses.com` once those mailboxes exist.

SEO, sitemap, robots, and JSON-LD use that origin. Empty legal `website_url` is filled with the apex on boot.

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

Owner: set `INITIAL_ADMIN_EMAIL` or claim with `BOOTSTRAP_SECRET`. Preview without Postgres may elect the first signed-in operator **only when `DATABASE_URL` is unset and the process is not production/Vercel**. Production never elects the first signup. Production without `DATABASE_URL` refuses to start.

## Storage

- Seed paid originals ship in `private-media/` and are included as Nitro server assets on Vercel. They are never under `public/`.
- `public/media/` holds teasers and covers only.
- Forensic stamps and Studio-generated originals need `BLOB_READ_WRITE_TOKEN` (Vercel Blob) in production. `/tmp` is cache only — it is not durable storage.
- Create the Blob store as **private** (or put vault/stamp objects with `access: "private"`). Paid originals are never public CDN objects. HMAC pathnames are not access control. `/api/media` is the only read path for grants.
- Marketing teasers under `/media/` may be public Blob objects.
- `DATABASE_URL` is required in production.

## Payments

Public checkout requires `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, and `NOWPAYMENTS_IPN_URL`. The browser cannot grant. Settlement requires HMAC plus finished status, amount, currency, payment id (string or number), pay address, and pay currency match. Operator grant is explicit and labeled.

USDT is modeled as ERC-20 (`usdterc20` on NOWPayments).

**Eligibility:** NOWPayments merchant terms (as of April 2026) state services are not rendered to residents or citizens of the United States, EU, or UK. If the legal entity is Washington / United States, do not take live settlement through NOWPayments until eligibility is confirmed in writing, or use a processor that onboards US adult merchants.

## Do not commit

- `data/grants/`, `data/originals/`, `data/stamps/` — runtime vault / forensic cache
- `.env` — keys

Do commit `private-media/` (paid seed originals) and `public/media/*-tease.jpg` / `*-cover.jpg` (public derivatives only).

## CI

`.github/workflows/ci.yml` runs typecheck, tests, lint, and a production build on `main` (and on PRs).

Hosted runners start when the repository is **public** (free runner pool) or when a **private** repo has a working [Actions billing](https://github.com/settings/billing) setup (payment method + spending limit). Early private-repo runs failed in ~4 seconds with no steps because GitHub refused to provision a runner — that was billing, not tests.

**Do not leave this repository public.** `private-media/` is the paid seed vault. A public GitHub repo makes those files world-downloadable, independent of `/api/media`. Switch it back to private before any exclusive paid original is unique to this vault, then keep Actions billing healthy so CI still runs.

## Branch protection

`main` blocks force pushes and deletion (classic protection + a `protect-main` ruleset).

After a CI run on `main` actually executes `npm test` and goes green:

1. Repo **Settings → Rules → Rulesets → protect-main**
2. Add required status check **`check`** (the CI job name)
3. Optionally require a pull request

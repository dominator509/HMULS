# AGENTS.md — HMULS / SHE UNDRESSES

> **Paste this entire file / follow AGENTS.md to deploy HMULS from zero.**
> Treat the ordered checklist as success criteria. Do not invent hosts, presets, or secrets. Prefer editing this file over creating parallel setup docs.

```
ONE-SHOT AGENT PROMPT — copy everything below this fence into your coding agent

You are deploying / operating HMULS (SHE UNDRESSES). Repo: github.com/dominator509/HMULS (keep PRIVATE — private-media/ is paid seeds). Production app is Cloudflare Worker `hmuls` on https://sheundresses.com — NOT a Vercel DNS host (README still mentions Vercel A/CNAME in places; that is drift).

Product: 18+ sequential unlock vault. NOT a nudify / clothes-remover app. Models are fictional adults 21+ (portrayed 24–34). Paid frames are grant-gated via /api/media only.

Stack: TanStack Start + Nitro, Better Auth, Neon Postgres (HTTP from Worker), Cloudflare Worker `hmuls` (Workers Builds ← GitHub), private Vercel Blob vault, xAI Grok/Imagine (Studio), NOWPayments crypto checkout, AgentMail outbound, stamp sidecar https://stamps.sheundresses.com (Contabo/VPS ffmpeg).

Success criteria (zero → live):
1. Private clone/fork; npm install; .env from .env.example
2. Neon + pooled DATABASE_URL; migrations through 0014_narrative_brief.sql (owner_brief)
3. Cloudflare Worker `hmuls` deployed via Workers Builds / connected GitHub
4. Worker secrets set (keys that must reach Nitro process.env) + plain vars set
5. DNS apex on CF; www → apex 301; role mailboxes only (no personal Gmail on public site)
6. Private Blob; seed sync via ensureCatalog / Ops “Sync seed vault to Blob”
7. Stamp sidecar live if stamps used; STAMP_URL + STAMP_SECRET on Worker
8. Admin bootstrap /login → /admin; Ops Legal entity required for checkout
9. IPN https://sheundresses.com/api/payments/ipn; ~98% underpay tolerance; recovery runbook
10. CI job `check` green; ignore Workers Builds PR preview fails; ship via PR to protected main
11. Whenever deploy/env/secrets/infra/migrations/domains/Worker vars change: update AGENTS.md in the same PR (or immediate follow-up)

Never commit .env or secret values. Never put operator personal name/Gmail on public pages or legal templates — use legal@ / dmca@ / contact@sheundresses.com.
```

---

## Product (accurate as of 2026-09)

| | |
|---|---|
| **Site** | https://sheundresses.com (apex canonical) |
| **Product** | 18+ sequential unlock vault — grant-gated photo/video ladders |
| **Not** | A nudify / clothes-remover app |
| **Models** | Fictional adults **21+**, portrayed **24–34** |
| **Repo** | `dominator509/HMULS` — **keep PRIVATE** (`private-media/` = paid seed originals; a public GitHub repo makes them world-downloadable) |
| **Production runtime** | Cloudflare Worker **`hmuls`** (Git-connected; Workers Builds from `main`) |
| **DB** | Neon Postgres (pooled `DATABASE_URL`; Worker uses Neon HTTP SQL, not long-lived `pg` TCP) |
| **Auth** | Better Auth |
| **Paid media** | Private Vercel Blob (`access: "private"`); collector reads only via `/api/media` |
| **AI** | xAI Grok / Imagine (Studio) when `XAI_API_KEY` is set |
| **Payments** | NOWPayments; IPN HMAC + amount/currency match; ~**98%** underpay tolerance |
| **Outbound mail** | AgentMail (`AGENTMAIL_API_KEY` + inbox) |
| **Inbound mail** | Cloudflare Email Routing → role addresses (legal@ / dmca@ / contact@) |
| **Stamps** | Sidecar `https://stamps.sheundresses.com` (Contabo/VPS ffmpeg); Worker holds tokens in Neon + stamped PNG in Blob |

### README drift (do not follow blindly)

- `README.md` still describes attaching the domain to a **Vercel** project and registrar `A 76.76.21.21` / `cname.vercel-dns.com`. **Production DNS and HTTPS terminate on Cloudflare for Worker `hmuls`.** Prefer CF zone records / Worker custom domains + www→apex 301.
- `vite.config.ts` still uses Nitro **`preset: "vercel"`**. Cloudflare Workers Builds wraps that build into Worker `hmuls`. Do **not** assume a committed Cloudflare Nitro preset exists — do not “fix” the preset unless you are intentionally changing the deploy pipeline.
- Local/`npm run build` may still mention Vercel function output paths for private-media copy; that is build scaffolding, not the live edge host.

---

## Maintenance rule (mandatory)

Whenever a change affects **deploy / env / secrets / infra / migrations / domains / Worker vars / Blob / payments / email / stamp sidecar**, the **same PR** (or an immediate follow-up PR) **MUST update this `AGENTS.md`** so the next one-shot agent stays accurate.

Do not leave runbooks or secret-name lists stale. Prefer expanding this file over inventing a second source of truth. Optional deep dives go under `docs/` and are linked from the Runbooks index below.

---

## Zero → live checklist

### 1. Repo + local

1. Clone or fork **`dominator509/HMULS`** as a **private** repo.
2. `npm install`
3. `cp .env.example .env` and fill locally (never commit `.env`).
4. `npm run dev` for local; production never elects the first signup as owner.

### 2. Neon + migrations

1. Create a Neon project; use the **pooled** connection string as `DATABASE_URL`.
2. Apply migrations in basename order through latest, including **`0014_narrative_brief.sql`** (`owner_brief` on models/ladders).
3. Cloudflare Workers Builds typically **does not** see `DATABASE_URL` at build time, so **`db:migrate` may be skipped on CF build** — apply migrations yourself (Neon SQL editor / MCP / `npm run db:migrate` with `DATABASE_URL` set) before expecting the homepage to work.
4. Migration order is lexical by filename under `migrations/*.sql` (see `scripts/migration-plan.mjs`). Do not skip `0014`.

### 3. Cloudflare Worker `hmuls`

1. Connect the GitHub repo to Cloudflare **Workers Builds**.
2. Worker name: **`hmuls`**. Production deploys from **`main`**.
3. Attach custom domains: `sheundresses.com` and `www.sheundresses.com`.
4. After merge to `main`, watch Workers Builds until production **success**, then verify the live site with a **real browser User-Agent** (default Python-urllib often gets CF **403**).

### 4. Secrets vs plain vars (Worker)

Put values that must reach **Nitro `process.env`** as **encrypted Worker secrets** when they are credentials. Use plain text vars for non-secret public URLs and build-visible hostnames.

**Secrets (encrypted):**

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | Auth signing |
| `BOOTSTRAP_SECRET` | Owner claim / bootstrap |
| `NOWPAYMENTS_API_KEY` | Checkout |
| `NOWPAYMENTS_IPN_SECRET` | IPN HMAC |
| `BLOB_READ_WRITE_TOKEN` | Private Vercel Blob R/W |
| `STAMP_SECRET` | Bearer auth to stamp sidecar |
| `XAI_API_KEY` | Grok / Imagine (Studio) |
| `AGENTMAIL_API_KEY` | Outbound mail (password reset, recovery replies) |

**Plain vars (text OK):**

| Name | Typical production value / notes |
|---|---|
| `INITIAL_ADMIN_EMAIL` | Designated **operator** inbox (not shown on public site) |
| `PUBLIC_SITE_URL` | `https://sheundresses.com` |
| `BETTER_AUTH_URL` | `https://sheundresses.com` |
| `VITE_PUBLIC_HOSTNAME` | `sheundresses.com` (also set as **Build** var so it bakes correctly) |
| `NOWPAYMENTS_IPN_URL` | `https://sheundresses.com/api/payments/ipn` (optional if derived from site URL) |
| `STAMP_URL` | `https://stamps.sheundresses.com` (no trailing slash) |
| `AGENTMAIL_INBOX` | AgentMail inbox id (often full address); plain OK |

**Do not set on Worker:** `FFMPEG` (no local ffmpeg binary in the isolate — stamps go through the sidecar).

### 5. DNS + HTTPS

1. Apex `sheundresses.com` on the Cloudflare zone → Worker `hmuls`.
2. `www` → apex **301** (CF Single Redirect / dynamic redirect; preserve path + query).
3. Prefer Full SSL, Always Use HTTPS, HSTS as appropriate for the zone.
4. Do **not** point apex at Vercel `76.76.21.21` for this production.

### 6. Email

1. **Inbound:** Cloudflare Email Routing for `legal@`, `dmca@`, `contact@` @sheundresses.com (inbound only — CF Email Routing does not send as the domain).
2. **Outbound:** AgentMail with `AGENTMAIL_API_KEY` (+ `AGENTMAIL_INBOX`).
3. Public templates and legal pack use **role mailboxes only**.

### 7. Blob vault + seed sync

1. Create a **private** Vercel Blob store (Blob only — production app host is still the Worker).
2. Set `BLOB_READ_WRITE_TOKEN` as a Worker secret.
3. Seed unlocks use `media_url` like `grant:rev_1.jpg`. Files ship in git `private-media/` for local/Nitro, but **the Worker has no durable private-media disk**.
4. Cold starts call `syncBundledVaultOriginalsToBlob()` from `ensureCatalog` (once per isolate) to upload missing seeds into Blob.
5. Ops can re-run via admin **“Sync seed vault to Blob”** (`syncVaultOriginals` on the Stamps panel).
6. Teasers/covers stay under `public/media/` (or public Blob). **Never** copy a paid original into `public/`.

### 8. Stamp sidecar (optional but required for pixel stamps)

1. Workers cannot `execFile` ffmpeg. Pixel stamps need the Contabo/VPS sidecar.
2. Public URL: **`https://stamps.sheundresses.com`** (prefer DNS-only / grey-cloud to the VPS origin).
3. Auth: `Authorization: Bearer <STAMP_SECRET>` on `/v1/*`.
4. Set Worker plain `STAMP_URL` + secret `STAMP_SECRET`. Sidecar must **not** store vault originals or stamp caches on disk (`/tmp` only).
5. Videos are not pixel-stamped (sidecar returns 415).

### 9. Admin bootstrap + legal

1. Sign in at `/login` with the owner email; claim via `BOOTSTRAP_SECRET` / `INITIAL_ADMIN_EMAIL` as documented in `.env.example`.
2. Reach `/admin`.
3. **Ops → Legal:** legal entity + public URL `https://sheundresses.com` are **required for checkout**. Save and regenerate the legal pack. Use `legal@` / `dmca@` role addresses.

### 10. Payments

1. IPN callback: **`https://sheundresses.com/api/payments/ipn`**
2. Settlement requires HMAC + finished/eligible status, amount, currency, payment id, pay address, pay currency match.
3. Underpay: code accepts ~**98%** (`actually_paid >= pay_amount * 0.98`) for partials within tolerance (exchange withdrawals often land slightly short).
4. Browser never grants; operator grant is explicit.
5. Stranded on-chain / missing unlock → [`docs/payment-recovery-agentmail.md`](docs/payment-recovery-agentmail.md).
6. Confirm NOWPayments merchant eligibility for your legal entity before live US/EU/UK settlement (terms have excluded those residents/citizens — verify in writing).

### 11. CI + branch protection

1. Required GitHub Actions job name: **`check`** (typecheck, test, lint, production build).
2. **Ignore Cloudflare Workers Builds PR preview failures** — previews often fail; they must **not** block merge when `check` is green.
3. `main` is protected (classic protection + `protect-main` ruleset). **Ship via PR**; do not force-push or bypass.
4. After merge, production Worker rebuilds from `main`.

### 12. Privacy (public site)

- **Never** put the operator’s personal name or personal Gmail on the public site, legal templates, SEO copy, or customer-facing email.
- Use role mailboxes: `legal@sheundresses.com`, `dmca@sheundresses.com`, `contact@sheundresses.com`.
- Do not commit secrets, tokens, or full connection strings. Env **names** only in docs/chat.

---

## Paid media storage (preserve)

- Production **paid originals MUST live in private Vercel Blob** (`access: "private"`). HMAC pathnames are not access control; `/api/media` is the only collector read path.
- Dashboard Studio / admin ingest already goes through `vaultShotMedia` → `putPrivateOriginal` when `BLOB_READ_WRITE_TOKEN` is set. Do not weaken that path or store paid frames as public CDN objects / under `public/`.
- Seed unlocks use `media_url` like `grant:rev_1.jpg`. Files ship in git `private-media/` for local/Nitro, but **Cloudflare Worker has no durable private-media disk** — cold starts call `syncBundledVaultOriginalsToBlob()` from `ensureCatalog` (once per isolate) to upload missing seeds into Blob. Ops can re-run via admin `syncVaultOriginals` (**Sync seed vault to Blob**).
- Teasers/covers stay under `public/media/` (or public Blob). Never copy a paid original into `public/`.

---

## Runbooks index

| Doc | Use |
|---|---|
| [`docs/payment-recovery-agentmail.md`](docs/payment-recovery-agentmail.md) | Stranded crypto / NOWPayments underpay; AgentMail recovery; ~2% tolerance; operator settle one invoice only |
| [`docs/muse-narrative-formula.md`](docs/muse-narrative-formula.md) | Muse / photoset voice; personal-fantasy hybrid / scene-trailer pattern; Engrish ban; Manual / Generate / Reverse modes |
| [`docs/seo-taxonomy.md`](docs/seo-taxonomy.md) | SEO taxonomy |
| [`docs/seo-content-calendar-8wk.md`](docs/seo-content-calendar-8wk.md) | 8-week content calendar |
| [`docs/seo-w2-page-copy.md`](docs/seo-w2-page-copy.md) | Week-2 page copy |
| [`docs/seo-w3-competitor-velocity.md`](docs/seo-w3-competitor-velocity.md) | Competitor velocity |
| [`docs/seo-w3-reply-grant-templates.md`](docs/seo-w3-reply-grant-templates.md) | Reply / grant templates |
| [`docs/seo-w4-content-engine.md`](docs/seo-w4-content-engine.md) | Content engine |
| [`docs/seo-w4-first-posts.md`](docs/seo-w4-first-posts.md) | First posts |

Local quick start remains: `npm install` → `cp .env.example .env` → `npm run dev`. Production path is the Worker checklist above.

---

## Do not commit

- `.env` and any real secret values
- `data/grants/`, `data/originals/`, `data/stamps/` (runtime vault / forensic cache)
- Operator personal identity on public assets

Do commit `private-media/` (paid seed originals) and `public/media/*-tease.jpg` / `*-cover.jpg` (public derivatives only) — and keep the GitHub repo **private**.

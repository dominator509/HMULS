# AGENTS.md — HMULS / SHE UNDRESSES

> **Paste this entire file / follow AGENTS.md to deploy HMULS from zero.**
> Treat the ordered checklist as success criteria. Do not invent hosts, presets, or secrets. Prefer editing this file over creating parallel setup docs.

```
ONE-SHOT AGENT PROMPT — copy everything below this fence into your coding agent

You are deploying / operating HMULS (SHE UNDRESSES). Repo: github.com/dominator509/HMULS (keep PRIVATE — private-media/ is paid seeds). Production app is Cloudflare Worker `hmuls` on https://sheundresses.com — NOT a Vercel DNS host (README still mentions Vercel A/CNAME in places; that is drift).

Product: 18+ sequential unlock vault. NOT a nudify / clothes-remover app. Models are fictional adults 21+ (portrayed 24–34). Paid frames are grant-gated via /api/media only.

Stack: TanStack Start + Nitro, Better Auth, Neon Postgres (HTTP from Worker), Cloudflare Worker `hmuls` (Workers Builds ← GitHub), Cloudflare R2 vault (hmuls-vault) with optional Vercel Blob fallback, xAI Grok/Imagine (Studio), NOWPayments crypto checkout, AgentMail outbound, stamp sidecar https://stamps.sheundresses.com (Contabo/VPS ffmpeg).

Success criteria (zero → live):
1. Private clone/fork; npm install; .env from .env.example
2. Neon + pooled DATABASE_URL; migrations through 0014_narrative_brief.sql (owner_brief)
3. Cloudflare Worker `hmuls` deployed via Workers Builds / connected GitHub
4. Worker secrets set (keys that must reach Nitro process.env) + plain vars set
5. DNS apex on CF; www → apex 301; role mailboxes only (no personal Gmail on public site)
6. R2 vault (`hmuls-vault` + `HMULS_VAULT` binding and/or `CLOUDFLARE_API_TOKEN`); seed sync backgrounded from ensureCatalog (not on auth path) / `/api/media` miss / Ops sync
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
| **DB** | Neon Postgres — Worker secret `DATABASE_URL` **must** use the **`-pooler`** host (`ep-…-pooler.…aws.neon.tech`). App SQL uses Neon HTTP `/sql` (AbortError/transient retries in `db.ts`); do not use long-lived node-postgres TCP from the Worker. |
| **Auth** | Better Auth via Neon HTTP Kysely dialect (`neonHttpDialect` → `getSql`) — same path as app SQL; **not** `pg` TCP or sticky serverless Pool |
| **Paid media** | Cloudflare R2 bucket `hmuls-vault` (binding `HMULS_VAULT`; REST token fallback); optional private Vercel Blob; collector reads only via `/api/media` |
| **AI** | xAI Grok / Imagine (Studio) when `XAI_API_KEY` is set |
| **Payments** | NOWPayments; IPN HMAC + amount/currency match; ~**98%** underpay tolerance |
| **Outbound mail** | AgentMail (`AGENTMAIL_API_KEY` + inbox) |
| **Inbound mail** | Cloudflare Email Routing → role addresses (legal@ / dmca@ / contact@) |
| **Stamps** | Sidecar `https://stamps.sheundresses.com` (Contabo/VPS ffmpeg); Worker holds tokens in Neon + stamped PNG in R2 (`stamps/…`) or Blob |

### README drift (do not follow blindly)

- `README.md` still describes attaching the domain to a **Vercel** project and registrar `A 76.76.21.21` / `cname.vercel-dns.com`. **Production DNS and HTTPS terminate on Cloudflare for Worker `hmuls`.** Prefer CF zone records / Worker custom domains + www→apex 301.
- `vite.config.ts` still uses Nitro **`preset: "vercel"`**. Cloudflare Workers Builds wraps that build into Worker `hmuls`. Do **not** assume a committed Cloudflare Nitro preset exists — do not “fix” the preset unless you are intentionally changing the deploy pipeline.
- Local/`npm run build` may still mention Vercel function output paths for private-media copy; that is build scaffolding, not the live edge host.

---

## Maintenance rule (mandatory)

Whenever a change affects **deploy / env / secrets / infra / migrations / domains / Worker vars / R2 / Blob / payments / email / stamp sidecar**, the **same PR** (or an immediate follow-up PR) **MUST update this `AGENTS.md`** so the next one-shot agent stays accurate.

Do not leave runbooks or secret-name lists stale. Prefer expanding this file over inventing a second source of truth. Optional deep dives go under `docs/` and are linked from the Runbooks index below.

---

## Zero → live checklist

### 1. Repo + local

1. Clone or fork **`dominator509/HMULS`** as a **private** repo.
2. `npm install`
3. `cp .env.example .env` and fill locally (never commit `.env`).
4. `npm run dev` for local; production never elects the first signup as owner.

### 2. Neon + migrations

1. Create a Neon project; use the **pooled** connection string as `DATABASE_URL` (host must include `-pooler`). Code rewrites non-pooler Neon hosts via `preferNeonPoolerUrl` and strips `channel_binding` (breaks Workers). Worker secret should still be the pooler URI from Neon console / `get_connection_string`.
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
| `DATABASE_URL` | Neon **pooled** connection string (`…-pooler.…neon.tech`; `sslmode=require`) |
| `BETTER_AUTH_SECRET` | Auth signing |
| `BOOTSTRAP_SECRET` | Owner claim / bootstrap |
| `NOWPAYMENTS_API_KEY` | Checkout |
| `NOWPAYMENTS_IPN_SECRET` | IPN HMAC |
| `CLOUDFLARE_API_TOKEN` | R2 REST object API fallback (alias `R2_CF_API_TOKEN` also accepted) |
| `BLOB_READ_WRITE_TOKEN` | Optional/legacy private Vercel Blob R/W (Hobby transfer caps can suspend the store) |
| `STAMP_SECRET` | Bearer auth to stamp sidecar |
| `XAI_API_KEY` | Grok / Imagine (Studio) |
| `AGENTMAIL_API_KEY` | Outbound mail (password reset, recovery replies) |
| `SOLANA_RPC_URL` | **Recommended** Worker secret: Helius/QuickNode JSON-RPC for reliable `/api/sol/recent-blockhash` + **`/api/sol/send-raw`** (Phantom server broadcast). Without it, mainnet-beta + publicnode are used and sendRaw is flakier. Treat as **secret** when the URL embeds an API key. |

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
| `R2_ACCOUNT_ID` | `8e4acc97dafd9496df937662d07aa0d5` |
| `R2_BUCKET` | `hmuls-vault` |

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

### 7. R2 vault + seed sync (Blob optional)

1. R2 bucket **`hmuls-vault`** on account `8e4acc97dafd9496df937662d07aa0d5`. `wrangler.toml` declares binding **`HMULS_VAULT`** so Workers Builds attaches it on deploy.
2. Plain Worker vars: `R2_ACCOUNT_ID`, `R2_BUCKET=hmuls-vault`. Secret for REST fallback: `CLOUDFLARE_API_TOKEN` (or `R2_CF_API_TOKEN`) — same Cloudflare REST object API (`/accounts/{id}/r2/buckets/hmuls-vault/objects/{key}`).
3. Object keys: `vault/<basename>` matching grant keys (e.g. `vault/crv_1.jpg`, `vault/rev_1.jpg`) — **not** Vercel Blob HMAC pathnames. Stamps: `stamps/<userId>/<shotId>.png`.
4. Seed unlocks use `media_url` like `grant:rev_1.jpg`. Files ship in git `private-media/` for local/Nitro, but **the Worker has no durable private-media disk**.
5. Cold starts **kick off** `syncBundledVaultOriginals()` from `ensureCatalog` once per isolate (**fire-and-forget — not awaited**). Auth / `getMyRole` / other server fns must not wait on R2 seed sync or full-ladder `syncLiveCounts` (throttled background) (that blocked login after the R2 cutover → client "Sign-in timed out"). Existence for bulk sync uses **one `vault/` list** (not N REST HEADs); R2 REST fetches use ~5s AbortSignal timeouts. Per-file seed repair still runs on `/api/media` miss.
6. Ops can re-run via admin seed vault sync (`syncVaultOriginals` on the Stamps panel).
7. Optional/legacy: private Vercel Blob via `BLOB_READ_WRITE_TOKEN`. Prefer R2 in production; Blob Hobby transfer caps can suspend the store.
8. Teasers/covers stay under `public/media/` (or public Blob). **Never** copy a paid original into `public/`.

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

## USDT unlock / MetaMask · Trust · Coinbase (buyers)

- NOWPayments USDT is **`usdterc20`** (Ethereum ERC-20, contract `0xdAC17F958D2ee523a2206206994597C13D831ec7`, 6 decimals). Never treat the pay address as a payment URI.
- Mobile deeplinks (`src/lib/wallet.ts`, `PayWallet`):
  - **MetaMask:** `metamask.app.link/send/<contract>@1/transfer?address=&uint256=` (not `/dapp/` — bare address → blank in-app browser).
  - **Trust:** `link.trustwallet.com/send` with `asset=c60_t<contract>` (and `coin=60&token=`) + human amount.
  - **Coinbase / Base:** do **not** pass a bare address to `dapp?cb_url=` (Invalid URL). Copy address+amount, open Coinbase send home, toast to paste and send **USDT (ERC-20) on Ethereum**.
- Buyer copy: remind **USDT on Ethereum (ERC-20)** — wrong network risks lost funds.
- **Do not** change SOL locked paths (`sol-mobile-deeplink` / Phantom / Solflare pay).

## SOL unlock / Phantom & Solflare (buyers)

- **Do not** send buyers into Phantom/Solflare **in-app browsers** (`…/ul/browse/<https checkout>`). That WebView is a **separate cookie jar** from Safari/Chrome — they look “logged out” and sign-in errors are easy to misread as “wrong password” or “only one session.”
- Better Auth **allows multiple concurrent sessions** by default. We do **not** revoke other sessions on email sign-in (only on password reset). Concurrent-login blocking is **not** a product rule.
- **Preferred unlock UX** (see `src/lib/wallet.ts`, `src/lib/sol-mobile-deeplink.ts`, `PayWallet`) — connect-and-pay first, never copy-link as primary:
  1. **Desktop / extension:** primary CTAs are **Pay with Phantom** and **Pay with Solflare**. When the extension is present, call `connect` + `signAndSendTransaction` for a `SystemProgram.transfer` of the **exact** invoice SOL to the invoice address, then continue the existing waiting / IPN unlock path.
  2. **Android:** same buttons open **package-scoped `intent://` Solana Pay** (`app.phantom` / `com.solflare.mobile`) so the native send sheet opens — not Base via bare `solana:`, and not an in-app browse of sheundresses.com.
  3. **iOS Safari (no extension):** **never** open bare `solana:` (iOS has no app chooser — Base or whichever wallet registered first hijacks it). Use **wallet-owned HTTPS universal links** only:
     - Phantom: `https://phantom.app/ul/v1/connect` (`cluster=mainnet-beta`) → return to checkout HTTPS → **`https://phantom.app/ul/v1/signTransaction`** (encrypted session + base58 serialized legacy tx). **Do not** use Phantom `signAndSendTransaction` — it is **deprecated** and returns “This method is not supported” ([docs](https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction)). On sign return: decrypt signed tx → **`POST /api/sol/send-raw`** (Worker POSTs JSON-RPC **`sendTransaction`** — not `sendRawTransaction` — via `SOLANA_RPC_URL` → mainnet → publicnode; continue on HTTP 403 / Method not found) → mark-sent / IPN unlock.
     - Solflare: `https://solflare.com/ul/v1/connect` (`cluster=mainnet-beta`) → encrypted **`signAndSendTransaction`** (still documented at `docs.solflare.com`) — wallet submits on-chain; we take the returned signature.
     - **Official Phantom constraint:** HTTPS `redirect_link` “Opens in the mobile browser” (often a **new Safari tab**), not the originating page — `sessionStorage` is empty on return ([specifying redirects](https://docs.phantom.com/phantom-deeplinks/specifying-redirects)). App MUST store the wallet session and pass it on later methods ([handling sessions](https://docs.phantom.com/phantom-deeplinks/handling-sessions)).
     - Persist dapp keypair + pay state in **`localStorage`** (`sheundresses.sol.deeplink.v1`, ~45 min TTL, clear on success/decline) — same-origin **cross-tab**. Also embed `hmuls_blob` (base64url resume JSON) on `redirect_link` as defense-in-depth when storage is blocked. Prefer storage; fall back to blob. `redirect_link` is the current checkout HTTPS URL on sheundresses.com (buyer returns signed-in).
     - **Resume after connect:** on checkout load, detect `hmuls_sol` / wallet return params, restore session from localStorage or `hmuls_blob`, decrypt connect, fetch a **fresh** blockhash from `GET /api/sol/recent-blockhash`, optionally **`POST /api/sol/simulate`** (`sigVerify: false`, `replaceRecentBlockhash: true`), then open branded Phantom `signTransaction` / Solflare `signAndSendTransaction` for exact invoice SOL. Persist terms/ack in **`localStorage`** (`sheundresses.sol.checkout.ack.v1`, same TTL). Do not gate UL resume on the ack `disabled` prop. Buyer toasts: “Confirm in Phantom…” / “Payment sent. Waiting for unlock…”. Insufficient funds from simulate → “Not enough SOL in that wallet for this payment + fee”. Unknown-site trust prompt in the wallet is normal for new domains — do not block on that. Clear error toasts if decrypt/session fails (no silent stall).
  4. **Copy address / copy pay link** are **backup only** (collapsed under “Backup”).
- **Pay URI validity:** Solana Pay rejects amounts with **>9 decimals** or scientific notation. Normalize with `formatSolAmount` (also when storing NOWPayments `pay_amount`) so links and transfers are not “invalid.” Empty address → do not emit a URI.
- **Blockhash / broadcast:** browser never calls public Solana RPC (often **403** to browser origins). iOS UL sign builder and desktop `sendSolWithWallet` fetch `{ blockhash, lastValidBlockHeight, blockHeight? }` from same-origin **`GET /api/sol/recent-blockhash`**. Store `lastValidBlockHeight` in the Phantom sign session/blob; before **`POST /api/sol/send-raw`**, if a **trusted** current height ≥ that value (or RPC returns `BlockhashNotFound` / block height exceeded), clear session and toast **“That confirm took too long. Tap Pay with Phantom again.”** — not the generic submit error. If height is missing/untrusted, **skip** the pre-broadcast height check and let `sendRaw` map a real `BlockhashNotFound`. `send-raw` POSTs Solana JSON-RPC **`sendTransaction`** (JS helpers may still be named sendRaw*); prefers **`skipPreflight: true`** + `maxRetries` first (then preflight), tries all RPC URLs (`SOLANA_RPC_URL` / mainnet-beta before publicnode) and continues on HTTP 403 / Method not found, treats a returned signature as success even if confirm poll is slow, and returns machine `code` plus truncated `detail` (`BLOCKHASH_EXPIRED` | `INSUFFICIENT_FUNDS` | `BROADCAST_FAILED`). Buyer toast on all-endpoint refuse: “Couldn't submit the payment. Try again in a moment.” (`detail` kept for debugging). Phantom finish re-serializes via `Transaction.from(...).serialize()` (base58 preferred, base64 accepted). Pre-sign check: **`POST /api/sol/simulate`**. Worker uses optional `SOLANA_RPC_URL` (Helius/QuickNode recommended; treat as secret when keyed), then `https://api.mainnet-beta.solana.com`, then `https://solana-rpc.publicnode.com` for blockhash/send. **`getBlockHeight` must not use publicnode** — it returns slot-scale numbers (~448M) while `lastValidBlockHeight` stays real (~426M); pairing them always looks expired. Prefer `SOLANA_RPC_URL` / mainnet-beta for height; if a fresh pair has `blockHeight >= lastValidBlockHeight`, **omit** `blockHeight` (treat as missing). Buyer toast on prepare failure: “Couldn't prepare the transfer. Try again in a moment.” (tech detail in Worker logs only).
- Do **not** put RPC API keys in `VITE_*` client env.
- Never put backend/unlock jargon (HMAC, Worker, underpay math) on the buyer paywall — plain exact amount + confirmation only.
- Honest Phantom / Solflare labels. Never brand bare `solana:` as those apps (Base hijacks the shared scheme on Android **and** iOS).


## Paid media storage (preserve)

- Production **paid originals prefer Cloudflare R2** bucket `hmuls-vault` (Workers binding `HMULS_VAULT`, REST fallback via `CLOUDFLARE_API_TOKEN` / `R2_CF_API_TOKEN`). Keys: `vault/<safe basename>`. Vercel Blob is **optional/legacy** fallback (`access: "private"`). HMAC Blob pathnames are not access control; `/api/media` is the only collector read path.
- Dashboard Studio / admin ingest goes through `vaultShotMedia` → `putPrivateOriginal` when R2 is ready or `BLOB_READ_WRITE_TOKEN` is set. Do not weaken that path or store paid frames as public CDN objects / under `public/`.
- Seed unlocks use `media_url` like `grant:rev_1.jpg`. Files ship in git `private-media/` for local/Nitro, but **Cloudflare Worker has no durable private-media disk** — cold starts **background** `syncBundledVaultOriginals()` from `ensureCatalog` (once per isolate, **not awaited** on the request path). Bulk existence uses one `vault/` list; R2 REST is time-bounded. `/api/media` miss still syncs a single seed. Ops can re-run via admin `syncVaultOriginals`.
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
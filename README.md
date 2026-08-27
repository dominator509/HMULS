# HMULS — SHE UNDRESSES

18+ sequential photo/video unlock vault. Nine-yes ladders, grant-gated paid frames, operator Studio (Grok authoring + Imagine stills/clips), theme, SEO, crypto checkout.

This is **not** a clothes-remover. Models are fictional adults. Paid files live in a grant vault and are not public.

## Stack

TanStack Start, Better Auth, PGLite/Postgres, Tailwind v4, xAI Grok + Imagine.

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

Owner: set `INITIAL_ADMIN_EMAIL` or claim with `BOOTSTRAP_SECRET`. Preview without Postgres may elect the first signed-in operator. Production never does.

## Payments

Public checkout requires `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, and `NOWPAYMENTS_IPN_URL`. The browser cannot grant. Settlement requires HMAC plus finished status, amount, currency, and payment id match. Operator grant is explicit and labeled.

## Do not commit

- `data/grants/` and `data/originals/` — full paid media
- `data/stamps/` — forensic watermark originals
- `.env` — keys

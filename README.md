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

Operator: first signed-in account is admin (atomic bootstrap). Studio and Theme live under Ops.

## Payments

The browser cannot grant access. A buyer invoice stays `confirming` until:

- NOWPayments IPN verifies `x-nowpayments-sig` (HMAC-SHA512), or
- an operator grants the invoice from checkout (preview / exception)

Set `NOWPAYMENTS_IPN_SECRET` before taking public payment. Complete Ops → Legal (entity, address, contact) or only the operator can open invoices.

## Do not commit

- `data/grants/` and `data/originals/` — full paid media
- `data/stamps/` — forensic watermark originals
- `.env` — keys

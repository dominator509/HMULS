# Agent notes — HMULS / SHE UNDRESSES

## Paid media storage

- Production **paid originals MUST live in private Vercel Blob** (`access: "private"`). HMAC pathnames are not access control; `/api/media` is the only collector read path.
- Dashboard Studio / admin ingest already goes through `vaultShotMedia` → `putPrivateOriginal` when `BLOB_READ_WRITE_TOKEN` is set. Do not weaken that path or store paid frames as public CDN objects / under `public/`.
- Seed unlocks use `media_url` like `grant:rev_1.jpg`. Files ship in git `private-media/` for local/Nitro, but **Cloudflare Worker has no durable private-media disk** — cold starts call `syncBundledVaultOriginalsToBlob()` from `ensureCatalog` (once per isolate) to upload missing seeds into Blob. Ops can re-run via admin `syncVaultOriginals` (Stamps panel button).
- Teasers/covers stay under `public/media/` (or public Blob). Never copy a paid original into `public/`.
# Agent notes — HMULS / sheundresses.com

## Privacy / cookies (read before analytics)

**Default policy: cookie-minimal.** Do not add third-party analytics, ad pixels, heatmaps, or non-essential tracking SDKs (Google Analytics, gtag, Meta Pixel, Plausible cloud, PostHog, Clarity, etc.) without an explicit operator ask.

Current intentional telemetry:
- First-party server `events` (views / unlocks) for Ops analytics
- Auth session cookies / tokens (strictly necessary)
- Age-gate `localStorage` key `sheundresses.age.ok`

If you are asked to add non-essential analytics or marketing cookies, you **MUST** follow `docs/gdpr-analytics.md` in the same change (or a blocking prerequisite PR). Shipping trackers without an EU/EEA/UK consent gate is not allowed.

See also: `docs/gdpr-analytics.md`.

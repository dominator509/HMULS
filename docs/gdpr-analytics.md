# GDPR / consent gate for non-essential analytics

Agent checklist for HMULS / sheundresses.com. **Not legal advice** — do not invent a full legal opinion. When adding trackers, implement this gate (and update legal copy) in the same change or a blocking prerequisite PR.

## Default

Site policy is **cookie-minimal**. Do not add third-party analytics, ad pixels, heatmaps, or non-essential tracking SDKs unless an operator explicitly asks. First-party Ops `events`, necessary auth cookies/tokens, and the age-gate `localStorage` key are intentional and stay without a marketing-consent banner.

## When consent is required

Consent is required before setting or reading **non-essential** cookies / storage, or before loading **third-party analytics / marketing scripts**, including (non-exhaustive):

- Google Analytics / gtag / GA4, Meta Pixel, TikTok / LinkedIn / X pixels
- Plausible cloud, PostHog, Hotjar, Microsoft Clarity, Amplitude, Mixpanel, Segment
- Cloudflare Web Analytics, Zaraz, or other edge/tag managers **if** they set non-essential cookies or load third-party trackers
- Third-party embeds (chat widgets, social embeds, A/B tools) that set non-essential cookies

Strictly necessary first-party cookies (auth/session, security, load balancing) must keep working **without** consent.

## Required UX

When shipping non-essential analytics:

1. **Region-aware banner** for visitors in the **EU / EEA / UK** (and preferably **Switzerland**). Geo or region detection is fine; do not treat “everyone gets trackers by default” as acceptable.
2. **Block scripts until accept** — do not inject, hydrate, or network-load tracker SDKs before an affirmative opt-in for that region.
3. **Remember choice** (cookie or equivalent) with a clear accept / reject (or equivalent granular) control.
4. **Easy withdraw** — users can change or revoke consent later (e.g. cookie settings link in footer / legal pages).
5. **Legal links** — banner (and settings) link to `/legal/cookies` and the privacy policy.
6. **No dark patterns** — reject must be as easy as accept; pre-ticked marketing consent is not allowed.

## Must not load trackers before consent

- No `<script>` tags, tag-manager boots, or `import()` of analytics packages until consent is granted for that visitor.
- No “load then delete cookies if they refuse” — refuse means never load.
- Server-rendered HTML must not embed tracker snippets that run before the gate for EU/EEA/UK/(CH) visitors.

## Keep necessary cookies working

Auth/session cookies and other strictly necessary first-party mechanisms continue to work with no marketing consent. Do not break login, grants, or Ops first-party `events` behind a consent wall.

## Update legal templates

When adding trackers, update cookie + privacy copy in `src/lib/legal-templates.ts` (and regenerate / Ops Legal as the product expects) so the public cookie and privacy pages name:

- What is collected
- Who the vendor is
- Purpose / legal basis framing as the templates already structure
- Retention / how to withdraw

Shipping trackers without matching legal text is incomplete.

## Cloudflare / Zaraz / embeds

Cloudflare Web Analytics, Zaraz, and third-party embeds **count** toward this checklist if they set non-essential cookies or load marketing/analytics scripts. “It’s just Cloudflare” is not an exemption — evaluate cookie behavior and block or gate accordingly.

## Test plan

- [ ] EU/EEA/UK (and preferably CH) visitor: banner shown; **no** tracker network requests / cookies before Accept
- [ ] After Reject: still no trackers; necessary auth still works
- [ ] After Accept: trackers load only as documented; choice persists across reload
- [ ] Withdraw / change consent: trackers stop (or are not re-loaded) and preference updates
- [ ] Non-EU control (or mocked geo): behavior matches intended region policy
- [ ] `/legal/cookies` and privacy pages updated and linked from the banner
- [ ] First-party Ops `events` and age-gate still function without marketing consent
- [ ] No tracker scripts in initial HTML for gated regions before consent

## Explicit non-goals

- Do **not** invent a full legal opinion or country-by-country treatise in code comments.
- Do **implement the consent gate** (and legal template updates) whenever non-essential trackers are added.
- Prefer keeping the site cookie-minimal; skip trackers entirely unless the operator asks.

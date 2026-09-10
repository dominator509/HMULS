# SEO Week 2 — money-page title / meta / H1 / blurb

**Brand:** SHE UNDRESSES (`https://sheundresses.com`)  
**Branch intent:** Ladder + muse money copy for **Liora + Nyx** (and hubs). Deterministic helpers in `src/lib/seo.ts` so new muses/ladders inherit patterns.  
**Constraints:** adult OC 24–34 portrayed; no celebs/IP; no under-21 framing; public mail = `contact@` / `legal@` / `dmca@sheundresses.com` only; no private grant media; no fake reviews.

**Nyx editorial rule:** ladders are **covered cyber-editorial** (Imagine-moderated). SEO must **not** promise a nude climax ladder. Slugs are `nyx-the-*` (not shared with Liora’s `the-reveal` etc.).

## Live audit snapshot (pre-W2 → post-Nyx publish)

| Route | Live signal | Gap / note |
|-------|-------------|------------|
| `/` | Title was “sequential adult photosets”; dial H1 | Strengthened vault/crypto/not-nudify language |
| `/models` | H1 “She has a name” | Money-query H1 + hub blurb |
| `/models/liora` | Generic AI muse template | Service blurb + H1 |
| `/models/nyx` | **Live** (was stub) — generic template | Cyberpunk / netrunner money angle + covered-editorial framing |
| `/ladders/the-reveal` … `/the-pedestal` | Liora live | Theme money queries (frontal / worship / feet) |
| `/ladders/nyx-the-reveal` … `nyx-the-pedestal` | **Live** covered cyber sets | Cyber + covered framing; no nude-climax SEO |
| `/llms.txt` | Liora + Nyx + 6 ladders | Helpers feed descriptions |

Keyword targets: sequential unlock, AI muse, collector vault, The Reveal/Curve/Pedestal, not-nudify, crypto collectors, **cyberpunk AI muse**, **netrunner AI**, covered cyber editorial.

---

## Final authoring (post-W2)

### Hubs + Liora

| Route | Title (≤60) | Meta (≤155) | H1 | Service blurb (2–3 sentences) | Keywords |
|-------|-------------|-------------|----|-------------------------------|----------|
| `/` | `SHE UNDRESSES — sequential unlock vault` | Featuring live muses; AI muses for crypto collectors; not a nudify app | Dial: `Sequential unlock. Watch her take it off.` / `Sequential unlock. She starts dressed.` | Vault for nerd/gamer/crypto collectors; climb Reveal/Curve/Pedestal — not a clothes-remover (`authorHomeSeo`) | sequential unlock, AI muse, collector vault, crypto, not nudify |
| `/models` | `AI muses — sequential unlock vault \| SHE UNDRESSES` | Meet AI muses; climb Reveal/Curve/Pedestal in order; 18+ | `AI muses who undress in order` | Hub blurb via `authorModelsHubSeo` | AI muses, sequential unlock |
| `/models/liora` | `Liora AI muse sequential unlocks \| SHE UNDRESSES` | Climb Liora’s AI muse sequential unlocks; fictional adult OC 24+; nine-shot ladders; not clothes-remover | `Liora — AI muse sequential unlocks` | Warm-control collector vault muse; ordered ladders; not nudify | Liora, AI muse, sequential unlock |
| `/ladders/the-reveal` | `Liora The Reveal: frontal unlock \| SHE UNDRESSES` | Frontal sequential unlock for crypto collectors; cream-robe hook; not nudify | `The Reveal — frontal sequential unlock` | Frontal nine-shot climb; collectors; not clothes-remover | The Reveal, frontal |
| `/ladders/the-curve` | `Liora The Curve: worship unlock \| SHE UNDRESSES` | Silhouette worship sequential unlock; back-turn hook | `The Curve — silhouette worship unlock` | Worship climb; collectors | The Curve, worship |
| `/ladders/the-pedestal` | `Liora The Pedestal: feet unlock \| SHE UNDRESSES` | Feet/anklet sequential unlock; ankles hook | `The Pedestal — feet sequential unlock` | Pedestal climb; collectors | The Pedestal, feet |

### Nyx (live — covered cyber editorial)

| Route | Title (≤60) | Meta (≤155) | H1 | Service blurb (2–3 sentences) | Keywords |
|-------|-------------|-------------|----|-------------------------------|----------|
| `/models/nyx` | `Nyx Virell cyberpunk AI muse \| SHE UNDRESSES` | Climb Nyx — cyberpunk AI muse / netrunner sequential unlocks; neon, locs, chrome mesh — covered cyber editorial; not nudify; 18+ | `Nyx Virell — cyberpunk AI muse unlocks` | Cyberpunk/netrunner AI muse — neon nights, ink-black locs, liquid-chrome mesh. Sequential unlock ladders: **covered cyber editorial**, not a nude climax dump and not a clothes-remover. For nerd, gamer, and crypto collectors. | cyberpunk AI muse, netrunner AI, neon, Nyx Virell |
| `/ladders/nyx-the-reveal` | `Nyx Virell The Reveal: cyber unlock \| SHE UNDRESSES` | Cyberpunk frontal sequential unlock for crypto collectors; chrome mesh / violet lace tagline; **covered cyber editorial — not a nude climax ladder**; 18+ | `The Reveal — covered cyber frontal unlock` | Nyx’s cyberpunk frontal sequential unlock. Chrome mesh → violet lace on her terms. Imagine-moderated covered editorial — **not a nude climax dump**, not a clothes-remover. | nyx-the-reveal, cyberpunk, covered cyber, frontal |
| `/ladders/nyx-the-curve` | `Nyx Virell The Curve: cyber worship \| SHE UNDRESSES` | Cyberpunk silhouette worship unlock; chrome-back tagline; covered cyber — not nude climax; 18+ | `The Curve — covered cyber worship unlock` | Nyx’s covered cyber worship climb — chrome back to neon hips. Collectors only; no nude climax promise; not a clothes-remover. | nyx-the-curve, cyber worship, netrunner |
| `/ladders/nyx-the-pedestal` | `Nyx Virell The Pedestal: cyber pedestal \| SHE UNDRESSES` | Cyberpunk feet/anklet unlock; chrome stilettos / silver anklet; covered editorial studies — not a nude ladder; 18+ | `The Pedestal — covered cyber feet unlock` | Nyx’s pedestal — chrome stilettos to silver anklet studies, covered editorial. Crypto collectors climb in order; no nude climax SEO; not a clothes-remover. | nyx-the-pedestal, cyber pedestal, anklet |

Ladder gold-line hooks remain from photoset voice; long teases stay as secondary body copy.

### Deterministic helpers

| Helper | Owns |
|--------|------|
| `museMoneyAngle(m)` | `cyberpunk` vs `default` from slug/looks |
| `authorHomeSeo` / `authorModelsHubSeo` | Hub title/meta/H1/blurb |
| `authorModelSeo` | Per-muse title/meta/H1/blurb/FAQs (cyberpunk branch for Nyx) |
| `isCoveredCyberEditorial(l)` | True for `nyx-the-*` (or “covered cyber” copy) |
| `ladderThemeMoney` + `authorLadderSeo` | Theme money labels; covered branch avoids nude-climax language |

Pass **`slug`** into `authorLadderSeo` (routes + `llmsMarkdown`) so Nyx ladders never inherit Liora’s “silk → nude” beats.

---

## Gap flags (nav / studio vs public indexable)

| Muse / ladder | Public indexable? | Action |
|---------------|-------------------|--------|
| Liora + `the-reveal` / `the-curve` / `the-pedestal` | Yes | Money copy shipped |
| **Nyx Virell** + `nyx-the-reveal` / `nyx-the-curve` / `nyx-the-pedestal` | **Yes (live)** | Cyberpunk + covered-editorial money copy in this PR |
| Future fantasy / gamer-OC muses | Gap | Taxonomy W5+ |

---

## Operator review checklist

- [ ] Titles ≤60, metas ≤155 on Liora + Nyx money routes  
- [ ] Nyx SEO does **not** promise nude climax ladders  
- [ ] Nyx ladder URLs use `nyx-the-*` only  
- [ ] No Dominic / personal Gmail on public copy  
- [ ] No private grant media URLs  
- [ ] Merge when Actions **`check`** is green (ignore Workers Builds)  

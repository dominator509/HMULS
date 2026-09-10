# sheundresses.com — SEO taxonomy / keyword map (Week 1)

**Brand:** SHE UNDRESSES (`https://sheundresses.com`)  
**Product:** 18+ sequential unlock vault — AI muses, ladders × 9 shots, crypto collectors  
**Privacy:** never publish Dominic / personal emails; public contact = `contact@` / `legal@` / `dmca@sheundresses.com`  
**Age:** portrayed 21+ (brand OCs 24–34); no under-21 aesthetics; RTA on public pages  

This map substitutes GBP “primary/secondary categories” with **archetypes + themes** that own public routes.

---

## A) Current public IA (indexable)

| Route | Owns | Current title / meta angle (authoring) | Notes |
|-------|------|----------------------------------------|-------|
| `/` | Brand + HowTo + home FAQs | Sequential unlock vault for collectors; AI muse; not nudify | Primary brand query surface |
| `/models` | Roster hub | Muse list | Indexable hub |
| `/models/liora` | Muse: Liora (`mod_liora`) | AI muse sequential unlocks | **Live** |
| `/models/nyx` | Muse: Nyx Virell (`mod_nyx`) | Stub bible exists; **do not claim live catalog** until published | Stub only |
| `/ladders/the-reveal` | Ladder theme: frontal undress | The Reveal — sequential unlock | Live for Liora |
| `/ladders/the-curve` | Ladder theme: worship / silhouette | The Curve | Live for Liora |
| `/ladders/the-pedestal` | Ladder theme: feet / anklet | The Pedestal | Live for Liora |
| `/llms.txt` | Answer-engine brief | Muse + ladder summaries + AI disclosure | Enrich Week 1 |
| `/sitemap.xml` | Crawl map | Public covers/teasers only | Never private grants |
| `/legal/*` | Trust / compliance | Terms, privacy, 2257, **AI disclosure**, cookies, DMCA, refund | Cite, don’t keyword-stuff |
| `/legal/models/{slug}` | Per-muse disclosure card | Synthetic vs human labeling | Required for AI FAQs |

**Out of sitemap / noindex:** `/admin`, `/vault`, `/checkout`, `/login`, `/gift`, `/api/*`, private grant media.

---

## B) Primary + secondary “categories” (our taxonomy)

### Primary categories (must win)

| Category ID | Buyer language | Owning route(s) | Priority |
|-------------|----------------|-----------------|----------|
| `cat.sequential-unlock` | “sequential unlock photoset”, “pay to unlock next shot”, “nine shot ladder” | `/`, ladders, `llms.txt` | P0 |
| `cat.ai-muse-vault` | “AI muse”, “AI girlfriend unlock”, “synthetic OC photoset” | `/`, `/models/*`, AI disclosure | P0 |
| `cat.collector-crypto` | “crypto onlyfans alternative”, “ETH unlock adult”, “collector vault NSFW” | `/`, home FAQs, social | P0 |
| `cat.not-nudify` | “not a nudify app”, “not clothes remover”, “she undresses for you” | `/`, ladder FAQs, `llms.txt` | P0 (defense + brand) |

### Secondary categories (archetypes / themes)

| Category ID | Angle | Owning route(s) | Status |
|-------------|-------|-----------------|--------|
| `theme.reveal` | Frontal undress, robe → lace → nude in order | `/ladders/the-reveal` | Live (Liora) |
| `theme.curve` | Back / hip / silhouette worship | `/ladders/the-curve` | Live (Liora) |
| `theme.pedestal` | Feet, anklet, low worship | `/ladders/the-pedestal` | Live (Liora) |
| `arch.warm-control` | Quiet, gold-moon, cream silk, in-control OC (Liora) | `/models/liora` | Live |
| `arch.cyber-netrunner` | Neon, locs, chrome mesh, void lipstick (Nyx) | `/models/nyx` when published | Stub bible only |
| `arch.fantasy-oc` | Fantasy / lore OC AI photoset (future muse) | Future `/models/{slug}` | Gap |
| `arch.gamer-cosplay-adjacent` | Gamer aesthetic **original** OC only — no celeb/IP cosplay | Future muse + landing | Gap (careful TOS) |
| `proof.ai-disclosed` | Labeled synthetic; model cards | `/legal/ai-disclosure` | Live |

---

## C) Target queries → route ownership

| Query / phrase cluster | Intent | Primary owner | Secondary |
|------------------------|--------|---------------|-----------|
| sequential unlock AI muse | Product | `/` | `/llms.txt` |
| AI girlfriend unlock photoset | Product | `/models/liora` | `/` |
| cyberpunk AI onlyfans / netrunner AI muse | Archetype | Nyx hub (when live) | X/Fanvue |
| fantasy OC AI photoset | Archetype | Future muse | Content calendar |
| AI muse The Reveal / frontal unlock ladder | Theme | `/ladders/the-reveal` | Liora hub |
| AI muse worship / curve photoset | Theme | `/ladders/the-curve` | — |
| AI muse feet / pedestal unlock | Theme | `/ladders/the-pedestal` | — |
| crypto pay unlock adult photoset | Audience | `/` FAQ | Checkout UX (noindex) |
| not a nudify / clothes remover sequential | Disambiguation | `/`, ladder FAQs | `llms.txt` |
| sheundresses Liora | Brand+muse | `/models/liora` | ladders |
| Fanvue AI creator sequential | Discovery | Off-site Fanvue/X | `/` as destination |

---

## D) Competitor angles (5+)

| # | Competitor angle (type) | Primary category they own | Secondary | Pricing model | AI disclosed? | Cadence signal | Takeaway for us |
|---|-------------------------|---------------------------|-----------|---------------|---------------|----------------|-----------------|
| 1 | Classic OF / Fanvue creator feed | Human GF / daily selfies | Custom video | Sub + PPV | Mixed / rare | Daily posts | We win on **ordered ladders**, not volume |
| 2 | “AI girlfriend” chat apps | Chat / GFE roleplay | Image gen addon | Sub / credits | Often yes | Always-on | We sell **photoset unlocks**, not chatbot hours |
| 3 | One-click nudify / clothes-remover tools | Upload→undress | Batch | One-shot fee | Sometimes | Ads-heavy | **Explicit anti-position**; never compete on that SERP ethically |
| 4 | Cyberpunk / neon AI model Instagram+Fanvue | Aesthetic muse | Merch | Sub | Often yes | 3–7×/wk | Nyx should own this **when published**; until then Liora ≠ cyber |
| 5 | Fantasy / elf / sorceress AI creators | Fantasy OC | Lore threads | Sub + sets | Often yes | Lore drops | Future muse + calendar lore beats |
| 6 | “AI OnlyFans” link-in-bio funnels | Broad AI NSFW | Bundles | Opaque bundles | Varies | Spammy | Differentiate with **Nine-Yes order**, grants, forensic stamps |
| 7 | Reddit r/AIgirlfriend style galleries | Free sample spam | Promo codes | Free→paywall | Mixed | Flood | Use SFW teasers + keyword-rich grants; no fake reviews |

---

## E) Prioritized gaps (impact for a sequential vault)

| Rank | Gap | Why it matters | Week | Action |
|------|-----|----------------|------|--------|
| 1 | Keyword language in DEFAULT_DESC + model/ladder helpers | Titles/meta are the only Google-friendly surface | **W1** | Done in `src/lib/seo.ts` |
| 2 | Taxonomy doc + query→route map | Operators need one source of truth (this file) | **W1** | This doc |
| 3 | `llms.txt` muse/ladder summaries + AI disclosure pointer | Generative engines cite this file | **W1** | `discover.ts` `llmsMarkdown` |
| 4 | 8-week content engine draft | Social is primary discovery for adult | **W1 draft / W4 ship** | `docs/seo-content-calendar-8wk.md` |
| 5 | Ladder + muse “service” copy pass (title ≤60, meta ≤155, H1, 2–3 sentences) | Listing optimization | **W2** | Per-ladder / per-muse |
| 6 | Missing public hubs for stub muses (Nyx) | Nav/studio without indexable page leaks trust | **W2** when catalog ready | Do **not** fake Nyx live catalog |
| 7 | Competitor social-proof teardown + grant reply templates | Review velocity substitute | **W3** | Playbook prompts 2–3 |
| 8 | Extra archetype landing pages (fantasy / gamer-OC) | Secondary category coverage | **W5+** | New muse + landing, OC-only |
| 9 | GSC Queries + gen-AI reports baseline | Measure what actually converts | **W1 ops** | Human: confirm property, export queries |

---

## F) Non-goals / hard constraints

- No celeb or IP cosplay advice; original OCs only.  
- No private grant media in sitemap, `llms.txt`, or social as full unlocks.  
- No fake reviews / invented collector counts.  
- No under-21 framing; no “teen/school” tropes.  
- No operator personal identity or personal email on public pages.  

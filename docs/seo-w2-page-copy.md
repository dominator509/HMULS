# SEO Week 2 — money-page title / meta / H1 / blurb

**Brand:** SHE UNDRESSES (`https://sheundresses.com`)  
**Branch intent:** Ladder + muse (Liora) + hub copy pass. Deterministic helpers in `src/lib/seo.ts` so new muses/ladders inherit the same patterns.  
**Constraints:** adult OC 24–34 portrayed; no celebs/IP; no under-21 framing; public mail = `contact@` / `legal@` / `dmca@sheundresses.com` only; no private grant media; no fake reviews.

## Live audit snapshot (pre-W2)

| Route | Live signal | Gap |
|-------|-------------|-----|
| `/` | Title ~`SHE UNDRESSES — sequential adult photosets`; dial-driven H1 | Weak “collector vault / crypto / not-nudify” in `<title>` |
| `/models` | Hub title “Muses — sequential adult photosets…”; H1 “She has a name” | H1 not money-query shaped |
| `/models/liora` | `authorModelSeo` title/meta; H1 = stage name only | Meta stacked awkwardly; no dedicated service blurb |
| `/ladders/the-reveal` | Template “Liora — The Reveal unlock…”; H1 = “The Reveal” | Missing frontal / crypto-collector language in title |
| `/ladders/the-curve` | Same template + worship theme | Missing worship / silhouette money query |
| `/ladders/the-pedestal` | Same template + feet theme | Missing feet / anklet money query |
| `/llms.txt` | Liora + 3 ladders; no Nyx catalog | OK — do not invent Nyx live URLs |
| `/models/nyx` | **Stub only** (bible + private Blob) | **Gap:** nav/studio may know Nyx before a public indexable page exists — **do not** ship fake catalog/unlocks |

Keyword targets (from `docs/seo-taxonomy.md`): sequential unlock, AI muse, collector vault, The Reveal / Curve / Pedestal, not-nudify, crypto collectors.

---

## Final authoring (post-W2)

| Route | Title (≤60) | Meta (≤155) | H1 | Service blurb (2–3 sentences) | Keyword targets |
|-------|-------------|-------------|----|-------------------------------|-----------------|
| `/` | `SHE UNDRESSES — sequential unlock vault` | `18+ sequential unlock vault featuring Liora. AI muses for crypto collectors — she starts dressed; each payment peels one layer. Not a nudify app.` | Dial fallback: `Sequential unlock. Watch her take it off.` (fetishHeat≥7) / `Sequential unlock. She starts dressed.` | `SHE UNDRESSES is an adults-only sequential unlock vault for nerd, gamer, and crypto collectors. Pick an AI muse, climb The Reveal, The Curve, or The Pedestal shot by shot — not a clothes-remover.` *(authorHomeSeo.serviceBlurb; hero body still dial-driven)* | sequential unlock, AI muse, collector vault, crypto, not nudify |
| `/models` | `AI muses — sequential unlock vault \| SHE UNDRESSES` | `Meet AI muses on SHE UNDRESSES — sequential unlock photosets for collectors. Pick a woman, climb The Reveal, Curve, or Pedestal in order. Not a nudify app. 18+.` | `AI muses who undress in order` | `Every muse on SHE UNDRESSES runs sequential unlock ladders for collectors. Pick her night, pay for the next yes, climb The Reveal, The Curve, or The Pedestal — ordered photosets, not infinite selfie spam.` | AI muses, sequential unlock, Reveal/Curve/Pedestal |
| `/models/liora` | `Liora AI muse sequential unlocks \| SHE UNDRESSES` | `Climb Liora's AI muse sequential unlocks for collectors on SHE UNDRESSES. Liora is a fictional AI muse (adult OC), portrayed 24+. Nine-shot ladders — not a clothes-remover. 18+.` | `Liora — AI muse sequential unlocks` | `Liora is an AI muse in the SHE UNDRESSES collector vault. Climb her sequential unlock photosets shot by shot — she starts dressed, each payment peels one layer. Built for nerd, gamer, and crypto collectors who want ordered ladders, not a nudify app.` | Liora, AI muse, sequential unlock, collector vault |
| `/ladders/the-reveal` | `Liora The Reveal: frontal unlock \| SHE UNDRESSES` | `Climb Liora's The Reveal — frontal sequential unlock for crypto collectors on SHE UNDRESSES. She kept the cream robe on until you paid to watch it lose. AI muse ladder, not a nudify app. 18+.` *(clipped ≤155)* | `The Reveal — frontal sequential unlock` | `The Reveal is Liora's frontal sequential unlock on SHE UNDRESSES. She kept the cream robe on until you paid to watch it lose. Built for nerd, gamer, and crypto collectors who climb nine shots in order — not a clothes-remover.` | The Reveal, frontal, sequential unlock, crypto collectors |
| `/ladders/the-curve` | `Liora The Curve: worship unlock \| SHE UNDRESSES` | `Climb Liora's The Curve — silhouette worship sequential unlock for crypto collectors on SHE UNDRESSES. She turned her back so you'd have to ask for the rest. AI muse ladder, not a nudify app. 18+.` *(clipped ≤155)* | `The Curve — silhouette worship unlock` | `The Curve is Liora's silhouette worship sequential unlock on SHE UNDRESSES. She turned her back so you'd have to ask for the rest. Built for nerd, gamer, and crypto collectors who climb nine shots in order — not a clothes-remover.` | The Curve, worship, silhouette, sequential unlock |
| `/ladders/the-pedestal` | `Liora The Pedestal: feet unlock \| SHE UNDRESSES` | `Climb Liora's The Pedestal — feet and anklet sequential unlock for crypto collectors on SHE UNDRESSES. She crossed her ankles and waited to see if you'd look down. AI muse ladder, not a nudify app. 18+.` *(clipped ≤155)* | `The Pedestal — feet sequential unlock` | `The Pedestal is Liora's feet and anklet sequential unlock on SHE UNDRESSES. She crossed her ankles and waited to see if you'd look down. Built for nerd, gamer, and crypto collectors who climb nine shots in order — not a clothes-remover.` | The Pedestal, feet, anklet, sequential unlock |

Ladder gold-line hooks (unchanged, still from photoset voice) stay under the H1; long muse tease remains as secondary body copy.

### Deterministic helpers (do not hardcode one-offs)

| Helper | Owns |
|--------|------|
| `authorHomeSeo(names)` | `/` title, meta, keywords, recommended H1/blurb |
| `authorModelsHubSeo()` | `/models` title, meta, H1, service blurb |
| `authorModelSeo(m)` | `/models/{slug}` title, meta, H1, service blurb, FAQs |
| `authorLadderSeo(l)` + `ladderThemeMoney(theme, title)` | `/ladders/{slug}` title, meta, H1, service blurb, FAQs — Reveal/Curve/Pedestal money labels |

New muses inherit model helpers; new ladder themes fall back to generic “sequential unlock” labels until `ladderThemeMoney` learns them.

---

## Gap flags (nav / studio vs public indexable)

| Muse / ladder | Public indexable page? | Action |
|---------------|------------------------|--------|
| Liora | Yes — `/models/liora` + 3 ladders | Money copy shipped this week |
| The Reveal / Curve / Pedestal | Yes — live for Liora | Money copy shipped this week |
| **Nyx Virell** | **No** — bible stub + private Blob only; `/models/nyx` must not claim live catalog | **Flag only.** When catalog publishes, re-run W2 helpers (no invented unlock URLs now) |
| Future fantasy / gamer-OC muses | Gap | Taxonomy W5+ |

---

## Operator review checklist

- [ ] Titles ≤60, metas ≤155 on the six money routes above  
- [ ] No Dominic / personal Gmail on public copy  
- [ ] No Nyx live catalog / unlock URLs invented  
- [ ] Merge when Actions `check` is green (ignore Workers Builds)  

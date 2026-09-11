# Muse narrative formula

Operator checklist for SHE UNDRESSES muse / photoset voice. Adult fictional OC only (portrayed **24–34**). No celebrities, no minors, no non-consensual framing. Never put Dominic or personal emails in public copy.

**Default `copyStyle`:** `personal-fantasy-hybrid` — **Personal fantasy (Brazzers×NA hybrid)**. FORMAT / PATTERN only. Study public adult-studio scene blurbs for structure; never paste or plagiarize copyrighted synopses. Studio generate / respin defaults to this voice.

## Personal-fantasy hybrid pattern (encode this shape)

Write as if composing **his private fantasy** — intimate, direct, slightly conspiratorial. Heavy **second person**. Pull him closer sentence by sentence. Public scene blurbs that sell male buyers (Brazzers × Naughty America energy) plus personal-fantasy draw-in tend to hit these beats in **2–5 short sentences**:

1. **Intimate hook** — “you weren’t supposed to be here / she left this for you” (private, not the feed).
2. **WHO she is** — role/archetype in one concrete line (“the netrunner who…”, “the silk-robed hostess who…”).
3. **WHERE / WHEN** — specific wardrobe + setting (chrome mesh doorway, cream silk bedroom, neon after-hours).
4. **Why YOU specifically** — chosen / private lobby / after hours; possession without a roomful.
5. **Tension + sexual promise** — curiosity, power flip, withhold that turns soft invitation; **leave the unlock ladder** to deliver climax.
6. **Soft CTA hunger** — pull him toward the next unlock (never “buy now” spam).

**Voice rules (mandatory):**

- Private fantasy written *to* the reader — “this is for you / she chose you / she kept you.”
- Fluent **native American English**, short sentences, dirty-but-smooth, zero ESL / Engrish / Chinglish artifacts.
- Soft invitation + heat; never clinical product copy.
- Specific garments / jewelry / pose; progressive unlock sales still apply.

### Before / after (invented OC — not studio text)

**Before (Engrish mush — banned):**

> Nyx is very sexy beautiful cyber girl with hot body. She want you look her undress step by step. You will like very much her lace and chrome. Please unlock to enjoy her charm.

**After (personal-fantasy hybrid for sequential unlock):**

> You weren’t supposed to find her channel. Nyx Virell left the after-hours netrunner lounge open for one man — you. Chrome mesh robe tied at the waist, violet lace only hinted underneath, LED ink glowing along her collarbones. She clocks you the second you clear the doorway and doesn’t look away — like she kept this private on purpose. Tonight she’s deciding how much chrome comes off, and she already chose whose terms. Stay. The mesh stops being polite for you.

**Before:**

> Liora have soft silk robe and gold moon. She is very gentle but also control. You pay then she show more sexy.

**After:**

> She doesn’t open this door for a crowd — she left it for you. Cream silk robe, gold crescent at her throat, dark eyes that already know why you showed up. Liora lets the night start dressed on purpose; the silk only moves when you’ve earned the next inch. Lace is a test she set for you. The bed is a decision. The last frame is for the man who didn’t quit early — and she wants that to be you.

### Engrish ban (instant rewrite)

- No “you is / she want you / very hot body / make you feel good very much”
- No stacked empties: “very sexy beautiful hot girl”
- No Chinglish stock: “open the secret / please enjoy her charm / she is waiting your unlock”
- No product-manual tone: “In this set, you will see…”

## Modes (Studio / Muses panel)

| Mode | When | What it does |
|------|------|----------------|
| **Manual** | You type everything | Source of truth. Save writes DB fields. LLM is not called. Owner brief still saved for later respins. |
| **Generate from looks** | You have stage name + looks (+ optional archetype tags / brief) | Invents congruent scenario + full photoset voices for the three ladders (or selected ladder). |
| **Reverse from frames** | Shots have visual beats / vision captions | Reverse-engineers bio + shot copy FROM the frames (written from the frame, sell next layer). |
| **Respin** | Same inputs + optional note (“more dominant”, “less soft”, “more cyber”) | Regenerates without losing identity lock. Never changes age band. Upgrades Engrish into fluent personal-fantasy copy. |

**Generate / Respin never wipe unsaved manual edits without your click.** Manual fields are source of truth; Generate fills empties or overwrites only when you click Generate / Respin (confirm if fields already have copy).

## Fields (persist to existing DB columns)

### Muse bible → `models`

| Formula field | DB column |
|---------------|-----------|
| looks | `looks` |
| voice | `voice` |
| teaseStyle | `tease_style` |
| short backstory / scenario | `bio` |
| owner brief (operator only) | `owner_brief` |

### Photoset → `ladders`

| Formula field | DB column |
|---------------|-----------|
| hook | `photoset_hook` (+ `tagline` when generated) |
| tease | `photoset_tease` (+ `description` when generated) |
| owner brief | `owner_brief` |

### Per shot → `shots` (matches `ShotVoice` in `src/lib/muses.ts`)

| Formula field | DB column |
|---------------|-----------|
| visual | `visual_beat` |
| tease | `tease` |
| grant | `grant_copy` |
| story | `story` |
| drop | `drop_line` |

## Tone formula

- `copyStyle: "personal-fantasy-hybrid"` — Personal fantasy (Brazzers×NA hybrid) beats above
- Second person, present tense, **her** voice — private fantasy written *to* him
- Specific garments / jewelry / pose / setting; sell the **next** unlock
- Sexualized desire + power/control dynamic appropriate to the muse; he feels selected
- Story first, price second; no “exclusive content” spam; native American English
- Adult 24–34 fictional OC only

## Mandatory buyer-psych checklist

Bake these into **every** generated (and preferably manual) field. Illegal / non-consensual psychology is forbidden.

1. **Progressive revelation / edging** — each tease sells the NEXT layer like a scene trailer; never dump the climax early.
2. **Specificity > adjectives** — “chrome mesh off one shoulder” beats “very sexy body.”
3. **Power / withhold / choose-you** — she decides; buyer feels selected; she never begs.
4. **Scarcity + social proof without lies** — drop % / collectors / “most men stop here”; no fake “0 collectors.”
5. **Possession / private-set framing** — “for you / not a room / not a feed / she kept this private”; personal-fantasy draw-in.
6. **Anticipation loop** — story opens a loop the next unlock closes.
7. **Collector / gacha brain** — roster + limited lore-drop language for photoset hooks.
8. **Second person present** — “you” in the scene now; private fantasy written TO him; fluent native American English.
9. **Desire first, price second** — never lead with “exclusive content” spam; intimate personal-fantasy scene first.
10. **Archetype congruence** — levers match THIS muse, not generic baddie paste.

Manual mode shows short **psych tips** beside fields so owner-written copy can use the same levers. Owner brief may name which levers to lean on.

## Operator steps

1. Onboard or open a muse (Muses tab). Enter **stage name** + **looks** (or leave looks empty for reverse-from-frames).
2. Optional: fill **Owner brief** (personality, setting, kinks-to-lean, what happened in the shoot, lines to hit/avoid, psych levers).
3. Choose mode:
   - **Manual** — type looks / voice / teaseStyle / scenario (bio) and per-photoset / per-shot fields; Save.
   - **Generate from looks** — click Generate; review for Engrish; Save.
   - **Reverse from frames** — ensure shots have media + visual beats (or run Auto from photos first); click Reverse; review; Save.
   - **Respin** — add a short direction note; confirm overwrite; click Respin; review; Save.
4. Create / select photosets; Generate can fill all three ladders or one selected ladder.
5. Persist with **Onboard muse** / Save. Photoset hook/tease and shot copy write through narrative server actions into the columns above.

## Code entry points

- Formula + prompts: `src/lib/narrative-formula.ts` (`COPY_STYLE`, `PERSONAL_FANTASY_HYBRID_PATTERN`; `BRAZZERS_SCENARIO_PATTERN` is a deprecated alias)
- Server generate / respin / persist: `src/lib/server/narrative.ts` (uses existing `grokJson` / `XAI_API_KEY`)
- UI: `src/components/admin/MusesPanel.tsx` (Manual | Generate from looks | Reverse from frames | Respin)
- Studio: narrative brief + Generate narrative affordance on muse add flow in `StudioPanel`

## Privacy

No Dominic / personal emails on public-facing muse or photoset copy.

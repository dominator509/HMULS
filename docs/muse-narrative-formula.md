# Muse narrative formula

Operator checklist for SHE UNDRESSES muse / photoset voice. Adult fictional OC only (portrayed **24–34**). No celebrities, no minors, no non-consensual framing. Never put Dominic or personal emails in public copy.

## Modes (Studio / Muses panel)

| Mode | When | What it does |
|------|------|----------------|
| **Manual** | You type everything | Source of truth. Save writes DB fields. LLM is not called. Owner brief still saved for later respins. |
| **Generate from looks** | You have stage name + looks (+ optional archetype tags / brief) | Invents congruent scenario + full photoset voices for the three ladders (or selected ladder). |
| **Reverse from frames** | Shots have visual beats / vision captions | Reverse-engineers bio + shot copy FROM the frames (Liora style: written from the frame, sell next layer). |
| **Respin** | Same inputs + optional note (“more dominant”, “less soft”, “more cyber”) | Regenerates without losing identity lock. Never changes age band. |

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

- Second person, present tense, **her** voice
- Specific garments / jewelry / pose; sell the **next** unlock
- Sexualized desire + power/control dynamic appropriate to the muse
- Story first, price second; no “exclusive content” spam; native English
- Adult 24–34 fictional OC only

## Mandatory buyer-psych checklist

Bake these into **every** generated (and preferably manual) field. Illegal / non-consensual psychology is forbidden.

1. **Progressive revelation / edging** — each tease sells the NEXT layer; never dump the climax early; delay gratification (matches sequential unlock).
2. **Specificity > adjectives** — name garment, jewelry, pose, what’s covered; concrete beats “sexy/hot.”
3. **Power / withhold / choose-you** — she decides; buyer feels selected; she never begs.
4. **Scarcity + social proof without lies** — drop % / collectors / “most men stop here”; no fake “0 collectors”; FOMO on limited climax.
5. **Possession / private-set framing** — “for you / not a room / not a feed.”
6. **Anticipation loop** — story opens a loop the next unlock closes; cliffhangers between shots.
7. **Collector / gacha brain** — roster + limited lore-drop language for photoset hooks (nerd/crypto audience).
8. **Second person present** — “you” in the scene now.
9. **Desire first, price second** — never lead with “exclusive content” spam.
10. **Archetype congruence** — levers match THIS muse (dominant cyber, soft control silk…), not generic baddie paste.

Manual mode shows short **psych tips** beside fields so owner-written copy can use the same levers. Owner brief may name which levers to lean on.

## Operator steps

1. Onboard or open a muse (Muses tab). Enter **stage name** + **looks** (or leave looks empty for reverse-from-frames).
2. Optional: fill **Owner brief** (personality, setting, kinks-to-lean, what happened in the shoot, lines to hit/avoid, psych levers).
3. Choose mode:
   - **Manual** — type looks / voice / teaseStyle / scenario (bio) and per-photoset / per-shot fields; Save.
   - **Generate from looks** — click Generate; review; Save.
   - **Reverse from frames** — ensure shots have media + visual beats (or run Auto from photos first); click Reverse; review; Save.
   - **Respin** — add a short direction note; confirm overwrite; click Respin; review; Save.
4. Create / select photosets; Generate can fill all three ladders or one selected ladder.
5. Persist with **Onboard muse** / Save. Photoset hook/tease and shot copy write through narrative server actions into the columns above.

## Code entry points

- Formula + prompts: `src/lib/narrative-formula.ts`
- Server generate / respin / persist: `src/lib/server/narrative.ts` (uses existing `grokJson` / `XAI_API_KEY`)
- UI: `src/components/admin/MusesPanel.tsx` (Manual | Generate from looks | Reverse from frames | Respin)
- Studio: narrative brief + Generate narrative affordance on muse add flow in `StudioPanel`

## Privacy

No Dominic / personal emails on public-facing muse or photoset copy.

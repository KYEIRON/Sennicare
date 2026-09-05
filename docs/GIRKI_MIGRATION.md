# Girki — content migration and build inventory

Step 1 of the brief's order of work: *migrate content and images with a
verification script that proves nothing was dropped.* This records what was
migrated, how it is proved, and what is still open.

Source of truth: `docs/prototypes/Girki_V54_Signup_Spacing.html` (V54).
Brief: `docs/GIRKI_BUILD_BRIEF.md`.

## How the migration works

```bash
npm run content:build    # prototype -> src/data/girki/*.json
npm run verify:content   # re-runs the prototype and compares, item by item
```

`scripts/extract-prototype.js` runs the prototype's **own JavaScript** under a
stub DOM and hands back its data structures. Everything downstream uses that, so
the source of truth is the file executing rather than a regex reading it. This
matters: a regex over 470KB of HTML truncates the parenthesised Commons
filenames (the Tacacá image) and counts photo-brief `note:` fields as recipe
notes. Running the prototype cannot make either mistake.

`scripts/verify-content.mjs` extracts the prototype fresh on every run and
compares it with the built bundle by identity — every dish, recipe key, meal,
image URL and cultural note — not by remembered counts.

## Content inventory — verified

| Item | Brief | Migrated | Verified by |
| --- | --- | --- | --- |
| Atlas dishes | 597 | 597 | every `country + dish` present |
| Countries | 195 | 195 | every row present |
| Hand-written recipes | 32 | 32 | every `country::dish` key present, ingredients and steps counted |
| Curated meals | 30 | 30 | every name present |
| Ghanaian dishes | 15 | 15 | the eight named dishes asserted individually |
| Remote images | 67 | 67 | every URL present, each with id, source and licence field |
| Family templates | — | 9 | labelled `generated` |
| Substitutions (`N37_SUBS`) | — | 37 | count matched to source |
| Technique clips | 15 | 15 | count matched to source |
| Occasions | 8 | 8 | count matched to source |
| Signup vocabularies | — | regions, confidence, weeknight, interests, discovery | counts matched to source |

**67 images only reconciles if parenthesised Commons filenames are handled.** A
naive URL regex returns 65 and looks plausible. This is exactly the silent loss
the brief warns about.

## Identity: cook log keyed by name and country

Every dish carries `id = <country-slug>--<dish-slug>`, plus `country` and
`countryId`. No array indexes anywhere. Verified: ids unique, ids contain both
parts, every dish carries its country.

## Open items — reported, not hidden

Written by `npm run verify:content` on every run:

1. **17 of 32 hand-written recipes cannot be reached from the atlas.** The
   prototype looks a recipe up as `country::dish` against the atlas dish list.
   These names are not in it, so the most expensive content in the product is
   written and unreachable. All 32 are migrated and each records
   `reachableFromAtlas`. Roughly seven are spelling or qualifier variants of a
   dish that *is* listed (Lebanon `Mujadara` vs atlas `Mujaddara`; Philippines
   `Chicken adobo` vs `Adobo`; China `Mapo tofu style braise` vs `Mapo tofu`;
   Morocco `Vegetable tagine` vs `Tagine`; Brazil `Feijoada de legumes` vs
   `Feijoada`; Nigeria `Nigerian jollof rice` vs `Jollof rice`). The rest are
   genuinely different dishes absent from their country's list. **Decision
   needed** — alias the variants, add the others to the atlas, or give authored
   recipes their own surface. Renaming atlas dishes is a content decision, so
   nothing was changed.
2. **582 of 597 atlas dishes have no hand-written recipe** and fall back to a
   family template. The brief calls this the biggest quality risk. They stay
   labelled `generated` and are never promoted to `authored`.
3. **23 of 32 recipes have no cultural note.** The prototype has 9; all 9
   survived. Cultural framing is central to the brief, so the gap is worth
   filling.
4. **57 of 67 images need a per-file licence review.** 10 carry a recorded
   licence and author from the prototype's photo briefs; 9 of those are CC BY-SA
   and legally require visible credit. Commons files are individually licensed
   and must not be treated as one pool.

## Feature inventory — to build

Walked from the prototype. Ticked only when it works in the app.

**Screens:** Today · Food · Pantry · Plan · Wellbeing · You

**Sheets:** aiChat · aiBeta · aiDecide · aiEnergy · aiSleep · breathing ·
cultureWellbeing · legal · move · pantry · plus · plusManage · profile ·
recovery · shopping · sleep · smartKitchen · wellbeingFood

**Systems, by prototype prefix:**

| System | What it is | State |
| --- | --- | --- |
| `n34*` | Cook mode: per-step timers parsed from method text, step kinds, chef cues, jump/tick/toggle | to build |
| `n35*` | Cook-and-capture: step photos, capture sheet, on-device storage | to build |
| `n36*` | Step media: video/motion candidates, autoplay rules | to build |
| `n37*` | Recipes, families, ingredient accessibility, substitutions | data migrated; UI to build |
| `n38*` | Spoken guidance: scene, speak, voice toggle | to build |
| `n39*` | Occasions: pick and open | data migrated; UI to build |
| `n40*` | Technique clips: matching, coverage, unmatched report | data migrated; matcher to build |
| `n41*` | Hero media, full-bleed | to build |
| `girki*` | Passport, continuity card, preferences, signup, cook log, shot list | to build |

**Already in the app** (from the Nourish lineage, to be re-pointed at Girki
content): Today, Food, Pantry, Plan, Wellbeing, You, meal sheet, plan sheets,
shopping, smart kitchen, discovery engine, Plus gating, tablet layout.

## Two things for Ronald, not for me to decide

1. **565 of 597 atlas dishes have generated methods.** (The verifier reports 582
   without an authored recipe because 17 recipes are unreachable; fixing
   reachability moves the number to 565, matching the brief.) They are honest
   and labelled. Do not silently promote them.
2. **The name.** Girki has had no trademark clearance search. Classes 9 and 42
   in the UK, EU and US need to come back clear before final branding.

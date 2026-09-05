# Nourish — engineering and product audit

Written before any V32.5 work, as required by the implementation brief.
Covers: what exists today, what is production-ready, what is prototype-only,
and what has to change for global food intelligence.

Codebase audited: `mobile/` (React Native + Expo, ships to iPhone, iPad,
Android), commit `61db76c`. Reference prototypes: V28 (`ios/prototype/`) and
V32.5 (the new source of truth). `ios/` holds a SwiftUI reference build.

---

## 1. What exists today

| Area | State | Where |
| --- | --- | --- |
| Onboarding (7 steps, validation) | Working, complete | `src/screens/Onboarding.tsx` |
| Account screen | Demo sign-in only | `src/screens/Auth.tsx` |
| Today | Working: greeting, morning feature, culture rail, fit chips, 3 slot rails, atlas card, tokens | `src/screens/Today.tsx` |
| Food | Working: search (decorative), mood chips, 30 featured meals, world rail, atlas | `src/screens/Food.tsx` |
| Pantry | Working: items, demo scan, smart matches | `src/screens/Pantry.tsx`, `src/sheets/KitchenSheets.tsx` |
| Plan | Working: week / calendar / list, swap, move, remove, 3-day free gate | `src/screens/Plan.tsx`, `src/sheets/PlanSheets.tsx` |
| Shopping | Working: add, paste, tick, remove, add-missing-from-meal | `src/sheets/KitchenSheets.tsx` |
| Cooking | Working: steps, timer, chef cues, completion tokens | `src/sheets/CookingSheet.tsx` |
| Wellbeing | Working: movement, breathing, sleep, recovery, culture, AI Beta panels | `src/screens/Wellbeing.tsx` |
| 195-country atlas | Working: search, continent filter, 12 free + locked previews | `src/screens/Food.tsx` (`WorldAtlas`) |
| Country sheets | Working: Commons image hydration with attribution | `src/sheets/DiscoverySheets.tsx`, `src/lib/commons.ts` |
| AI Beta | **Static information panels only. No reasoning, no query, no retrieval.** | `src/sheets/InfoSheets.tsx` |
| Free / Plus | Client-side boolean; gates planning days, meal variations, atlas depth | `src/state/store.tsx` |
| Tablet | Side rail, larger type, grid rails, 1180px content cap | `src/lib/responsive.ts`, `src/components/shell.tsx` |
| Persistence | AsyncStorage under the prototype's own keys | `src/state/store.tsx` |
| Parity guard | Runs V28's JS beside the port, asserts agreement | `scripts/parity.mjs` |

## 2. Production-ready vs prototype-only

**Production-ready as architecture** (needs data and a backend, not a rewrite):
the design system and tokens, responsive layout, navigation and sheet routing,
persistence layer, the cooking flow, the plan data model, pantry matching, and
the image cache.

**Prototype-only, and must be labelled as such:**

- **Scan** — `demoScan()` inserts a fixed six-item list. Not recognition.
- **Auth** — `signIn()` writes a local object. No Apple/Google/email identity.
- **Plus** — a local boolean. Trivially bypassed; no entitlement check.
- **AI Beta** — informational copy. It cannot answer a question.
- **Nutrition** — illustrative percentages, not verified reference values.
- **Allergens** — collected in onboarding, then **never applied to anything**.
- **Images** — remote URLs with no asset ID, licence record or editorial state.

## 3. The core defect

`meals` is 30 records. Everything a user can be *recommended* comes from those
30. The 195-country atlas — 585 dish records — is browse-only: it feeds cards
and country sheets and is invisible to every recommendation path.

Concretely, in the current build:

- `filterMeals('Fish')` → 3 results, all from the featured 30.
- `filterMeals('Breakfast')` → whatever 30 records happen to match.
- `smartMatches()` scores pantry overlap across the same 30.
- The atlas cannot be searched by ingredient, meal type, or time — only by
  country name, region and dish string.

So "I want more fish" returns the fish already on screen. That is the defect the
brief names: **featured is being treated as the food universe.**

V32.5 addresses this in prototype form (`NOURISH_GLOBAL_LIBRARY`,
`n32GlobalDiverseRank`) and that direction is correct. Its implementation has
limits we should not carry over:

1. Dish classification is three regexes (breakfast / fish / light). Every
   non-breakfast dish becomes `'Lunch / Dinner'`.
2. Ranking is a flat score with `Math.random()*0.01` as the tie-break; diversity
   is "first dish per country wins", so a country's other dishes are unreachable.
3. `n32AiIngredientTerms` is a hardcoded list of 23 ingredient words.
4. Allergy filtering applies to the 30 curated meals only — global discovery
   records are never allergen-checked, and the copy still says "I excluded
   recipes that conflict".
5. There is no conversational memory: `n32AiThread` stores rendered HTML, so
   "which of those use what I have?" cannot refine the previous result.
6. `n32AiExplore()` opens `openSheet('aiBeta')` — the static info panel — then
   calls `n32AiQuick`, which needs `#n32AiInput` from the `aiChat` sheet. **The
   Food intent chips do nothing in V32.5.** Fix, don't port.

## 4. Data model gaps against the brief

Today a meal is a flat object: name, slot, duration, meta, cal, img,
ingredients[], steps[], nut[], fit, culture, fits[]. Missing, and needed:

stable IDs · region and cuisine as entities · ingredients as reusable records
rather than strings · structured allergens · cultural status (traditional dish
vs traditional recipe vs Nourish adaptation) · recipe provenance · image
provenance and licence · difficulty · prep/cook split · servings · equipment ·
substitutions · seasonality · budget band · editorial and review state.

Ingredients are free text with quantities baked in ("150g salmon"), so
`ingredientBase()` strips units with a regex on every comparison. That works for
pantry matching and cannot support "which recipes use salmon" across a library.

## 5. Safety findings (highest priority)

1. **Allergies are collected and ignored.** Onboarding treats them as safety
   constraints; no screen filters on them. This is the most serious gap.
2. **No allergen data on 585 of 615 records.** Discovery records are dish names.
   They must never be presented as allergen-safe — they can only be excluded on
   suspicion and otherwise flagged as un-checked.
3. **Never claim safety.** Wording must stay "contains soy" / "not allergen
   checked", never "safe for you".
4. **Client-side entitlement.** Plus is a local flag; production needs
   server-side verification.
5. **No secrets in the client.** Any future LLM call must go through a backend.

## 6. Plan

| Phase | Work | Gate |
| --- | --- | --- |
| 1–2 | This audit | — |
| 3 | Food graph: typed records, ingredient index, allergens, classification, provenance, cultural status | Graph tests |
| 4 | Discovery engine: intent parsing, retrieval, safety filter, ranking with diversity, explanations | Scenario tests |
| 5 | Food intents and search route to the engine, not to featured | The 10 human tests |
| 6 | Pantry: "uses 4 of 6, you need fish and herbs" | Pantry scenarios |
| 7 | Plan: plan-a-day across breakfast/lunch/dinner | Day plan test |
| 8 | Shopping: have / need per recommendation | Shopping test |
| 9 | Ask Nourish: conversational refinement over a held result set | Follow-up tests |
| 10 | Plus: monthly/yearly, trial, manage, honest gating | Entitlement tests |
| 11 | Full journey testing, phone and tablet | Definition of done |

Each phase ends with tests run and a commit.

## 7. Explicitly out of scope

Not building: a chatbot, an AI recipe generator, invented recipes for the 585
discovery records, scraped content, live supermarket pricing, or medical advice.
Not touching: the V28→V32.5 design language, navigation, or the 195-country
atlas, which stays whole (Peru leaves *featured* and remains in the atlas).

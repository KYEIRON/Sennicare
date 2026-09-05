# Nourish — iPhone, iPad and Android

React Native + Expo. One codebase for all three targets, ported from
`Nourish_Global_Experience_V28.html`.

**V28 is the visual and interaction source of truth.** Colours, typography,
spacing, cards, navigation, copy, imagery and every rule (free vs Plus, the
three planning days, the daily rotation) come from the prototype. Nothing here
is a redesign.

## Running it

```bash
cd mobile
npm install
npx expo install --fix   # aligns package versions with the installed SDK
npm start                # then press i (iOS), a (Android), or scan the QR code
```

Checks:

```bash
npm run typecheck   # tsc --noEmit
npm run parity      # runs V28's own JS beside the port and asserts they agree
```

`npm run parity` is the guard rail against drift. It loads the prototype's
JavaScript straight out of the HTML file and compares, for real:

- `smartMatches()` — pantry scoring, ordering and missing-ingredient counts
- `filterFood(term)` — across 16 chips, matching index for index
- the daily rotation — every slot, every one of the 30 possible daily offsets,
  free and Plus
- `ingredientBase()` — across every ingredient string in the library
- meal image URLs and the 195-country atlas — identical, in order

## Layout

| | Phone | Tablet (≥700px) |
| --- | --- | --- |
| Navigation | bottom tab bar | 118px left rail |
| Type | h1 36 / h2 28 / h3 21 | h1 48 / h2 34 / h3 24 |
| Meal + culture rails | horizontal scroll | 3-column grid |
| World tiles | horizontal scroll | 4-column grid |
| Atlas | 1 column | 3 columns, 4 above 1100px |
| Week plan | 1 column | 2 columns |
| Content | full width | max 1180px, centred |

These are V28's own `@media (min-width:700px)` and `1100px` rules, in
`src/lib/responsive.ts`.

## Structure

```
src/
  data/data.json      generated from the prototype's constants
  lib/data.ts         typed access: meals, countries, worlds, nutrients, image URLs
  lib/logic.ts        the prototype's rules, ported (pantry, filters, rotation, validation)
  lib/commons.ts      the Wikimedia Commons lookup for country dishes
  lib/responsive.ts   V28's breakpoints
  theme/              colour and type tokens from V28's :root
  state/store.tsx     AsyncStorage under the prototype's own localStorage keys
  nav/router.tsx      tabs, sheets and the food filter page
  components/         cards, primitives, app shell (header, tab bar, sheet, toast)
  screens/            Onboarding, Auth, Today, Food, Pantry, Plan, Wellbeing, You
  sheets/             every openSheet() overlay, meal detail and cooking mode
```

## Images

Every photograph loads from the exact URL the prototype uses (Unsplash and
Wikimedia Commons); `expo-image` caches to memory and disk. Country sheets
hydrate their dish photos from the Commons API with the same query and the same
known-file list as `hydrateCountryFoodImages()`, and keep the attribution line.

## Typography — one open decision

V28's display face is Iowan Old Style, which ships with iOS and **does not
exist on Android**, where the app currently falls back to the platform serif.
To make the two identical, bundle a licensed serif (or an open substitute such
as Source Serif 4 or Crimson Pro) and point `displayFont` in
`src/theme/typography.ts` at it. Until then, Android headings will differ
slightly from the prototype.

## Still prototype behaviour

Carried over from V28 deliberately: the scan buttons use its demo item list
rather than image recognition, the account screen is a demo sign-in rather than
real Apple/Google auth, and Nourish+ is a local toggle rather than a store
purchase. Each is a real integration when the product is ready for it
(`expo-camera`, native sign-in, RevenueCat).

## The SwiftUI build

`ios/` holds an earlier native SwiftUI implementation of the same prototype. It
is kept as a native reference — this Expo app is the one that ships.

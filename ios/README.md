# Nourish — iOS app

A native SwiftUI rebuild of the `Nourish_Global_Experience_V28.html` prototype:
the same screens, the same copy, the same flows and **the same pictures** — every
photograph is loaded from the exact URL the prototype uses (Unsplash and
Wikimedia Commons), so the imagery is identical rather than a lookalike.

## Opening it

```
open ios/Nourish/Nourish.xcodeproj
```

Requires **Xcode 16 or newer** (the project uses a file-system synchronised
group, so new files in `Nourish/` are picked up automatically). Deployment
target is iOS 16.0, iPhone and iPad. Run on any simulator — the app needs
network access on first run to fetch the photography, after which images are
cached on disk.

## What is in the app

| Prototype | iOS |
| --- | --- |
| 7 step onboarding (`renderOb`) | `Views/OnboardingView.swift` |
| Account screen (`openAuth`) | `Views/AuthView.swift` |
| Today (`today()`) | `Views/TodayView.swift` |
| Food + world atlas (`food()`, `renderAtlas()`) | `Views/FoodView.swift` |
| Pantry (`pantryPage()`) | `Views/PantryView.swift` |
| Plan, week / calendar / list (`plan(view)`) | `Views/PlanView.swift` |
| Wellbeing + AI beta (`wellbeing()`) | `Views/WellbeingView.swift` |
| You (`you()`) | `Views/YouView.swift` |
| Meal sheet (`openMeal(i)`) | `Views/MealDetailView.swift` |
| Chef mode with timer (`renderCooking()`) | `Views/CookingView.swift` |
| Culture, country and morning sheets | `Views/DiscoveryViews.swift` |
| Every `openSheet(type)` overlay | `Views/Sheets.swift`, `Views/InfoSheet.swift` |

## Data and images

`Nourish/Resources/data.json` is generated from the constants in the HTML file
(`meals`, `V17_NUTRIENTS`, `V17_WORLDS`, `GLOBAL_DISCOVERIES`, `SMART_FIT_MEALS`,
`WORLD_COUNTRIES`, `worlds`, …). It holds all 30 meals, 195 countries, the 18
world tiles and the nutrient tables — including each item's image URL, so no
picture was re-picked or substituted.

Country sheets hydrate their dish photographs from the Wikimedia Commons API
exactly as `hydrateCountryFoodImages()` does, using the same known-file list
first and the same per-dish cache.

`RemoteImage.swift` adds a memory + disk cache on top of those URLs.

## State

Everything the prototype kept in `localStorage` is kept in `UserDefaults` under
the same keys (`nourishProfile`, `nourishPantry`, `nourishShopping`,
`nourishShoppingDone`, `nourishWeek`, `nourishTokens`, `nourishPlus`,
`nourishExplored`, `nourishCompleted`, `nourishAccount`), with the same rules:
three free planning days, four meal ideas per slot (eight with Nourish+),
twelve free atlas countries, tokens for exploring and cooking.

The scan buttons use the prototype's demo item list — this is a prototype, not a
recognition pipeline — and the account screen is a demo sign-in, not real Apple
or Google authentication.

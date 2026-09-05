# Girki — production build brief for Claude Code

## What this is

`Girki_V54_Signup_Spacing.html` is a complete, working single-file prototype of Girki. Every screen, interaction, recipe and piece of copy in it is deliberate and has been iterated on many times. **It is the specification.** Your job is to rebuild it as a production app without losing anything.

Read the whole file before writing a line of code. When the brief below and the prototype disagree, the prototype wins.

**What Girki is:** a world food atlas that gets you cooking. 195 countries of food, matched to what an ordinary supermarket actually stocks, with real methods, real timings, and a passport that stamps every country you cook from. Not a diet app. Not a delivery app.

---

## Non-negotiable: nothing is lost

Before you finish, every item below must exist in the production app and behave as it does in the prototype.

### Content inventory
- **597 atlas dishes across 195 countries** — `NOURISH_GLOBAL_LIBRARY`
- **32 hand-written recipes** — `N37_RECIPES`, with ingredients, methods with real timings, nutrition percentages and cultural notes
- **30 curated meals** — the `meals` array
- **15 Ghanaian dishes** including waakye, red red, kelewele, kontomire stew, light soup, groundnut soup, banku with okro stew, tuo zaafi
- **Family templates** — `N37_FAMILIES`, which generate an honest home version for any atlas dish with no hand-written recipe
- **67 remote image URLs** — every one must survive the migration. See Images below.
- **Ingredient accessibility data** — `N37_SUBS`, the substitution map for harder-to-find ingredients

### Feature inventory
Today · Food · Pantry · Plan · Wellbeing · You. Plus:
- **Cook mode** — per-step timers parsed from the method text, full-bleed photo hero, glass controls on the image, step track, spoken guidance, screen wake lock
- **The passport** — country stamps, regions, recently cooked, "where next" suggestion
- **Occasions** — date night, movie night, family, friends, just me, too tired, cook once eat twice, "I don't know what I want"
- **The assistant** — parses time, meal, diet, nutrient, country, ingredient and pantry from natural language
- **Smart kitchen / pantry** — what you have, what you can make
- **Shopping list** — combined quantities, minus what's in the pantry
- **Plan** — breakfast, lunch and dinner for seven days, week / calendar / list views
- **Technique clip system** — 15 clips, matched to steps automatically
- **Cook-and-capture** — photograph what you made, kept on device
- **Signup** — 7 steps, no repeated questions
- **Preferences** — regions, cooking confidence, weeknight time, household, optional birthday

**Verify with a checklist, not a feeling.** Walk every screen and every sheet in the prototype, list what it does, then tick each one off in the build.

---

## Stack

- **React Native + Expo**, TypeScript, iOS and Android from one codebase
- **Supabase** — Postgres, auth, storage
- **Local-first**: the app must work fully offline once content is cached. Cooking happens in kitchens with bad signal.
- Ronald already has Codex working on a build. Check what exists before starting from scratch.

---

## Data model

```
countries      id, name, region, subregion
dishes         id, country_id, name, slot, minutes, kcal, is_authored,
               cultural_note, source, editorial_status
ingredients    id, dish_id, text, position, accessibility, substitution
steps          id, dish_id, position, text, minutes, kind, chef_cue
nutrients      id, dish_id, name, percentage
media          id, dish_id, step_position, kind(photo|video), url, poster_url,
               licence, author, attribution_text, depicts_actual_dish, status
users          id, created_at
preferences    user_id, regions[], confidence, weeknight_minutes, household,
               dob_day, dob_month, dob_year, diet, allergies[], priorities[]
cook_log       id, user_id, dish_name, country, cooked_at, kcal, minutes
plans          user_id, day, slot, dish_id, added_at
pantry         user_id, item, added_at
shopping       user_id, item, quantity, done
photos         user_id, dish_name, storage_path, created_at
```

**Critical:** the cook log is keyed by dish **name and country**, never by array index. The prototype originally used indexes and the history scrambled itself. Do not repeat that.

---

## Images — read this twice

The single biggest risk in this migration is losing or breaking imagery.

1. **Inventory first.** Extract all 67 remote URLs from the prototype into the `media` table before changing anything. `nourish-image-manifest.csv` has 50 of them already catalogued with source pages.
2. **Self-host everything.** Wikimedia rate-limits hotlinking and Unsplash URLs change. Download, resize to 1600px long edge, convert to WebP, store in Supabase Storage, serve through a CDN.
3. **Record the licence for every file.** Commons files are individually licensed — some CC BY-SA and legally require visible author credit, some CC0. Do not treat them as one pool. Render attribution where required.
4. **Flag images that show the wrong dish.** Several are generic stock standing in for specific dishes. `girkiShotList()` in the prototype console lists the eight Ghanaian dishes with written photography briefs.
5. **Keep the fallback chain.** Technique clip → step photo → dish photo → plain dark field. Never a broken icon, never an empty box.
6. **Bundle a small set of critical images in the binary** so the app is not blank on first launch before any network call.

**No image may be dropped in migration.** If a URL cannot be cleared for licensing, replace it — do not delete the slot.

---

## Notifications — build this properly

Ronald is right that this is where retention is won or lost. The rule: **every notification must be about food, at a moment when food is on the person's mind.** No streak nags, no guilt, no "we miss you".

**Send:**
- **Cook reminder** — 45 minutes before a planned meal, only if one is planned. *"Kimchi jjigae tonight. You have everything except the tofu."*
- **Shopping nudge** — Saturday morning if the week is planned and the list has unbought items.
- **Birthday** — if they gave a date. One dish, chosen properly, on the morning.
- **New country unlocked** — when the passport hits a milestone or a new region opens.
- **Weekly discovery** — one dish from a region they have never cooked, once a week, at a time they usually open the app.
- **Timer alerts** — when a cook-mode step finishes and the app is backgrounded. This one is functional and must be reliable.

**Never send:**
- Streak warnings, "don't lose your progress", daily engagement pings, anything counting days since last use, anything about weight or calories.

**Mechanics:** ask permission *after* the first meal is cooked, never on launch — the ask converts far better once value is proven. Default to a maximum of two a week outside timers. Per-category toggles in settings. Respect quiet hours and the device timezone.

---

## Copy and tone

The writing in the prototype is part of the product. Keep it exactly.

- Plain, warm, unhurried. Short sentences. No exclamation marks, no emoji in body copy.
- **Never** claim food treats, cures or prevents anything. "Supports", "provides a source of", "part of a varied diet", "individual needs differ". This is both an ethical line and an App Store review line.
- Cultural framing: a dish is an invitation into a food tradition, never a definition of a country's cuisine. Traditional / Girki interpretation / everyday version must stay distinguishable.
- Supermarket language is global: "Most supermarkets", "Larger supermarkets", "Speciality or world food shop". Never name a chain.
- Empty states teach the mechanic. See the passport card when a dish has no country — that pattern is deliberate and should be copied elsewhere.

---

## Design system

- **Type:** Iowan Old Style / Palatino / Georgia serif for headings and the cook-mode instruction. System sans for body and UI.
- **Palette:** sage, sand, clay, warm off-white. Never bright green-orange-red.
- **Full bleed imagery** on the cook hero and recipe sheet, running to all three edges, information resting on the photograph over a gradient scrim.
- **Glass controls** over images: translucent white, backdrop blur, primary action solid white.
- **Touch targets** 44px minimum, 50px in cook mode — wet hands, glancing at a pan.
- **Spacing:** 14px rail gutters on phone, 20px on tablet. Sections breathe.
- Respect `prefers-reduced-motion` and Dynamic Type. Test with the largest accessibility text size.
- **iPad:** proper layout, not a stretched phone. Fill the width, more columns, rails still scroll horizontally.

---

## Monetisation

Free: 12 countries, 3 days of planning. Girki+: all 195 countries, all 7 days, deeper regional content.

The gate is the day count and the country count — never the quality of what free users get. A free user must be able to cook something excellent, or they will never pay.

---

## Order of work

1. **Migrate content and images** with a verification script that proves nothing was dropped
2. **Core screens** — Today, Food, Plan, with the passport
3. **Cook mode** — the heart of the product, get it right
4. **Pantry, shopping, wellbeing, preferences**
5. **Notifications**
6. **Offline caching**
7. **Girki+ and payments**

---

## Definition of done

- Every feature in the inventory above works
- A verification script proves all 597 dishes, 32 recipes and 67 images survived
- Cook mode works offline with the screen awake and timers firing in the background
- Full VoiceOver pass and largest-Dynamic-Type pass
- Cold start under two seconds
- Zero health claims anywhere in the copy
- Every image has a recorded licence and, where required, visible attribution
- iPad layout reviewed on a real device

---

## Two things to raise with Ronald rather than decide alone

1. **565 of 597 atlas dishes have generated methods**, not written ones. They are honest and clearly labelled, but they are the biggest quality risk in the product. Do not silently promote them to authored.
2. **The name.** Girki has not had a trademark clearance search. Do not commission final branding until classes 9 and 42 come back clear in the UK, EU and US.

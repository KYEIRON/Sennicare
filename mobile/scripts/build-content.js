/**
 * Build the Girki content bundle from the prototype.
 *
 *   npm run content:build
 *
 * Reads Girki_V54_Signup_Spacing.html through the extractor — the prototype's
 * own JavaScript, executed — and writes typed JSON into src/data/girki. Rerun
 * it whenever the prototype changes; `npm run verify:content` then proves the
 * result against the source.
 */
const fs = require('fs');
const path = require('path');
const { extractPrototype, imageUrls } = require('./extract-prototype');

const { data: d, html, threw } = extractPrototype();
if (threw) console.log('note: prototype threw under the stub DOM (expected):', threw);
const OUT = path.join(__dirname, '..', 'src', 'data', 'girki');

const slug = (s) =>
  String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- countries ---------- */
const countries = d.WORLD_COUNTRIES.map(([name, region, areas, foods]) => ({
  id: slug(name), name, region, areas, foods,
}));

/* ---------- dishes: the 597 atlas records ---------- */
const dishes = d.NOURISH_GLOBAL_LIBRARY.map((x) => ({
  id: `${slug(x.country)}--${slug(x.dish)}`,
  country: x.country,
  countryId: slug(x.country),
  region: x.region,
  name: x.dish,
  slot: x.slot,
  source: x.source || 'Girki country atlas',
  curated: Boolean(x.curated),
}));

/* ---------- recipes: 32 hand written ----------
   The prototype looks a recipe up as `country::dish` against the atlas dish
   name, so a recipe whose name does not appear in its country's atlas list is
   written but never reachable. Reachability is recorded here rather than fixed
   silently: renaming atlas dishes or adding new ones is a content decision.  */
const norm = (v) => String(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
const recipes = Object.entries(d.N37_RECIPES).map(([key, r]) => {
  const [country, name] = key.split('::');
  const atlasDish = dishes.find(
    (x) => norm(x.country) === norm(country) && norm(x.name) === norm(name)
  );
  return {
    atlasDishId: atlasDish ? atlasDish.id : null,
    reachableFromAtlas: Boolean(atlasDish),
    id: `${slug(country)}--${slug(name)}`,
    key, country, countryId: slug(country), name,
    slot: r.slot, minutes: r.min, kcal: r.cal,
    ingredients: r.ing,
    steps: r.steps,
    nutrients: (r.nut || []).map(([n, percentage]) => ({ name: n, percentage })),
    culturalNote: r.note || '',
    isAuthored: true,
    editorialStatus: 'authored',
  };
});

/* ---------- curated meals: the original 30 ---------- */
const meals = d.meals.map((m, index) => ({
  id: `meal--${slug(m.name)}`,
  legacyIndex: index,
  name: m.name, slot: m.slot, minutes: m.duration, kcal: m.cal,
  meta: m.meta, image: m.img,
  ingredients: m.ingredients, steps: m.steps,
  nutrients: m.nut || null, fit: m.fit || null,
  culture: m.culture || null, fits: m.fits || null,
}));

/* ---------- families: honest home versions ---------- */
const families = d.N37_FAMILIES.map((f) => ({
  id: f.id,
  name: f.name,
  match: f.test.__regex,
  matchFlags: f.test.flags,
  ingredients: f.ing && f.ing.result ? f.ing.result : [],
  steps: f.steps,
  nutrients: (f.nut || []).map(([n, percentage]) => ({ name: n, percentage })),
  minutes: f.min, kcal: f.cal,
  editorialStatus: 'generated',
}));

/* ---------- ingredient accessibility ---------- */
const substitutions = Object.entries(d.N37_SUBS).map(([term, substitution]) => ({
  term, substitution,
}));

/* ---------- technique clips ---------- */
const clips = Object.entries(d.GIRKI_TECHNIQUE_CLIPS).map(([id, c]) => ({
  id, file: c.file, alt: c.alt,
  match: c.test.__regex, matchFlags: c.test.flags,
  and: c.and ? c.and.__regex : null,
  not: c.not ? c.not.__regex : null,
}));

/* ---------- occasions ---------- */
const occasions = d.N39_OCCASIONS.map((o) => ({
  id: o.id, icon: o.icon, name: o.name, blurb: o.blurb,
  want: o.want || {},
  prefer: o.prefer ? o.prefer.__regex : null,
  tip: o.tip || '',
}));

/* ---------- media: every remote image, with licence ---------- */
const urls = imageUrls(html);
const assetMap = d.NOURISH_ASSET_MAP || {};

/* Photo briefs carry the licence facts the prototype recorded. */
const photoMeta = {};
for (const [dish, p] of Object.entries(d.GIRKI_DISH_PHOTOS || {})) photoMeta[p.preview] = { dish, ...p };
for (const [dish, p] of Object.entries(d.GIRKI_GHANA_DISCOVERY_PHOTOS || {})) photoMeta[p.preview] = { dish, ...p };

const media = urls.map((url) => {
  const meta = photoMeta[url];
  const commons = url.includes('wikimedia');
  const file = commons
    ? decodeURIComponent(url.split('FilePath/')[1] || '').split('?')[0]
    : (url.split('/').pop() || '').split('?')[0];
  return {
    id: assetMap[url] || `girki-${slug(file).slice(0, 40)}-${Buffer.from(url).toString('base64').slice(-6).replace(/[^a-z0-9]/gi, '')}`,
    url,
    file,
    source: commons ? 'Wikimedia Commons' : 'Unsplash',
    licence: meta?.license || (commons ? 'Individual Commons file licence — to be confirmed per file' : 'Unsplash licence — to be confirmed'),
    author: meta?.author || '',
    attributionRequired: /CC BY/i.test(meta?.license || ''),
    depictsActualDish: meta ? true : null,
    dish: meta?.dish || null,
    localTarget: meta?.local || null,
    shotNote: meta?.note || null,
    status: meta ? 'briefed' : 'needs-review',
  };
});

/* ---------- signup and preference vocabularies ---------- */
const preferences = {
  regions: d.GIRKI_REGIONS,
  confidence: d.GIRKI_CONFIDENCE.map(([id, label, detail]) => ({ id, label, detail })),
  weeknight: d.GIRKI_WEEKNIGHT.map(([id, label]) => ({ id, label })),
  foodInterests: d.GIRKI_FOOD_INTERESTS,
  discoveryLevels: d.GIRKI_DISCOVERY_LEVELS.map(([id, label, detail]) => ({ id, label, detail })),
};

/* ---------- cook mode timing vocabulary ---------- */
const cookMode = {
  defaults: d.N34_DEFAULTS,
  methodOverrides: d.N34_METHOD,
};

const bundle = {
  meta: {
    source: 'Girki_V54_Signup_Spacing.html',
    extractedAt: new Date().toISOString().slice(0, 10),
    counts: {
      countries: countries.length,
      dishes: dishes.length,
      recipes: recipes.length,
      meals: meals.length,
      families: families.length,
      substitutions: substitutions.length,
      clips: clips.length,
      occasions: occasions.length,
      media: media.length,
    },
  },
  countries, dishes, recipes, meals, families, substitutions, clips, occasions, media,
  preferences, cookMode,
  freeCountries: d.WORLD_FREE_FEATURED,
  continents: d.WORLD_CONTINENTS,
  continentMap: d.WORLD_CONTINENT_MAP,
  worldTiles: d.worlds,
  worldInfo: d.V17_WORLDS,
  nutrients: d.V17_NUTRIENTS,
  dietRules: d.N32_DIET_RULES,
  demoPantry: d.DEMO_PANTRY,
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, value] of Object.entries(bundle)) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(value, null, 1));
}
console.log(JSON.stringify(bundle.meta.counts, null, 1));
console.log('written to', OUT);

import raw from '../data/data.json';

/**
 * The prototype's own constants, generated from
 * Nourish_Global_Experience_V28.html. Every meal, country, world tile,
 * nutrient table and image URL is the prototype's — nothing re-picked.
 */
export type Meal = {
  name: string;
  slot: string;
  duration: number;
  meta: string;
  cal: number;
  img: string;
  ingredients: string[];
  steps: string[];
  nut?: string[];
  fit?: string;
  culture?: string;
  fits?: string[];
};

export type WorldInfo = {
  region: string;
  tag: string;
  img: string;
  description: string;
};

export type Country = {
  name: string;
  region: string;
  areas: string[];
  foods: string[];
};

export type WorldTile = { title: string; subtitle: string; img: string };
export type NutrientBar = { name: string; percent: number };
export type MealRef = { index: number; meal: Meal };

type Raw = {
  meals: Meal[];
  V17_NUTRIENTS: Record<string, [string, number][]>;
  V17_WORLDS: Record<string, WorldInfo>;
  WORLD_COUNTRIES: [string, string, string[], string[]][];
  WORLD_FREE_FEATURED: string[];
  WORLD_CONTINENTS: string[];
  WORLD_CONTINENT_MAP: Record<string, string[]>;
  worlds: [string, string, string][];
};

const data = raw as unknown as Raw;

export const meals: Meal[] = data.meals;
export const mealRefs: MealRef[] = meals.map((meal, index) => ({ index, meal }));
export const worldInfo = data.V17_WORLDS;
export const freeFeatured = data.WORLD_FREE_FEATURED;
export const continents = data.WORLD_CONTINENTS;
const continentMap = data.WORLD_CONTINENT_MAP;

export const countries: Country[] = data.WORLD_COUNTRIES.map(
  ([name, region, areas, foods]) => ({ name, region, areas, foods })
);

export const worldTiles: WorldTile[] = data.worlds.map(([title, subtitle, img]) => ({
  title,
  subtitle,
  img,
}));

const nutrientTable = data.V17_NUTRIENTS;

export function mealIndex(name: string): number {
  return meals.findIndex((m) => m.name === name);
}

export function countryByName(name: string): Country | undefined {
  return countries.find((c) => c.name === name);
}

/** `worldContinent(country)` */
export function continentFor(country: string): string {
  for (const key of Object.keys(continentMap)) {
    if (continentMap[key].includes(country)) return key;
  }
  return 'Asia';
}

/** `V17_NUTRIENTS[m.name] || [...]` */
export function nutrientBars(meal: Meal): NutrientBar[] {
  const rows = nutrientTable[meal.name];
  if (rows) return rows.map(([name, percent]) => ({ name, percent }));
  return [
    { name: 'Protein', percent: 30 },
    { name: 'Fibre', percent: 25 },
    { name: 'Iron', percent: 20 },
    { name: 'Vitamin C', percent: 25 },
  ];
}

/** `nutrientMeaning(n)` */
export function nutrientMeaning(n: string): string {
  const x = n.toLowerCase();
  if (x.includes('protein')) return 'helps maintain and repair body tissues';
  if (x.includes('fibre')) return 'supports normal digestive function';
  if (x.includes('calcium')) return 'contributes to normal bones and teeth';
  if (x.includes('iron')) return 'contributes to normal oxygen transport';
  if (x.includes('folate')) return 'contributes to normal blood formation';
  if (x.includes('vitamin c')) return 'contributes to normal immune function';
  if (x.includes('vitamin d')) return 'contributes to normal muscle and bone function';
  if (x.includes('b12')) return 'contributes to normal red blood cell formation';
  if (x.includes('potassium')) return 'contributes to normal muscle function';
  if (x.includes('magnesium')) return 'contributes to normal energy metabolism';
  if (x.includes('omega 3')) return 'provides a source of long chain omega 3 fats';
  return 'one part of a varied diet';
}

/** `chefCue(m, n)` */
const CHEF_CUES = [
  'Get everything ready before you start. A little preparation makes the cooking feel easier.',
  'Listen and look: gentle bubbling is usually enough here. Avoid rushing the heat.',
  'Taste if appropriate and adjust seasoning gradually. You can always add more, but you cannot take it away.',
  'Give the finished food a minute to settle before serving.',
];

export function chefCue(step: number): string {
  return CHEF_CUES[Math.min(step, CHEF_CUES.length - 1)];
}

/** The dishes behind `openCulture(place)`. */
export const cultureNames: Record<string, string[]> = {
  Nepal: ['Nepali dal bhat tarkari'],
  Ghana: ['Ghanaian grilled tilapia & fries', 'Ghanaian jollof rice with beans'],
  Sweden: ['Swedish köttbullar with lingonberry'],
  Japan: ['True ramen · shoyu style', 'Japanese salmon rice bowl'],
  Vietnam: ['Vietnamese chicken phở'],
  Korea: ['Korean bibimbap'],
  Fiji: ['Fijian kokoda'],
  India: ['Masala dosa with sambar'],
  Peru: ['Peruvian ceviche'],
  Amazon: ['Amazonian tacacá'],
  'Hawaiʻi': ['Hawaiian poke bowl'],
  Mediterranean: ['Shakshuka with wholegrain bread'],
  Morocco: ['Moroccan chickpea vegetable tagine'],
  'Middle East': ['Middle Eastern lentil soup with wholegrain flatbread'],
  Ethiopia: ['Ethiopian lentil stew with greens'],
  'Latin America': ['Mexican black bean, corn & avocado bowl'],
};

/** `culturePicks` on Today. */
export const culturePicks: { place: string; meal: string }[] = [
  { place: 'Ghana', meal: 'Ghanaian grilled tilapia & fries' },
  { place: 'Sweden', meal: 'Swedish köttbullar with lingonberry' },
  { place: 'Japan', meal: 'True ramen · shoyu style' },
  { place: 'Vietnam', meal: 'Vietnamese chicken phở' },
  { place: 'Korea', meal: 'Korean bibimbap' },
  { place: 'Fiji', meal: 'Fijian kokoda' },
  { place: 'India', meal: 'Masala dosa with sambar' },
  { place: 'Peru', meal: 'Peruvian ceviche' },
  { place: 'Amazon', meal: 'Amazonian tacacá' },
  { place: 'Hawaiʻi', meal: 'Hawaiian poke bowl' },
];

/** The rail titles V28 maps onto culture keys. */
export function culturePlace(title: string): string {
  switch (title) {
    case 'West Africa':
      return 'Ghana';
    case 'South Asia':
      return 'Nepal';
    case 'East Asia':
      return 'Japan';
    case 'North Africa':
      return 'Morocco';
    case 'Scandinavia':
      return 'Sweden';
    default:
      return title;
  }
}

/** `commonsFoodImageUrl(food, country)` */
const KNOWN_COMMONS_IMAGES: Record<string, string> = {
  'ghana|grilled tilapia & yam chips':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Grilled_Tilapia_Ghana.JPG?width=900',
  'ghana|jollof rice':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Jollof%20Rice%20in%20Ghana.jpg?width=900',
  'nepal|dal bhat tarkari':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Dal_bhat.jpg?width=900',
  'japan|ramen': 'https://commons.wikimedia.org/wiki/Special:FilePath/Ramen.jpg?width=900',
  'vietnam|pho':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Vietnamese%20Pho.jpg?width=900',
  'korea|bibimbap':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Korean%20Bibimbap.jpg?width=900',
  'fiji|kokoda': 'https://commons.wikimedia.org/wiki/Special:FilePath/Kokodafood.jpg?width=900',
  'india|masala dosa':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Dosa%20India.jpg?width=900',
  'peru|ceviche':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Ceviche%20de%20pescado.jpg?width=900',
  'amazon|tacacá':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Tacac%C3%A1%20(Brazilian%20indigenous%20soup)%20(51404038372).jpg?width=900',
  'hawaiʻi|poke bowl':
    'https://commons.wikimedia.org/wiki/Special:FilePath/Limupoke.jpg?width=900',
};

export function knownCommonsImage(food: string, country: string): string | undefined {
  return KNOWN_COMMONS_IMAGES[`${country}|${food}`.toLowerCase()];
}

/** Photography used outside the meal library, at the prototype's URLs. */
export const IMAGES = {
  people: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=85',
  move: 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=900&q=85',
  discovery: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85',
  morningFeature:
    'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=88',
  nepalMorning:
    'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=88',
  onboardingHero:
    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=90',
  authHero:
    'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=90',
} as const;

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export type Day = (typeof DAYS)[number];

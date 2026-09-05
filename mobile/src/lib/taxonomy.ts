/**
 * Nourish food taxonomy.
 *
 * These are the vocabularies the food graph and the discovery engine share:
 * meal slots, dietary and style tags, allergens, and the keyword evidence used
 * to read a dish name or an ingredient line.
 *
 * Everything derived from a dish *name* is a heuristic and is marked as such on
 * the record. Nothing here is allowed to assert that a dish is safe.
 */

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner';
export const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner'];

export type Allergen =
  | 'Peanuts'
  | 'Tree nuts'
  | 'Milk'
  | 'Eggs'
  | 'Fish'
  | 'Shellfish'
  | 'Wheat'
  | 'Soy';

export const ALLERGENS: Allergen[] = [
  'Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Fish', 'Shellfish', 'Wheat', 'Soy',
];

/**
 * Ingredient words that indicate an allergen. Used to derive allergens from a
 * structured ingredient list — never to declare a dish free of one.
 */
export const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  Peanuts: ['peanut', 'groundnut'],
  'Tree nuts': ['almond', 'walnut', 'cashew', 'pistachio', 'hazelnut', 'pecan', 'macadamia', 'praline'],
  Milk: ['milk', 'yoghurt', 'yogurt', 'cheese', 'feta', 'butter', 'cream', 'paneer', 'ghee', 'kefir'],
  Eggs: ['egg', 'omelette', 'omelet', 'mayonnaise', 'meringue'],
  Fish: ['fish', 'salmon', 'cod', 'tuna', 'tilapia', 'sardine', 'mackerel', 'trout', 'anchov', 'hake', 'herring', 'snapper'],
  Shellfish: ['prawn', 'shrimp', 'crab', 'lobster', 'mussel', 'clam', 'oyster', 'squid', 'octopus', 'shellfish'],
  Wheat: ['bread', 'flour', 'pasta', 'noodle', 'wheat', 'pitta', 'pita', 'couscous', 'semolina', 'bulgur', 'breadcrumb', 'flatbread', 'tortilla', 'chapati', 'roti', 'baguette', 'dumpling'],
  Soy: ['soy', 'shoyu', 'tofu', 'miso', 'edamame', 'tempeh', 'tamari'],
};

/** A dietary or style characteristic a dish can carry. */
export type FoodTag =
  | 'fish'
  | 'shellfish'
  | 'chicken'
  | 'meat'
  | 'plant based'
  | 'vegetarian'
  | 'salad'
  | 'soup'
  | 'stew'
  | 'grain bowl'
  | 'noodles'
  | 'rice'
  | 'bread'
  | 'comforting'
  | 'light'
  | 'spicy'
  | 'high protein'
  | 'high fibre'
  | 'quick'
  | 'street food'
  | 'grilled'
  | 'baked'
  | 'raw';

/**
 * Evidence for reading a dish name. Deliberately broad, because dish names come
 * from 195 food cultures — but each match only ever produces a *hint*, which
 * the record records as unverified.
 */
export const TAG_KEYWORDS: Record<FoodTag, RegExp> = {
  fish: /\b(fish|salmon|cod|tilapia|tuna|sardine|sardines|mackerel|trout|hake|anchov|herring|snapper|barramundi|kokoda|ceviche|poke|bacalhau|kedgeree|gravlax|lutefisk|surströmming|maafe? poisson|poisson|pescado|pesce|ikan|isda|samaki)\b/i,
  shellfish: /\b(prawn|prawns|shrimp|crab|lobster|mussel|mussels|clam|clams|oyster|squid|octopus|calamari|gambas|camarão|langosta)\b/i,
  chicken: /\b(chicken|poulet|pollo|frango|hähnchen|kyckling|murgh|ayam|doro|yassa|adobo|katsu)\b/i,
  meat: /\b(beef|lamb|mutton|pork|goat|veal|steak|sausage|bacon|ham|meatball|köttbullar|kebab|kofta|kebda|braai|asado|carne|cordero|schnitzel|gulyás|goulash|bulgogi|rendang|biltong|shawarma|suya|brisket|oxtail|tripe|liver)\b/i,
  'plant based': /\b(lentil|lentils|bean|beans|chickpea|chickpeas|dal|dhal|daal|tofu|vegetable|vegetables|veg|greens|spinach|cabbage|aubergine|eggplant|pumpkin|squash|mushroom|falafel|hummus|potato|yam|cassava|plantain|maize|corn|quinoa|okra|salad)\b/i,
  vegetarian: /\b(paneer|cheese|halloumi|egg|omelette|frittata|shakshuka|pierogi|dosa|idli|injera)\b/i,
  salad: /\b(salad|slaw|tabbouleh|fattoush|gado|kachumbari|som tam|horiatiki|caprese|poke|ensalada|salade|insalata)\b/i,
  soup: /\b(soup|broth|chorba|shorba|harira|borscht|borsch|pho|phở|ramen|laksa|miso|caldo|sopa|zuppa|potage|bouillon|consommé|gazpacho|menudo|bisque)\b/i,
  stew: /\b(stew|tagine|tajine|curry|goulash|gulyás|casserole|hotpot|potjie|muamba|calulu|nyama|feijoada|cassoulet|ragout|ragù|chili|chilli|guisado|birria|bourguignon)\b/i,
  'grain bowl': /\b(bowl|pilaf|palaw|plov|pilau|biryani|risotto|paella|jollof|bibimbap|donburi|couscous|bulgur|quinoa|freekeh)\b/i,
  noodles: /\b(noodle|noodles|pasta|spaghetti|ramen|udon|soba|pho|phở|lo mein|chow mein|laksa|pad thai|mie|bún|kesme|makaron)\b/i,
  rice: /\b(rice|jollof|biryani|paella|risotto|congee|nasi|arroz|riz|sushi|onigiri|pilaf|palaw|plov)\b/i,
  bread: /\b(bread|toast|flatbread|pitta|pita|naan|roti|chapati|injera|baguette|burek|byrek|börek|pide|arepa|tortilla|paratha|damper|focaccia|banh mi|bánh mì|sandwich)\b/i,
  comforting: /\b(stew|casserole|pie|hotpot|dumpling|pudding|porridge|mash|roast|bake|gratin|goulash|risotto|ramen|congee|soup|meatball|köttbullar)\b/i,
  light: /\b(salad|soup|broth|ceviche|poke|steamed|greens|vegetable|yoghurt|yogurt|fruit|slaw|tabbouleh|gazpacho)\b/i,
  spicy: /\b(chilli|chili|spicy|peri|piri|harissa|berbere|gochujang|kimchi|sambal|jerk|vindaloo|suya|shito|birria|laksa|curry|masala|doro wat|kelewele)\b/i,
  'high protein': /\b(chicken|beef|lamb|pork|fish|salmon|tuna|egg|eggs|lentil|lentils|bean|beans|chickpea|chickpeas|tofu|paneer|yoghurt|yogurt|cheese)\b/i,
  'high fibre': /\b(lentil|lentils|bean|beans|chickpea|chickpeas|dal|dhal|wholegrain|oat|oats|barley|quinoa|vegetable|vegetables|greens|cabbage|okra|pea|peas)\b/i,
  quick: /\b(salad|sandwich|toast|wrap|omelette|scramble|smoothie|poke|slaw)\b/i,
  'street food': /\b(kebab|shawarma|taco|arepa|empanada|samosa|suya|satay|pierogi|banh mi|bánh mì|falafel|pastel|bhaji|pakora|chaat)\b/i,
  grilled: /\b(grilled|grill|braai|barbecue|bbq|asado|yakitori|suya|kebab|skewer|satay|char)\b/i,
  baked: /\b(baked|bake|pie|tart|gratin|casserole|börek|burek|byrek|quiche|focaccia|roast)\b/i,
  raw: /\b(ceviche|poke|kokoda|tartare|sashimi|carpaccio|gravlax|kibbeh nayyeh)\b/i,
};

/** Dish-name evidence that a dish is eaten at breakfast. */
export const BREAKFAST_KEYWORDS =
  /\b(porridge|oat|oats|pancake|pancakes|crepe|crêpe|bread|toast|egg|eggs|omelette|omelet|dosa|idli|congee|koko|chechebsa|menemen|frittata|granola|yoghurt|yogurt|waffle|muesli|puri|chapati|roti|injera|burek|byrek|damper|rice cake|shakshuka|ful medames|arepa|churro|banitsa|gallo pinto|kaya|nasi lemak|scone|bagel|croissant|smoothie|breakfast)\b/i;

/** Dish-name evidence that a dish is a lighter midday plate. */
export const LUNCH_KEYWORDS =
  /\b(salad|sandwich|wrap|soup|noodle|noodles|bowl|slaw|tabbouleh|fattoush|banh mi|bánh mì|taco|arepa|empanada|samosa|falafel|hummus|mezze|poke|ceviche|kebab|shawarma|pide|börek)\b/i;

/** Everyday ingredient vocabulary, used to read both queries and dish names. */
export const INGREDIENT_VOCABULARY = [
  'salmon', 'cod', 'tuna', 'tilapia', 'sardine', 'mackerel', 'trout', 'anchovy', 'fish',
  'prawn', 'shrimp', 'crab', 'squid', 'mussel',
  'chicken', 'beef', 'lamb', 'pork', 'goat', 'turkey', 'duck', 'sausage', 'bacon',
  'egg', 'eggs', 'tofu', 'paneer', 'halloumi', 'feta', 'cheese', 'yoghurt', 'yogurt', 'milk', 'butter', 'cream',
  'lentil', 'lentils', 'chickpea', 'chickpeas', 'bean', 'beans', 'pea', 'peas',
  'rice', 'pasta', 'noodle', 'noodles', 'bread', 'oats', 'quinoa', 'couscous', 'barley', 'maize', 'corn', 'potato', 'potatoes', 'sweet potato', 'yam', 'cassava', 'plantain',
  'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'carrot', 'courgette', 'zucchini', 'aubergine', 'eggplant', 'pepper', 'peppers', 'tomato', 'tomatoes', 'onion', 'onions', 'garlic', 'ginger', 'mushroom', 'mushrooms', 'okra', 'pumpkin', 'squash', 'cucumber', 'avocado', 'olive', 'lemon', 'lime', 'coconut',
  'banana', 'berries', 'apple', 'mango', 'orange',
  'chilli', 'chili', 'coriander', 'parsley', 'basil', 'mint', 'herbs', 'cumin', 'paprika', 'turmeric', 'soy', 'miso', 'sesame', 'peanut', 'almond', 'walnut', 'cashew', 'honey', 'seeds',
];

/** Words that mean "not this", so a query can exclude as well as include. */
export const NEGATION_PATTERNS = [
  /\b(?:no|not|without|avoid|skip|exclude|hold the)\s+([a-zà-ÿ' -]{3,25})/gi,
  /\bnothing\s+([a-zà-ÿ' -]{3,25})/gi,
  /\bi\s+(?:don'?t|do not|can'?t|cannot)\s+(?:eat|have|do)\s+([a-zà-ÿ' -]{3,25})/gi,
  /\b(?:allergic to|allergy to)\s+([a-zà-ÿ' -]{3,25})/gi,
];

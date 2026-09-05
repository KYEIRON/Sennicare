import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RecommendationCard } from '../components/discovery';
import { discover } from '../lib/discovery';
import { AtlasCard, FoodCard, WorldCard } from '../components/cards';
import { dishesByCountry, recipes as writtenRecipes } from '../lib/girki/content';
import { Page } from '../components/shell';
import {
  Button, Card, Chip, Eyebrow, H1, H2, H3, Notice, P, Rail, Section, SectionLabel, Small, Wrap,
} from '../components/ui';
import { SmartKitchenBlock } from '../components/smartKitchen';
import {
  Country, continentFor, continents, countries, culturePlace, freeFeatured, mealRefs, worldTiles,
} from '../lib/data';
import { filterMeals } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * The Food screen's intent chips. These are entry points into the whole food
 * library — 615 records across 195 countries — not filters over the featured
 * rail. Each maps to the natural request a person would actually type.
 */
const MOODS: { label: string; query: string }[] = [
  { label: 'Breakfast', query: 'breakfast ideas from around the world' },
  { label: 'Lunch', query: 'lunch ideas' },
  { label: 'Dinner', query: 'dinner ideas' },
  { label: 'Salads', query: 'more salads' },
  { label: 'Fish', query: 'I want more fish' },
  { label: 'Plant based', query: 'something plant based' },
  { label: 'Chicken', query: 'chicken dishes' },
  { label: 'Meat', query: 'meat dishes' },
  { label: 'Something light', query: 'something light' },
  { label: 'Comforting', query: 'something comforting' },
  { label: 'High protein', query: 'high protein meals' },
  { label: 'High fibre', query: 'high fibre meals' },
  { label: 'Under 30 minutes', query: 'meals under 30 minutes' },
  { label: 'Easy tonight', query: 'easy tonight, under 30 minutes' },
  { label: 'Use what I have', query: 'use what I have in my pantry' },
  { label: 'Something new', query: 'take me somewhere new' },
];

/** The Food tab — `food()`. */
export function Food() {
  const router = useRouter();
  const layout = useLayout();
  const [search, setSearch] = useState('');
  const cardWidth = `${100 / layout.foodColumns - 2}%` as const;

  if (router.filterTerm) return <DiscoveryResults query={router.filterTerm} />;

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Food</Eyebrow>
        <H1>Find something you'll want to make.</H1>
        <P>Explore meals, ingredients, nutrients and food from around the world.</P>
        <View style={styles.searchRow}>
          <Text style={styles.searchMark}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Try “more fish”, “breakfast from India” or “20 minute lunch”"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => search.trim() && router.filterFood(search.trim())}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => search.trim() && router.filterFood(search.trim())}
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </Pressable>
        </View>
      </View>

      <SmartKitchenBlock text="Tell Girki what you already have. It can find meals that use it first and show you what is missing." />

      <Section>
        <SectionLabel>What are you in the mood for?</SectionLabel>
        <Wrap>
          {MOODS.map((mood) => (
            <Chip key={mood.label} title={mood.label} onPress={() => router.filterFood(mood.query)} />
          ))}
        </Wrap>
        <Small style={{ marginTop: 8 }}>
          These search the whole Girki food library, not the featured rail.
        </Small>
      </Section>

      <Section>
        <SectionLabel>Selected for you</SectionLabel>
        <View style={styles.grid}>
          {mealRefs.map(({ index, meal }) => (
            <FoodCard
              key={index}
              meal={meal}
              width={cardWidth}
              onPress={() => router.present({ type: 'meal', index })}
            />
          ))}
        </View>
      </Section>

      <Section>
        <SectionLabel>Written recipes</SectionLabel>
        <H2>Cooked and written by hand</H2>
        <Small>
          {writtenRecipes.length} recipes written for an ordinary kitchen and an ordinary shop,
          with real timings. Everything else in the atlas gets an honest home version.
        </Small>
        <View style={styles.grid}>
          {writtenRecipes.map((recipe) => (
            <Pressable
              key={recipe.id}
              accessibilityRole="button"
              onPress={() => router.present({ type: 'girkiRecipe', id: recipe.id })}
              style={styles.recipeCard}
            >
              <Text style={styles.recipeCountry}>{recipe.country.toUpperCase()}</Text>
              <Text style={styles.recipeName}>{recipe.name}</Text>
              <Small>
                {recipe.minutes} min · {recipe.kcal} kcal
              </Small>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section>
        <SectionLabel>From somewhere new</SectionLabel>
        <H2>Food worth discovering</H2>
        <Small>
          The featured rail is the front door. Ask Girki for any country, ingredient or meal type
          and it searches the wider global food index.
        </Small>
        <Rail columns={layout.worldColumns}>
          {worldTiles.map((tile) => (
            <WorldCard
              key={tile.title}
              tile={tile}
              width={layout.tablet ? '100%' : undefined}
              onPress={() => router.present({ type: 'culture', place: culturePlace(tile.title) })}
            />
          ))}
        </Rail>
      </Section>

      <Section>
        <Card>
          <SectionLabel>Nutrients</SectionLabel>
          <H3>See what your food brings.</H3>
          <P>
            Explore protein, fibre, iron, folate, calcium and other nutrients that contribute to a
            varied diet.
          </P>
        </Card>
      </Section>

      <WorldAtlas />
    </Page>
  );
}

/**
 * Discovery results.
 *
 * This is what a Food chip or a search now opens: the recommendation engine's
 * answer over the whole graph, with recipes and atlas dishes kept distinct, a
 * "Why this?" on every card, and a way to keep refining by asking.
 */
function DiscoveryResults({ query }: { query: string }) {
  const store = useStore();
  const router = useRouter();

  const result = useMemo(
    () => discover(query, store.discoveryContext(), { limit: 8, discoveryLimit: 10 }),
    // The context is rebuilt on every store change; the query drives the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, store.pantry, store.plus, store.profile.allergies, store.exploredCountries]
  );

  const total = result.recipes.length + result.discoveries.length;
  const places = result.countriesRepresented.filter((c) => c !== 'Modern home kitchen');

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Pressable accessibilityRole="button" onPress={router.clearFilter} hitSlop={8}>
          <Text style={styles.back}>← All food</Text>
        </Pressable>
        <Eyebrow>Food · {query}</Eyebrow>
        <H1>{total ? 'Ideas from around the world.' : 'Nothing I would stand behind yet.'}</H1>
        <P>
          {total
            ? `${total} ideas across ${places.length} food cultures, ranked by what fits you — your pantry, your time and what you have already explored.`
            : result.unrecognised.length
            ? `I do not have anything for ${result.unrecognised.join(', ')} in the Girki food library, and I would rather say so than show you something else.`
            : 'I could not find a match I am confident in. Try another ingredient, a different meal type, or ask Girki directly.'}
        </P>

        {result.relaxed.length ? (
          <Notice title="Widened the search:">
            Girki holds nothing that matches exactly, so it loosened{' '}
            {result.relaxed.join(' and ')} to find these. Everything else you asked for still
            applies.
          </Notice>
        ) : null}

        {result.allergens.length ? (
          <Notice title="Allergy check:">
            {result.excludedForAllergies} records removed for {result.allergens.join(', ').toLowerCase()}.
            Dishes from the country atlas have no verified ingredient list, so they are shown as
            discovery records — Girki cannot tell you a dish is safe.
          </Notice>
        ) : null}

        <Button
          title="Refine this with Ask Girki"
          variant="secondary"
          onPress={() => router.present({ type: 'ask', seed: query })}
        />

        {result.recipes.length ? (
          <Section>
            <SectionLabel>Recipe-backed matches</SectionLabel>
            {result.recipes.map((recommendation) => (
              <RecommendationCard key={recommendation.record.id} recommendation={recommendation} />
            ))}
          </Section>
        ) : null}

        {result.discoveries.length ? (
          <Section>
            <SectionLabel>More from the world</SectionLabel>
            <Small>
              Dishes from the 195-country atlas. Girki knows the dish and where it comes from, so
              these are offered to explore rather than to cook.
            </Small>
            <View style={{ marginTop: 10 }}>
              {result.discoveries.map((recommendation) => (
                <RecommendationCard key={recommendation.record.id} recommendation={recommendation} />
              ))}
            </View>
          </Section>
        ) : null}

        {!total ? (
          <Button title="Ask Girki instead" onPress={() => router.present({ type: 'ask', seed: query })} />
        ) : null}
      </View>
    </Page>
  );
}

/** `worldAtlasSection()` + `renderAtlas()` */
export function WorldAtlas() {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();
  const [query, setQuery] = useState('');
  const [continent, setContinent] = useState('All');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = countries.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.foods.some((f) => f.toLowerCase().includes(q))
    );
    if (continent !== 'All') list = list.filter((c) => continentFor(c.name) === continent);
    return list;
  }, [query, continent]);

  // Free members see the featured twelve plus four locked previews.
  const shown = store.plus
    ? visible
    : [
        ...visible.filter((c) => freeFeatured.includes(c.name)).slice(0, 12),
        ...visible.filter((c) => !freeFeatured.includes(c.name)).slice(0, 4),
      ];

  const limit = store.plus ? countries.length : 12;
  const cardWidth = layout.atlasColumns > 1 ? (`${100 / layout.atlasColumns - 2}%` as const) : '100%';

  function open(country: Country) {
    const locked = !store.plus && !freeFeatured.includes(country.name);
    if (locked) {
      router.present({ type: 'plus' });
      return;
    }
    store.markCountryExplored(country.name);
    // A country opens onto its dishes, and every one of them is cookable.
    const dishes = dishesByCountry.get(country.name) || [];
    if (dishes.length === 1) router.present({ type: 'girkiDish', id: dishes[0].id });
    else router.present({ type: 'country', name: country.name });
  }

  return (
    <Section>
      <SectionLabel>The world of food</SectionLabel>
      <H2>195 countries. Endless foodways.</H2>
      <P>
        From neighbourhood kitchens to regional traditions, there is always another table to
        discover.
      </P>
      <Small>
        {store.plus
          ? `${visible.length} countries available`
          : `12 featured countries free · locked previews shown below · ${countries.length} in the full atlas`}
      </Small>

      <View style={{ gap: 8, marginVertical: 10 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a country or food"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          style={styles.atlasSearch}
        />
        <Wrap gap={7}>
          {continents.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: continent === option }}
              onPress={() => setContinent(option)}
              style={[styles.continent, continent === option && styles.continentActive]}
            >
              <Text style={[styles.continentText, continent === option && { color: '#fff' }]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </Wrap>
      </View>

      <View style={styles.grid}>
        {shown.map((country) => (
          <AtlasCard
            key={country.name}
            country={country}
            locked={!store.plus && !freeFeatured.includes(country.name)}
            width={cardWidth}
            onPress={() => open(country)}
          />
        ))}
      </View>

      {visible.length > limit ? (
        <View style={styles.preview}>
          {!store.plus ? <Text style={styles.previewTitle}>There is much more to discover.</Text> : null}
          <Small>
            {store.plus
              ? `${visible.length} countries shown.`
              : 'Explore 12 featured countries free. Girki+ unlocks the full world atlas, regional foodways and deeper stories.'}
          </Small>
          {!store.plus ? (
            <Button title="Unlock the world" onPress={() => router.present({ type: 'plus' })} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.explore}>
        <Eyebrow>Image led discovery</Eyebrow>
        <H3>Every dish should make you curious.</H3>
        <P>
          Free members get a curated taste of the world. Girki+ opens the deeper image rich
          library, with more regional dishes, recipes and variations.
        </P>
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewTitle}>Curiosity is free. Depth is Plus.</Text>
        <Small>
          Free members can taste the discovery experience. Girki+ opens the full atlas, deeper
          regional exploration and more variations.
        </Small>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.search,
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  searchMark: { fontSize: 16, color: colors.muted },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink, paddingVertical: 10 },
  searchButton: {
    backgroundColor: colors.ink,
    borderRadius: 11,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  searchButtonText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  recipeCard: {
    width: '48%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
  },
  recipeCountry: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.muted },
  recipeName: { fontFamily: displayFont, fontSize: 18, color: colors.ink, marginVertical: 4 },
  back: { fontSize: 12, fontWeight: '600', color: colors.sage, marginBottom: 10 },
  atlasSearch: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.ink,
  },
  continent: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  continentActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  continentText: { fontSize: 11, color: colors.ink },
  preview: {
    backgroundColor: colors.warm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
  },
  previewTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  explore: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 16,
    marginTop: 14,
  },
});

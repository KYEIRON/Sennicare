import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AtlasCard, FoodCard, WorldCard } from '../components/cards';
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

const MOODS = [
  'Easy tonight', 'Something plant based', 'Fish', 'Chicken', 'Meat', 'Something light',
  'Comforting', 'High protein', 'High fibre', 'Use what I have', 'Under 30 minutes', 'Something new',
];

/** The Food tab — `food()`. */
export function Food() {
  const router = useRouter();
  const layout = useLayout();
  const cardWidth = `${100 / layout.foodColumns - 2}%` as const;

  if (router.filterTerm) return <FilterResults term={router.filterTerm} />;

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Food</Eyebrow>
        <H1>Find something you'll want to make.</H1>
        <P>Explore meals, ingredients, nutrients and food from around the world.</P>
        <View style={styles.search}>
          <Text style={styles.searchText}>⌕  Search meals, ingredients or nutrients</Text>
        </View>
      </View>

      <SmartKitchenBlock text="Tell Nourish what you already have. It can find meals that use it first and show you what is missing." />

      <Section>
        <SectionLabel>What might work today?</SectionLabel>
        <Wrap>
          {MOODS.map((mood) => (
            <Chip key={mood} title={mood} onPress={() => router.filterFood(mood)} />
          ))}
        </Wrap>
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
        <SectionLabel>From somewhere new</SectionLabel>
        <H2>Food worth discovering</H2>
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

/** `filterFood(term)` */
function FilterResults({ term }: { term: string }) {
  const router = useRouter();
  const layout = useLayout();
  const kidney = term.toLowerCase() === 'kidney aware';
  const matched = useMemo(() => filterMeals(term), [term]);
  const cardWidth = `${100 / layout.foodColumns - 2}%` as const;

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Pressable accessibilityRole="button" onPress={router.clearFilter} hitSlop={8}>
          <Text style={styles.back}>← All food</Text>
        </Pressable>
        <Eyebrow>Food · {term}</Eyebrow>
        <H1>{kidney ? 'Kidney aware food' : 'Ideas that fit.'}</H1>
        <P>
          {kidney
            ? 'Kidney diets vary by condition, stage, blood tests and treatment. This demo does not label recipes as kidney friendly without clinical review.'
            : 'Explore the food itself first. Fit labels help you narrow the field without putting food into good or bad boxes.'}
        </P>

        {kidney ? (
          <Notice title="How Nourish should handle this">
            In production, kidney related labels will use verified sodium, potassium, phosphorus,
            protein and portion data, with appropriate clinical review. The app should never imply
            that one meal is universally safe for everyone with kidney disease.
          </Notice>
        ) : matched.length ? (
          <View style={styles.grid}>
            {matched.map(({ index, meal }) => (
              <FoodCard
                key={index}
                meal={meal}
                width={cardWidth}
                onPress={() => router.present({ type: 'meal', index })}
              />
            ))}
          </View>
        ) : (
          <P>No exact matches in this demo yet.</P>
        )}

        <View style={{ marginTop: 14 }}>
          <Notice title="Health fit note">
            Vegan labels can often be recipe based. Keto and kidney related suitability is more
            individual and should only be shown from verified nutrition data and appropriate
            professional guidance.
          </Notice>
        </View>
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
    if (locked) router.present({ type: 'plus' });
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
              : 'Explore 12 featured countries free. Nourish+ unlocks the full world atlas, regional foodways and deeper stories.'}
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
          Free members get a curated taste of the world. Nourish+ opens the deeper image rich
          library, with more regional dishes, recipes and variations.
        </P>
      </View>

      <View style={styles.preview}>
        <Text style={styles.previewTitle}>Curiosity is free. Depth is Plus.</Text>
        <Small>
          Free members can taste the discovery experience. Nourish+ opens the full atlas, deeper
          regional exploration and more variations.
        </Small>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  search: {
    backgroundColor: colors.search,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  searchText: { fontSize: 13, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
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

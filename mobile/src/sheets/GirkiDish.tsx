import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, Notice, P, Photo, SectionLabel, Small, Tag, Wrap } from '../components/ui';
import { Dish, dishesById, media as mediaTable, recipes as writtenRecipes } from '../lib/girki/content';
import { cookSteps } from '../lib/girki/cook';
import { accessibility, cookableForDish } from '../lib/girki/recipes';
import { countryIsOpen } from '../lib/girki/passport';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { CookMode } from './CookMode';

/**
 * A dish, ready to cook.
 *
 * Traditional, Girki interpretation and everyday version stay distinguishable:
 * an authored recipe says so, and a family version says plainly that it is an
 * interpretation rather than the tradition.
 */
export function GirkiDishSheet({ id, kind = 'dish' }: { id: string; kind?: 'dish' | 'recipe' }) {
  const router = useRouter();
  const store = useStore();
  const [cooking, setCooking] = useState(false);

  /**
   * A recipe whose name is not in its country's atlas list is still a written
   * recipe, and must be reachable. The atlas is unchanged; this simply opens
   * the recipe directly.
   */
  const written = kind === 'recipe' ? writtenRecipes.find((r) => r.id === id) : undefined;
  const dish: Dish | undefined =
    kind === 'recipe'
      ? (written?.atlasDishId ? dishesById.get(written.atlasDishId) : undefined) ||
        (written
          ? {
              id: written.id,
              country: written.country,
              countryId: written.countryId,
              region: '',
              name: written.name,
              slot: written.slot,
              source: 'Girki written recipe',
              curated: true,
            }
          : undefined)
      : dishesById.get(id);

  const cookable = useMemo(() => (dish ? cookableForDish(dish, { loose: true }) : null), [dish]);
  const access = useMemo(
    () => (cookable ? accessibility(cookable.ingredients) : null),
    [cookable]
  );
  const steps = useMemo(() => (cookable ? cookSteps(cookable.steps) : []), [cookable]);

  if (!dish || !cookable || !access) {
    return (
      <Sheet>
        <H2>That dish is no longer available.</H2>
      </Sheet>
    );
  }

  const open = countryIsOpen(dish.country, store.plus);
  const photo = mediaTable.find((m) => m.dish === dish.name);

  if (cooking) {
    return <CookMode cookable={cookable} image={photo?.url} />;
  }

  return (
    <Sheet>
      {photo ? <Photo uri={photo.url} height={220} radius={20} /> : null}

      <View style={{ marginTop: photo ? 16 : 0 }}>
        <Eyebrow>{dish.country} · {dish.region}</Eyebrow>
      </View>
      <H2>{dish.name}</H2>

      <Wrap gap={5}>
        <Tag text={cookable.authored ? 'Girki recipe' : 'Girki home version'} />
        <Tag text={`${cookable.minutes} min`} />
        <Tag text={`${cookable.kcal} kcal`} />
        <Tag text={access.score} />
      </Wrap>

      <P>{cookable.note}</P>

      {!cookable.authored ? (
        <Notice title="How to read this:">
          this is a Girki home version built from the way a {cookable.family} is usually made. It is
          an interpretation, not the traditional recipe — those vary by region, family and season.
        </Notice>
      ) : null}

      {!open ? (
        <Card>
          <SectionLabel>Girki+</SectionLabel>
          <H3>This country is part of the full atlas.</H3>
          <P>
            Twelve countries are open without Girki+. This one, and the other 183, come with Girki+
            — along with all seven planning days.
          </P>
          <Button title="See Girki+" onPress={() => router.present({ type: 'plus' })} />
        </Card>
      ) : null}

      <Card>
        <SectionLabel>What you'll need</SectionLabel>
        <Small>{access.where}</Small>
        {access.rows.map((row) => (
          <View key={row.text} style={styles.ingredient}>
            <Text style={styles.ingredientText}>{row.text}</Text>
            {row.level === 'specialist' ? (
              <Text style={styles.substitution}>or {row.substitution}</Text>
            ) : null}
          </View>
        ))}
        <Button
          title="Add what I need to Shopping"
          variant="secondary"
          onPress={() => {
            const missing = cookable.ingredients.filter((i) => !store.pantryHas(i));
            if (!missing.length) {
              store.toast('You already have everything for this.');
              return;
            }
            store.addShoppingText(missing.join('\n'));
            router.present({ type: 'shopping' });
          }}
        />
      </Card>

      <Card>
        <SectionLabel>Method</SectionLabel>
        <Small>
          {steps.length} steps · about {cookable.minutes} minutes
        </Small>
        {steps.map((step) => (
          <View key={step.index} style={styles.step}>
            <Text style={styles.stepNumber}>{step.index + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepText}>{step.text}</Text>
              <Small>
                {step.timed ? `${step.minutes} min, from the method` : `about ${step.minutes} min`}
              </Small>
            </View>
          </View>
        ))}
        <Button title="Cook this" onPress={() => setCooking(true)} />
      </Card>

      {cookable.nutrients.length ? (
        <Card>
          <SectionLabel>What it brings</SectionLabel>
          <Small>
            Percentages are a guide to what the meal contributes, as part of a varied diet.
            Individual needs differ.
          </Small>
          {cookable.nutrients.map((n) => (
            <View key={n.name} style={styles.nutrientRow}>
              <Text style={styles.nutrientName}>{n.name}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min(100, n.percentage)}%` }]} />
              </View>
              <Text style={styles.nutrientValue}>{n.percentage}%</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {photo?.attributionRequired && photo.author ? (
        <Small>
          Photograph: {photo.author}, {photo.licence}, via {photo.source}.
        </Small>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  ingredient: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  ingredientText: { fontSize: 14, color: colors.ink },
  substitution: { fontSize: 12, color: colors.sage, marginTop: 2 },
  step: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  stepNumber: {
    width: 26, height: 26, borderRadius: 13, textAlign: 'center', lineHeight: 26,
    backgroundColor: colors.sage2, fontSize: 12, fontWeight: '700', color: colors.ink,
  },
  stepText: { fontSize: 14, lineHeight: 21, color: colors.ink },
  nutrientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  nutrientName: { width: 84, fontSize: 12, color: colors.ink },
  barTrack: { flex: 1, height: 7, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: 7, backgroundColor: colors.sage, borderRadius: 99 },
  nutrientValue: { width: 40, fontSize: 12, color: colors.muted, textAlign: 'right' },
});

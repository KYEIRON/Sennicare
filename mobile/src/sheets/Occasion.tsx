import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, P, SectionLabel, Small, Tag, Wrap } from '../components/ui';
import { meals as legacyMeals } from '../lib/data';
import { occasionById, pickForOccasion } from '../lib/girki/occasions';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * An occasion.
 *
 * Not a filter — a way of asking the question people actually ask. "Too tired
 * to cook" and "date night" want different food, and the tip at the bottom is
 * the part that changes the evening.
 */
export function OccasionSheet({ id }: { id: string }) {
  const router = useRouter();
  const store = useStore();
  const occasion = occasionById(id);

  const picks = useMemo(
    () =>
      occasion
        ? pickForOccasion(occasion, 4, {
            plus: store.plus,
            exploredCountries: store.passport.countries,
          })
        : [],
    [occasion, store.plus, store.passport.countries]
  );

  if (!occasion) {
    return (
      <Sheet>
        <H2>That occasion is no longer available.</H2>
      </Sheet>
    );
  }

  return (
    <Sheet>
      <Text style={styles.icon}>{occasion.icon}</Text>
      <Eyebrow>Occasion</Eyebrow>
      <H2>{occasion.name}</H2>
      <P>{occasion.blurb}</P>

      {picks.map((pick) => (
        <Card key={pick.cookable.id}>
          <SectionLabel>{pick.cookable.country}</SectionLabel>
          <Text style={styles.dish}>{pick.cookable.dish}</Text>
          <Wrap gap={5}>
            <Tag text={`${pick.cookable.minutes} min`} />
            <Tag text={pick.cookable.authored ? 'Girki recipe' : 'Girki home version'} />
            {pick.cookable.kcal ? <Tag text={`${pick.cookable.kcal} kcal`} /> : null}
          </Wrap>
          <Button
            title="Look at this one"
            variant="secondary"
            onPress={() => {
              if (pick.dish) router.present({ type: 'girkiDish', id: pick.dish.id });
              else if (pick.mealName) {
                const index = legacyMeals.findIndex((m) => m.name === pick.mealName);
                if (index >= 0) router.present({ type: 'meal', index });
              }
            }}
          />
        </Card>
      ))}

      {!picks.length ? (
        <Card>
          <H3>Nothing fits that right now.</H3>
          <P>
            Try another occasion, or look through Food. Girki would rather show you nothing than
            something that does not suit the evening.
          </P>
        </Card>
      ) : null}

      <View style={styles.tip}>
        <SectionLabel>One thing that helps</SectionLabel>
        <P>{occasion.tip}</P>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 30, marginBottom: 6 },
  dish: { fontFamily: displayFont, fontSize: 22, color: colors.ink, marginVertical: 4 },
  tip: { backgroundColor: colors.warmAlt, borderRadius: 20, padding: 16, marginTop: 16 },
});

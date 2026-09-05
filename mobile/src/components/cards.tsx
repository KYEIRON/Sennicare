import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Country, Meal, WorldTile, continentFor } from '../lib/data';
import { SmartMatch } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';
import { Button, H3, P, Photo, PremiumTag, Small, Tag, Wrap } from './ui';

function tags(meal: Meal) {
  const list = (meal.fits || []).slice(0, 3);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 7 }}>
      <Wrap gap={5}>
        {list.map((t) => (
          <Tag key={t} text={t} />
        ))}
      </Wrap>
    </View>
  );
}

/** `.mealCardV10` — the Today rail card. */
export function MealCard({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  const l = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.mealCard, l.tablet ? { width: '100%' } : { width: l.mealCardWidth }, shadow]}
    >
      <Photo uri={meal.img} height={l.mealCardImage} />
      <View style={{ padding: 14 }}>
        <Text style={[styles.cardTitle, { fontSize: l.tablet ? 18 : 16 }]}>{meal.name}</Text>
        <Text style={styles.cardMeta}>
          {meal.cal} kcal · {meal.meta}
        </Text>
        {tags(meal)}
      </View>
    </Pressable>
  );
}

/** `.foodBig` */
export function FoodCard({
  meal,
  onPress,
  width,
}: {
  meal: Meal;
  onPress: () => void;
  width?: number | string;
}) {
  const l = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.foodCard, width !== undefined ? ({ width } as ViewStyle) : null, shadow]}
    >
      <Photo uri={meal.img} height={l.foodCardImage} />
      <View style={{ padding: l.tablet ? 17 : 13 }}>
        <Text style={[styles.cardTitle, { fontSize: l.tablet ? 19 : 15 }]}>{meal.name}</Text>
        <Text style={styles.cardMeta}>
          {meal.cal} kcal · {meal.meta}
        </Text>
        {tags(meal)}
      </View>
    </Pressable>
  );
}

/** `.cultureCard` — the Today "travel the world" rail. */
export function CultureCard({
  place,
  caption,
  image,
  onPress,
  width,
}: {
  place: string;
  caption: string;
  image?: string;
  onPress: () => void;
  width?: number | string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.cultureCard, width !== undefined ? ({ width } as ViewStyle) : null, shadow]}
    >
      <Photo uri={image} height={132} />
      <View style={{ padding: 12 }}>
        <Text style={styles.cultureTitle}>{place}</Text>
        <Text style={styles.cardMeta}>{caption}</Text>
      </View>
    </Pressable>
  );
}

/** `.worldCard` */
export function WorldCard({
  tile,
  onPress,
  width,
}: {
  tile: WorldTile;
  onPress: () => void;
  width?: number | string;
}) {
  const l = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.worldCard, width !== undefined ? ({ width } as ViewStyle) : null]}
    >
      <Photo uri={tile.img} height={l.worldCardImage} />
      <View style={{ padding: 11 }}>
        <Text style={{ fontFamily: displayFont, fontSize: l.tablet ? 21 : 18, color: colors.ink }}>
          {tile.title}
        </Text>
        <Text style={styles.cardMeta}>{tile.subtitle}</Text>
      </View>
    </Pressable>
  );
}

/** `.atlasCard` */
export function AtlasCard({
  country,
  locked,
  onPress,
  width,
}: {
  country: Country;
  locked: boolean;
  onPress: () => void;
  width?: number | string;
}) {
  const l = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.atlasCard,
        { minHeight: l.tablet ? 170 : 152 },
        width !== undefined ? ({ width } as ViewStyle) : null,
        locked && { opacity: 0.72 },
        shadow,
      ]}
    >
      <View style={styles.atlasTop}>
        <View style={styles.atlasFlag}>
          <Text style={styles.atlasFlagText}>{country.name.slice(0, 2).toUpperCase()}</Text>
        </View>
        {locked ? <PremiumTag /> : <Small>{continentFor(country.name)}</Small>}
      </View>
      <Text style={{ fontFamily: displayFont, fontSize: 21, color: colors.ink, marginTop: 6 }}>
        {country.name}
      </Text>
      <Text style={styles.atlasRegion}>{country.areas.join(' · ')}</Text>
      <View style={{ marginTop: 9 }}>
        <Wrap gap={5}>
          {country.foods.map((food) => (
            <View key={food} style={styles.atlasFood}>
              <Text style={styles.atlasFoodText}>{food}</Text>
            </View>
          ))}
        </Wrap>
      </View>
    </Pressable>
  );
}

/** `.kitchenCard` */
export function KitchenCard({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const l = useLayout();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.kitchenCard, { padding: l.tablet ? 22 : 15 }, shadow]}
    >
      <View style={styles.kitchenIcon} />
      <Text style={{ fontFamily: displayFont, fontSize: l.tablet ? 27 : 23, color: colors.ink }}>
        {title}
      </Text>
      <Text style={styles.cardMeta}>{subtitle}</Text>
    </Pressable>
  );
}

/** `.pantryMatch` */
export function PantryMatchRow({
  match,
  onPress,
  buttonTitle = 'Explore this meal',
}: {
  match: SmartMatch;
  onPress: () => void;
  buttonTitle?: string;
}) {
  const l = useLayout();
  return (
    <View style={styles.pantryMatch}>
      <View style={{ width: l.pantryMatchImage }}>
        <Photo uri={match.meal.img} height={l.pantryMatchImage} radius={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.matchPct}>
          {Math.round(match.score * 100)}% FROM YOUR PANTRY
        </Text>
        <H3>{match.meal.name}</H3>
        <P size={11}>
          {match.meal.cal} kcal · {match.meal.duration} min
        </P>
        <Button title={buttonTitle} variant="secondary" onPress={onPress} />
      </View>
    </View>
  );
}

/** A compact meal row for the swap, move and day picker sheets. */
export function MealRow({
  meal,
  caption,
  buttonTitle,
  onPress,
}: {
  meal: Meal;
  caption: string;
  buttonTitle: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.mealRow}>
      <View style={{ width: 82 }}>
        <Photo uri={meal.img} height={68} radius={14} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: displayFont, fontSize: 17, color: colors.ink }}>{meal.name}</Text>
        <Text style={styles.cardMeta}>{caption}</Text>
        <Button title={buttonTitle} variant="secondary" onPress={onPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mealCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    overflow: 'hidden',
  },
  foodCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 23,
    overflow: 'hidden',
  },
  cultureCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    width: 220,
  },
  cultureTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  worldCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    overflow: 'hidden',
    width: 150,
  },
  cardTitle: { fontWeight: '700', color: colors.ink, lineHeight: 22 },
  cardMeta: { fontSize: 11, color: colors.muted, marginTop: 4, lineHeight: 16 },
  atlasCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
  },
  atlasTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  atlasFlag: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.sage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atlasFlagText: { fontFamily: displayFont, fontSize: 13, color: colors.flagInk },
  atlasRegion: { fontSize: 10, color: colors.muted, marginTop: 4 },
  atlasFood: { backgroundColor: colors.warmAlt, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 7 },
  atlasFoodText: { fontSize: 9, color: colors.atlasInk },
  kitchenCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 21,
  },
  kitchenIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.sage2,
    marginBottom: 8,
  },
  pantryMatch: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  matchPct: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.sage },
  mealRow: {
    flexDirection: 'row',
    gap: 11,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 14,
    marginVertical: 6,
  },
});

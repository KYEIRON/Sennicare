import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Recommendation } from '../lib/discovery';
import { ingredientKey } from '../lib/foodGraph';
import { meals } from '../lib/data';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';
import { Photo, Small, Tag, Wrap } from './ui';

/**
 * One recommendation, in the Nourish card language.
 *
 * A recipe-backed record shows its photograph and offers "Cook recipe". A
 * discovery record from the country atlas shows what Nourish actually knows —
 * dish, country, region — and offers "Explore dish". The two are never blurred.
 */
export function RecommendationCard({
  recommendation,
  onPress,
}: {
  recommendation: Recommendation;
  onPress?: () => void;
}) {
  const router = useRouter();
  const store = useStore();
  const [showWhy, setShowWhy] = useState(false);
  const { record } = recommendation;
  const isRecipe = record.kind === 'recipe';

  function open() {
    store.markCountryExplored(record.country);
    if (onPress) return onPress();
    if (isRecipe && record.mealIndex !== undefined) {
      router.present({ type: 'meal', index: record.mealIndex });
    } else {
      router.present({ type: 'globalDish', id: record.id });
    }
  }

  const meal = isRecipe && record.mealIndex !== undefined ? meals[record.mealIndex] : undefined;

  return (
    <View style={[styles.card, shadow]}>
      <Pressable accessibilityRole="button" onPress={open}>
        {meal ? <Photo uri={meal.img} height={150} /> : null}
        <View style={{ padding: 14 }}>
          <View style={styles.topRow}>
            <Text style={styles.kind}>
              {isRecipe ? 'RECIPE' : 'DISCOVERY'}
            </Text>
            <Text style={styles.place} numberOfLines={1}>
              {record.country === 'Modern home kitchen' ? 'Nourish kitchen' : record.country}
              {record.region && record.country !== record.region ? ` · ${record.region}` : ''}
            </Text>
          </View>

          <Text style={styles.title}>{record.title}</Text>

          {meal ? (
            <Small>
              {meal.cal} kcal · {meal.duration} min · {meal.meta}
            </Small>
          ) : (
            <Small>A dish from the Nourish country atlas.</Small>
          )}

          {record.tags.length ? (
            <View style={{ marginTop: 8 }}>
              <Wrap gap={5}>
                {record.tags.slice(0, 3).map((tag) => (
                  <Tag key={tag} text={tag} />
                ))}
              </Wrap>
            </View>
          ) : null}

          {isRecipe && recommendation.have.length ? (
            <View style={styles.pantryLine}>
              <Text style={styles.pantryHave}>
                ✓ {recommendation.have.length} from your pantry
              </Text>
              {recommendation.need.length ? (
                <Text style={styles.pantryNeed}>
                  · need {recommendation.need.length}
                </Text>
              ) : (
                <Text style={styles.pantryHave}> · nothing to buy</Text>
              )}
            </View>
          ) : null}

          {recommendation.containsAllergens.length ? (
            <Text style={styles.allergen}>
              Contains {recommendation.containsAllergens.join(', ').toLowerCase()}
            </Text>
          ) : null}
          {recommendation.allergenUnknown ? (
            <Text style={styles.allergenUnknown}>
              Not allergen checked — Nourish has no ingredient list for this dish
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={open} style={styles.action}>
          <Text style={styles.actionText}>{isRecipe ? 'Cook recipe' : 'Explore dish'}</Text>
        </Pressable>
        {isRecipe && record.mealIndex !== undefined ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.present({ type: 'planDayPicker', mealIndex: record.mealIndex as number })
            }
            style={styles.action}
          >
            <Text style={styles.actionText}>Add to plan</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowWhy((v) => !v)}
          style={styles.action}
          accessibilityState={{ expanded: showWhy }}
        >
          <Text style={styles.actionText}>{showWhy ? 'Hide' : 'Why this?'}</Text>
        </Pressable>
      </View>

      {showWhy ? (
        <View style={styles.why}>
          {recommendation.reasons.length ? (
            recommendation.reasons.map((reason) => (
              <View key={`${reason.kind}-${reason.detail}`} style={styles.reason}>
                <Text style={styles.reasonLabel}>{reason.label}</Text>
                <Text style={styles.reasonDetail}>{reason.detail}</Text>
              </View>
            ))
          ) : (
            <Small>It matched what you asked for.</Small>
          )}
          {isRecipe && recommendation.need.length ? (
            <View style={styles.reason}>
              <Text style={styles.reasonLabel}>Still needed</Text>
              <Text style={styles.reasonDetail}>
                {recommendation.need.map(ingredientKey).join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 12,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kind: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.sage },
  place: { flex: 1, fontSize: 10, color: colors.muted, textAlign: 'right' },
  title: { fontFamily: displayFont, fontSize: 20, color: colors.ink, marginTop: 4, marginBottom: 4 },
  pantryLine: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  pantryHave: { fontSize: 11, fontWeight: '700', color: colors.sage },
  pantryNeed: { fontSize: 11, color: colors.muted },
  allergen: { fontSize: 10, color: colors.accent, marginTop: 8, fontWeight: '600' },
  allergenUnknown: { fontSize: 10, color: colors.muted, marginTop: 6 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  why: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.warmAlt,
    padding: 14,
    gap: 8,
  },
  reason: { flexDirection: 'row', gap: 10 },
  reasonLabel: { width: 78, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.muted },
  reasonDetail: { flex: 1, fontSize: 12, color: colors.ink, lineHeight: 17 },
});

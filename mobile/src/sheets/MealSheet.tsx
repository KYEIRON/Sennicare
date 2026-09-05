import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import {
  Button, Card, Eyebrow, H2, H3, Notice, P, Photo, RewardCard, Small, Tag, Wrap,
} from '../components/ui';
import { NutrientBar, meals, nutrientBars, nutrientMeaning } from '../lib/data';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/** `openMeal(i)` */
export function MealSheet({ index }: { index: number }) {
  const store = useStore();
  const router = useRouter();
  const meal = meals[index];

  useEffect(() => {
    store.markExplored(index);
    // Only when the sheet opens, exactly as the prototype awards on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!meal) {
    return (
      <Sheet>
        <H2>This meal is no longer available.</H2>
      </Sheet>
    );
  }

  const digestion = store.profile.priorities.includes('Digestive comfort');

  return (
    <Sheet>
      <Photo uri={meal.img} height={280} radius={20} />
      <View style={{ marginTop: 16 }}>
        <Eyebrow>
          {meal.slot} · {meal.duration} min{meal.culture ? ` · ${meal.culture}` : ''}
        </Eyebrow>
      </View>
      <H2>{meal.name}</H2>
      <P>{meal.meta}</P>
      {(meal.fits || []).length ? (
        <Wrap gap={5}>
          {(meal.fits || []).slice(0, 3).map((t) => (
            <Tag key={t} text={t} />
          ))}
        </Wrap>
      ) : null}

      {meal.culture ? (
        <View style={styles.origin}>
          <Text style={styles.originTitle}>Food & culture</Text>
          <Small>
            This dish is here as an invitation to explore its food tradition, not as a single
            definition of a country's cuisine.
          </Small>
        </View>
      ) : null}

      <View style={styles.stats}>
        <StatBox value={String(meal.cal)} label="kcal" />
        <StatBox value={String(meal.duration)} label="minutes" />
        <StatBox value={String(store.tokens)} label="tokens" />
      </View>

      {digestion && meal.fit ? (
        <View style={styles.healthFit}>
          <Text style={styles.originTitle}>For your digestion priority</Text>
          <P size={12}>
            {meal.fit} Individual tolerance varies, so use your own experience as a guide.
          </P>
        </View>
      ) : null}

      <Card>
        <H3>What your meal brings</H3>
        <P size={11}>
          Estimated contribution to daily reference values for the listed nutrients. Values are
          illustrative in this prototype.
        </P>
        {nutrientBars(meal).map((bar) => (
          <NutritionBar key={bar.name} bar={bar} />
        ))}
        <Button
          title="Explore with AI beta"
          variant="secondary"
          onPress={() => router.present({ type: 'aiDecide' })}
        />
      </Card>

      <RewardCard
        eyebrow="Learn as you go"
        title="Know what is on your plate"
        token="+2 tokens"
        text="Explore the nutrient bars and the simple reason each nutrient matters. The aim is curiosity, not perfection."
        button={{
          title: 'I have explored this',
          onPress: () => store.awardTokens(1, 'nutrition explored'),
        }}
      />

      <Card>
        <H3>What you'll need</H3>
        {meal.ingredients.map((item) => (
          <Text key={item} style={styles.ingredient}>
            {item}
          </Text>
        ))}
        <View style={styles.actions}>
          <Button
            title="Add to list"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => store.addShoppingForMeal(index)}
          />
          <Button
            title="Add to my week"
            style={{ flex: 1 }}
            onPress={() => router.present({ type: 'planDayPicker', mealIndex: index })}
          />
        </View>
      </Card>

      <Card>
        <H3>Chef style cooking</H3>
        <P size={11}>
          No assumed cooking knowledge. We tell you what to do, what to look for and roughly how
          long each stage takes.
        </P>
        {meal.steps.map((step, i) => (
          <Text key={step} style={styles.step}>
            <Text style={{ fontWeight: '700' }}>{i + 1}. </Text>
            {step}
          </Text>
        ))}
        <Button title="Start cooking" onPress={() => router.present({ type: 'cooking', index })} />
      </Card>

      <Notice>
        Nutrition information is a demo estimate. If you are managing an allergy or medical
        condition, check ingredients carefully and follow professional advice.
      </Notice>
    </Sheet>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Small>{label}</Small>
    </View>
  );
}

/** `.nutritionBar` */
function NutritionBar({ bar }: { bar: NutrientBar }) {
  return (
    <View style={{ marginTop: 11 }}>
      <View style={styles.barRow}>
        <Text style={styles.barName}>{bar.name}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.min(100, bar.percent)}%` }]} />
        </View>
        <Text style={styles.barPct}>{bar.percent}%</Text>
      </View>
      <Text style={styles.barMeaning}>{nutrientMeaning(bar.name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  origin: {
    backgroundColor: '#f7f4ed',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    padding: 12,
    marginTop: 12,
  },
  originTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  healthFit: {
    backgroundColor: colors.sage2,
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  stats: { flexDirection: 'row', gap: 9, marginTop: 14 },
  statBox: {
    flex: 1,
    backgroundColor: colors.warmAlt,
    borderRadius: 17,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: displayFont, fontSize: 21, color: colors.ink },
  ingredient: {
    fontSize: 13,
    color: colors.ink,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  actions: { flexDirection: 'row', gap: 9 },
  step: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barName: { width: 75, fontSize: 11, color: colors.ink },
  barTrack: { flex: 1, height: 7, borderRadius: 99, backgroundColor: colors.track, overflow: 'hidden' },
  barFill: { height: 7, backgroundColor: colors.sage, borderRadius: 99 },
  barPct: { width: 40, fontSize: 11, color: colors.muted, textAlign: 'right' },
  barMeaning: { fontSize: 10, color: colors.muted, marginLeft: 83, marginTop: 2 },
});

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../components/shell';
import { Button, Eyebrow, H1, LinkButton, P, Photo, PlusGate, Small, SourceNote } from '../components/ui';
import { DAYS, Day, meals } from '../lib/data';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

type PlanView = 'week' | 'calendar' | 'list';

/** The Plan tab — `plan(view)`, with week, calendar and list views. */
export function Plan() {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();
  const [view, setView] = useState<PlanView>('week');

  // A day holding an atlas dish has no verified nutrition, and the summary says so.
  const hasDiscoveries = DAYS.some((day) => {
    const record = store.plannedRecord(day);
    return record?.kind === 'discovery';
  });

  const dayWidth = layout.weekColumns > 1 ? (`${100 / layout.weekColumns - 1}%` as const) : '100%';

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Plan</Eyebrow>
        <H1>Your week, made easier</H1>
        <P>Plan around real life, then change your mind without starting again.</P>
      </View>

      <View style={styles.views}>
        {(['week', 'calendar', 'list'] as PlanView[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: view === option }}
            onPress={() => setView(option)}
            style={[styles.viewBtn, view === option && styles.viewBtnActive]}
          >
            <Text style={[styles.viewText, view === option && { color: '#fff' }]}>
              {option[0].toUpperCase() + option.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.summary}>
        <Stat
          value={store.plannedCalories().toLocaleString()}
          label={
            hasDiscoveries ? 'planned kcal · recipe data pending for discoveries' : 'planned kcal'
          }
        />
        <Stat value={`${store.plannedDaysCount()}/7`} label="days planned" />
        <Stat
          value={store.plus ? 'Full world planning' : '3 days'}
          label={store.plus ? 'Girki+ access' : 'free planning'}
        />
      </View>

      <View style={styles.planWithGirki}>
        <Eyebrow>Plan with Girki</Eyebrow>
        <P size={12}>
          Ask for a whole day and Girki chooses breakfast, lunch and dinner together — variety
          across food cultures, your pantry reused, and the shopping kept small.
        </P>
        <Button
          title="Plan tomorrow with Girki"
          onPress={() => router.present({ type: 'ask', seed: 'Plan my breakfast, lunch and dinner for tomorrow' })}
        />
      </View>

      <View style={styles.insight}>
        <Text style={styles.insightTitle}>Plan around your real cooking rhythm.</Text>
        <P size={12}>
          Research suggests many people plan only a few days ahead, while weekday meals often need
          convenience and weekends can allow more time. Girki should learn each person's actual
          rhythm rather than assume one perfect cooking schedule.
        </P>
      </View>

      {!store.plus ? (
        <PlusGate
          title="Plan across the whole week and the whole world."
          text="Plus unlocks all seven days and lets you choose food discoveries from any country in the Girki atlas."
          buttonTitle="Explore Girki+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : (
        <View style={styles.insight}>
          <Text style={styles.insightTitle}>Your plan is a living list, not a rulebook.</Text>
          <P size={12}>
            Choose a country, choose a meal, use your Pantry, add missing ingredients to Shopping,
            cook when a verified recipe is available, and change your mind later.
          </P>
        </View>
      )}

      {view === 'calendar' ? (
        <View style={styles.calendar}>
          {DAYS.map((day) => (
            <View key={day} style={styles.calCell}>
              <Text style={styles.calHead}>{day.slice(0, 3)}</Text>
              <Text style={styles.calMeal}>{store.plannedRecord(day)?.title || 'Free'}</Text>
            </View>
          ))}
        </View>
      ) : view === 'list' ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          {DAYS.map((day, dayIndex) => {
            const record = store.plannedRecord(day);
            const index = store.plannedMealIndex(day);
            return (
              <View key={day} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>{day}</Text>
                  <Small>
                    {record
                      ? `${record.title}${record.kind === 'discovery' ? ` · ${record.country} · world food` : ''}`
                      : 'Open'}
                  </Small>
                </View>
                {!record ? (
                  store.dayIsLocked(day) ? (
                    <Small>Girki+</Small>
                  ) : (
                    <LinkButton
                      title="Add a meal"
                      onPress={() => router.present({ type: 'mealPickerForDay', dayIndex })}
                    />
                  )
                ) : (
                  <LinkButton
                    title={index !== null ? 'Open meal' : 'Open dish'}
                    onPress={() =>
                      index !== null
                        ? router.present({ type: 'meal', index })
                        : router.present({ type: 'globalDish', id: record.id })
                    }
                  />
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.weekGrid}>
          {DAYS.map((day, dayIndex) => (
            <View key={day} style={{ width: dayWidth }}>
              <WeekDay day={day} dayIndex={dayIndex} />
            </View>
          ))}
        </View>
      )}

      <SourceNote>
        Nutrition and recipe facts are shown only where Girki holds structured content. Discovery
        records stay clearly labelled until they are fully verified.
      </SourceNote>
    </Page>
  );
}

function WeekDay({ day, dayIndex }: { day: Day; dayIndex: number }) {
  const store = useStore();
  const router = useRouter();
  const record = store.plannedRecord(day);
  const index = store.plannedMealIndex(day);
  const meal = index !== null ? meals[index] : undefined;
  const locked = store.dayIsLocked(day);

  function open() {
    if (index !== null) router.present({ type: 'meal', index });
    else if (record) router.present({ type: 'globalDish', id: record.id });
  }

  return (
    <View style={[styles.weekDay, locked && { opacity: 0.7 }]}>
      <View style={styles.weekHead}>
        <Text style={styles.dayName}>{day}</Text>
        <Small>{meal ? `${meal.cal} kcal` : record ? 'World food' : 'Open'}</Small>
      </View>

      {record ? (
        <>
          <Pressable accessibilityRole="button" onPress={open} style={styles.weekMeal}>
            {meal ? (
              <View style={{ width: 72 }}>
                <Photo uri={meal.img} height={56} radius={13} />
              </View>
            ) : (
              <View style={styles.worldMark}>
                <Text style={styles.worldMarkText}>
                  {record.country.slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.weekMealName}>{record.title}</Text>
              <Small>
                {meal
                  ? `${meal.slot} · ${meal.duration} min`
                  : `${record.country} · discovery, recipe not yet verified`}
              </Small>
            </View>
          </Pressable>
          <View style={styles.weekActions}>
            <Button
              title="Swap"
              variant="secondary"
              style={styles.weekAction}
              onPress={() => router.present({ type: 'swap', day })}
            />
            <Button
              title="Move"
              variant="secondary"
              style={styles.weekAction}
              onPress={() => router.present({ type: 'move', day })}
            />
            <Button
              title="Remove"
              variant="secondary"
              style={styles.weekAction}
              onPress={() => store.removePlanMeal(day)}
            />
          </View>
        </>
      ) : locked ? (
        <Small style={{ paddingVertical: 8 }}>Unlock this day with Girki+.</Small>
      ) : (
        <Button
          title={store.plus ? 'Choose a meal or explore the world' : 'Add a meal'}
          variant="secondary"
          onPress={() => router.present({ type: 'mealPickerForDay', dayIndex })}
        />
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Small>{label}</Small>
    </View>
  );
}

const styles = StyleSheet.create({
  views: { flexDirection: 'row', gap: 7, marginTop: 16, marginBottom: 12 },
  viewBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  viewBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  viewText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  summary: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 12,
  },
  statValue: { fontFamily: displayFont, fontSize: 21, color: colors.ink },
  insight: { backgroundColor: colors.warmAlt, borderRadius: 20, padding: 15, marginTop: 12 },
  planWithGirki: {
    backgroundColor: colors.sage2,
    borderRadius: 20,
    padding: 15,
    marginTop: 14,
  },
  insightTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  weekGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  weekDay: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 15,
    minHeight: 120,
  },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  weekMeal: { flexDirection: 'row', gap: 11, alignItems: 'center', marginTop: 10 },
  weekMealName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  worldMark: {
    width: 72,
    height: 56,
    borderRadius: 13,
    backgroundColor: colors.sage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  worldMarkText: { fontFamily: displayFont, fontSize: 18, color: colors.flagInk },
  weekActions: { flexDirection: 'row', gap: 8 },
  weekAction: { flex: 1, paddingHorizontal: 8 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  calCell: {
    width: '13.2%',
    minHeight: 80,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 6,
  },
  calHead: { fontSize: 9, fontWeight: '800', color: colors.muted, textAlign: 'center' },
  calMeal: { fontSize: 8, color: colors.muted, marginTop: 4 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 15,
  },
});

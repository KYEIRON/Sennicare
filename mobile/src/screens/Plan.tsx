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

  const dayWidth = layout.weekColumns > 1 ? (`${100 / layout.weekColumns - 1}%` as const) : '100%';

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Plan</Eyebrow>
        <H1>Your week, made easier</H1>
        <P>
          Plan ahead, change your mind and keep the whole week visible. Nourish should fit the way
          you actually cook.
        </P>
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
        <Stat value={store.plannedCalories().toLocaleString()} label="planned kcal" />
        <Stat value={`${store.plannedDaysCount()}/7`} label="days planned" />
        <Stat
          value={store.plus ? 'Full week' : '3 days'}
          label={store.plus ? 'Nourish+ access' : 'free planning'}
        />
      </View>

      <View style={styles.insight}>
        <Text style={styles.insightTitle}>Plan around your real cooking rhythm.</Text>
        <P size={12}>
          Research suggests many people plan only a few days ahead, while weekday meals often need
          convenience and weekends can allow more time. Nourish should learn each person's actual
          rhythm rather than assume one perfect cooking schedule.
        </P>
      </View>

      {!store.plus ? (
        <PlusGate
          title="Three planning days free. Seven with Nourish+."
          text="Everyone can explore the whole week. Plus unlocks all seven planning days, deeper meal variations and flexible swaps and changes."
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}

      {view === 'calendar' ? (
        <View style={styles.calendar}>
          {DAYS.map((day) => (
            <View key={day} style={styles.calCell}>
              <Text style={styles.calHead}>{day.slice(0, 3)}</Text>
              <Text style={styles.calMeal}>
                {(() => {
                  const index = store.plannedMealIndex(day);
                  return index === null ? 'Free' : meals[index].name;
                })()}
              </Text>
            </View>
          ))}
        </View>
      ) : view === 'list' ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          {DAYS.map((day, dayIndex) => {
            const index = store.plannedMealIndex(day);
            return (
              <View key={day} style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayName}>{day}</Text>
                  <Small>{index === null ? 'Open' : meals[index].name}</Small>
                </View>
                {index === null ? (
                  store.dayIsLocked(day) ? (
                    <Small>Nourish+</Small>
                  ) : (
                    <LinkButton
                      title="Add a meal"
                      onPress={() => router.present({ type: 'mealPickerForDay', dayIndex })}
                    />
                  )
                ) : (
                  <LinkButton
                    title="Open meal"
                    onPress={() => router.present({ type: 'meal', index })}
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
        Prototype nutrition and planning figures are illustrative. Production values require
        verified food data and appropriate review.
      </SourceNote>
    </Page>
  );
}

function WeekDay({ day, dayIndex }: { day: Day; dayIndex: number }) {
  const store = useStore();
  const router = useRouter();
  const index = store.plannedMealIndex(day);
  const locked = store.dayIsLocked(day);

  return (
    <View style={[styles.weekDay, locked && { opacity: 0.7 }]}>
      <View style={styles.weekHead}>
        <Text style={styles.dayName}>{day}</Text>
        <Small>{index === null ? 'Open' : `${meals[index].cal} kcal`}</Small>
      </View>

      {index !== null ? (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.present({ type: 'meal', index })}
            style={styles.weekMeal}
          >
            <View style={{ width: 72 }}>
              <Photo uri={meals[index].img} height={56} radius={13} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.weekMealName}>{meals[index].name}</Text>
              <Small>
                {meals[index].slot} · {meals[index].duration} min
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
        <Small style={{ paddingVertical: 8 }}>Unlock this day with Nourish+.</Small>
      ) : (
        <Button
          title="Add a meal"
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

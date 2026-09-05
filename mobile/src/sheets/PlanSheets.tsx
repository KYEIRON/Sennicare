import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MealRow } from '../components/cards';
import { Sheet } from '../components/shell';
import { Button, Card, ChoiceTile, Eyebrow, H2, H3, Notice, P, PlusGate, Small } from '../components/ui';
import { DAYS, Day, mealRefs } from '../lib/data';
import { FoodRecord, discoveryRecords } from '../lib/foodGraph';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * World planning search.
 *
 * The whole 195-country atlas, searchable by country, region or dish, so a day
 * can hold a food discovery and not only a saved recipe. Placing one is a
 * Nourish+ capability: free members can see the world, Plus members can plan
 * from it.
 */
function WorldPlanSearch({ day }: { day: Day }) {
  const store = useStore();
  const router = useRouter();
  const [query, setQuery] = useState('');

  const pool = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return discoveryRecords;
    return discoveryRecords.filter((record) =>
      `${record.country} ${record.region} ${record.title}`.toLowerCase().includes(q)
    );
  }, [query]);

  const shown = pool.slice(0, store.plus ? 18 : 8);

  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search any country or food"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {shown.length ? (
        shown.map((record) => (
          <WorldPlanCard key={record.id} record={record} day={day} />
        ))
      ) : (
        <View style={styles.empty}>
          <Small>No world food matches yet. Try a country, ingredient or dish.</Small>
        </View>
      )}

      {pool.length > shown.length ? (
        <Notice title={`${pool.length} world matches`}>
          {store.plus
            ? 'Keep refining your search to find the right country or dish.'
            : 'Plus opens the complete world planning library.'}
        </Notice>
      ) : null}

      {!store.plus ? (
        <PlusGate
          title="Plan from any country with Nourish+"
          text="Free can preview the world. Plus lets you place discoveries from the full 195-country food index into any day."
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
    </View>
  );
}

function WorldPlanCard({ record, day }: { record: FoodRecord; day: Day }) {
  const store = useStore();
  const router = useRouter();

  function add() {
    if (!store.plus) {
      router.present({ type: 'plus' });
      return;
    }
    if (store.planGlobalDish(record.id, day)) {
      router.close();
      router.show('plan');
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{record.country}</Eyebrow>
          <Text style={styles.worldTitle}>{record.title}</Text>
          <Small>{record.region} · world food discovery</Small>
        </View>
        {!store.plus ? (
          <View style={styles.plusTag}>
            <Text style={styles.plusTagText}>PLUS</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <Button
          title="Explore"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.present({ type: 'globalDish', id: record.id })}
        />
        <Button title={`Add to ${day}`} style={{ flex: 1 }} onPress={add} />
      </View>
    </Card>
  );
}

/** `openPlanDayPicker(i)` — for a recipe or a world food discovery. */
export function PlanDayPickerSheet({
  mealIndex,
  globalId,
}: {
  mealIndex?: number;
  globalId?: string;
}) {
  const store = useStore();
  const router = useRouter();
  const used = store.plannedDaysCount();
  const isGlobal = globalId !== undefined;

  function place(day: Day) {
    if (isGlobal) {
      if (!store.plus) {
        router.present({ type: 'plus' });
        return;
      }
      if (store.planGlobalDish(globalId as string, day)) router.close();
      return;
    }
    if (store.planMeal(mealIndex as number, day)) router.close();
    else router.present({ type: 'plus' });
  }

  return (
    <Sheet>
      <Eyebrow>Add to your plan</Eyebrow>
      <H2>Where should we put it?</H2>
      <P>
        {store.plus
          ? 'Your full week is open.'
          : isGlobal
          ? 'Planning food from the world atlas is a Nourish+ capability. Free planning covers three days of your saved recipes.'
          : 'Free planning includes three days. You can still view all seven days.'}
      </P>
      <View style={styles.grid}>
        {DAYS.map((day) => {
          const occupied = store.planOccupied(day);
          const locked = (!store.plus && !occupied && used >= 3) || (isGlobal && !store.plus);
          return (
            <ChoiceTile
              key={day}
              title={day}
              subtitle={
                occupied ? 'Replace what is there' : locked ? 'Unlock with Plus' : 'Choose this day'
              }
              locked={locked}
              width="48%"
              onPress={() => (locked ? router.present({ type: 'plus' }) : place(day))}
            />
          );
        })}
      </View>
      {!store.plus && (used >= 3 || isGlobal) ? (
        <PlusGate
          title={isGlobal ? 'Plan from any country with Nourish+' : 'Want the whole week?'}
          text={
            isGlobal
              ? 'Free can explore all 195 countries. Plus lets you place those discoveries into your week.'
              : 'Upgrade to Nourish+ to plan all seven days and change meals freely.'
          }
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
    </Sheet>
  );
}

/** `openMealPickerForDay(dayIndex)` — recipes, or the world. */
export function MealPickerSheet({ dayIndex }: { dayIndex: number }) {
  const store = useStore();
  const router = useRouter();
  const day = DAYS[dayIndex] as Day;
  const occupied = store.planOccupied(day);
  const [tab, setTab] = useState<'recipes' | 'world'>('recipes');
  const options = mealRefs.slice(0, store.plus ? 14 : 5);

  return (
    <Sheet>
      <Eyebrow>{day}</Eyebrow>
      <H2>What would you like to cook?</H2>
      <P>
        {store.plus
          ? 'Choose from your saved recipes or explore food from any country in the world.'
          : 'Choose from the free recipe set, or preview the world. Plus opens full global planning.'}
      </P>

      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'recipes' }}
          onPress={() => setTab('recipes')}
          style={[styles.tab, tab === 'recipes' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'recipes' && { color: '#fff' }]}>My recipes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === 'world' }}
          onPress={() => setTab('world')}
          style={[styles.tab, tab === 'world' && styles.tabActive]}
        >
          <Text style={[styles.tabText, tab === 'world' && { color: '#fff' }]}>World food</Text>
        </Pressable>
      </View>

      {tab === 'recipes' ? (
        <>
          {options.map(({ index, meal }) => (
            <MealRow
              key={index}
              meal={meal}
              caption={`${meal.slot} · ${meal.cal} kcal · ${meal.duration} min`}
              buttonTitle={occupied ? 'Use this' : `Add to ${day}`}
              onPress={() => {
                if (store.planMeal(index, day)) router.close();
                else router.present({ type: 'plus' });
              }}
            />
          ))}
          {!store.plus ? (
            <PlusGate
              title="More recipes with Nourish+"
              text="Plus opens deeper recipe choices and global planning."
              buttonTitle="Explore Nourish+"
              onPress={() => router.present({ type: 'plus' })}
            />
          ) : null}
        </>
      ) : (
        <WorldPlanSearch day={day} />
      )}
    </Sheet>
  );
}

/** `openSwap(day)` */
export function SwapSheet({ day }: { day: Day }) {
  const store = useStore();
  const router = useRouter();
  const current = store.plannedMealIndex(day);
  const alternatives = mealRefs.filter((r) => r.index !== current).slice(0, store.plus ? 8 : 4);

  return (
    <Sheet>
      <Eyebrow>Change {day}</Eyebrow>
      <H2>Find a different meal.</H2>
      <P>Search your recipes or explore the world. Nourish keeps this day in place.</P>
      {alternatives.map(({ index, meal }) => (
        <MealRow
          key={index}
          meal={meal}
          caption={`${meal.cal} kcal · ${meal.duration} min`}
          buttonTitle="Use this"
          onPress={() => {
            if (store.planMeal(index, day)) router.close();
            else router.present({ type: 'plus' });
          }}
        />
      ))}
      <H3>Or explore the world</H3>
      <Small>
        Search any country or dish. Nourish keeps this day in place and swaps what sits in it.
      </Small>
      <WorldPlanSearch day={day} />

      {!store.plus ? (
        <PlusGate
          title="More variations with Nourish+"
          text="Free gives you a smaller set of alternatives. Plus opens a deeper pool and global swaps."
          buttonTitle="See Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
    </Sheet>
  );
}

/** `openMove(day)` */
export function MoveSheet({ day }: { day: Day }) {
  const store = useStore();
  const router = useRouter();
  const choices = DAYS.filter((d) => d !== day && !store.planOccupied(d));

  return (
    <Sheet>
      <Eyebrow>Move {day}</Eyebrow>
      <H2>Choose another day.</H2>
      <P>Keep the meal, change where it sits in your week.</P>
      {choices.length ? (
        <View style={styles.grid}>
          {choices.map((target) => (
            <ChoiceTile
              key={target}
              title={target}
              subtitle="Move meal here"
              width="48%"
              onPress={() => {
                if (store.movePlanMeal(day, target)) router.close();
              }}
            />
          ))}
        </View>
      ) : (
        <P>No open days yet. Remove a meal or choose another day.</P>
      )}
      {!store.plus && store.plannedDaysCount() >= 3 ? (
        <PlusGate
          title="Need another planning day?"
          text="Nourish+ opens all seven days."
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
    </Sheet>
  );
}

/** `openSheet('plan')` */
export function PlanPreferencesSheet() {
  const store = useStore();
  const router = useRouter();
  const [time, setTime] = useState<string | null>(null);
  const [people, setPeople] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);

  function group(
    options: string[],
    value: string | null,
    onChange: (value: string) => void
  ) {
    return (
      <View style={styles.grid}>
        {options.map((option) => (
          <ChoiceTile
            key={option}
            title={option}
            selected={value === option}
            width="48%"
            onPress={() => onChange(option)}
          />
        ))}
      </View>
    );
  }

  return (
    <Sheet>
      <Eyebrow>Build your week</Eyebrow>
      <H2>Make eating easier.</H2>
      <P>Tell Nourish about your real life.</P>
      <H3>Cooking time</H3>
      {group(['10–15 minutes', '20–30 minutes', 'I enjoy cooking', 'Batch cooking'], time, setTime)}
      <H3>Planning for</H3>
      {group(['Just me', 'Two people', 'Family', 'Flexible'], people, setPeople)}
      <H3>Budget</H3>
      {group(['Value', 'Balanced', 'No preference'], budget, setBudget)}
      <Button
        title="Create my week"
        onPress={() => {
          router.close();
          store.toast('Your week has been shaped around your choices.');
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 8 },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  tab: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  tabActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  tabText: { fontSize: 13, color: colors.ink },
  searchRow: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    fontSize: 14,
    color: colors.ink,
  },
  worldTitle: { fontFamily: displayFont, fontSize: 22, color: colors.ink, marginVertical: 3 },
  plusTag: { backgroundColor: colors.ink, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 8 },
  plusTagText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  empty: { backgroundColor: colors.warm, borderRadius: 18, padding: 14, marginVertical: 12 },
});

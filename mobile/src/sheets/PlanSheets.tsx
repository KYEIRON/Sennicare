import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MealRow } from '../components/cards';
import { Sheet } from '../components/shell';
import { Button, ChoiceTile, Eyebrow, H2, H3, P, PlusGate } from '../components/ui';
import { DAYS, Day, mealRefs } from '../lib/data';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';

/** `openPlanDayPicker(i)` */
export function PlanDayPickerSheet({ mealIndex }: { mealIndex: number }) {
  const store = useStore();
  const router = useRouter();
  const used = store.plannedDaysCount();

  return (
    <Sheet>
      <Eyebrow>Add to your plan</Eyebrow>
      <H2>Where should we put it?</H2>
      <P>
        {store.plus
          ? 'Your full week is open.'
          : 'Free planning includes three days. You can still view all seven days.'}
      </P>
      <View style={styles.grid}>
        {DAYS.map((day) => {
          const occupied = store.plannedMealIndex(day) !== null;
          const locked = !store.plus && !occupied && used >= 3;
          return (
            <ChoiceTile
              key={day}
              title={day}
              subtitle={
                occupied ? 'Replace current meal' : locked ? 'Unlock with Plus' : 'Choose this day'
              }
              locked={locked}
              width="48%"
              onPress={() => {
                if (locked) {
                  router.present({ type: 'plus' });
                  return;
                }
                store.planMeal(mealIndex, day);
                router.close();
              }}
            />
          );
        })}
      </View>
      {!store.plus && used >= 3 ? (
        <PlusGate
          title="Want the whole week?"
          text="Upgrade to Nourish+ to plan all seven days and change meals freely."
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
    </Sheet>
  );
}

/** `openMealPickerForDay(dayIndex)` */
export function MealPickerSheet({ dayIndex }: { dayIndex: number }) {
  const store = useStore();
  const router = useRouter();
  const day = DAYS[dayIndex] as Day;
  const occupied = store.plannedMealIndex(day) !== null;
  const options = mealRefs.slice(0, store.plus ? 10 : 5);

  return (
    <Sheet>
      <Eyebrow>{day}</Eyebrow>
      <H2>What would you like to cook?</H2>
      <P>Choose a meal for this day. You can change it later.</P>
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
          title="More meal choices with Nourish+"
          text="Free includes a smaller set. Plus opens a deeper pool of meals for every planning day."
          buttonTitle="Explore Nourish+"
          onPress={() => router.present({ type: 'plus' })}
        />
      ) : null}
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
      <H2>Choose a different meal.</H2>
      <P>Keep the day, change the idea. Your plan updates immediately.</P>
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
      {!store.plus ? (
        <PlusGate
          title="More variations with Nourish+"
          text="Free gives you a smaller set of alternatives. Plus opens a deeper pool."
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
  const choices = DAYS.filter((d) => d !== day && store.plannedMealIndex(d) === null);

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
                store.movePlanMeal(day, target);
                router.close();
              }}
            />
          ))}
        </View>
      ) : (
        <P>No open days yet. Remove a meal or use Nourish+ for the full week.</P>
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
});

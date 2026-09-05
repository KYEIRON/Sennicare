import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ChoiceTile, Eyebrow, H1, H2, P, Photo, Small } from '../components/ui';
import { IMAGES, meals } from '../lib/data';
import { onboardingError } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { useStore } from '../state/store';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

const PRIORITIES = [
  'Everyday health', 'Healthy ageing', 'Heart health', 'Digestive comfort',
  'Blood sugar', 'Healthy weight', 'Strength & muscle', 'Sleep',
  'Menopause', 'Prostate', 'Fertility', 'Recovery',
  'Energy', 'Brain health', 'Bone health', 'Eating more plants',
  'Easier meals', 'Budget friendly food', 'Family meals', 'More variety',
];

const DIETS = [
  'Mostly plant based', 'Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian',
  'Halal', 'Kosher', 'No preference', 'Other',
];

const ALLERGIES = ['Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Fish', 'Shellfish', 'Wheat', 'Soy', 'None'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** The prototype's seven step onboarding, question for question. */
export function Onboarding({ onFinished }: { onFinished: () => void }) {
  const store = useStore();
  const layout = useLayout();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [allergiesTouched, setAllergiesTouched] = useState(false);

  const columns = layout.tablet ? 3 : 2;
  const tileWidth = `${100 / columns - 2}%` as const;

  function next() {
    const error = onboardingError(step, store.profile, allergiesTouched);
    if (error) {
      store.toast(error);
      return;
    }
    if (step < 7) setStep(step + 1);
    else onFinished();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: insets.top + 20,
          paddingBottom: 24,
          maxWidth: layout.contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
        }}
      >
        <Text style={[styles.brand, { fontSize: layout.brand }]}>girki</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(step / 7) * 100}%` }]} />
        </View>

        {step === 1 ? (
          <View>
            <Eyebrow>A better way to decide what to eat</Eyebrow>
            <H1>What should I eat today?</H1>
            <P>
              That is the question Girki is built around. Tell us a little about you and we will
              make the choices more relevant.
            </P>
            <View style={[styles.adHero, shadow]}>
              <Photo uri={IMAGES.onboardingHero} height={270} />
              <View style={{ padding: 20 }}>
                <Eyebrow>A first look</Eyebrow>
                <H2>Food you'll want to discover.</H2>
                <P size={15}>
                  Personalised meal ideas, new foods and simple ways to plan your week without
                  taking the thinking out of your hands.
                </P>
                <AdPoint
                  number="01"
                  title="See something worth trying"
                  text="New meals shaped around what you enjoy."
                />
                <AdPoint
                  number="02"
                  title="Make it fit your life"
                  text="Time, preferences, priorities and ingredients can all shape what appears."
                />
                <AdPoint
                  number="03"
                  title="Keep discovering"
                  text="The more you use Girki, the more useful its recommendations can become."
                />
              </View>
            </View>
            <Small style={{ marginTop: 12 }}>About a minute to get started.</Small>
          </View>
        ) : null}

        {step === 2 ? (
          <View>
            <Eyebrow>About you · 1 of 5</Eyebrow>
            <H1>When were you born?</H1>
            <P>
              Your date of birth helps us understand your life stage and, if you choose, celebrate
              your birthday with something special.
            </P>
            <DateOfBirth />
            <View style={styles.birthdayBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>Birthday surprises</Text>
                <Small>
                  Let Girki prepare a thoughtful food or wellbeing idea around your birthday.
                </Small>
              </View>
              <Switch
                value={store.profile.birthdaySurprises}
                onValueChange={(value) => store.setProfile({ birthdaySurprises: value })}
                trackColor={{ true: colors.sage, false: colors.line }}
              />
            </View>
            <Small style={{ marginTop: 10 }}>
              You can change this later. Your exact date of birth is not shown publicly.
            </Small>
          </View>
        ) : null}

        {step === 3 ? (
          <View>
            <Eyebrow>About you · 2 of 5</Eyebrow>
            <H1>How should Girki understand you?</H1>
            <View style={styles.grid}>
              {['Woman', 'Man', 'Non binary', 'Prefer not to say'].map((option) => (
                <ChoiceTile
                  key={option}
                  title={option}
                  width={tileWidth}
                  selected={store.profile.gender === option}
                  onPress={() => store.setProfile({ gender: option })}
                />
              ))}
            </View>
            <Small style={{ marginTop: 14 }}>
              This can help us make some content more relatable. You can change it later.
            </Small>
          </View>
        ) : null}

        {step === 4 ? (
          <View>
            <Eyebrow>Your priorities · 3 of 5</Eyebrow>
            <H1>What would you like more help with?</H1>
            <P>
              Choose anything that feels relevant. These guide what we put in front of you, not what
              you are told to do.
            </P>
            <View style={styles.grid}>
              {PRIORITIES.map((option) => (
                <ChoiceTile
                  key={option}
                  title={option}
                  width={tileWidth}
                  selected={store.profile.priorities.includes(option)}
                  onPress={() => store.togglePriority(option)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View>
            <Eyebrow>Food preferences · 4 of 5</Eyebrow>
            <H1>How do you like to eat?</H1>
            <P>There is no right answer. We want to understand your pattern, not put you in a box.</P>
            <View style={styles.grid}>
              {DIETS.map((option) => (
                <ChoiceTile
                  key={option}
                  title={option}
                  width={tileWidth}
                  selected={store.profile.diet === option}
                  onPress={() => store.setProfile({ diet: option })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {step === 6 ? (
          <View>
            <Eyebrow>Food safety · 5 of 5</Eyebrow>
            <H1>Anything you must avoid?</H1>
            <P>Allergies are safety constraints, not preferences. Select everything that applies.</P>
            <View style={styles.grid}>
              {ALLERGIES.map((option) => (
                <ChoiceTile
                  key={option}
                  title={option}
                  width={tileWidth}
                  selected={
                    option === 'None'
                      ? allergiesTouched && store.profile.allergies.length === 0
                      : store.profile.allergies.includes(option)
                  }
                  onPress={() => {
                    setAllergiesTouched(true);
                    store.toggleAllergy(option);
                  }}
                />
              ))}
            </View>
            <Small style={{ marginTop: 12 }}>
              Always check packaged food labels and seek professional advice for severe allergies.
            </Small>
          </View>
        ) : null}

        {step === 7 ? <ReadyStep /> : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 12 }}>
        <Button title={step === 7 ? 'See my experience' : 'Continue'} onPress={next} />
        {step > 1 ? (
          <Button title="Back" variant="secondary" onPress={() => setStep(step - 1)} />
        ) : null}
      </View>
    </View>
  );
}

function AdPoint({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <View style={styles.adPoint}>
      <Text style={styles.adPointNumber}>{number}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <P size={12}>{text}</P>
      </View>
    </View>
  );
}

/** `updateReadyPreview()` */
function ReadyStep() {
  const store = useStore();
  const first = store.profile.priorities[0];
  const meal = meals[6];
  return (
    <View>
      <Eyebrow>Your experience</Eyebrow>
      <H1>
        {store.profile.diet === 'Mostly plant based'
          ? 'A flexible, mostly plant based experience.'
          : 'A more personal food experience is ready.'}
      </H1>
      <P>
        {(first ? `${first} can shape what appears first. ` : '') +
          'Here is a first glimpse of what your experience could feel like.'}
      </P>
      <ReadyItem
        number="01"
        title={meal ? meal.name : 'A meal you may like'}
        text={
          meal
            ? `${meal.cal} kcal · ${store.profile.diet || 'Your food preferences'} · ${
                first || 'Everyday health'
              }`
            : 'Based on what you told us.'
        }
      />
      <ReadyItem
        number="02"
        title="Three ideas, not one answer"
        text="Different options give you something to choose from."
      />
      <ReadyItem
        number="03"
        title="A week that learns your pattern"
        text="Save, swap, plan and let your choices shape what appears next."
      />
      <Small style={{ marginTop: 12 }}>
        You stay in control. Preferences can be changed at any time.
      </Small>
    </View>
  );
}

function ReadyItem({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <View style={styles.readyItem}>
      <View style={styles.readyBadge}>
        <Text style={styles.readyBadgeText}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { fontSize: 15 }]}>{title}</Text>
        <P size={12}>{text}</P>
      </View>
    </View>
  );
}

/** The prototype's day / month / year scroller. */
export function DateOfBirth() {
  const store = useStore();
  const now = new Date().getFullYear();
  const parts = (store.profile.dob || '').split('-').map(Number);
  const [year, setYear] = useState(parts[0] || now - 30);
  const [month, setMonth] = useState(parts[1] || 1);
  const [day, setDay] = useState(parts[2] || 1);
  const [touched, setTouched] = useState(Boolean(store.profile.dob));

  function commit(d: number, m: number, y: number) {
    setTouched(true);
    store.setDob(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }

  const years: number[] = [];
  for (let y = now - 18; y >= now - 100; y -= 1) years.push(y);
  const days: number[] = [];
  for (let d = 1; d <= 31; d += 1) days.push(d);

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Wheel
          items={days.map((d) => ({ label: String(d), value: d }))}
          value={day}
          onChange={(v) => {
            setDay(v);
            commit(v, month, year);
          }}
          flex={1}
        />
        <Wheel
          items={MONTHS.map((label, i) => ({ label, value: i + 1 }))}
          value={month}
          onChange={(v) => {
            setMonth(v);
            commit(day, v, year);
          }}
          flex={1.35}
        />
        <Wheel
          items={years.map((y) => ({ label: String(y), value: y }))}
          value={year}
          onChange={(v) => {
            setYear(v);
            commit(day, month, v);
          }}
          flex={1.2}
        />
      </View>
      <Text style={styles.datePreview}>
        {touched ? `${day} ${MONTHS[month - 1]} ${year}` : 'Select your date of birth'}
      </Text>
    </View>
  );
}

function Wheel({
  items,
  value,
  onChange,
  flex,
}: {
  items: { label: string; value: number }[];
  value: number;
  onChange: (value: number) => void;
  flex: number;
}) {
  return (
    <View style={[styles.wheel, { flex }]}>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {items.map((item) => (
          <Pressable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected: item.value === value }}
            onPress={() => onChange(item.value)}
            style={[styles.wheelItem, item.value === value && { backgroundColor: colors.sage2 }]}
          >
            <Text style={styles.wheelText}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontFamily: displayFont, letterSpacing: -0.6, color: colors.ink },
  progressTrack: {
    height: 4,
    backgroundColor: colors.progressTrack,
    borderRadius: 4,
    marginTop: 25,
    marginBottom: 34,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: colors.sage, borderRadius: 4 },
  adHero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: 22,
  },
  adPoint: {
    flexDirection: 'row',
    gap: 11,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  adPointNumber: { fontSize: 10, fontWeight: '800', color: colors.sage, marginTop: 3 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 6 },
  birthdayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  readyItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  readyBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.sage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBadgeText: { fontSize: 9, fontWeight: '800', color: '#4c5848' },
  wheel: {
    height: 132,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  wheelItem: { paddingVertical: 10, alignItems: 'center' },
  wheelText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  datePreview: { textAlign: 'center', color: colors.muted, fontSize: 12, marginVertical: 9 },
});

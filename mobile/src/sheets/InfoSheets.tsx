import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, ChoiceTile, Eyebrow, H2, H3, LegalCard, Notice, P, Small } from '../components/ui';
import { meals } from '../lib/data';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

/** `openSheet('morning')` */
export function MorningSheet() {
  const router = useRouter();
  const first = meals[0];
  return (
    <Sheet>
      <Eyebrow>Your morning</Eyebrow>
      <H2>Start gently</H2>
      <Card>
        <H3>01 · Hydrate</H3>
        <P>Start with a glass of water if that suits you.</P>
      </Card>
      <Card>
        <H3>02 · Breakfast</H3>
        {first ? (
          <P>
            {first.name} · {first.cal} kcal
          </P>
        ) : null}
        <Button
          title="See breakfast"
          variant="secondary"
          onPress={() => router.present({ type: 'meal', index: 0 })}
        />
      </Card>
      <Card>
        <H3>03 · Move</H3>
        <P>A few minutes of walking or stretching.</P>
      </Card>
    </Sheet>
  );
}

/** `openSheet('move')` */
export function MovementSheet() {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  return (
    <Sheet>
      <Eyebrow>Move</Eyebrow>
      <H2>A little movement goes a long way.</H2>
      <P>Choose something that feels realistic today.</P>
      <View style={styles.grid}>
        {['10 minute walk', 'Gentle stretch', 'Mobility', 'Gentle strength'].map((option) => (
          <ChoiceTile
            key={option}
            title={option}
            selected={choice === option}
            width="48%"
            onPress={() => setChoice(option)}
          />
        ))}
      </View>
      <Button title="Done" onPress={router.close} />
    </Sheet>
  );
}

/** `openSheet('breathing')` + `startBreath()` */
export function BreathingSheet() {
  const [phase, setPhase] = useState('Breathe');
  const [running, setRunning] = useState(false);
  const scale = useRef(new Animated.Value(0.9)).current;
  const count = useRef(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      count.current += 1;
      if (count.current >= 23) {
        setRunning(false);
        setPhase('Well done');
        return;
      }
      const inhale = count.current % 2 === 0;
      setPhase(inhale ? 'Inhale' : 'Exhale');
      Animated.timing(scale, {
        toValue: inhale ? 1.15 : 0.9,
        duration: 4600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 5000);
    return () => clearInterval(timer);
  }, [running, scale]);

  return (
    <Sheet>
      <Eyebrow>Reset</Eyebrow>
      <H2>Breathe with Girki</H2>
      <P>Follow the circle. Inhale as it grows. Exhale as it softens.</P>
      <View style={styles.breath}>
        <Animated.View style={[styles.breathCircle, { transform: [{ scale }] }]}>
          <Text style={styles.breathText}>{phase}</Text>
        </Animated.View>
        <Small>A calm 2 minute practice</Small>
      </View>
      <Button
        title="Begin"
        onPress={() => {
          count.current = 0;
          setPhase('Inhale');
          setRunning(true);
          Animated.timing(scale, {
            toValue: 1.15,
            duration: 4600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }).start();
        }}
      />
    </Sheet>
  );
}

/** `openSheet('wellbeingFood')` */
export function WellbeingFoodSheet() {
  const router = useRouter();
  return (
    <Sheet>
      <Eyebrow>Eat well</Eyebrow>
      <H2>Make wellbeing feel practical.</H2>
      <P>
        Use food as part of your everyday rhythm. Explore meals you enjoy, learn what nutrients they
        bring and notice what leaves you feeling well.
      </P>
      <Card>
        <Text style={styles.cardTitle}>Try tonight</Text>
        <P>Choose one meal from Food, then use Nutrition to understand what is in it.</P>
        <Button
          title="Explore food"
          variant="secondary"
          onPress={() => router.closeAndShow('food')}
        />
      </Card>
    </Sheet>
  );
}

/** `openSheet('sleep')` */
export function SleepSheet() {
  const store = useStore();
  const router = useRouter();
  return (
    <Sheet>
      <Eyebrow>Sleep</Eyebrow>
      <H2>A gentler evening.</H2>
      <P>
        There is no universal perfect dinner time. If eating late seems to affect your sleep,
        experiment with giving yourself some time between a larger meal and bed.
      </P>
      <Button
        title="Keep this idea"
        onPress={() => {
          router.close();
          store.toast('Your evening idea is ready.');
        }}
      />
    </Sheet>
  );
}

/** `openSheet('cultureWellbeing')` */
export function CultureWellbeingSheet() {
  const router = useRouter();
  return (
    <Sheet>
      <Eyebrow>Food & culture</Eyebrow>
      <H2>Wellbeing has many traditions.</H2>
      <P>
        From shared meals to tea rituals, fermented foods, slow cooking and family recipes, food
        culture carries ways of caring for ourselves and one another.
      </P>
      <Button
        title="Start with Ghana"
        onPress={() => router.present({ type: 'culture', place: 'Ghana' })}
      />
    </Sheet>
  );
}

type InfoCard = { label?: string; heading?: string; lines: string[] };

/** The remaining `openSheet(type)` panels, word for word. */
function Info({
  eyebrow,
  title,
  intro,
  cards = [],
  notice,
  legal,
  safety,
  button,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  cards?: InfoCard[];
  notice?: { title: string; text: string };
  legal?: { title: string; text: string };
  safety?: string;
  button: string;
}) {
  const router = useRouter();
  return (
    <Sheet>
      <Eyebrow>{eyebrow}</Eyebrow>
      <H2>{title}</H2>
      <P>{intro}</P>
      {notice ? <Notice title={notice.title}>{notice.text}</Notice> : null}
      {cards.map((card, i) => (
        <Card key={i}>
          {card.label ? <Text style={styles.safeLabel}>{card.label.toUpperCase()}</Text> : null}
          {card.heading ? <H3>{card.heading}</H3> : null}
          {card.lines.map((line) => (
            <P key={line} size={12}>
              {line}
            </P>
          ))}
        </Card>
      ))}
      {safety ? (
        <Card>
          <Eyebrow>Evidence based · Nuance matters</Eyebrow>
          <P size={12}>{safety}</P>
        </Card>
      ) : null}
      {legal ? <LegalCard title={legal.title}>{legal.text}</LegalCard> : null}
      <Button title={button} onPress={router.close} />
    </Sheet>
  );
}

export const RecoverySheet = () => (
  <Info
    eyebrow="Recovery"
    title="Find your rhythm again."
    intro="Simple food, movement and rest ideas that can fit around real life."
    cards={[
      {
        heading: 'Start small',
        lines: [
          'Choose an easy meal, drink enough fluids for your needs, and take a gentle walk or stretch if it feels comfortable.',
        ],
      },
    ]}
    button="Done"
  />
);

export const DiscoverySheet = () => (
  <Info
    eyebrow="Girki Discovery · Food & sleep"
    title="Eating immediately before bed?"
    intro="A large meal immediately before sleep can interfere with sleep for some people. It is not a universal rule, and individual responses differ."
    notice={{
      title: 'A practical idea',
      text: 'If you notice late meals affect your sleep, try giving yourself some time between dinner and bed and see what works for you.',
    }}
    safety="Girki presents health information to help you explore your choices. It does not diagnose or treat medical conditions."
    button="Got it"
  />
);

export const AiSleepSheet = () => (
  <Info
    eyebrow="AI beta · Sleep"
    title="Could this meal affect my sleep?"
    intro="Some people notice that meal size, timing, alcohol, caffeine or particular foods change how they sleep. Research does not mean the same effect will happen to everyone."
    cards={[
      {
        label: 'How Girki approaches it',
        lines: [
          'We can explain what evidence suggests, what remains uncertain, and what you might observe in your own routine. We should not tell you that a food will cause or cure a sleep problem.',
        ],
      },
    ]}
    legal={{
      title: 'Important:',
      text: 'AI beta is general information, not medical advice or a diagnosis. If sleep problems are persistent, severe or worrying, speak with a qualified healthcare professional.',
    }}
    button="I understand"
  />
);

export const AiEnergySheet = () => (
  <Info
    eyebrow="AI beta · Everyday patterns"
    title="Understand your own signals."
    intro="Food, sleep, activity, hydration and many other factors can affect how you feel. AI beta can help you organise observations and compare meals without claiming a medical cause."
    cards={[
      {
        heading: 'Try asking',
        lines: [
          '“What changed between these two meals?”',
          '“Which one has more protein or fibre?”',
          '“What ingredients are different?”',
        ],
      },
    ]}
    legal={{
      title: 'No diagnosis.',
      text: 'Girki should never infer a medical condition from a meal, symptom or pattern.',
    }}
    button="Explore safely"
  />
);

export const AiDecideSheet = () => (
  <Info
    eyebrow="AI beta · Decisions"
    title="Help me choose."
    intro="AI can compare practical factors such as ingredients, estimated nutrition, cooking time, pantry coverage and your stated preferences."
    cards={[
      {
        lines: [
          'It can say: “Meal A has more fibre and uses five ingredients already in your pantry.”',
          'It should not say: “Meal A is the treatment you need.”',
        ],
      },
    ]}
    legal={{
      title: 'Your choice stays yours.',
      text: 'Personalised food information is not a substitute for professional dietary or medical advice.',
    }}
    button="Got it"
  />
);

export const AiBetaSheet = () => (
  <Info
    eyebrow="Girki AI beta"
    title="Intelligence that knows its limits."
    intro="AI beta is designed as an explanation and decision support layer across Food, Pantry, Plan and Wellbeing."
    cards={[
      {
        heading: 'What it can help with',
        lines: [
          'Compare meals, explain nutrients in plain language, surface food and culture context, find pantry matches, organise shopping and explore everyday patterns such as sleep timing.',
        ],
      },
      {
        heading: 'What it will not do',
        lines: [
          'Diagnose disease, prescribe treatment, tell someone to stop medication, make emergency decisions, or claim that a food will prevent or cure illness.',
        ],
      },
    ]}
    legal={{
      title: 'Beta notice:',
      text: 'AI generated explanations can be incomplete or wrong. Always check important nutrition, allergy and health information against reliable sources and professional advice where appropriate.',
    }}
    button="I understand"
  />
);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 8 },
  breath: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  breathCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.sage2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathText: { fontSize: 14, fontWeight: '600', color: '#4c5848' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  safeLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.sage },
});

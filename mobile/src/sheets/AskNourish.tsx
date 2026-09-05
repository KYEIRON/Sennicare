import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RecommendationCard } from '../components/discovery';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, P, Small, Wrap } from '../components/ui';
import { Conversation, Turn } from '../lib/conversation';
import { meals } from '../lib/data';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

const QUICK_PROMPTS = [
  'More fish',
  'Plan tomorrow',
  'Use my Pantry',
  'Something new',
  'Breakfast ideas',
];

const QUICK_QUERIES: Record<string, string> = {
  'More fish': 'Find me more fish meals from different countries',
  'Plan tomorrow': 'Plan my breakfast, lunch and dinner for tomorrow',
  'Use my Pantry': 'Use my pantry to suggest a meal',
  'Something new': 'Take me somewhere new',
  'Breakfast ideas': 'Give me breakfast ideas',
};

/**
 * Ask Nourish.
 *
 * Not a chatbot window: each turn is Nourish's own data — recommendation cards,
 * a pantry split, a day plan, a safety note — with a short sentence explaining
 * the approach. The conversation keeps context, so a follow-up refines the
 * answer already on screen.
 */
export function AskNourishSheet({ seed }: { seed?: string }) {
  const store = useStore();
  const router = useRouter();
  const conversation = useRef(new Conversation());
  const [turns, setTurns] = useState<{ question: string; turn: Turn }[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scroller = useRef<ScrollView>(null);

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    setInput('');
    setThinking(true);
    // A frame's pause so the question paints before the answer arrives.
    setTimeout(() => {
      const turn = conversation.current.ask(text, store.discoveryContext());
      setTurns((current) => [...current, { question: text, turn }]);
      setThinking(false);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
    }, 60);
  }

  useEffect(() => {
    if (seed) ask(seed);
    // Seeded once, when the sheet opens from a chip or the search field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const allergies = store.profile.allergies.filter((a) => a && a !== 'None');

  return (
    <Sheet>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Nourish · beta</Eyebrow>
          <H2>Ask Nourish</H2>
          <P>
            Your food guide for planning, Pantry ideas and discovering what is worth trying next.
          </P>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Beta</Text>
        </View>
      </View>

      <View style={styles.risk}>
        <Text style={styles.riskTitle}>Safety first</Text>
        <Small>
          {allergies.length
            ? `Nourish is keeping these allergies in view: ${allergies.join(', ')}. It removes what it knows or suspects contains them, and never tells you a dish is safe — always check packaged labels and preparation.`
            : 'Add allergies and intolerances in your preferences so Nourish can treat them as safety constraints.'}
        </Small>
      </View>

      <Wrap gap={7}>
        {QUICK_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt}
            accessibilityRole="button"
            onPress={() => ask(QUICK_QUERIES[prompt] || prompt)}
            style={styles.quick}
          >
            <Text style={styles.quickText}>{prompt}</Text>
          </Pressable>
        ))}
      </Wrap>

      <ScrollView
        ref={scroller}
        style={styles.thread}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {!turns.length && !thinking ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeMark}>✦</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTitle}>What are you thinking about?</Text>
              <Small>
                Ask me to find a meal, use your Pantry, plan a day, compare dishes or take you
                somewhere new.
              </Small>
            </View>
          </View>
        ) : null}

        {turns.map(({ question, turn }, index) => (
          <View key={`${question}-${index}`}>
            <View style={styles.question}>
              <Text style={styles.questionText}>{question}</Text>
            </View>
            <TurnView turn={turn} onAsk={ask} />
          </View>
        ))}

        {thinking ? (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.sage} />
            <Small>Searching the Nourish food library…</Small>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.prompt}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="What would you like to eat?"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
          onSubmitEditing={() => ask(input)}
        />
        <Button title="Send" onPress={() => ask(input)} style={{ marginTop: 0 }} />
      </View>

      <Small style={{ marginTop: 10 }}>
        Nourish can help you explore choices. It does not diagnose, prescribe or tell you what you
        must eat.
      </Small>

      <Button
        title="How Nourish AI works"
        variant="secondary"
        onPress={() => router.present({ type: 'aiBeta' })}
      />
    </Sheet>
  );
}

/** One answer: the approach, what was understood, the results, the safety note. */
function TurnView({ turn, onAsk }: { turn: Turn; onAsk: (q: string) => void }) {
  const store = useStore();
  const router = useRouter();

  return (
    <View style={styles.answer}>
      <P size={13}>{turn.intro}</P>

      {turn.understood ? (
        <Text style={styles.understood}>Reading it as: {turn.understood}</Text>
      ) : null}

      {turn.plan ? (
        <View style={{ marginTop: 8 }}>
          {turn.plan.slots.map(({ slot, recommendation }) => (
            <View key={slot}>
              <Text style={styles.sectionLabel}>{slot.toUpperCase()}</Text>
              {recommendation ? (
                <RecommendationCard recommendation={recommendation} />
              ) : (
                <Small>Nothing suitable within your allergies and preferences.</Small>
              )}
            </View>
          ))}
          <Card>
            <H3>What this day asks of you</H3>
            <Small>
              Pantry used: {turn.plan.pantryUsed.length} · to buy:{' '}
              {turn.plan.shoppingNeeded.length} · food cultures:{' '}
              {turn.plan.countries.join(', ')}
            </Small>
            {turn.plan.shoppingNeeded.length ? (
              <Button
                title={`Add ${turn.plan.shoppingNeeded.length} items to shopping`}
                onPress={() => {
                  store.addShoppingText(turn.plan!.shoppingNeeded.join('\n'));
                  router.present({ type: 'shopping' });
                }}
              />
            ) : null}
          </Card>
        </View>
      ) : null}

      {turn.result.recipes.length ? (
        <>
          <Text style={styles.sectionLabel}>RECIPE-BACKED MATCHES</Text>
          {turn.result.recipes.map((recommendation) => (
            <RecommendationCard key={recommendation.record.id} recommendation={recommendation} />
          ))}
        </>
      ) : null}

      {turn.result.discoveries.length ? (
        <>
          <Text style={styles.sectionLabel}>MORE FROM THE WORLD</Text>
          {turn.result.discoveries.map((recommendation) => (
            <RecommendationCard key={recommendation.record.id} recommendation={recommendation} />
          ))}
        </>
      ) : null}

      {turn.kind === 'empty' ? (
        <View style={styles.empty}>
          <Small>
            I could not find a match I would stand behind. Tell me one thing to change — an
            ingredient, a time, a country — and I will look again.
          </Small>
        </View>
      ) : null}

      {turn.safety ? (
        <View style={styles.risk}>
          <Text style={styles.riskTitle}>Allergy check</Text>
          <Small>{turn.safety.replace(/^Allergy check: /, '')}</Small>
        </View>
      ) : null}

      {turn.suggestions.length ? (
        <View style={{ marginTop: 10 }}>
          <Wrap gap={7}>
            {turn.suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => onAsk(suggestion)}
                style={styles.suggestion}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </Pressable>
            ))}
          </Wrap>
        </View>
      ) : null}

      <Text style={styles.source}>
        Featured food is only the front door. Recipes come from the Nourish library; discovery
        records come from the 195-country atlas and are shown as dishes to explore, not recipes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  badge: {
    backgroundColor: colors.sage2,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: colors.chipInk },
  risk: {
    backgroundColor: '#f6f1e8',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 13,
    marginVertical: 10,
  },
  riskTitle: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  quick: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quickText: { fontSize: 12, color: colors.ink },
  thread: { maxHeight: 460, marginTop: 12 },
  welcome: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.warmAlt,
    borderRadius: 20,
    padding: 16,
  },
  welcomeMark: { fontSize: 18, color: colors.sage },
  welcomeTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  question: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sage2,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 13,
    marginTop: 14,
    maxWidth: '85%',
  },
  questionText: { fontSize: 13, color: colors.sageDeep },
  answer: { marginTop: 10 },
  understood: { fontSize: 11, color: colors.muted, fontStyle: 'italic', marginBottom: 8 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.muted,
    marginTop: 12,
    marginBottom: 6,
  },
  empty: { backgroundColor: colors.warm, borderRadius: 18, padding: 14, marginTop: 8 },
  suggestion: {
    borderWidth: 1,
    borderColor: colors.sage,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    backgroundColor: colors.card,
  },
  suggestionText: { fontSize: 11, fontWeight: '600', color: colors.sage },
  source: { fontSize: 10, color: colors.muted, lineHeight: 15, marginTop: 12 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  prompt: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginTop: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 15,
    padding: 13,
    fontSize: 14,
    color: colors.ink,
    maxHeight: 90,
  },
});

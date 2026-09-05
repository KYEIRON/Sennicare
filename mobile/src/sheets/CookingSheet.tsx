import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, P, Small } from '../components/ui';
import { chefCue, meals } from '../lib/data';
import { formatTimer } from '../lib/logic';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/** `startCooking(i)` / `renderCooking()` — chef mode with the running timer. */
export function CookingSheet({ index }: { index: number }) {
  const store = useStore();
  const router = useRouter();
  const meal = meals[index];

  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState((meal?.duration || 0) * 60);
  const sizzle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sizzle, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(sizzle, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sizzle]);

  if (!meal) return null;

  const pct = Math.round((step / meal.steps.length) * 100);

  /** `advanceCook()` */
  function advance() {
    if (step < meal.steps.length) {
      setStep(step + 1);
    } else {
      router.close();
      store.markMealComplete(index);
    }
  }

  return (
    <Sheet>
      <View style={styles.hero}>
        <View style={styles.metaRow}>
          <Text style={styles.metaStrong}>COOKING</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meal.duration} min · {meal.name}
          </Text>
        </View>

        <View style={styles.panWrap}>
          <View style={styles.pan}>
            <Animated.View
              style={[
                styles.panFood,
                { transform: [{ scale: sizzle.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }] },
              ]}
            />
          </View>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.sizzle,
                { left: 60 + i * 22 },
                {
                  opacity: sizzle.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.1] }),
                  transform: [
                    { translateY: sizzle.interpolate({ inputRange: [0, 1], outputRange: [-12, -30] }) },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaStrong}>
            {step < meal.steps.length ? `Step ${step + 1} of ${meal.steps.length}` : 'Ready'}
          </Text>
          <Text style={styles.meta}>Chef guidance</Text>
        </View>

        <Text style={styles.timer}>{formatTimer(seconds)}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(8, pct)}%` }]} />
        </View>
      </View>

      <View style={styles.coach}>
        <Text style={styles.coachTitle}>Chef's cue</Text>
        <P size={12}>
          {step < meal.steps.length
            ? chefCue(step)
            : 'Give it a moment to rest, then serve. You made it.'}
        </P>
      </View>

      {meal.steps.map((text, n) => {
        const done = n < step;
        const active = n === step;
        return (
          <View
            key={text}
            style={[
              styles.step,
              active && { backgroundColor: colors.sage2, borderColor: colors.sage },
              done && { opacity: 0.62 },
            ]}
          >
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{done ? '✓' : n + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepLabel}>{active ? 'Now' : done ? 'Done' : 'Next'}</Text>
              <P size={12}>{text}</P>
            </View>
          </View>
        );
      })}

      <View style={styles.controls}>
        <Button title="Back to meal" variant="secondary" style={{ flex: 1 }} onPress={router.close} />
        <Button
          title={step < meal.steps.length ? 'Next step' : 'Finish'}
          style={{ flex: 1 }}
          onPress={advance}
        />
      </View>
      <Small>Tokens are awarded when you finish a meal.</Small>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.cookDark, borderRadius: 26, padding: 20, marginBottom: 18 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  meta: { color: 'rgba(255,255,255,0.7)', fontSize: 10, flexShrink: 1 },
  metaStrong: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  panWrap: { height: 150, alignItems: 'center', justifyContent: 'center' },
  pan: {
    width: 170,
    height: 96,
    borderRadius: 18,
    backgroundColor: '#2c2f2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panFood: { width: 96, height: 44, borderRadius: 40, backgroundColor: colors.accent, opacity: 0.85 },
  sizzle: {
    position: 'absolute',
    top: 40,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  timer: { fontFamily: displayFont, fontSize: 44, letterSpacing: -1, color: '#fff', marginTop: 8 },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: colors.sage2, borderRadius: 99 },
  coach: { backgroundColor: colors.warmAlt, borderRadius: 20, padding: 15 },
  coachTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  step: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 15,
    marginTop: 10,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 11, fontWeight: '800', color: colors.ink },
  stepLabel: { fontSize: 12, fontWeight: '700', color: colors.ink },
  controls: { flexDirection: 'row', gap: 9, marginTop: 12 },
});

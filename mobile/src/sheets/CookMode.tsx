import { useKeepAwake } from 'expo-keep-awake';
import * as Speech from 'expo-speech';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Photo, Small } from '../components/ui';
import { Cookable, accessibility } from '../lib/girki/recipes';
import { CookStep, cookSteps, formatTimer, remainingMinutes } from '../lib/girki/cook';
import { timerAlert } from '../lib/girki/notifications';
import { cancelCategory, schedule } from '../lib/girki/notifyPlatform';
import { clipById, techniqueFor } from '../lib/girki/technique';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * Cook mode.
 *
 * The heart of the product: one step at a time, a timer taken from the method
 * itself, the photograph running full bleed behind glass controls, and the
 * screen kept awake because this is used with wet hands at a hob.
 *
 * Touch targets are 50px here rather than the usual 44px, for the same reason.
 */
export function CookMode({ cookable, image }: { cookable: Cookable; image?: string | null }) {
  const router = useRouter();
  const store = useStore();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  useKeepAwake();

  const steps = useMemo(() => cookSteps(cookable.steps), [cookable.steps]);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(steps[0] ? steps[0].minutes * 60 : 0);
  const [running, setRunning] = useState(false);
  const [voice, setVoice] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const finished = index >= steps.length;
  const step: CookStep | undefined = steps[index];
  const announced = useRef(-1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  /**
   * A backgrounded timer still has to fire — this is the functional
   * notification, and the brief says it must be reliable. It is scheduled when
   * the timer starts and cancelled the moment it stops, so a paused timer never
   * shouts from a pocket.
   */
  useEffect(() => {
    if (!running || !step) {
      cancelCategory('timer').catch(() => {});
      return;
    }
    const fireAt = new Date(Date.now() + secondsLeft * 1000);
    schedule(timerAlert(index + 1, cookable.dish, fireAt), {
      settings: store.notifications,
      now: new Date(),
      sentAt: [],
      cooksLogged: store.passport.cooks,
    }).catch(() => {});
    // Only when the run state changes: rescheduling every second would spam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, index]);

  useEffect(() => () => { cancelCategory('timer').catch(() => {}); }, []);

  // The timer for the step you are on, not for the recipe as a whole.
  useEffect(() => {
    if (!running || !step) return undefined;
    const tick = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(tick);
          setRunning(false);
          store.toast(`Step ${index + 1} is up.`);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [running, step, index, store]);

  useEffect(() => {
    setSecondsLeft(step ? step.minutes * 60 : 0);
    setRunning(false);
  }, [index, step]);

  // Spoken guidance: the instruction, then what to look for.
  useEffect(() => {
    if (!voice || !step || announced.current === index) return;
    announced.current = index;
    Speech.stop();
    Speech.speak(`Step ${index + 1}. ${step.text}`, { rate: 0.92 });
  }, [voice, step, index]);

  useEffect(() => () => { Speech.stop(); }, []);

  const clipId = step ? techniqueFor(step.text, { name: cookable.dish, ingredients: cookable.ingredients }) : null;
  const clip = clipId ? clipById(clipId) : undefined;
  const access = useMemo(() => accessibility(cookable.ingredients), [cookable.ingredients]);

  function finish() {
    Speech.stop();
    cancelCategory('timer').catch(() => {});
    store.recordCook({
      dish: cookable.dish,
      country: cookable.country,
      at: new Date().toISOString(),
      kcal: cookable.kcal,
      minutes: cookable.minutes,
    });
    router.close();

    // The permission ask waits until a first meal is cooked, never on launch.
    if (!store.notifications.permissionGranted && store.passport.cooks === 0) {
      setTimeout(() => router.present({ type: 'notificationsAsk' }), 600);
    }
  }

  const heroHeight = landscape ? height * 0.5 : Math.min(height * 0.42, 380);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={router.close}>
      <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
          stickyHeaderIndices={[]}
        >
          {/* Full bleed hero: information rests on the photograph over a scrim. */}
          <View style={{ height: heroHeight }}>
            <Photo uri={image || undefined} height={heroHeight} />
            <View style={styles.scrim} pointerEvents="none" />

            <View style={[styles.glassRow, { top: insets.top + 10 }]}>
              <GlassButton label="Close" onPress={() => { Speech.stop(); router.close(); }} />
              <View style={{ flex: 1 }} />
              <GlassButton
                label={voice ? 'Voice on' : 'Voice off'}
                onPress={() => {
                  if (voice) Speech.stop();
                  setVoice(!voice);
                  announced.current = -1;
                }}
                active={voice}
              />
            </View>

            <View style={[styles.heroFoot, { paddingBottom: 18 }]}>
              <Text style={styles.heroCountry}>
                {cookable.country.toUpperCase()}
                {cookable.authored ? '' : ' · GIRKI HOME VERSION'}
              </Text>
              <Text style={styles.heroTitle}>{cookable.dish}</Text>
              <Text style={styles.heroMeta}>
                {finished
                  ? 'Ready'
                  : `Step ${index + 1} of ${steps.length} · about ${remainingMinutes(steps, index)} min left`}
              </Text>
            </View>
          </View>

          {/* The instruction, in the display serif, large enough to glance at. */}
          <View style={styles.body}>
            {finished ? (
              <>
                <Text style={styles.instruction}>That is it. Serve it while it is hot.</Text>
                <Text style={styles.cue}>
                  {cookable.authored
                    ? cookable.note
                    : 'This was a Girki home version. The tradition it comes from has more to it.'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.instruction} accessibilityRole="header">
                  {step?.text}
                </Text>
                <View style={styles.cueBox}>
                  <Text style={styles.cueLabel}>WHAT TO LOOK FOR</Text>
                  <Text style={styles.cue}>{step?.cue}</Text>
                  {clip ? (
                    <Text style={styles.clip} accessibilityLabel={`Technique: ${clip.alt}`}>
                      Technique · {clip.alt}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.timerRow}>
                  <Text style={styles.timer}>{formatTimer(secondsLeft)}</Text>
                  <View style={{ flex: 1 }}>
                    <Small>
                      {step?.timed
                        ? 'Timer taken from the method.'
                        : 'No timing in this step — this is a guide, not a rule.'}
                    </Small>
                  </View>
                </View>

                <View style={styles.timerButtons}>
                  <BigButton
                    label={running ? 'Pause' : secondsLeft === 0 ? 'Reset' : 'Start timer'}
                    onPress={() => {
                      if (secondsLeft === 0) setSecondsLeft((step?.minutes || 0) * 60);
                      else setRunning(!running);
                    }}
                  />
                  <BigButton
                    label="Add a minute"
                    tone="quiet"
                    onPress={() => setSecondsLeft((s) => s + 60)}
                  />
                </View>
              </>
            )}

            {/* The step track: where you are, and what is coming. */}
            <View style={styles.track}>
              {steps.map((s, i) => (
                <Pressable
                  key={`${s.index}-${s.text.slice(0, 12)}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Step ${i + 1}`}
                  accessibilityState={{ selected: i === index }}
                  onPress={() => setIndex(i)}
                  style={[
                    styles.trackDot,
                    i === index && styles.trackDotActive,
                    i < index && styles.trackDotDone,
                  ]}
                >
                  <Text style={[styles.trackNumber, i === index && { color: colors.card }]}>
                    {i < index ? '✓' : i + 1}
                  </Text>
                </Pressable>
              ))}
            </View>

            {access.specialist.length ? (
              <View style={styles.subs}>
                <Text style={styles.cueLabel}>IF YOU CANNOT FIND SOMETHING</Text>
                {access.specialist.map((row) => (
                  <Text key={row.text} style={styles.sub}>
                    {row.term}: {row.substitution}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Controls stay put, 50px targets, within thumb reach. */}
        <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
          <BigButton
            label="Back"
            tone="quiet"
            disabled={index === 0}
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <BigButton
            label={finished ? 'Finish' : index === steps.length - 1 ? 'Last step done' : 'Next step'}
            onPress={() => (finished ? finish() : setIndex((i) => i + 1))}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Glass control over an image: translucent, blurred, never obscuring. */
function GlassButton({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.glass, active && styles.glassActive]}
      hitSlop={8}
    >
      <Text style={[styles.glassText, active && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function BigButton({
  label, onPress, tone = 'solid', disabled,
}: {
  label: string; onPress: () => void; tone?: 'solid' | 'quiet'; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.big,
        tone === 'quiet' ? styles.bigQuiet : styles.bigSolid,
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={[styles.bigText, tone === 'quiet' && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,14,0.28)',
  },
  glassRow: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', gap: 10 },
  glass: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  glassActive: { backgroundColor: '#fff' },
  glassText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  heroFoot: { position: 'absolute', left: 18, right: 18, bottom: 0 },
  heroCountry: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { fontFamily: displayFont, fontSize: 34, color: '#fff', marginTop: 4 },
  heroMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4 },
  body: { paddingHorizontal: 18, paddingTop: 20 },
  instruction: { fontFamily: displayFont, fontSize: 26, lineHeight: 34, color: colors.ink },
  cueBox: { backgroundColor: colors.warmAlt, borderRadius: 20, padding: 15, marginTop: 16 },
  cueLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.muted },
  cue: { fontSize: 14, lineHeight: 21, color: colors.ink, marginTop: 6 },
  clip: { fontSize: 12, color: colors.sage, marginTop: 8, fontWeight: '600' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  timer: { fontFamily: displayFont, fontSize: 46, letterSpacing: -1, color: colors.ink },
  timerButtons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  track: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  trackDot: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
  },
  trackDotActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  trackDotDone: { backgroundColor: colors.sage2, borderColor: colors.sage2 },
  trackNumber: { fontSize: 13, fontWeight: '700', color: colors.ink },
  subs: { marginTop: 22, backgroundColor: colors.warm, borderRadius: 18, padding: 14 },
  sub: { fontSize: 13, color: colors.ink, marginTop: 6 },
  controls: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 12,
    backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line,
  },
  big: { flex: 1, minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bigSolid: { backgroundColor: colors.ink },
  bigQuiet: { backgroundColor: colors.sage2 },
  bigText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

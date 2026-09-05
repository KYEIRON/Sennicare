import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodCard } from '../components/cards';
import { Button, Eyebrow, H1, H3, P, Photo, Rail, Small } from '../components/ui';
import { IMAGES, meals } from '../lib/data';
import { isValidEmail } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/** "Keep your Nourish experience." — V28's account screen. */
export function Auth({ onBack, onEnter }: { onBack: () => void; onEnter: () => void }) {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function enter() {
    setTimeout(onEnter, 450);
  }

  function demoAuth(provider: string) {
    store.signIn(provider);
    store.toast(`Demo account created with ${provider}.`);
    enter();
  }

  /** `submitEmailAuth()` */
  function submit() {
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    const trimmed = name.trim();
    if (mode === 'signup' && !trimmed) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    if (trimmed) store.setProfile({ name: trimmed });
    store.signIn('Email', email.trim(), trimmed);
    store.toast(mode === 'signup' ? 'Your account is ready.' : 'Signed in successfully.');
    enter();
  }

  // `updateAuthCopy()` shows meals 0, 4 and 7.
  const rail = [0, 4, 7].filter((i) => meals[i]);

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
        <Text style={[styles.brand, { fontSize: layout.brand }]}>nourish</Text>
        <View style={styles.progress} />

        <Eyebrow>A first taste of your Nourish</Eyebrow>
        <H1>Keep your Nourish experience.</H1>
        <P>
          We've started shaping a world around what you told us. Take a look before you decide.
        </P>

        <View style={[styles.hero, shadow]}>
          <Photo uri={IMAGES.authHero} height={205} />
          <View style={{ padding: 16 }}>
            <Eyebrow>Made around you</Eyebrow>
            <Text style={styles.heroTitle}>Three places to start.</Text>
            <P>
              One familiar. One different. One that might introduce you to something you have never
              made before.
            </P>
          </View>
        </View>

        <View style={{ gap: 8, marginTop: 14 }}>
          <Button title="Continue with Apple" onPress={() => demoAuth('Apple')} />
          <Button title="Continue with email" variant="secondary" onPress={() => setShowEmail(true)} />
        </View>

        <View style={styles.foodTitle}>
          <H3>What could be on your table?</H3>
          <Small>Tap anything to explore</Small>
        </View>

        <Rail columns={layout.tablet ? 3 : 0}>
          {rail.map((index) => (
            <FoodCard
              key={index}
              meal={meals[index]}
              width={layout.tablet ? '100%' : 205}
              onPress={() => router.present({ type: 'meal', index })}
            />
          ))}
        </Rail>

        <View style={styles.stats}>
          <Stat value={String(Math.max(1, store.profile.priorities.length))} label="personal priorities" />
          <Stat value="3" label="starting ideas" />
          <Stat value="∞" label="ways to explore" />
        </View>

        <Small style={{ marginTop: 12 }}>
          Your choices can change what you discover over time. You stay in control.
        </Small>

        <View style={styles.dietPill}>
          <Text style={styles.dietPillText}>{store.profile.diet || 'Flexible eating'}</Text>
        </View>

        {showEmail ? (
          <View style={{ marginTop: 16 }}>
            {mode === 'signup' ? (
              <Field label="Name" placeholder="Your name" value={name} onChange={setName} />
            ) : null}
            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              email
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title={mode === 'signup' ? 'Create my account' : 'Sign in'} onPress={submit} />
            <Pressable accessibilityRole="button" onPress={() => setShowEmail(false)}>
              <Text style={styles.subtle}>Back to other options</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Provider mark="●" title="Continue with Apple" onPress={() => demoAuth('Apple')} />
            <Provider mark="G" title="Continue with Google" onPress={() => demoAuth('Google')} />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Small>or</Small>
              <View style={styles.dividerLine} />
            </View>
            <Button
              title="Continue with email"
              onPress={() => {
                setMode('signup');
                setShowEmail(true);
              }}
            />
            <Small>By continuing, you agree to Nourish's Terms and Privacy Policy.</Small>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMode('signin');
                setShowEmail(true);
              }}
            >
              <Text style={styles.subtle}>
                Already have an account? <Text style={{ fontWeight: '700', color: colors.ink }}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 12 }}>
        <Button title="Back" variant="secondary" onPress={onBack} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Provider({ mark, title, onPress }: { mark: string; title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.provider}>
      <Text style={styles.providerMark}>{mark}</Text>
      <Text style={styles.providerText}>{title}</Text>
    </Pressable>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  email,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  email?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize={email ? 'none' : 'words'}
        keyboardType={email ? 'email-address' : 'default'}
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontFamily: displayFont, letterSpacing: -0.6, color: colors.ink },
  progress: { height: 4, backgroundColor: colors.sage, borderRadius: 4, marginVertical: 25 },
  hero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: 16,
  },
  heroTitle: { fontFamily: displayFont, fontSize: 25, color: colors.ink, marginTop: 5 },
  foodTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 18,
    marginBottom: 8,
  },
  stats: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: displayFont, fontSize: 22, color: colors.ink },
  statLabel: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 4 },
  dietPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sage2,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    marginTop: 10,
  },
  dietPillText: { fontSize: 11, fontWeight: '700', color: colors.chipInk },
  provider: {
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  providerMark: { fontSize: 15, fontWeight: '700', color: colors.ink },
  providerText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 15,
    padding: 14,
    fontSize: 15,
    color: colors.ink,
  },
  error: { fontSize: 11, fontWeight: '600', color: '#b4553f', marginBottom: 6 },
  subtle: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 10 },
});

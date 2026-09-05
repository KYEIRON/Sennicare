import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, ChoiceTile, Eyebrow, H2, H3, LegalCard, Notice, P, Small } from '../components/ui';
import { DateOfBirth } from '../screens/Onboarding';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

/** `openSheet('profile')` */
export function ProfileSheet() {
  const store = useStore();
  const router = useRouter();

  function group(
    options: string[],
    selected: (option: string) => boolean,
    onPress: (option: string) => void
  ) {
    return (
      <View style={styles.grid}>
        {options.map((option) => (
          <ChoiceTile
            key={option}
            title={option}
            selected={selected(option)}
            width="48%"
            onPress={() => onPress(option)}
          />
        ))}
      </View>
    );
  }

  return (
    <Sheet>
      <Eyebrow>Your account</Eyebrow>
      <H2>Your preferences</H2>
      <P>Keep Girki relevant as your life changes.</P>

      <H3>Date of birth</H3>
      <DateOfBirth />

      <View style={styles.birthdayBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Birthday surprises</Text>
          <Small>A thoughtful idea around your birthday.</Small>
        </View>
        <Switch
          value={store.profile.birthdaySurprises}
          onValueChange={(value) => store.setProfile({ birthdaySurprises: value })}
          trackColor={{ true: colors.sage, false: colors.line }}
        />
      </View>

      <H3>Gender</H3>
      {group(
        ['Woman', 'Man', 'Non binary', 'Prefer not to say'],
        (o) => store.profile.gender === o,
        (o) => store.setProfile({ gender: o })
      )}

      <H3>How you like to eat</H3>
      <Small>You can prefer mostly plant based food without giving up meat or fish.</Small>
      {group(
        ['Mostly plant based', 'Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'No preference'],
        (o) => store.profile.diet === o,
        (o) => store.setProfile({ diet: o })
      )}

      <H3>Allergies</H3>
      {group(
        ['Peanuts', 'Tree nuts', 'Milk', 'Eggs', 'Fish', 'Shellfish', 'Wheat', 'Soy', 'None'],
        (o) => (o === 'None' ? store.profile.allergies.length === 0 : store.profile.allergies.includes(o)),
        (o) => store.toggleAllergy(o)
      )}

      <Button
        title="Save preferences"
        onPress={() => {
          store.toast('Preferences saved.');
          router.closeAndShow('today');
        }}
      />
    </Sheet>
  );
}

/** `openSheet('plus')` — the subscription experience. */
export function PlusSheet() {
  const store = useStore();
  const router = useRouter();
  const active = store.plus;
  const plan = store.plusPlan;

  const benefits: [string, string][] = [
    ['All 195 countries', 'Free opens twelve countries. Girki+ opens the rest of the atlas, and every dish in it is cookable.'],
    ['The whole week', 'Free plans three days. Girki+ plans seven, and lets you plan food from any country.'],
    ['Global food intelligence', 'Ask for fish, breakfast, salads or a cuisine and search the whole library, not the featured screen.'],
    ['Personalised planning', 'Build a full week around your Pantry, preferences, time and variety.'],
    ['Smart Pantry & shopping', 'Use what you already have and see what is genuinely missing.'],
    ['Deeper discovery', 'Explore all 195 countries, regional foodways and verified cultural context.'],
    ['More flexibility', 'More swaps, alternatives and ways to reshape a plan without starting again.'],
    ['Ask Girki', 'Ask, refine and compare. Girki uses your context rather than acting like a generic chatbot.'],
  ];

  return (
    <Sheet>
      <Eyebrow>Girki+</Eyebrow>
      <View style={styles.plusHero}>
        <View style={styles.plusMark}>
          <Text style={styles.plusMarkText}>NOURISH+</Text>
        </View>
        <H2>{active ? 'Your wider Girki experience.' : 'More discovery. Less mental load.'}</H2>
        <P>
          {active
            ? 'Your Plus access is active in this prototype.'
            : 'Unlock the parts of Girki designed to make the everyday food decision easier.'}
        </P>
      </View>

      <View style={styles.planToggle}>
        <PlanOption
          title="Monthly"
          price="£4.99"
          selected={plan === 'monthly'}
          onPress={() => store.setPlusPlan('monthly')}
        />
        <PlanOption
          title="Yearly"
          price="£39.99 · save"
          selected={plan === 'yearly'}
          onPress={() => store.setPlusPlan('yearly')}
        />
      </View>

      <Card>
        {benefits.map(([title, text]) => (
          <View key={title} style={styles.benefit}>
            <Text style={styles.tick}>✓</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{title}</Text>
              <P size={12}>{text}</P>
            </View>
          </View>
        ))}
      </Card>

      <Notice title="What free gives you:">
        twelve countries, every one of them fully cookable, with the written recipes, the method,
        the timings and the shopping list. Three planning days. The gate is how much of the world
        and how many days, never the quality of the food.
      </Notice>

      {active ? (
        <>
          <Notice title="Plus is active">
            Your prototype subscription is set to {plan === 'yearly' ? 'yearly' : 'monthly'}{' '}
            billing. Real App Store and Google Play billing replaces this demo state in production,
            and entitlement is verified server-side rather than trusted from the device.
          </Notice>
          <Button title="Manage subscription" onPress={() => router.present({ type: 'plusManage' })} />
        </>
      ) : (
        <>
          <Button
            title="Start 14 day free trial"
            onPress={() => {
              store.setPlus(true);
              store.toast('Your 14 day Girki+ trial has started in this prototype.');
            }}
          />
          <Small style={{ marginTop: 8 }}>
            14 day trial, then {plan === 'yearly' ? '£39.99/year' : '£4.99/month'}. Payment and
            cancellation are handled by the platform in production. This prototype takes no payment.
          </Small>
        </>
      )}

      <Button title="Not now" variant="secondary" onPress={router.close} />
    </Sheet>
  );
}

function PlanOption({
  title,
  price,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.planOption, selected && styles.planOptionActive]}
    >
      <Text style={[styles.planTitle, selected && { color: '#fff' }]}>{title}</Text>
      <Text style={[styles.planPrice, selected && { color: 'rgba(255,255,255,0.8)' }]}>{price}</Text>
    </Pressable>
  );
}

/** `openSheet('plusManage')` */
export function PlusManageSheet() {
  const store = useStore();
  const router = useRouter();

  return (
    <Sheet>
      <Eyebrow>Girki+ · Manage</Eyebrow>
      <H2>Your subscription</H2>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.benefitTitle}>Girki+</Text>
            <Small>
              {store.plusPlan === 'yearly' ? '£39.99/year' : '£4.99/month'} · prototype active
            </Small>
          </View>
          <View style={styles.activeTag}>
            <Text style={styles.activeTagText}>ACTIVE</Text>
          </View>
        </View>
      </Card>

      <View style={styles.planToggle}>
        <PlanOption
          title="Monthly"
          price="£4.99"
          selected={store.plusPlan === 'monthly'}
          onPress={() => store.setPlusPlan('monthly')}
        />
        <PlanOption
          title="Yearly"
          price="£39.99"
          selected={store.plusPlan === 'yearly'}
          onPress={() => store.setPlusPlan('yearly')}
        />
      </View>

      <Button
        title="Manage billing"
        onPress={() => {
          router.close();
          store.toast('In production this opens the App Store or Google Play settings.');
        }}
      />
      <Button
        title="Turn off Plus demo"
        variant="secondary"
        onPress={() => {
          store.setPlus(false);
          router.close();
        }}
      />
    </Sheet>
  );
}

/** `openSheet('legal')` */
export function LegalSheet() {
  const router = useRouter();
  const sections: [string, string][] = [
    ['Health information', 'Content should use cautious language such as “may”, “can” and “evidence suggests”. Personal circumstances can change what is appropriate.'],
    ['Allergies', 'Allergy settings are treated as safety constraints, but no app can guarantee the absence of allergens or cross contamination. Users must check labels and trusted preparation information.'],
    ['Medical conditions', 'Labels such as “kidney aware” are discovery aids, not clinical clearance. Condition specific advice requires appropriately qualified professionals.'],
    ['AI', 'AI beta can explain and compare information but must not diagnose, prescribe or provide emergency guidance.'],
    ['Images & culture', 'Prototype images must be individually rights checked, correctly matched to the dish and credited where required. Cultural descriptions should be reviewed for accuracy and should never imply that one dish represents an entire people or country.'],
  ];

  return (
    <Sheet>
      <Eyebrow>Safety & legal boundaries</Eyebrow>
      <H2>Designed with care.</H2>
      <P>
        Girki is a food discovery and wellbeing product. It should provide general information and
        practical tools, not medical diagnosis or treatment.
      </P>
      <Card>
        {sections.map(([title, text]) => (
          <View key={title}>
            <H3>{title}</H3>
            <P size={12}>{text}</P>
          </View>
        ))}
      </Card>
      <LegalCard title="Production requirement:">
        Terms, Privacy Policy, consent language, data retention, content governance, clinical review
        where needed, advertising rules and jurisdiction specific legal review must be completed
        before launch.
      </LegalCard>
      <Button title="Close" onPress={router.close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  plusHero: { marginBottom: 12 },
  plusMark: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 9,
    marginBottom: 8,
  },
  plusMarkText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#fff' },
  planToggle: { flexDirection: 'row', gap: 9, marginVertical: 10 },
  planOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  planOptionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  planTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  planPrice: { fontSize: 11, color: colors.muted, marginTop: 4 },
  benefit: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tick: { fontSize: 13, fontWeight: '800', color: colors.sage },
  benefitTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  activeTag: { backgroundColor: colors.sage2, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 9 },
  activeTagText: { fontSize: 9, fontWeight: '800', color: colors.chipInk },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 8 },
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
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
});

import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
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
      <P>Keep Nourish relevant as your life changes.</P>

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

/** `openSheet('plus')` */
export function PlusSheet() {
  const store = useStore();
  const router = useRouter();

  const features = [
    ['Smart pantry', 'Tell Nourish what you have and find meals that use it first.'],
    ['Camera & receipt scans', 'Turn a cupboard photo, fridge photo or shopping receipt into a pantry or shopping list.'],
    ['Ingredient rescue', '“My spinach expires tomorrow. What can I make?”'],
    ['Smart shopping', 'Combine your weekly meals, pantry and missing ingredients into one practical list.'],
    ['World food atlas', 'Explore 195 countries, deeper regional foodways and a growing editorial library.'],
    ['More ways to choose', 'See more meal variations at breakfast, lunch and dinner, with richer swaps and personalised alternatives.'],
    ['Budget & waste reduction', 'Plan around what you own and buy only what is needed.'],
  ];

  return (
    <Sheet>
      <Eyebrow>Nourish+</Eyebrow>
      <H2>Your world becomes wider. Your kitchen becomes smarter.</H2>
      <P>
        Nourish+ is designed to unlock depth and save real mental effort, not to make the free
        experience feel broken.
      </P>

      <Card>
        {features.map(([title, text]) => (
          <View key={title} style={{ marginBottom: 6 }}>
            <H3>{title}</H3>
            <P size={12}>{text}</P>
          </View>
        ))}
      </Card>

      <Notice title="Free access:">
        explore the world of food, keep a pantry and shopping list, and plan up to three days.
        Nourish+: unlock all 195 countries, deeper regional foodways, more meal variations, all
        seven planning days, flexible swaps, intelligent scans, pantry aware planning and deeper
        food intelligence.
      </Notice>

      <Button
        title="Start 14 day trial"
        onPress={() => {
          store.setPlus(true);
          router.closeAndShow('plan');
        }}
      />
      <Button
        title="Keep free version"
        variant="secondary"
        onPress={() => {
          store.setPlus(false);
          router.closeAndShow('plan');
        }}
      />
      <Small style={{ marginTop: 10 }}>$4.99/month or $39.99/year after trial.</Small>
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
        Nourish is a food discovery and wellbeing product. It should provide general information and
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

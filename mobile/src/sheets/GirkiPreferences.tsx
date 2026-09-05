import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, ChoiceTile, Eyebrow, H2, H3, P, SectionLabel, Small, Wrap } from '../components/ui';
import { preferences as vocab } from '../lib/girki/content';
import { NotificationCategory } from '../lib/girki/notifications';
import { requestPermission } from '../lib/girki/notifyPlatform';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

const HOUSEHOLD = [
  { id: 'one', label: 'Just me' },
  { id: 'two', label: 'Two of us' },
  { id: 'family', label: 'A family' },
  { id: 'varies', label: 'It varies' },
];

const CATEGORY_COPY: { id: NotificationCategory; title: string; detail: string }[] = [
  { id: 'cookReminder', title: 'Cook reminder', detail: 'Forty-five minutes before a meal you planned, and only if you planned one.' },
  { id: 'shoppingNudge', title: 'Shopping', detail: 'Saturday morning, if the week is planned and the list is not done.' },
  { id: 'birthday', title: 'Birthday', detail: 'One dish, chosen properly, on the morning. Only if you gave a date.' },
  { id: 'newCountry', title: 'New country', detail: 'When your passport reaches somewhere new.' },
  { id: 'weeklyDiscovery', title: 'Weekly discovery', detail: 'One dish a week from a region you have not cooked from.' },
  { id: 'timer', title: 'Cooking timers', detail: 'When a step finishes and the app is in the background. This one is functional.' },
];

/**
 * Preferences.
 *
 * Regions, cooking confidence, weeknight time, household, an optional birthday,
 * and per-category notification control. Nothing here is asked twice: signup
 * already covers diet and allergies.
 */
export function GirkiPreferencesSheet() {
  const store = useStore();
  const router = useRouter();
  const girki = store.profile.girki;
  const [asking, setAsking] = useState(false);

  function toggleRegion(region: string) {
    const next = girki.regions.includes(region)
      ? girki.regions.filter((r) => r !== region)
      : [...girki.regions, region];
    store.setGirkiPreferences({ regions: next });
  }

  function toggleInterest(interest: string) {
    const next = girki.foodInterests.includes(interest)
      ? girki.foodInterests.filter((i) => i !== interest)
      : [...girki.foodInterests, interest];
    store.setGirkiPreferences({ foodInterests: next });
  }

  return (
    <Sheet>
      <Eyebrow>Your Girki</Eyebrow>
      <H2>Preferences</H2>
      <P>Change these whenever your life changes. Nothing here is fixed.</P>

      <SectionLabel>Parts of the world</SectionLabel>
      <Small>Girki leans towards these. It will still show you everywhere else.</Small>
      <View style={{ marginTop: 8 }}>
        <Wrap gap={8}>
          {vocab.regions.map((region) => (
            <Pressable
              key={region}
              accessibilityRole="button"
              accessibilityState={{ selected: girki.regions.includes(region) }}
              onPress={() => toggleRegion(region)}
              style={[styles.chip, girki.regions.includes(region) && styles.chipOn]}
            >
              <Text style={[styles.chipText, girki.regions.includes(region) && { color: '#fff' }]}>
                {region}
              </Text>
            </Pressable>
          ))}
        </Wrap>
      </View>

      <H3>How much cooking have you done?</H3>
      <View style={styles.grid}>
        {vocab.confidence.map((option) => (
          <ChoiceTile
            key={option.id}
            title={option.label}
            subtitle={option.detail}
            selected={girki.confidence === option.id}
            width="100%"
            onPress={() => store.setGirkiPreferences({ confidence: option.id })}
          />
        ))}
      </View>

      <H3>On a weeknight</H3>
      <View style={styles.grid}>
        {vocab.weeknight.map((option) => (
          <ChoiceTile
            key={option.id}
            title={option.label}
            selected={girki.weeknightMinutes === option.id}
            width="48%"
            onPress={() => store.setGirkiPreferences({ weeknightMinutes: option.id })}
          />
        ))}
      </View>

      <H3>Who are you cooking for?</H3>
      <View style={styles.grid}>
        {HOUSEHOLD.map((option) => (
          <ChoiceTile
            key={option.id}
            title={option.label}
            selected={girki.household === option.id}
            width="48%"
            onPress={() => store.setGirkiPreferences({ household: option.id })}
          />
        ))}
      </View>

      <H3>More of what?</H3>
      <View style={{ marginTop: 4 }}>
        <Wrap gap={7}>
          {vocab.foodInterests.map((interest) => (
            <Pressable
              key={interest}
              accessibilityRole="button"
              accessibilityState={{ selected: girki.foodInterests.includes(interest) }}
              onPress={() => toggleInterest(interest)}
              style={[styles.chip, girki.foodInterests.includes(interest) && styles.chipOn]}
            >
              <Text style={[styles.chipText, girki.foodInterests.includes(interest) && { color: '#fff' }]}>
                {interest}
              </Text>
            </Pressable>
          ))}
        </Wrap>
      </View>

      <H3>How adventurous?</H3>
      <View style={styles.grid}>
        {vocab.discoveryLevels.map((option) => (
          <ChoiceTile
            key={option.id}
            title={option.label}
            subtitle={option.detail}
            selected={girki.discovery === option.id}
            width="100%"
            onPress={() => store.setGirkiPreferences({ discovery: option.id })}
          />
        ))}
      </View>

      <Card>
        <SectionLabel>Notifications</SectionLabel>
        <H3>Only about food.</H3>
        <P>
          Girki will not count the days since you last cooked, and will never send anything about
          weight. Outside cooking timers, it sends at most two a week.
        </P>

        {!store.notifications.permissionGranted ? (
          <>
            <Small>
              {store.passport.cooks
                ? 'Turn these on whenever you like.'
                : 'Girki asks for permission after your first cook, not before.'}
            </Small>
            <Button
              title={asking ? 'Asking…' : 'Turn notifications on'}
              onPress={async () => {
                setAsking(true);
                const granted = await requestPermission();
                store.setNotificationSettings({ permissionGranted: granted });
                setAsking(false);
                store.toast(granted ? 'Notifications are on.' : 'Left off. Nothing will be sent.');
              }}
            />
          </>
        ) : (
          CATEGORY_COPY.map((category) => (
            <View key={category.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{category.title}</Text>
                <Small>{category.detail}</Small>
              </View>
              <Switch
                value={store.notifications.enabled[category.id]}
                onValueChange={() => store.toggleNotificationCategory(category.id)}
                trackColor={{ true: colors.sage, false: colors.line }}
              />
            </View>
          ))
        )}
      </Card>

      <Button title="Done" onPress={router.close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 8, marginBottom: 6 },
  chip: {
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card,
    borderRadius: 999, paddingVertical: 9, paddingHorizontal: 13,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, color: colors.ink },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
});

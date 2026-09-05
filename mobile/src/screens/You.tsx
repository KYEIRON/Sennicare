import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Page } from '../components/shell';
import {
  Button, Card, Eyebrow, H1, H3, LinkButton, P, Pill, Small, Wrap,
} from '../components/ui';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

/** The You tab — `you()`. */
export function You() {
  const store = useStore();
  const router = useRouter();

  const summary =
    [store.profile.name, store.profile.age, store.profile.gender].filter(Boolean).join(' · ') ||
    'Personalise Girki';

  const pills = [
    ...(store.profile.priorities.length ? store.profile.priorities.slice(0, 4) : ['Health priorities']),
    store.profile.diet || 'Food preferences',
  ];

  function confirmReset() {
    Alert.alert(
      'Reset demo experience?',
      'This clears your profile, pantry, shopping list, plan and tokens on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: store.resetDemo },
      ]
    );
  }

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Your Girki</Eyebrow>
        <H1>Made for you</H1>
        <P>Change your preferences whenever your life or priorities change.</P>
      </View>

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Eyebrow>Profile</Eyebrow>
            <H3>{summary}</H3>
          </View>
          <LinkButton title="Edit" onPress={() => router.present({ type: 'profile' })} />
        </View>
        <View style={{ marginTop: 10 }}>
          <Wrap gap={7}>
            {pills.map((pill) => (
              <Pill key={pill} text={pill} />
            ))}
          </Wrap>
        </View>
      </Card>

      <Card>
        <Eyebrow>Your kitchen</Eyebrow>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <H3>Pantry & shopping</H3>
            <Small>
              {store.pantry.length} at home · {store.shopping.length} to buy
            </Small>
          </View>
          <LinkButton title="Open" onPress={() => router.present({ type: 'pantry' })} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            title="Pantry"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.present({ type: 'pantry' })}
          />
          <Button
            title="Shopping list"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => router.present({ type: 'shopping' })}
          />
        </View>
      </Card>

      <Card>
        <Eyebrow>Girki+</Eyebrow>
        <H3>{store.plus ? 'Girki+ is active' : 'More personal. Less mental load.'}</H3>
        <P>
          Smart pantry planning, scans, ingredient rescue, personalised weeks, swaps, advanced
          nutrient goals and family planning.
        </P>
        <Button
          title={store.plus ? 'Manage Girki+' : 'Try free for 14 days'}
          onPress={() => router.present({ type: 'plus' })}
        />
        <Small style={{ marginTop: 8 }}>$4.99/month or $39.99/year after trial.</Small>
      </Card>

      <Card>
        <Eyebrow>Safety & legal</Eyebrow>
        <H3>Food and health deserve care.</H3>
        <P>
          Girki is designed to help people discover food and general nutrition information, not to
          diagnose, treat or give medical advice.
        </P>
        <Button
          title="Read safety boundaries"
          variant="secondary"
          onPress={() => router.present({ type: 'legal' })}
        />
      </Card>

      <Card>
        <Eyebrow>Prototype</Eyebrow>
        <Text accessibilityRole="button" onPress={confirmReset} style={styles.reset}>
          Reset demo experience
        </Text>
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reset: { fontSize: 13, fontWeight: '600', color: colors.ink, marginTop: 8 },
});

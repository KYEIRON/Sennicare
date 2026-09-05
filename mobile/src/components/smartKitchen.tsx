import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { useLayout } from '../lib/responsive';
import { colors } from '../theme/tokens';
import { Button, Eyebrow, H3, P, PremiumTag, Wrap } from './ui';

/** `.smartKitchen` — the pantry teaser reused on Food, Pantry and Wellbeing. */
export function SmartKitchenBlock({ text }: { text: string }) {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();
  const items = store.pantry.slice(0, 6);

  return (
    <View style={[styles.block, { padding: layout.tablet ? 24 : 18, borderRadius: layout.tablet ? 28 : 24 }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Eyebrow>Smart kitchen</Eyebrow>
          <H3>What can I make?</H3>
        </View>
        <PremiumTag />
      </View>
      <P size={12}>{text}</P>
      <View style={{ marginVertical: 8 }}>
        <Wrap gap={7}>
          {(items.length ? items : ['Add pantry items']).map((item) => (
            <View key={item} style={styles.mini}>
              <Text style={styles.miniText}>{item}</Text>
            </View>
          ))}
        </Wrap>
      </View>
      <Button
        title="Find meals from my pantry"
        onPress={() => router.present({ type: 'smartKitchen' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#eef1ea',
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 16,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  mini: { backgroundColor: colors.warm, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 9 },
  miniText: { fontSize: 10, color: colors.miniInk },
});

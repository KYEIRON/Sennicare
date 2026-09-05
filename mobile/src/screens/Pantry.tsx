import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KitchenCard, PantryMatchRow } from '../components/cards';
import { Page } from '../components/shell';
import { SmartKitchenBlock } from '../components/smartKitchen';
import { Card, Eyebrow, H1, Notice, P, Section, SectionLabel } from '../components/ui';
import { smartMatches } from '../lib/logic';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';

/** The Pantry tab — `pantryPage()`. */
export function Pantry() {
  const store = useStore();
  const router = useRouter();
  const matches = smartMatches(store.pantry).slice(0, 3);

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Your kitchen</Eyebrow>
        <H1>Know what you have. Discover what you can make.</H1>
        <P>
          Pantry is where your kitchen starts. Keep what is already at home here, keep what you want
          to buy in Shopping, and let Nourish connect the two.
        </P>
      </View>

      <View style={styles.row}>
        <KitchenCard
          title="Pantry"
          subtitle={`${store.pantry.length} items at home`}
          onPress={() => router.present({ type: 'pantry' })}
        />
        <KitchenCard
          title="Shopping"
          subtitle={`${store.shopping.length} items to buy`}
          onPress={() => router.present({ type: 'shopping' })}
        />
      </View>

      <SmartKitchenBlock
        text={
          store.pantry.length
            ? `You have ${store.pantry.length} things at home. Start with what you already own.`
            : 'Add a few things you already have, then see what you can make.'
        }
      />

      <Section>
        <SectionLabel>You could make this</SectionLabel>
        <Card>
          <P size={11}>
            Beautiful, pantry matched ideas should make the next meal feel obvious without taking
            away the joy of discovery.
          </P>
          {matches.map((match) => (
            <PantryMatchRow
              key={match.index}
              match={match}
              onPress={() => router.present({ type: 'meal', index: match.index })}
            />
          ))}
        </Card>
      </Section>

      <Section>
        <SectionLabel>Bring your kitchen with you</SectionLabel>
        <View style={styles.row}>
          <KitchenCard
            title="Add items"
            subtitle="Type what you have."
            onPress={() => router.present({ type: 'pantry' })}
          />
          <KitchenCard
            title="Shopping"
            subtitle="Build your next shop."
            onPress={() => router.present({ type: 'shopping' })}
          />
        </View>
      </Section>

      <View style={{ marginTop: 20 }}>
        <Notice title="Prototype:">
          camera and receipt scanning are demonstrated with confirmation. Production AI should never
          silently change your pantry or shopping list.
        </Notice>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
});

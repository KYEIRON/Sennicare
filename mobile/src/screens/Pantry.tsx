import React from 'react';
import { StyleSheet, View } from 'react-native';
import { KitchenCard } from '../components/cards';
import { RecommendationCard } from '../components/discovery';
import { Page } from '../components/shell';
import { SmartKitchenBlock } from '../components/smartKitchen';
import { Button, Card, Eyebrow, H1, Notice, P, Section, SectionLabel } from '../components/ui';
import { pantryMatches } from '../lib/discovery';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';

/** The Pantry tab — `pantryPage()`. */
export function Pantry() {
  const store = useStore();
  const router = useRouter();
  // Pantry-first: ranked by how much of the meal you already own, with the
  // missing items named rather than implied.
  const matches = pantryMatches(store.discoveryContext(), 3);

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Your kitchen</Eyebrow>
        <H1>Know what you have. Discover what you can make.</H1>
        <P>
          Pantry is where your kitchen starts. Keep what is already at home here, keep what you want
          to buy in Shopping, and let Girki connect the two.
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
        <P size={11}>
          Ranked by how much of each meal is already in your kitchen. Every card says what you have
          and what you would still need.
        </P>
        <View style={{ marginTop: 10 }}>
          {matches.map((match) => (
            <RecommendationCard key={match.record.id} recommendation={match} />
          ))}
        </View>
        <Button
          title="Ask Girki what to cook tonight"
          variant="secondary"
          onPress={() =>
            router.present({
              type: 'ask',
              seed: store.pantry.length
                ? `I have ${store.pantry.slice(0, 8).join(', ')}. What can I make?`
                : 'Use my pantry to suggest a meal',
            })
          }
        />
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

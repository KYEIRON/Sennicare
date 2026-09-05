import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, Notice, P, SectionLabel, Small, Tag, Wrap } from '../components/ui';
import { recordsById, recordsByCountry } from '../lib/foodGraph';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

/**
 * A dish from the country atlas.
 *
 * This is deliberately not a recipe screen. It shows exactly what Girki holds
 * — the dish, its country, its region and what was inferred — and offers ways
 * to go deeper. A recipe appears only when there is a verified one.
 */
export function GlobalDishSheet({ id }: { id: string }) {
  const router = useRouter();
  const store = useStore();
  const record = recordsById.get(id);

  if (!record) {
    return (
      <Sheet>
        <H2>That dish is no longer available.</H2>
      </Sheet>
    );
  }

  const alsoFrom = (recordsByCountry.get(record.country) || []).filter((r) => r.id !== record.id);

  return (
    <Sheet>
      <Eyebrow>Food discovery · {record.country}</Eyebrow>
      <H2>{record.title}</H2>
      <P>
        {record.region} · a dish held in Girki's country food index.
      </P>

      {record.tags.length ? (
        <Wrap gap={5}>
          {record.tags.map((tag) => (
            <Tag key={tag} text={tag} />
          ))}
        </Wrap>
      ) : null}

      <Card>
        <SectionLabel>What Girki knows</SectionLabel>
        <H3>Start with the food, then go deeper.</H3>
        <P>
          Girki holds this dish, the country it belongs to and its region. It does not hold a
          verified recipe, ingredient list, nutrition or image rights for it yet — so it is offered
          as a dish to explore rather than a recipe to cook.
        </P>
        <View style={styles.knowledge}>
          <Row label="Country" value={record.country} />
          <Row label="Region" value={record.region} />
          <Row label="Likely at" value={record.slots.join(' or ')} inferred />
          {record.tags.length ? (
            <Row label="Reads as" value={record.tags.join(', ')} inferred />
          ) : null}
          <Row label="Source" value={record.provenance} />
          <Row label="Status" value="Traditional dish · recipe not yet verified" />
        </View>
      </Card>

      <Notice title="Recipe status">
        This dish can be added to your plan as a discovery. A production recipe needs verified
        ingredients, method, nutrition, image rights and cultural review before Girki will present
        cooking instructions for it.
      </Notice>

      {record.allergens.length ? (
        <Notice title="Possible allergens:">
          the name of this dish suggests {record.allergens.join(', ').toLowerCase()}. Girki has no
          ingredient list for it, so this is a flag, not a check. Never treat it as a clearance.
        </Notice>
      ) : (
        <Notice title="Not allergen checked:">
          Girki has no verified ingredient list for this dish, so it cannot tell you what it
          contains. Check the recipe you cook from.
        </Notice>
      )}

      <Card>
        <SectionLabel>Plan it</SectionLabel>
        <H3>Put this discovery in your week.</H3>
        <P>
          {store.plus
            ? 'Add it to any day. You can keep exploring the world and change your mind later.'
            : 'Planning food from the world atlas is a Girki+ capability. Exploring it is always free.'}
        </P>
        <Button
          title="Add to a day"
          onPress={() =>
            store.plus
              ? router.present({ type: 'planDayPicker', globalId: record.id })
              : router.present({ type: 'plus' })
          }
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: 9 }}>
        <Button
          title="Tell me about it"
          style={{ flex: 1 }}
          onPress={() =>
            router.present({
              type: 'ask',
              seed: `Tell me about ${record.title} from ${record.country}`,
            })
          }
        />
        <Button
          title="Find similar food"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() =>
            router.present({
              type: 'ask',
              seed: `Find dishes similar to ${record.title}`,
            })
          }
        />
      </View>

      {alsoFrom.length ? (
        <Card>
          <SectionLabel>Also from {record.country}</SectionLabel>
          {alsoFrom.map((other) => (
            <Text
              key={other.id}
              accessibilityRole="button"
              onPress={() => {
                store.markCountryExplored(other.country);
                router.present({ type: 'globalDish', id: other.id });
              }}
              style={styles.link}
            >
              {other.title} ›
            </Text>
          ))}
          <Button
            title={`Explore ${record.country}`}
            variant="secondary"
            onPress={() => router.present({ type: 'country', name: record.country })}
          />
        </Card>
      ) : null}

      <Notice title="Editorial standard:">
        Girki distinguishes a traditional dish from a Girki adaptation, and will not invent a
        recipe or a history to fill a result.
      </Notice>
    </Sheet>
  );
}

function Row({ label, value, inferred }: { label: string; value: string; inferred?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowValue}>{value}</Text>
        {inferred ? <Small>read from the dish name, not verified</Small> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  knowledge: { marginTop: 8, gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  rowLabel: { width: 80, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.muted },
  rowValue: { flex: 1, fontSize: 13, color: colors.ink },
  link: {
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});

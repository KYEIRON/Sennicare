import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Sheet } from '../components/shell';
import { Button, Card, Eyebrow, H2, H3, Notice, P, Photo, Small } from '../components/ui';
import { smartMatches } from '../lib/logic';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';

/** `openSheet('pantry')` */
export function PantrySheet() {
  const store = useStore();
  const router = useRouter();
  const [entry, setEntry] = useState('');

  return (
    <Sheet>
      <Eyebrow>Your kitchen</Eyebrow>
      <H2>Pantry</H2>
      <P>
        Keep a simple picture of what you already have at home. Nourish uses this to reduce
        unnecessary shopping and find meals you can make now.
      </P>

      <View style={styles.inputRow}>
        <TextInput
          value={entry}
          onChangeText={setEntry}
          placeholder="Add an item you have"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={() => {
            store.addPantryItem(entry);
            setEntry('');
          }}
        />
        <Button
          title="Add"
          style={{ marginTop: 0 }}
          onPress={() => {
            store.addPantryItem(entry);
            setEntry('');
          }}
        />
      </View>

      <ScanBox
        title="Scan your kitchen"
        text="Take a photo of your cupboard, fridge or recent shop."
        onPress={() => store.demoScan(false)}
      />

      <Card>
        {store.pantry.length ? (
          store.pantry.map((item, index) => (
            <ListRow
              key={item}
              title={item}
              subtitle="At home"
              onRemove={() => store.removePantryItem(index)}
            />
          ))
        ) : (
          <P>Your pantry is empty. Add a few things you already have.</P>
        )}
      </Card>

      <Button
        title="What can I make with these?"
        onPress={() => router.present({ type: 'smartKitchen' })}
      />
      <Small style={{ marginTop: 10 }}>
        For the prototype, scans use a demo set of items. Production would use image recognition and
        user confirmation before updating the pantry.
      </Small>
    </Sheet>
  );
}

/** `openSheet('shopping')` */
export function ShoppingSheet() {
  const store = useStore();
  const router = useRouter();
  const [entry, setEntry] = useState('');

  return (
    <Sheet>
      <Eyebrow>Your kitchen</Eyebrow>
      <H2>Shopping list</H2>
      <P>
        Everything you want to buy, including ingredients Nourish adds from your meal plan.
      </P>

      <TextInput
        value={entry}
        onChangeText={setEntry}
        placeholder="Add an item, or paste your shopping list one item per line"
        placeholderTextColor={colors.muted}
        multiline
        style={[styles.input, { height: 84, textAlignVertical: 'top' }]}
      />
      <Button
        title="Add"
        onPress={() => {
          store.addShoppingText(entry);
          setEntry('');
        }}
      />

      <ScanBox
        title="Bring in your shop"
        text="Photograph a receipt or import a list."
        onPress={() => store.demoScan(true)}
      />

      <Card>
        {store.shopping.length ? (
          store.shopping.map((item, index) => {
            const done = store.shoppingDone.includes(item);
            return (
              <ListRow
                key={item}
                title={item}
                subtitle={done ? 'Bought' : 'To buy'}
                checked={done}
                onToggle={() => store.toggleShoppingItem(index)}
                onRemove={() => store.removeShoppingItem(index)}
              />
            );
          })
        ) : (
          <P>Your list is empty. Add items or open a meal and add its ingredients.</P>
        )}
      </Card>

      <Button
        title="I already have some of these"
        variant="secondary"
        onPress={() => router.present({ type: 'pantry' })}
      />
    </Sheet>
  );
}

/** `renderSmartKitchen()` */
export function SmartKitchenSheet() {
  const store = useStore();
  const router = useRouter();
  const matches = smartMatches(store.pantry);

  return (
    <Sheet>
      <Eyebrow>Smart kitchen</Eyebrow>
      <H2>What can I make?</H2>
      <P>
        Start with what is already in your pantry. Nourish compares ingredients, your food
        preferences and the kind of meal you are exploring.
      </P>

      <View style={styles.aiResult}>
        <Text style={styles.aiTitle}>Quiet intelligence</Text>
        <P size={11}>
          These are suggestions, not instructions. You stay in control of what you cook, buy and
          eat.
        </P>
      </View>

      {matches.map((match) => (
        <Card key={match.index}>
          <Photo uri={match.meal.img} height={150} radius={18} />
          <Text style={styles.matchPct}>
            {Math.round(match.score * 100)}% FROM YOUR PANTRY
          </Text>
          <H3>{match.meal.name}</H3>
          <P size={12}>
            {match.meal.cal} kcal · {match.meal.meta}
          </P>
          <Text style={[styles.needs, match.missing.length ? null : { color: colors.sage }]}>
            {match.missing.length
              ? `Need ${match.missing.length} more: ${match.missing.slice(0, 3).join(', ')}`
              : 'You have everything needed.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 9 }}>
            <Button
              title="See meal"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => router.present({ type: 'meal', index: match.index })}
            />
            <Button
              title="Add missing"
              style={{ flex: 1 }}
              onPress={() => store.addShoppingForMeal(match.index)}
            />
          </View>
        </Card>
      ))}

      <Notice title="Nourish+ idea:">
        camera and receipt scans, expiry aware suggestions, budget planning and automatic pantry
        updates can save time. Any production scan should show what was recognised and ask you to
        confirm before changing your kitchen.
      </Notice>
    </Sheet>
  );
}

/** `.listItem` */
function ListRow({
  title,
  subtitle,
  checked,
  onToggle,
  onRemove,
}: {
  title: string;
  subtitle: string;
  checked?: boolean;
  onToggle?: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.listItem}>
      {onToggle ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: Boolean(checked) }}
          onPress={onToggle}
          style={[styles.check, checked && { backgroundColor: colors.sage2 }]}
        >
          <Text style={styles.checkText}>{checked ? '✓' : ' '}</Text>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.itemTitle,
            checked ? { textDecorationLine: 'line-through', opacity: 0.55 } : null,
          ]}
        >
          {title}
        </Text>
        <Small>{subtitle}</Small>
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} style={styles.tinyBtn}>
        <Text style={styles.tinyBtnText}>Remove</Text>
      </Pressable>
    </View>
  );
}

/** `.scanBox` */
function ScanBox({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <View style={styles.scanBox}>
      <Text style={styles.scanTitle}>{title}</Text>
      <Small>{text}</Small>
      <Button title="Run a demo scan" variant="secondary" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 15,
    padding: 13,
    fontSize: 14,
    color: colors.ink,
  },
  scanBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.scanLine,
    backgroundColor: colors.scan,
    borderRadius: 20,
    padding: 17,
    alignItems: 'center',
    marginTop: 12,
  },
  scanTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.warm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  itemTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  tinyBtn: { backgroundColor: colors.warm, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 9 },
  tinyBtnText: { fontSize: 10, fontWeight: '600', color: colors.muted },
  aiResult: { backgroundColor: colors.sage2, borderRadius: 18, padding: 14, marginTop: 10 },
  aiTitle: { fontSize: 12, fontWeight: '700', color: colors.ink },
  matchPct: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: colors.sage, marginTop: 10 },
  needs: { fontSize: 11, fontWeight: '600', color: colors.accent, marginVertical: 6 },
});

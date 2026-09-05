import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CultureCard, MealCard } from '../components/cards';
import { Page } from '../components/shell';
import {
  Button, Card, Chip, Eyebrow, H1, H2, P, Photo, Rail, RewardCard, Section, SectionLabel, Small, Wrap,
} from '../components/ui';
import { IMAGES, culturePicks, mealIndex, meals, worldInfo } from '../lib/data';
import { occasions } from '../lib/girki/content';
import { nextDishSuggestion, whenText } from '../lib/girki/passport';
import { todaysMeals } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

const FITS: { label: string; query: string }[] = [
  { label: 'Spicy', query: 'something spicy' },
  { label: 'Plant based', query: 'something plant based' },
  { label: 'High protein', query: 'high protein meals' },
  { label: 'High fibre', query: 'high fibre meals' },
  { label: 'Under 30 minutes', query: 'meals under 30 minutes' },
  { label: 'Something new', query: 'take me somewhere new' },
];

/** The Today tab — `today()`. */
export function Today() {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>{greeting}</Eyebrow>
        <H1>A world of food is waiting.</H1>
        <P>
          Every day, discover dishes, ingredients and food traditions from somewhere you may not
          have explored before.
        </P>
      </View>

      <GirkiContinuity />

      <Section>
        <SectionLabel>What is tonight?</SectionLabel>
        <Small>
          Not a filter. The question you actually ask yourself at six o'clock.
        </Small>
        <Rail columns={layout.tablet ? 4 : 0} gap={10}>
          {occasions.map((occasion) => (
            <Pressable
              key={occasion.id}
              accessibilityRole="button"
              onPress={() => router.present({ type: 'occasion', id: occasion.id })}
              style={styles.occasion}
            >
              <Text style={styles.occasionIcon}>{occasion.icon}</Text>
              <Text style={styles.occasionName}>{occasion.name}</Text>
              <Text style={styles.occasionBlurb} numberOfLines={3}>{occasion.blurb}</Text>
            </Pressable>
          ))}
        </Rail>
      </Section>

      {/* .morningFeature */}
      <View style={[styles.feature, shadow]}>
        <Photo uri={IMAGES.morningFeature} height={230} />
        <View style={{ paddingHorizontal: 18, paddingTop: 17, paddingBottom: 18 }}>
          <Eyebrow>A new day</Eyebrow>
          <H2>Food, health and culture bring us together.</H2>
          <P size={13}>
            From Ghanaian grilled tilapia to Japanese ramen, Vietnamese phở and Fijian kokoda. Your
            next favourite could come from anywhere.
          </P>
          <Button
            title="Open today's discovery"
            variant="secondary"
            onPress={() => router.present({ type: 'morningDiscovery' })}
          />
        </View>
      </View>

      {/* .cultureHero */}
      <View style={styles.cultureHero}>
        <Eyebrow>Worth discovering</Eyebrow>
        <H2>Travel the world through food.</H2>
        <P>
          Not a fixed menu. A living stream of curiosity, with new places, dishes and stories every
          day.
        </P>
        <Rail columns={layout.tablet ? 3 : 0} gap={10}>
          {culturePicks.map((pick) => {
            const index = mealIndex(pick.meal);
            const image = index >= 0 ? meals[index].img : worldInfo[pick.place]?.img;
            const caption =
              pick.meal === 'True ramen · shoyu style'
                ? 'Ramen: Chinese roots, Japanese craft'
                : pick.meal;
            return (
              <CultureCard
                key={pick.place}
                place={pick.place}
                caption={caption}
                image={image}
                width={layout.tablet ? '100%' : undefined}
                onPress={() => router.present({ type: 'culture', place: pick.place })}
              />
            );
          })}
        </Rail>
        <Small style={{ marginTop: 6 }}>
          And this is only the beginning. West Africa, South Asia, East Asia, the Pacific, the
          Andes, the Amazon and beyond.
        </Small>
      </View>

      <Section>
        <SectionLabel>How would you like it to fit?</SectionLabel>
        <Wrap>
          {FITS.map((fit) => (
            <Chip key={fit.label} title={fit.label} onPress={() => router.filterFood(fit.query)} />
          ))}
        </Wrap>
        <Small style={{ marginTop: 10 }}>
          Food fit is recipe specific. Health related labels need verified nutrition data and, for
          medical diets, individual professional guidance.
        </Small>
      </Section>

      {['Breakfast', 'Lunch', 'Dinner'].map((slot) => {
        const selected = todaysMeals(slot, store.dailyOffset, store.plus);
        return (
          <View key={slot} style={{ marginTop: 30 }}>
            <View style={styles.slotHead}>
              <Text style={[styles.slotTitle, { fontSize: layout.tablet ? 32 : 27 }]}>{slot}</Text>
              <Small>{store.plus ? `${selected.length} ways to explore` : '4 ideas today'}</Small>
            </View>
            <Rail columns={layout.railColumns} gap={14}>
              {selected.map(({ index, meal }) => (
                <MealCard
                  key={index}
                  meal={meal}
                  onPress={() => router.present({ type: 'meal', index })}
                />
              ))}
            </Rail>
            {!store.plus ? (
              <Text
                accessibilityRole="button"
                onPress={() => router.present({ type: 'plus' })}
                style={styles.moreLink}
              >
                See more variations with Girki+
              </Text>
            ) : null}
          </View>
        );
      })}

      <Section>
        <Card>
          <Eyebrow>World food atlas</Eyebrow>
          <H2>Where will food take you next?</H2>
          <P>
            Every country has many foodways, shaped by regions, seasons, migration and family
            traditions.
          </P>
          <View style={styles.atlasRow}>
            <Small style={{ flex: 1 }}>
              {store.plus ? '195 countries unlocked' : 'Taste 12 today · 195 in the full atlas'}
            </Small>
            <Button
              title="Explore the atlas"
              variant="secondary"
              onPress={() => router.show('food')}
              style={{ marginTop: 0 }}
            />
          </View>
        </Card>
      </Section>

      <RewardCard
        eyebrow="Keep exploring"
        title={`${store.tokens} Girki tokens`}
        token="Cook · learn · discover"
        text="Tomorrow brings a new set of ideas. The world of food never runs out of stories."
      />
    </Page>
  );
}

/**
 * `girkiContinuityCard` — what you cooked last, and where it points next.
 * When nothing is cooked yet the card teaches the mechanic instead of
 * apologising for being empty.
 */
function GirkiContinuity() {
  const store = useStore();
  const router = useRouter();
  const passport = store.passport;
  const next = nextDishSuggestion(passport, store.plus);

  if (!passport.last) {
    return (
      <View style={styles.continuity}>
        <Eyebrow>Your passport</Eyebrow>
        <H2>Nothing stamped yet.</H2>
        <Small>
          Cook anything and the country is stamped. Twelve countries are open without Girki+, and
          the atlas holds 195.
        </Small>
        {next ? (
          <Button
            title={`Start with ${next.name}`}
            onPress={() => router.present({ type: 'girkiDish', id: next.id })}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.continuity}>
      <Eyebrow>Your passport</Eyebrow>
      <H2>
        {passport.countries.length} {passport.countries.length === 1 ? 'country' : 'countries'}, {passport.cooks} {passport.cooks === 1 ? 'meal' : 'meals'}
      </H2>
      <Small>
        Last: {passport.last.dish}
        {passport.last.country ? ` from ${passport.last.country}` : ''} · {whenText(passport.last.at)}
      </Small>
      <View style={{ flexDirection: 'row', gap: 9, marginTop: 4 }}>
        <Button
          title="Open passport"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.show('passport')}
        />
        {next ? (
          <Button
            title="Where next"
            style={{ flex: 1 }}
            onPress={() => router.present({ type: 'girkiDish', id: next.id })}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  continuity: {
    backgroundColor: colors.sage2,
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
  },
  occasion: {
    width: 180,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 14,
  },
  occasionIcon: { fontSize: 22 },
  occasionName: { fontFamily: displayFont, fontSize: 19, color: colors.ink, marginTop: 6 },
  occasionBlurb: { fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 4 },
  feature: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 26,
    overflow: 'hidden',
    marginTop: 20,
  },
  cultureHero: {
    backgroundColor: colors.warmAlt,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
  },
  slotHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  slotTitle: { fontFamily: displayFont, color: colors.ink, letterSpacing: -0.45 },
  moreLink: { fontSize: 12, fontWeight: '600', color: colors.sage, marginTop: 8 },
  atlasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CultureCard, MealCard } from '../components/cards';
import { Page } from '../components/shell';
import {
  Button, Card, Chip, Eyebrow, H1, H2, P, Photo, Rail, RewardCard, Section, SectionLabel, Small, Wrap,
} from '../components/ui';
import { IMAGES, culturePicks, mealIndex, meals, worldInfo } from '../lib/data';
import { todaysMeals } from '../lib/logic';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

const FITS = ['Spicy', 'Vegan friendly', 'Keto friendly', 'Kidney aware', 'High fibre', 'Under 30 minutes'];

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
            <Chip key={fit} title={fit} onPress={() => router.filterFood(fit)} />
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
                See more variations with Nourish+
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
        title={`${store.tokens} Nourish tokens`}
        token="Cook · learn · discover"
        text="Tomorrow brings a new set of ideas. The world of food never runs out of stories."
      />
    </Page>
  );
}

const styles = StyleSheet.create({
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

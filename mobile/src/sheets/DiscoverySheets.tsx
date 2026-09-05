import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FoodCard } from '../components/cards';
import { Sheet } from '../components/shell';
import {
  Button, Card, Eyebrow, H2, H3, Notice, P, Photo, Small, SourceNote,
} from '../components/ui';
import {
  IMAGES, countryByName, cultureNames, knownCommonsImage, mealIndex, mealRefs, meals, worldInfo,
} from '../lib/data';
import { useRouter } from '../nav/router';
import { colors, shadow } from '../theme/tokens';
import { findCommonsImage, CommonsImage } from '../lib/commons';

/** `openMorningDiscovery()` */
export function MorningDiscoverySheet() {
  const router = useRouter();
  return (
    <Sheet>
      <Photo uri={IMAGES.nepalMorning} height={240} radius={20} />
      <View style={{ marginTop: 16 }}>
        <Eyebrow>Nepal</Eyebrow>
      </View>
      <H2>A morning in Nepal</H2>
      <P>
        Food is shaped by place, climate, tradition and what people grow and cook every day.
      </P>
      <Card>
        <H3>Dal bhat</H3>
        <P>
          A familiar combination of lentils, rice and vegetables. A simple example of how a few
          everyday ingredients can become a complete meal.
        </P>
        <Button
          title="Discover a meal"
          onPress={() => {
            const index = mealIndex('Nepali dal bhat tarkari');
            if (index >= 0) router.present({ type: 'meal', index });
          }}
        />
      </Card>
      <Notice>
        Nourish uses food and culture as a way to help you discover new possibilities, without
        telling you what you must eat.
      </Notice>
    </Sheet>
  );
}

/** `openCulture(place)` */
export function CultureSheet({ place }: { place: string }) {
  const router = useRouter();
  const info = worldInfo[place] || worldInfo.Nepal;
  const names = cultureNames[place] || [];
  const matched = mealRefs.filter((ref) => names.includes(ref.meal.name));
  const related = matched.length ? matched : mealRefs.slice(0, 2);

  return (
    <Sheet>
      <Photo uri={info.img} height={230} radius={20} />
      <View style={{ marginTop: 16 }}>
        <Eyebrow>{info.tag}</Eyebrow>
      </View>
      <H2>{place}</H2>
      <P>{info.description}</P>
      <Card>
        <H3>Try it in your kitchen</H3>
        <P>
          Start with a dish from this food culture, then follow the ingredients and chef style
          steps.
        </P>
        {related.map(({ index, meal }) => (
          <View key={index} style={{ marginTop: 9 }}>
            <FoodCard meal={meal} onPress={() => router.present({ type: 'meal', index })} />
          </View>
        ))}
      </Card>
      <SourceNote>
        Demo image source: Wikimedia Commons. Production will keep image licence, author and
        attribution metadata with each asset.
      </SourceNote>
    </Sheet>
  );
}

/** `openCountry(name)` */
export function CountrySheet({ name }: { name: string }) {
  const router = useRouter();
  const country = countryByName(name);
  if (!country) return null;

  // The prototype's featured hero: a meal from this culture, else a meal whose
  // name matches the country's first dish.
  const featured =
    meals.find((m) => m.culture === name) ||
    meals.find((m) => {
      const first = country.foods[0]?.toLowerCase().split(' ')[0];
      return first ? m.name.toLowerCase().includes(first) : false;
    });

  return (
    <Sheet>
      {featured ? (
        <Photo uri={featured.img} height={210} radius={20} />
      ) : (
        <View style={styles.heroFallback}>
          <Text style={styles.heroFallbackText}>Explore {country.region}</Text>
        </View>
      )}
      <View style={{ marginTop: 14 }}>
        <Eyebrow>{country.region}</Eyebrow>
      </View>
      <H2>{country.name}</H2>
      <P>
        Explore regional foodways through dishes, ingredients and stories. No single dish represents
        an entire country.
      </P>

      {country.foods.map((food, i) => (
        <CountryFoodCard
          key={food}
          food={food}
          area={country.areas[i % Math.max(1, country.areas.length)] || ''}
          country={country.name}
        />
      ))}

      <View style={styles.explore}>
        <Eyebrow>Go deeper with Nourish+</Eyebrow>
        <H3>More dishes. More regions. More ways to cook.</H3>
        <P>
          Plus opens the full country library, richer regional stories, more recipes and more image
          led discovery. Free members can explore the featured set and see what is waiting beyond
          it.
        </P>
        <Button title="Explore Nourish+" onPress={() => router.present({ type: 'plus' })} />
      </View>

      <Notice title="Editorial principle:">
        every food image and cultural description should be sourced, rights checked and reviewed for
        accuracy before publication.
      </Notice>

      <Button
        title="Keep exploring food"
        variant="secondary"
        onPress={() => router.closeAndShow('food')}
      />
    </Sheet>
  );
}

/** `.foodImageCard` — hydrated from Wikimedia Commons like the prototype. */
function CountryFoodCard({ food, area, country }: { food: string; area: string; country: string }) {
  const [image, setImage] = useState<CommonsImage | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const known = knownCommonsImage(food, country);
    if (known) {
      setImage({
        url: known,
        author: '',
        license: 'Verify individual file licence',
        source: 'Wikimedia Commons',
      });
      return;
    }
    findCommonsImage(food, country).then((result) => {
      if (cancelled) return;
      if (result) setImage(result);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [food, country]);

  return (
    <View style={[styles.foodCard, shadow]}>
      <Photo uri={image?.url} height={150} />
      <View style={{ padding: 13 }}>
        <Text style={styles.miniLabel}>{area.toUpperCase()}</Text>
        <Text style={styles.foodName}>{food}</Text>
        <P size={11}>
          A foodway to explore from this region. The image should match the exact dish, not merely
          the country.
        </P>
        {image ? (
          <Small>
            Source: {image.source || 'Wikimedia Commons'}
            {image.author ? ` · ${image.author}` : ''}
            {image.license ? ` · ${image.license}` : ''}
          </Small>
        ) : failed ? (
          <Small>
            No verified image found yet. Keep this dish out of the production library until sourced.
          </Small>
        ) : null}
      </View>
    </View>
  );
}

/** `openIngredientDiscovery()` */
export function IngredientDiscoverySheet() {
  const router = useRouter();
  return (
    <Sheet>
      <Eyebrow>Ingredient curiosity</Eyebrow>
      <H2>What else can a courgette do?</H2>
      <P>
        Roast it, fold it through grains, add it to a tray bake or turn it into a simple soup.
        Nourish can use one ingredient as a starting point for discovery rather than a restriction.
      </P>
      <Card>
        <H3>Try it tonight</H3>
        <P>Courgette, chickpea and herb bowl · 20 minutes</P>
        <Button title="See a meal" onPress={() => router.present({ type: 'meal', index: 4 })} />
      </Card>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  heroFallback: {
    height: 210,
    borderRadius: 20,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFallbackText: { fontSize: 18, color: colors.ink },
  foodCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 12,
  },
  miniLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.muted },
  foodName: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 4 },
  explore: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 22,
    padding: 16,
    marginTop: 14,
  },
});

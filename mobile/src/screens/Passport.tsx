import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Page } from '../components/shell';
import { Button, Card, Eyebrow, H1, H2, H3, P, SectionLabel, Small, Wrap } from '../components/ui';
import { countryIsOpen, nextDishSuggestion, stampsByRegion, suggestNext, whenText } from '../lib/girki/passport';
import { preferences } from '../lib/girki/content';
import { useLayout } from '../lib/responsive';
import { useRouter } from '../nav/router';
import { useStore } from '../state/store';
import { colors } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * The passport.
 *
 * A stamp for every country cooked from. The empty state teaches the mechanic
 * rather than apologising for being empty — the pattern the brief points at.
 */
export function Passport() {
  const store = useStore();
  const router = useRouter();
  const layout = useLayout();
  const passport = store.passport;
  const regions = stampsByRegion(passport);
  const next = nextDishSuggestion(passport, store.plus);

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Your passport</Eyebrow>
        <H1>
          {passport.countries.length
            ? `${passport.countries.length} ${passport.countries.length === 1 ? 'country' : 'countries'} cooked`
            : 'Nothing stamped yet'}
        </H1>
        <P>
          {passport.countries.length
            ? `${passport.cooks} ${passport.cooks === 1 ? 'meal' : 'meals'} from ${passport.regions.length} ${passport.regions.length === 1 ? 'region' : 'regions'}, out of ${passport.totalCountries} countries in the atlas.`
            : 'Cook something and the country gets stamped here. Twelve countries are open without Girki+, and the atlas holds 195.'}
        </P>
      </View>

      <View style={styles.stats}>
        <Stat value={String(passport.countries.length)} label={`of ${passport.totalCountries} countries`} />
        <Stat value={String(passport.regions.length)} label={`of ${preferences.regions.length} regions`} />
        <Stat value={String(passport.cooks)} label={passport.cooks === 1 ? 'meal cooked' : 'meals cooked'} />
      </View>

      {passport.last ? (
        <Card>
          <SectionLabel>Last cooked</SectionLabel>
          <H3>{passport.last.dish}</H3>
          <Small>
            {passport.last.country || 'Girki kitchen'} · {whenText(passport.last.at)}
          </Small>
        </Card>
      ) : null}

      <Card>
        <SectionLabel>Where next</SectionLabel>
        <P>{suggestNext(passport)}</P>
        {next ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.present({ type: 'girkiDish', id: next.id })}
            style={styles.suggestion}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.suggestionCountry}>{next.country.toUpperCase()}</Text>
              <Text style={styles.suggestionDish}>{next.name}</Text>
              <Small>{next.region}</Small>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : null}
        {!store.plus ? (
          <Button
            title="Open all 195 countries"
            variant="secondary"
            onPress={() => router.present({ type: 'plus' })}
          />
        ) : null}
      </Card>

      {regions.length ? (
        regions.map(({ region, stamps }) => (
          <View key={region} style={{ marginTop: 22 }}>
            <SectionLabel>{region}</SectionLabel>
            <Wrap gap={8}>
              {stamps.map((stamp) => (
                <View key={stamp.country} style={styles.stamp}>
                  <Text style={styles.stampCountry}>{stamp.country}</Text>
                  <Text style={styles.stampCount}>
                    {stamp.cooks} {stamp.cooks === 1 ? 'cook' : 'cooks'}
                  </Text>
                </View>
              ))}
            </Wrap>
          </View>
        ))
      ) : (
        <Card>
          <SectionLabel>How stamps work</SectionLabel>
          <H3>Cook a dish, and its country is stamped.</H3>
          <P>
            The stamp is the country, not the recipe. Cook from Ghana three ways and Ghana is
            stamped once, with three cooks against it.
          </P>
          <Button title="Find something to cook" onPress={() => router.show('food')} />
        </Card>
      )}

      {passport.log.length ? (
        <View style={{ marginTop: 22 }}>
          <SectionLabel>Recently cooked</SectionLabel>
          {[...passport.log].reverse().slice(0, 10).map((entry, i) => (
            <View key={`${entry.dish}-${entry.at}-${i}`} style={styles.logRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logDish}>{entry.dish}</Text>
                <Small>
                  {entry.country || 'Girki kitchen'} · {whenText(entry.at)}
                  {countryIsOpen(entry.country, store.plus) ? '' : ' · Girki+'}
                </Small>
              </View>
              <Small>{entry.minutes ? `${entry.minutes} min` : ''}</Small>
            </View>
          ))}
        </View>
      ) : null}
    </Page>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Small>{label}</Small>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  stat: {
    flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line,
    borderRadius: 16, padding: 12,
  },
  statValue: { fontFamily: displayFont, fontSize: 26, color: colors.ink },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10,
    backgroundColor: colors.warmAlt, borderRadius: 18, padding: 14,
  },
  suggestionCountry: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: colors.muted },
  suggestionDish: { fontFamily: displayFont, fontSize: 20, color: colors.ink, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.muted },
  stamp: {
    borderWidth: 1, borderColor: colors.sage, borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: colors.sage2,
  },
  stampCountry: { fontFamily: displayFont, fontSize: 16, color: colors.ink },
  stampCount: { fontSize: 10, color: colors.chipInk, marginTop: 2 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  logDish: { fontSize: 14, fontWeight: '700', color: colors.ink },
});

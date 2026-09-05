import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KitchenCard } from '../components/cards';
import { Page } from '../components/shell';
import { SmartKitchenBlock } from '../components/smartKitchen';
import {
  Button, Card, Eyebrow, H1, H2, H3, LinkButton, P, Photo, Section, SectionLabel, Small, SourceNote,
} from '../components/ui';
import { IMAGES } from '../lib/data';
import { useLayout } from '../lib/responsive';
import { Sheet, useRouter } from '../nav/router';
import { colors, shadow } from '../theme/tokens';

/** The Wellbeing tab — `wellbeing()`. */
export function Wellbeing() {
  const router = useRouter();
  const layout = useLayout();

  return (
    <Page>
      <View style={{ marginTop: 12 }}>
        <Eyebrow>Food for your life</Eyebrow>
        <H1>Wellbeing that belongs here.</H1>
        <P>
          Food is where we begin. Wellbeing connects what you eat with how you move, rest, sleep,
          recover and enjoy everyday life.
        </P>
      </View>

      <View style={[styles.hero, shadow]}>
        <Photo uri={IMAGES.move} height={layout.heroImage} />
        <View style={{ padding: 18 }}>
          <Eyebrow>Your rhythm</Eyebrow>
          <H3>Eat. Move. Rest. Discover.</H3>
          <P>
            Nourish does not separate food from life. Explore small ideas that can sit naturally
            alongside your meals and your day.
          </P>
          <Button
            title="Explore movement"
            variant="secondary"
            onPress={() => router.present({ type: 'movement' })}
          />
        </View>
      </View>

      <Section>
        <SectionLabel>Around your food</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <KitchenCard
            title="Eat well"
            subtitle="Ideas that fit real meals, not rules."
            onPress={() => router.present({ type: 'wellbeingFood' })}
          />
          <KitchenCard
            title="Reset"
            subtitle="A few quiet minutes when you need them."
            onPress={() => router.present({ type: 'breathing' })}
          />
        </View>
      </Section>

      <InfoCard
        eyebrow="Sleep"
        title="Make tonight a little gentler."
        text="Explore food timing, wind down ideas and simple routines. Your own response matters more than a rigid rule."
        button="Explore sleep"
        sheet={{ type: 'sleep' }}
      />
      <InfoCard
        eyebrow="Recovery"
        title="Give your body room to recover."
        text="Pair nourishment with rest and manageable movement. Especially useful on days when your energy is different."
        button="Explore recovery"
        sheet={{ type: 'recovery' }}
      />
      <InfoCard
        eyebrow="Food & culture"
        title="Wellbeing can look different around the world."
        text="Discover how meals, rituals, ingredients and everyday movement connect people and place."
        button="Explore a food tradition"
        sheet={{ type: 'cultureWellbeing' }}
      />

      <SmartKitchenBlock text="Tell Nourish what is in your pantry and it can help you find a meal that fits tonight." />

      <View style={styles.ai}>
        <View style={styles.betaMark}>
          <Text style={styles.betaText}>AI BETA</Text>
        </View>
        <H2>Understand your food, without being told what to do.</H2>
        <P>
          Explore how food, routines and everyday choices may relate to things such as sleep, energy
          or digestion. Nourish explains evidence with uncertainty and helps you think through
          choices. It does not diagnose, prescribe or replace professional care.
        </P>
        <AiQuestion
          title="Could this meal affect my sleep?"
          subtitle="Explore what is known and what is individual"
          action="Explore"
          sheet={{ type: 'aiSleep' }}
        />
        <AiQuestion
          title="Why might I feel different after this?"
          subtitle="Separate observation from assumption"
          action="Explore"
          sheet={{ type: 'aiEnergy' }}
        />
        <AiQuestion
          title="Help me compare these meals"
          subtitle="Nutrition, ingredients and practical fit"
          action="Compare"
          sheet={{ type: 'aiDecide' }}
        />
        <Button
          title="Ask Nourish"
          onPress={() => router.present({ type: 'ask' })}
        />
        <Button
          title="How AI beta works"
          variant="secondary"
          onPress={() => router.present({ type: 'aiBeta' })}
        />
      </View>

      <SourceNote>
        Wellbeing and AI beta provide general lifestyle and nutrition information only. They are not
        diagnosis, treatment or emergency services. Individual needs differ.
      </SourceNote>
    </Page>
  );
}

function InfoCard({
  eyebrow,
  title,
  text,
  button,
  sheet,
}: {
  eyebrow: string;
  title: string;
  text: string;
  button: string;
  sheet: Sheet;
}) {
  const router = useRouter();
  return (
    <Card>
      <Eyebrow>{eyebrow}</Eyebrow>
      <H3>{title}</H3>
      <P>{text}</P>
      <Button title={button} variant="secondary" onPress={() => router.present(sheet)} />
    </Card>
  );
}

function AiQuestion({
  title,
  subtitle,
  action,
  sheet,
}: {
  title: string;
  subtitle: string;
  action: string;
  sheet: Sheet;
}) {
  const router = useRouter();
  return (
    <View style={styles.aiQuestion}>
      <View style={{ flex: 1 }}>
        <Text style={styles.aiTitle}>{title}</Text>
        <Small>{subtitle}</Small>
      </View>
      <LinkButton title={action} onPress={() => router.present(sheet)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 14,
  },
  ai: {
    backgroundColor: colors.aiBg,
    borderWidth: 1,
    borderColor: colors.aiBorder,
    borderRadius: 24,
    padding: 18,
    marginTop: 24,
  },
  betaMark: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  betaText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#fff' },
  aiQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.aiLine,
  },
  aiTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
});

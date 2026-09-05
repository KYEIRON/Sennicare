import { Image } from 'expo-image';
import React from 'react';
import {
  ImageStyle,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useLayout } from '../lib/responsive';
import { colors, radii, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

/**
 * The prototype's photography, loaded from the same URLs. expo-image caches to
 * memory and disk, so a picture is fetched once per device.
 */
export function Photo({
  uri,
  height,
  radius = 0,
  style,
}: {
  uri?: string | null;
  height: number;
  radius?: number;
  style?: ImageStyle;
}) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={[{ width: '100%', height, borderRadius: radius, backgroundColor: colors.sage2 }, style]}
      contentFit="cover"
      transition={180}
      cachePolicy="disk"
    />
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const l = useLayout();
  return (
    <Text
      style={{
        fontFamily: displayFont,
        fontSize: l.h1,
        lineHeight: l.h1Line,
        letterSpacing: -0.45,
        color: colors.ink,
        marginTop: 5,
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  );
}

export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const l = useLayout();
  return (
    <Text
      style={[
        {
          fontFamily: displayFont,
          fontSize: l.h2,
          letterSpacing: -0.45,
          color: colors.ink,
          marginTop: 5,
          marginBottom: 8,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function H3({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const l = useLayout();
  return (
    <Text
      style={[
        {
          fontFamily: displayFont,
          fontSize: l.h3,
          letterSpacing: -0.45,
          color: colors.ink,
          marginTop: 4,
          marginBottom: 6,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function P({
  children,
  size,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  style?: TextStyle;
}) {
  const l = useLayout();
  const fontSize = size ?? l.body;
  return (
    <Text
      style={[
        { fontSize, lineHeight: Math.round(fontSize * 1.48), color: colors.muted, marginVertical: 6 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** `.eyebrow` */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <Text style={styles.eyebrow}>{String(children).toUpperCase()}</Text>;
}

/** `.sectionLabel` */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{String(children).toUpperCase()}</Text>;
}

export function Small({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.small, style]}>{children}</Text>;
}

/** `.card` */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const l = useLayout();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: l.cardRadius,
          padding: l.cardPadding,
          marginVertical: 12,
        },
        shadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** `.section` */
export function Section({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const l = useLayout();
  return <View style={[{ marginTop: l.sectionGap }, style]}>{children}</View>;
}

/** `.btn` */
export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? colors.ink : colors.sage2, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: primary ? '#fff' : colors.sageDeep }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** `.link` */
export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

/** `.pill` */
export function Pill({ text }: { text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

/** `.mealTag` */
export function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

/** `.premiumTag` */
export function PremiumTag() {
  return (
    <View style={styles.premium}>
      <Text style={styles.premiumText}>PLUS</Text>
    </View>
  );
}

/** `.fitChip` / `.moodgrid button` */
export function Chip({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.chip}>
      <Text style={styles.chipText}>{title}</Text>
    </Pressable>
  );
}

/** `.notice` */
export function Notice({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>
        {title ? <Text style={styles.noticeTitle}>{title} </Text> : null}
        {children}
      </Text>
    </View>
  );
}

/** `.legalCard` */
export function LegalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.legal}>
      <Text style={styles.legalText}>
        <Text style={styles.legalTitle}>{title} </Text>
        {children}
      </Text>
    </View>
  );
}

/** `.plusGate` */
export function PlusGate({
  title,
  text,
  buttonTitle,
  onPress,
}: {
  title: string;
  text: string;
  buttonTitle: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.plusGate}>
      <Text style={styles.plusGateTitle}>{title}</Text>
      <P size={12}>{text}</P>
      <Button title={buttonTitle} onPress={onPress} />
    </View>
  );
}

/** `.sourceNote` */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sourceNote}>{children}</Text>;
}

/** `.choice` / `.obChoice` */
export function ChoiceTile({
  title,
  subtitle,
  selected,
  locked,
  onPress,
  width,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  locked?: boolean;
  onPress: () => void;
  width?: number | string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.choice,
        selected && { backgroundColor: colors.sage2, borderColor: colors.sage },
        locked && { opacity: 0.55 },
        width !== undefined ? ({ width } as ViewStyle) : null,
      ]}
    >
      <Text style={[styles.choiceTitle, subtitle ? { fontWeight: '700' } : null]}>{title}</Text>
      {subtitle ? <Text style={styles.choiceSub}>{subtitle}</Text> : null}
    </Pressable>
  );
}

/** `.rewardCard` */
export function RewardCard({
  eyebrow,
  title,
  token,
  text,
  button,
}: {
  eyebrow: string;
  title: string;
  token: string;
  text: string;
  button?: { title: string; onPress: () => void };
}) {
  const l = useLayout();
  return (
    <View style={styles.reward}>
      <View style={styles.rewardTop}>
        <View style={{ flex: 1 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <Text style={{ fontFamily: displayFont, fontSize: l.h3, color: colors.ink, marginTop: 4 }}>
            {title}
          </Text>
        </View>
        <Text style={styles.token}>{token}</Text>
      </View>
      <P size={12}>{text}</P>
      {button ? <Button title={button.title} variant="secondary" onPress={button.onPress} /> : null}
    </View>
  );
}

/** A horizontal rail on phones that becomes a grid on tablets (V28's V25 layer). */
export function Rail({
  children,
  columns,
  gap = 12,
}: {
  children: React.ReactNode[];
  columns: number;
  gap?: number;
}) {
  if (columns > 0) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
        {React.Children.map(children, (child) => (
          <View style={{ width: `${100 / columns}%`, paddingRight: gap, paddingBottom: gap }}>
            {child}
          </View>
        ))}
      </View>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap, paddingVertical: 4, paddingRight: 6 }}
    >
      {children}
    </ScrollView>
  );
}

/** A wrapping row of chips or tags. */
export function Wrap({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{children}</View>;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: colors.muted,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: colors.muted,
    marginBottom: 7,
  },
  small: { fontSize: 11, color: colors.muted, lineHeight: 16 },
  button: {
    borderRadius: radii.button,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonLabel: { fontSize: 14, fontWeight: '700' },
  link: { fontSize: 11, fontWeight: '800', color: colors.sage },
  pill: {
    backgroundColor: colors.sage2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radii.chip,
  },
  pillText: { fontSize: 11, color: colors.chipInk },
  tag: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.tag,
    borderRadius: radii.chip,
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  tagText: { fontSize: 9, color: colors.tagInk },
  premium: {
    backgroundColor: colors.ink,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: radii.chip,
  },
  premiumText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: '#fff' },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radii.chip,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  chipText: { fontSize: 11, color: colors.ink },
  notice: { backgroundColor: colors.warm, borderRadius: radii.small, padding: 12 },
  noticeText: { fontSize: 11, lineHeight: 17, color: colors.noticeInk },
  noticeTitle: { fontWeight: '700' },
  legal: { backgroundColor: colors.warm, borderRadius: 18, padding: 13 },
  legalText: { fontSize: 10, lineHeight: 15, color: colors.legalInk },
  legalTitle: { fontWeight: '700' },
  plusGate: {
    backgroundColor: colors.warm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 15,
    marginVertical: 14,
  },
  plusGateTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  sourceNote: { fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 12 },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 13,
    minHeight: 52,
    justifyContent: 'center',
  },
  choiceTitle: { fontSize: 13, color: colors.ink },
  choiceSub: { fontSize: 11, color: colors.muted, marginTop: 3 },
  reward: {
    backgroundColor: colors.reward,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 21,
    padding: 16,
    marginTop: 14,
  },
  rewardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  token: { fontSize: 10, fontWeight: '700', color: colors.sage, flexShrink: 1, textAlign: 'right' },
});

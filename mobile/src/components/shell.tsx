import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tab, useRouter } from '../nav/router';
import { useLayout } from '../lib/responsive';
import { colors, shadow } from '../theme/tokens';
import { displayFont } from '../theme/typography';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'food', label: 'Food' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'plan', label: 'Plan' },
  { key: 'wellbeing', label: 'Wellbeing' },
  { key: 'you', label: 'You' },
];

/**
 * V28's tab icons are inline SVG paths. These are the same shapes drawn with
 * plain views so no SVG dependency is needed: a roof, cutlery, shelves, a
 * calendar, a heart and a person.
 */
function TabGlyph({ tab, active }: { tab: Tab; active: boolean }) {
  const tint = active ? colors.ink : colors.tabIdle;
  const base: ViewStyle = { borderColor: tint, borderWidth: 1.8 };
  switch (tab) {
    case 'today':
      return (
        <View style={glyph.box}>
          <View style={[glyph.roof, base]} />
          <View style={[glyph.houseBody, base]} />
        </View>
      );
    case 'food':
      return (
        <View style={glyph.box}>
          <View style={[glyph.fork, base]} />
          <View style={[glyph.knife, base]} />
        </View>
      );
    case 'pantry':
      return (
        <View style={glyph.box}>
          <View style={[glyph.shelfOuter, base]} />
          <View style={[glyph.shelfLine, { backgroundColor: tint, top: 7 }]} />
          <View style={[glyph.shelfLine, { backgroundColor: tint, top: 12 }]} />
        </View>
      );
    case 'plan':
      return (
        <View style={glyph.box}>
          <View style={[glyph.calendar, base]} />
          <View style={[glyph.calendarTop, { backgroundColor: tint }]} />
        </View>
      );
    case 'wellbeing':
      return (
        <View style={glyph.box}>
          <View style={[glyph.heartLeft, base]} />
          <View style={[glyph.heartRight, base]} />
        </View>
      );
    default:
      return (
        <View style={glyph.box}>
          <View style={[glyph.head, base]} />
          <View style={[glyph.shoulders, base]} />
        </View>
      );
  }
}

/** `.tabs` — a bottom bar on phones, a 118px left rail on tablets. */
export function TabBar() {
  const router = useRouter();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  if (layout.tablet) {
    return (
      <View style={[rail.container, { paddingTop: insets.top + 20, width: layout.railWidth }]}>
        {TABS.map((tab) => {
          const active = router.tab === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => router.show(tab.key)}
              style={[rail.item, active && { backgroundColor: colors.sage2 }]}
            >
              <TabGlyph tab={tab.key} active={active} />
              <Text style={[rail.label, active && rail.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[bar.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const active = router.tab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => router.show(tab.key)}
            style={bar.item}
          >
            <TabGlyph tab={tab.key} active={active} />
            <Text style={[bar.label, active && bar.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The app header: wordmark and avatar. */
export function Header() {
  const router = useRouter();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        header.container,
        {
          paddingTop: insets.top + (layout.tablet ? 24 : 12),
          paddingHorizontal: layout.tablet ? 34 : 22,
          maxWidth: layout.contentMaxWidth,
          alignSelf: 'center',
          width: '100%',
        },
      ]}
    >
      <Text style={[header.brand, { fontSize: layout.brand }]}>nourish</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your profile"
        onPress={() => router.present({ type: 'profile' })}
        style={[header.avatar, { width: layout.tablet ? 44 : 40, height: layout.tablet ? 44 : 40 }]}
      >
        <Text style={header.avatarText}>R</Text>
      </Pressable>
    </View>
  );
}

/** The scrolling body of a tab, with V28's `main` padding and max width. */
export function Page({ children }: { children: React.ReactNode }) {
  const layout = useLayout();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: layout.tablet ? colors.tabletBg : colors.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: layout.pagePadding,
        paddingTop: 6,
        paddingBottom: layout.tablet ? 56 : 40,
        maxWidth: layout.contentMaxWidth,
        alignSelf: 'center',
        width: '100%',
      }}
    >
      {children}
    </ScrollView>
  );
}

/** The prototype's bottom sheet: rounded top corners and a round close button. */
export function Sheet({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={router.close}
      presentationStyle="overFullScreen"
    >
      <View style={sheet.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={router.close} accessibilityLabel="Close" />
        <View style={[sheet.card, { maxHeight: layout.height * 0.9, width: '100%', maxWidth: layout.tablet ? 620 : undefined, alignSelf: 'center' }]}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={router.close}
              style={sheet.close}
            >
              <Text style={sheet.closeText}>×</Text>
            </Pressable>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** `.toast` */
export function Toast({ message }: { message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[toast.wrap, { bottom: insets.bottom + 96 }]}>
      <View style={toast.pill}>
        <Text style={toast.text}>{message}</Text>
      </View>
    </View>
  );
}

const header = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  brand: { fontFamily: displayFont, letterSpacing: -0.6, color: colors.ink },
  avatar: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', color: colors.ink },
});

const bar = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', gap: 5 },
  label: { fontSize: 10, color: colors.tabIdle },
  labelActive: { color: colors.ink, fontWeight: '700' },
});

const rail = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    justifyContent: 'center',
    gap: 7,
    padding: 12,
    ...(Platform.OS === 'web' ? {} : shadow),
  },
  item: { height: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 7 },
  label: { fontSize: 11, color: colors.tabIdle },
  labelActive: { color: colors.ink, fontWeight: '700' },
});

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,18,14,0.34)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  close: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.closeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  closeText: { fontSize: 22, color: colors.ink, lineHeight: 24 },
});

const toast = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    backgroundColor: 'rgba(37,37,34,0.95)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 15,
    marginHorizontal: 24,
  },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});

const glyph = StyleSheet.create({
  box: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
  roof: {
    width: 15,
    height: 15,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
    position: 'absolute',
    top: -1,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  houseBody: { width: 13, height: 10, position: 'absolute', bottom: 1, borderTopWidth: 0 },
  fork: { width: 5, height: 17, borderRadius: 2, position: 'absolute', left: 3 },
  knife: { width: 5, height: 17, borderRadius: 2, position: 'absolute', right: 3, borderBottomWidth: 0 },
  shelfOuter: { width: 16, height: 18, borderRadius: 2 },
  shelfLine: { position: 'absolute', left: 5, width: 11, height: 1.4, borderRadius: 1 },
  calendar: { width: 17, height: 15, borderRadius: 3, marginTop: 2 },
  calendarTop: { position: 'absolute', top: 5, width: 17, height: 1.6 },
  heartLeft: {
    width: 11,
    height: 11,
    borderRadius: 6,
    position: 'absolute',
    left: 1,
    top: 4,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    transform: [{ rotate: '-45deg' }],
  },
  heartRight: {
    width: 11,
    height: 11,
    borderRadius: 6,
    position: 'absolute',
    right: 1,
    top: 4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  head: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 2 },
  shoulders: {
    width: 15,
    height: 9,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    position: 'absolute',
    bottom: 1,
    borderBottomWidth: 0,
  },
});

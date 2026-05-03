import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { tapLight } from '../lib/haptics';
import AccountModal from './AccountModal';
import IconShield from './icons/IconShield';
import IconGlobe from './icons/IconGlobe';
import IconGear from './icons/IconGear';
import IconShare from './icons/IconShare';
import IconPatreon from './icons/IconPatreon';
import IconDiscord from './icons/IconDiscord';
import { colors, fonts, spacing } from '../theme';

// Wood-canyon banner (2026-05-03 redesign) — replaces the prior dark
// brand-and-social-row TopHeader. Layout per mockups/redesign/option-d/:
//
//   [Shield]  STRIDEKEEP:           [Globe] [Gear]
//             Season N · MURAL NAME
//
// The 4 community icons (Share / BMC / Patreon / Discord) that used to
// live here are dropped from the banner per the locked design — they'll
// resurface in a Profile sub-tab section in a future pass. Globe + gear
// stay because globe is the website link (high discoverability) and the
// gear opens AccountModal (the only way into auth/account management).
//
// AccountModal still mounts here because the gear toggles its
// visibility — keeping the modal local to the header lets every screen
// share the same TopHeader without each having to manage its own state.
export default function TopHeader(): React.JSX.Element {
  const [accountOpen, setAccountOpen] = useState(false);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonMuralName = useGameStore((s) => s.seasonMuralName);

  const subtitle = formatSubtitle(seasonNumber, seasonMuralName);

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <IconShield size={42} />

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>STRIDEKEEP</Text>
          {subtitle !== null && (
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          )}
        </View>

        <View style={styles.utilities}>
          <Pressable onPress={tapLight} hitSlop={8} accessibilityRole="button" accessibilityLabel="Share Stridekeep">
            <IconShare size={17} color={colors.accent.brassLight} />
          </Pressable>
          <Pressable onPress={tapLight} hitSlop={8} accessibilityRole="button" accessibilityLabel="stridekeep.app website">
            <IconGlobe size={17} color={colors.accent.brassLight} />
          </Pressable>
          <Pressable onPress={tapLight} hitSlop={8} accessibilityRole="button" accessibilityLabel="Patreon">
            <IconPatreon size={17} />
          </Pressable>
          <View style={styles.discordSlot} accessibilityLabel="Discord (coming soon)">
            <IconDiscord size={17} />
          </View>
          <Pressable
            onPress={() => {
              tapLight();
              setAccountOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <IconGear size={17} color={colors.accent.brassLight} />
          </Pressable>
        </View>
      </View>

      <AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

// "canyon_dawn" → "Season 1 · CANYON DAWN". Returns null when the
// season number is null (between-seasons / pre-bootstrap), so the
// subtitle row gets dropped from the layout entirely rather than
// rendering a stub like "Season — · —".
function formatSubtitle(seasonNumber: number | null, muralName: string | null): string | null {
  if (seasonNumber === null) return null;
  const name = muralName !== null && muralName.trim().length > 0
    ? muralName.replace(/_/g, ' ').toUpperCase()
    : null;
  return name !== null ? `Season ${seasonNumber} · ${name}` : `Season ${seasonNumber}`;
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.banner.mid,
    borderBottomWidth: 2,
    borderBottomColor: colors.banner.edge,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: 10,
    backgroundColor: colors.banner.mid,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: fonts.outfitBlack,
    fontSize: 20,
    color: colors.text.lightCream,
    letterSpacing: 0.5,
    lineHeight: 22,
    // Subtle drop shadow so the title sits "carved" on the banner blue.
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  subtitle: {
    fontFamily: fonts.outfitRegular,
    fontWeight: '600',
    fontSize: 11,
    color: colors.text.lightCream,
    letterSpacing: -0.3,
    marginTop: 4,
  },
  utilities: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  // Discord is "coming soon" per SKILL.md §11 — visual placeholder
  // dimmed via 50% opacity, no Pressable so the row reads as not-yet-
  // tappable. Keep parity with the other 17px slots.
  discordSlot: {
    opacity: 0.5,
  },
});

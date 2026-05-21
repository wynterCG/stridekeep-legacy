import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { tapLight } from '../lib/haptics';
import { useTranslation, t as tSnapshot } from '../i18n';

const STRIDEKEEP_WEBSITE_URL = 'https://stridekeep.app/';
import SettingsModal from './SettingsModal';
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
// gear opens SettingsModal (drill-in list: Account / Privacy /
// Notifications / About).
//
// SettingsModal still mounts here because the gear toggles its
// visibility — keeping the modal local to the header lets every screen
// share the same TopHeader without each having to manage its own state.
export default function TopHeader(): React.JSX.Element {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonMuralName = useGameStore((s) => s.seasonMuralName);
  // Subscribe to language via the hook so the subtitle re-renders on
  // a language flip. The actual formatting uses the snapshot `t` so we
  // can keep `formatSubtitle` as a pure helper outside the component.
  const t = useTranslation();
  void t; // referenced solely to subscribe to language changes
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
          <Pressable
            onPress={() => {
              tapLight();
              // Fire-and-forget; OS handles whether it lands in an
              // in-app browser, the system browser, or a deep-link
              // handler. canOpenURL gate matches the PrivacySection
              // pattern so a hostile / sandboxed environment doesn't
              // unhandled-reject.
              void (async () => {
                try {
                  const ok = await Linking.canOpenURL(STRIDEKEEP_WEBSITE_URL);
                  if (ok) await Linking.openURL(STRIDEKEEP_WEBSITE_URL);
                } catch {
                  // Silent fail — no UI surface in the TopHeader to show
                  // a banner from; user can tap again or open manually.
                }
              })();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="stridekeep.app website"
          >
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
              setSettingsOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <IconGear size={17} color={colors.accent.brassLight} />
          </Pressable>
        </View>
      </View>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </SafeAreaView>
  );
}

// "canyon_dawn" → "Season 1 · CANYON DAWN" (or "Temporada 1 · CANYON
// DAWN" in PT). Returns null when the season number is null
// (between-seasons / pre-bootstrap), so the subtitle row gets dropped
// from the layout entirely rather than rendering a stub like
// "Season — · —". The mural name itself is an atmospheric proper noun
// and stays UNTRANSLATED in both languages — only the "Season N"
// prefix flips between EN and PT.
function formatSubtitle(seasonNumber: number | null, muralName: string | null): string | null {
  if (seasonNumber === null) return null;
  const name = muralName !== null && muralName.trim().length > 0
    ? muralName.replace(/_/g, ' ').toUpperCase()
    : null;
  return name !== null
    ? tSnapshot('header.seasonSubtitleWithName', { n: seasonNumber, name })
    : tSnapshot('header.seasonSubtitleNoName', { n: seasonNumber });
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

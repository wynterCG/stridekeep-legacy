import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AccountModal from './AccountModal';
import SocialIconRow from './SocialIconRow';
import { colors, fonts, spacing } from '../theme';

// Stripped-down persistent header (compound-cards redesign 2026-05-02).
// Just the brand on the left + the social-icon row on the right. Team
// crest, season + countdown chip, purse button, and ShopModal mount
// have all migrated:
//
// - Team identity: surfaced via the mural border colour (red mural for
//   red team players) + the SeasonCard scoreboard team labels.
// - Season + countdown: now in SeasonCard's header line.
// - Purse: now in SeasonCard's stats line.
// - ShopModal: deferred — current Inventory action sheets cover the
//   buy flow; if a discoverability gap emerges, add a SHOP icon to
//   SocialIconRow or a SHOP sub-tab on Inventory.
//
// AccountModal still mounts here because the gear icon (in
// SocialIconRow) toggles its visibility. Keeping the modal local to
// the header lets multiple screens share the same TopHeader without
// each having to manage its own AccountModal state.
export default function TopHeader(): React.JSX.Element {
  const [accountOpen, setAccountOpen] = useState(false);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <Text style={styles.brand}>STRIDEKEEP</Text>
        <SocialIconRow onSettings={() => setAccountOpen(true)} />
      </View>
      <AccountModal visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.bg.overlay,
    borderBottomWidth: 2,
    borderBottomColor: colors.ui.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  brand: {
    fontFamily: fonts.pressStart,
    fontSize: 11,
    color: colors.accent.brassLight,
    letterSpacing: 2,
    flexShrink: 0,
  },
});

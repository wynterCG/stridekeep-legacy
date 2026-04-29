import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ColorDef } from '../types';
import { colors, fonts, radii } from '../theme';

interface Props {
  color: ColorDef;
  // Render the qty badge when defined. 0 renders the badge (e.g. "0" for
  // owned-none cells we want to show as available-but-empty); pass undefined
  // to omit the badge entirely (as in TilePicker target previews).
  qty?: number;
  showCode?: boolean;
  size?: number;
  onPress?: () => void;
  dimmed?: boolean;
}

// Shared color-swatch primitive. Colorblind 2-char code overlays are ON by
// default — `colorCode` is baked into ColorDef server-side at seed time so
// every component (CaseCard, InventoryScreen, TilePicker, ShopModal,
// CraftModal, SeasonEndCeremony, LiveFeed) renders the same code for the
// same color.
//
// Code text uses a semi-transparent dark backdrop pill so it stays readable
// regardless of the swatch hex — avoids per-color luminance computation.
export default function ColorCell({
  color,
  qty,
  showCode = true,
  size = 56,
  onPress,
  dimmed = false,
}: Props): React.JSX.Element {
  const node = (
    <View
      style={[
        styles.cell,
        { backgroundColor: color.hex, width: size, height: size },
        dimmed && styles.dimmed,
      ]}
      accessibilityLabel={`${color.name} (${color.colorCode})`}
    >
      {showCode && (
        <View style={styles.codePill}>
          <Text style={styles.codeText}>{color.colorCode}</Text>
        </View>
      )}
      {qty !== undefined && (
        <View style={styles.qtyBadge}>
          <Text style={styles.qtyText}>{qty}</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{node}</Pressable>;
  }
  return node;
}

const styles = StyleSheet.create({
  cell: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  dimmed: {
    opacity: 0.35,
  },
  codePill: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  codeText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.cream,
    letterSpacing: 1,
    lineHeight: 13,
  },
  qtyBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: fonts.outfitBold,
    fontSize: 10,
    color: colors.text.cream,
    lineHeight: 12,
  },
});

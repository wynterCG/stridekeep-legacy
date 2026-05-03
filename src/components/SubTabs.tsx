import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radii } from '../theme';

export interface TabSpec {
  label: string;
  // Icon component reference (e.g. `IconMural`). Optional — if omitted,
  // the tab renders text-only. Receives `color` so the active/inactive
  // state can recolor the icon.
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
}

interface Props {
  tabs: TabSpec[];
  activeIndex: number;
  onChange: (index: number) => void;
}

// Wood-canyon folder-tab strip (2026-05-03 redesign) — replaces the
// prior brass-flat segmented control. Sits on a banner-blue band with
// each tab as a parchment "folder" that lifts when active. Each tab can
// optionally render an icon before its label (the home variant uses
// mural/cases/person; the inventory variant uses palette/mixing).
//
// The icon-color contract: the Icon component receives `color` matching
// the active state so the same icon component works on both states. The
// icon's default `color` prop fallback is kept on the icon itself.
export default function SubTabs({ tabs, activeIndex, onChange }: Props): React.JSX.Element {
  return (
    <View style={styles.band}>
      <View style={styles.row}>
        {tabs.map((tab, idx) => {
          const isActive = idx === activeIndex;
          const Icon = tab.Icon;
          return (
            <Pressable
              key={tab.label}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => {
                if (isActive) return;
                tapLight();
                onChange(idx);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              {Icon !== undefined && (
                <Icon
                  size={14}
                  color={isActive ? colors.text.cream : colors.text.lightCream}
                />
              )}
              <Text style={[styles.label, !isActive && styles.labelInactive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Banner-blue band that sits behind the folder tabs. The tabs poke
  // up out of it with rounded top corners.
  band: {
    backgroundColor: colors.banner.lo,
    paddingTop: 5,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: '#415266', // recessed inactive — slate-blue
    borderTopLeftRadius: radii.card + 6,
    borderTopRightRadius: radii.card + 6,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.banner.edge,
    marginHorizontal: 3,
  },
  tabActive: {
    backgroundColor: colors.bg.cardHi, // brightest parchment
    paddingTop: 9,
    paddingBottom: 11,
    // Lift effect: the active tab sits 1px above the inactive tabs so
    // it reads as the "front" folder.
    marginTop: -1,
    zIndex: 3,
  },
  label: {
    fontFamily: fonts.outfitBold,
    fontSize: 13,
    color: colors.text.cream,
  },
  labelInactive: {
    color: colors.text.lightCream,
  },
});

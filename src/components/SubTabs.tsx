import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { tapLight } from '../lib/haptics';
import { colors, fonts } from '../theme';

interface Props {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

// Generic horizontal segmented control. Used inside Home (CANVAS / CASES /
// PROFILE) and Inventory (COLORS / MIXING). Hard-edged pixel-art chrome
// per the locked redesign — active tab gets brass background + slate text
// + a brass-deep bottom inset bar; inactive tabs get a subtle dither
// stripe + muted label. Light haptic on tap matches the existing
// SimulateWalk / TilePicker affordance.
//
// Renders on top of the bg.overlay; the parent screen's container provides
// the surrounding padding.
export default function SubTabs({ tabs, activeIndex, onChange }: Props): React.JSX.Element {
  return (
    <View style={styles.row}>
      {tabs.map((label, idx) => {
        const isActive = idx === activeIndex;
        const isLast = idx === tabs.length - 1;
        return (
          <Pressable
            key={label}
            style={[
              styles.tab,
              !isLast && styles.tabBorderRight,
              isActive ? styles.tabActive : styles.tabInactive,
            ]}
            onPress={() => {
              if (isActive) return;
              tapLight();
              onChange(idx);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.ui.border,
    backgroundColor: colors.bg.overlay,
    marginTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  tabBorderRight: {
    borderRightWidth: 2,
    borderRightColor: colors.ui.border,
  },
  tabInactive: {
    backgroundColor: colors.bg.overlay,
  },
  tabActive: {
    backgroundColor: colors.accent.brass,
    // Inset shadow approximation via borderBottom — gives the
    // pixel-button "pressed-in" silhouette without a real inset shadow
    // (RN's shadow* props don't render on Android).
    borderBottomWidth: 3,
    borderBottomColor: colors.accent.brassDeep,
  },
  label: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
  labelActive: {
    color: colors.bg.primary,
  },
});

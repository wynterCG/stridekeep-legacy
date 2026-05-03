import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable, StyleSheet } from 'react-native';
import { tapLight } from '../lib/haptics';
import { colors, fonts, radii } from '../theme';

// State indicator for a sub-tab. 'ready' = something worth surfacing
// (e.g. cases pending); 'rare' = the high-emphasis variant for the
// dopamine-moment tier (e.g. a tier-3 fine case is pending). Dignified-
// positive treatment per the SKILL.md "no alert red" rule — we use the
// brass accent palette, escalating brightness + pulse speed for 'rare'.
export type TabIndicator = 'ready' | 'rare';

export interface TabSpec {
  label: string;
  // Icon component reference (e.g. `IconMural`). Optional — if omitted,
  // the tab renders text-only. Receives `color` so the active/inactive
  // state can recolor the icon.
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
  // When set, renders a top-right notification glyph. 'rare' adds a
  // pulsing brass halo behind the dot for tier-3 cases (Master Pigments)
  // since those earn extra emphasis per the locked design.
  indicator?: TabIndicator;
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
              {!isActive && tab.indicator !== undefined && (
                <TabPulse rare={tab.indicator === 'rare'} />
              )}
              {Icon !== undefined && (
                <Icon
                  size={14}
                  color={isActive ? colors.text.cream : colors.text.lightCream}
                />
              )}
              <Text style={[styles.label, !isActive && styles.labelInactive]}>
                {tab.label}
              </Text>
              {tab.indicator !== undefined && (
                <Indicator rare={tab.indicator === 'rare'} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Full-tab brass overlay that fades in/out over the inactive tab face,
// so the whole sub-tab blinks in cohesion with the corner Indicator
// dot. Suppressed on the active tab (the user is already looking at
// the panel; pulsing would just be noise). 'ready' is a calm 0→0.15
// brass swell; 'rare' escalates to 0→0.30 brassRim at the same faster
// 500ms half-cycle the dot uses, so the dot + tab read as one glow.
function TabPulse({ rare }: { rare: boolean }): React.JSX.Element {
  const peakOpacity = rare ? 0.3 : 0.15;
  const halfCycleMs = rare ? 500 : 800;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: peakOpacity,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, peakOpacity, halfCycleMs]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tabPulse,
        rare ? styles.tabPulseRare : styles.tabPulseReady,
        { opacity },
      ]}
    />
  );
}

// Pulsing brass dot anchored top-right of a sub-tab. 'ready' is calm
// (slow 800ms half-cycle, brass at 0.55-1.0 opacity, 7px). 'rare'
// escalates: brighter brassRim, larger 9px dot, faster 500ms half-
// cycle, plus a halo ring behind that fades in lockstep so the whole
// glyph reads as a stronger glow without a second animation loop.
function Indicator({ rare }: { rare: boolean }): React.JSX.Element {
  const minOpacity = rare ? 0.4 : 0.55;
  const halfCycleMs = rare ? 500 : 800;
  const opacity = useRef(new Animated.Value(minOpacity)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: minOpacity,
          duration: halfCycleMs,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, minOpacity, halfCycleMs]);

  return (
    <Animated.View pointerEvents="none" style={[styles.indicator, { opacity }]}>
      {rare && <View style={styles.indicatorHalo} />}
      <View
        style={[
          styles.indicatorDot,
          rare ? styles.indicatorDotRare : styles.indicatorDotReady,
        ]}
      />
    </Animated.View>
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
  tabPulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.card + 6,
    borderTopRightRadius: radii.card + 6,
  },
  tabPulseReady: {
    backgroundColor: colors.accent.brass,
  },
  tabPulseRare: {
    backgroundColor: colors.accent.brassRim,
  },
  indicator: {
    position: 'absolute',
    top: 6,
    right: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorHalo: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent.brassRim,
    opacity: 0.35,
  },
  indicatorDot: {
    borderRadius: 999,
  },
  indicatorDotReady: {
    width: 7,
    height: 7,
    backgroundColor: colors.accent.brass,
  },
  indicatorDotRare: {
    width: 9,
    height: 9,
    backgroundColor: colors.accent.brassRim,
  },
});

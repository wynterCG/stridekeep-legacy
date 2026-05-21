import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TopHeader from '../components/TopHeader';
import SeasonCard from '../components/SeasonCard';
import SubTabs, { type TabSpec } from '../components/SubTabs';
import IconColors from '../components/icons/IconColors';
import IconMixing from '../components/icons/IconMixing';
import ColorsPanel from './inventory/ColorsPanel';
import MixingPanel from './inventory/MixingPanel';
import { useGameStore } from '../store/gameStore';
import { useCanvasLiveSync } from '../hooks/useCanvasLiveSync';
import { useTeamsCanvasProgressSync } from '../hooks/useTeamsCanvasProgressSync';
import { useTranslation } from '../i18n';
import { colors } from '../theme';

// Phase-4 redesign Inventory shell. Two sub-tabs (COLORS / MIXING) over
// the same shared SeasonCard banner that Home uses. The COLORS sub-tab
// owns the palette grid + action sheet; the MIXING sub-tab absorbs the
// retired CraftModal entirely.
//
// Coordination between sub-tabs: tapping CRAFT WITH on a color cell
// (inside ColorsPanel) bubbles the colorId up here via onCraftWith,
// which switches the active sub-tab to MIXING and sets the recipe
// filter. Replaces the old CraftModal-popover flow with an in-tab
// transition.
//
// useCanvasLiveSync stays at the screen level so the action-sheet's
// PLACE shortcut has canvas state ready even if the player cold-starts
// into Inventory.
export default function InventoryScreen(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  useCanvasLiveSync(team, seasonNumber);
  useTeamsCanvasProgressSync();
  const t = useTranslation();

  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);

  // Built per-render so the labels react to a language flip without
  // remounting the screen. The icon refs are top-level constants so
  // the deps array only needs `t` (which is stable per language).
  const TABS: TabSpec[] = useMemo(
    () => [
      { label: t('inventory.colors'), Icon: IconColors },
      { label: t('inventory.mixing'), Icon: IconMixing },
    ],
    [t],
  );

  // Force the Colors sub-tab whenever the JIT first-case flow advances
  // into the inventory-side steps. Without this, a player who left
  // Mixing active before the tutorial fired lands on Mixing after
  // tapping the spotlit INVENTORY bottom tab, and the next spotlight
  // step (inv-cell) has nothing to anchor to. Only fires on dep change
  // (entering step 3+), so it won't fight the user if they manually
  // swipe to Mixing afterwards.
  const tutorialActiveFlow = useGameStore((s) => s.tutorialActiveFlow);
  const tutorialFlowStep = useGameStore((s) => s.tutorialFlowStep);
  useEffect(() => {
    if (tutorialActiveFlow !== 'first-case') return;
    if (tutorialFlowStep < 3) return;
    setTab(0);
  }, [tutorialActiveFlow, tutorialFlowStep]);

  return (
    <View style={styles.root}>
      <TopHeader />
      <SeasonCard />
      <SubTabs tabs={TABS} activeIndex={tab} onChange={setTab} />
      <View style={styles.panel}>
        {tab === 0 && (
          <ColorsPanel
            onCraftWith={(id) => {
              setFilter(id);
              setTab(1);
            }}
          />
        )}
        {tab === 1 && <MixingPanel filterByInputColorId={filter ?? undefined} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  panel: {
    flex: 1,
  },
});

import React, { useState } from 'react';
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
import { colors } from '../theme';

const TABS: TabSpec[] = [
  { label: 'Colors', Icon: IconColors },
  { label: 'Mixing', Icon: IconMixing },
];

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

  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);

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

import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TopHeader from '../components/TopHeader';
import SeasonCard from '../components/SeasonCard';
import SubTabs, { type TabSpec, type TabIndicator } from '../components/SubTabs';
import IconMural from '../components/icons/IconMural';
import IconCases from '../components/icons/IconCases';
import IconPerson from '../components/icons/IconPerson';
import CanvasPanel from './home/CanvasPanel';
import CasesPanel from './home/CasesPanel';
import ProfilePanel from './home/ProfilePanel';
import { useGameStore } from '../store/gameStore';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { useTeamsCanvasProgressSync } from '../hooks/useTeamsCanvasProgressSync';
import { colors } from '../theme';

// Phase-4 redesign Home shell. Three sub-tabs (CANVAS / CASES / PROFILE)
// share the same persistent SeasonCard banner up top — switching between
// them swaps only the panel body, season context stays visible.
//
// useTeamsLiveSync stays at the screen level (not the panel) so the
// scoreboard inside SeasonCard updates in realtime regardless of which
// sub-tab is active. CanvasPanel owns its own canvas-related state
// (pickerPixel + TilePicker mount); CasesPanel owns the dev buttons;
// ProfilePanel is read-only.
export default function HomeScreen(): React.JSX.Element {
  useTeamsLiveSync();
  useTeamsCanvasProgressSync();
  const [tab, setTab] = useState(0);
  const caseState = useGameStore((s) => s.caseState);

  // Cases-tab indicator escalates with the in-game economy:
  //   - tier-3 (`fine`) pending  → 'rare'  (Master Pigments dopamine)
  //   - any other tier pending   → 'ready' (calm brass dot)
  //   - nothing pending          → no decoration
  // SubTabs handles the pulse + halo; HomeScreen owns the policy.
  const fineReady = caseState.fine.pending > 0;
  const anyReady =
    fineReady ||
    caseState.starter.pending > 0 ||
    caseState.quality.pending > 0;
  const casesIndicator: TabIndicator | undefined = fineReady
    ? 'rare'
    : anyReady
      ? 'ready'
      : undefined;

  // Wood-canyon tab labels: 'CANVAS' renamed to 'Mural' to match the
  // locked mockup spec. The CanvasPanel component itself is unchanged
  // (it still renders the mural canvas + recent feed); only the tab
  // label flipped. Memoised on `casesIndicator` — the icon imports
  // are top-level constants and don't need to be in deps. Without
  // memoisation, useTownFeed re-renders rebuild the array each tick.
  const tabs = useMemo<TabSpec[]>(
    () => [
      { label: 'Mural', Icon: IconMural },
      { label: 'Cases', Icon: IconCases, indicator: casesIndicator },
      { label: 'Profile', Icon: IconPerson },
    ],
    [casesIndicator],
  );

  return (
    <View style={styles.root}>
      <TopHeader />
      <SeasonCard />
      <SubTabs tabs={tabs} activeIndex={tab} onChange={setTab} />
      <View style={styles.panel}>
        {tab === 0 && <CanvasPanel />}
        {tab === 1 && <CasesPanel />}
        {tab === 2 && <ProfilePanel />}
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

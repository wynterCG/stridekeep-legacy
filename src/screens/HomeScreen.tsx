import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import TopHeader from '../components/TopHeader';
import SeasonCard from '../components/SeasonCard';
import SubTabs from '../components/SubTabs';
import CanvasPanel from './home/CanvasPanel';
import CasesPanel from './home/CasesPanel';
import ProfilePanel from './home/ProfilePanel';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { useTeamsCanvasProgressSync } from '../hooks/useTeamsCanvasProgressSync';
import { colors } from '../theme';

const TABS = ['CANVAS', 'CASES', 'PROFILE'] as const;

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
  return (
    <View style={styles.root}>
      <TopHeader />
      <SeasonCard />
      <SubTabs tabs={[...TABS]} activeIndex={tab} onChange={setTab} />
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

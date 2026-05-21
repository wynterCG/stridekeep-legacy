import React, { useEffect, useMemo } from 'react';
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
import { useTranslation } from '../i18n';
import { colors } from '../theme';

// Sub-tab string ↔ index mapping. SubTabs takes an integer activeIndex
// (it indexes into the tabs array); the store carries the string name
// so any code that wants to address a tab semantically (the JIT tutorial
// step 1's `advanceOn` check, for instance) doesn't break if tabs are
// ever reordered.
const TAB_INDEX: Record<'mural' | 'cases' | 'profile', number> = {
  mural: 0,
  cases: 1,
  profile: 2,
};
const TAB_NAMES: ('mural' | 'cases' | 'profile')[] = ['mural', 'cases', 'profile'];

// First-launch detection: the server-side handle_new_user trigger
// assigns a `Stridekeeper-XXXXXX` default nickname; once the user
// picks a custom one the regex stops matching. We use that as the
// "has completed nickname onboarding" gate.
const DEFAULT_NICKNAME_RE = /^Stridekeeper-[a-f0-9]{6}$/;

// Phase-4 redesign Home shell. Three sub-tabs (CANVAS / CASES / PROFILE)
// share the same persistent SeasonCard banner up top — switching between
// them swaps only the panel body, season context stays visible.
//
// useTeamsLiveSync stays at the screen level (not the panel) so the
// scoreboard inside SeasonCard updates in realtime regardless of which
// sub-tab is active. CanvasPanel owns its own canvas-related state
// (pickerPixel + TilePicker mount); CasesPanel owns the dev buttons;
// ProfilePanel is read-only.
//
// The active sub-tab lives in gameStore so the JIT tutorial's "cases-tab"
// step (advanceOn: activeSubTab === 'cases') can read it through the
// shared store rather than wiring callbacks up from SubTabs.
export default function HomeScreen(): React.JSX.Element {
  useTeamsLiveSync();
  useTeamsCanvasProgressSync();
  const t = useTranslation();
  const caseState = useGameStore((s) => s.caseState);
  const activeSubTab = useGameStore((s) => s.activeSubTab);
  const setActiveSubTab = useGameStore((s) => s.setActiveSubTab);

  // Tutorial state. `onboardingActive` drives the welcome modal;
  // `tutorialFlags` gates the one-shot triggers; the JIT actions below
  // start / advance the first-case flow when the player's first case
  // transitions pending 0 → ≥1.
  const nickname = useGameStore((s) => s.nickname);
  const tutorialFlags = useGameStore((s) => s.tutorialFlags);
  const onboardingActive = useGameStore((s) => s.onboardingActive);
  const tutorialActiveFlow = useGameStore((s) => s.tutorialActiveFlow);
  const startOnboarding = useGameStore((s) => s.startOnboarding);
  const startTutorialFlow = useGameStore((s) => s.startTutorialFlow);
  const advanceFlowStep = useGameStore((s) => s.advanceFlowStep);

  // First-launch onboarding modal. Two-card welcome that orients the
  // player on "walking is everything" + the core loop. Fires after the
  // nickname becomes custom (NicknameOnboardingModal dismisses) and
  // never re-fires for the same install (gated by tutorialFlags.onboarding).
  useEffect(() => {
    if (tutorialFlags.onboarding) return;
    if (onboardingActive) return;
    if (nickname === null) return;
    if (DEFAULT_NICKNAME_RE.test(nickname)) return;
    startOnboarding();
  }, [nickname, tutorialFlags.onboarding, onboardingActive, startOnboarding]);

  // First-case JIT trigger. Fires `startTutorialFlow('first-case')` whenever
  // any tier has pending > 0 AND the flow hasn't completed yet AND no other
  // flow is already running. State-based (not transition-based) so it also
  // catches the case where the player closed the app mid-pending and
  // relaunches — the persisted caseState still has pending > 0, but a pure
  // transition watcher would miss it (prev and curr are both > 0 at mount).
  //
  // Guard rails:
  //   - Don't fire while onboardingActive — let the welcome modal close
  //     first so the JIT overlay isn't stacking on top of another modal.
  //   - Don't fire if any flow is already active.
  useEffect(() => {
    if (tutorialFlags.firstCaseFlow) return;
    if (tutorialActiveFlow !== null) return;
    if (onboardingActive) return;
    const anyPending =
      caseState.starter.pending > 0 ||
      caseState.quality.pending > 0 ||
      caseState.fine.pending > 0;
    if (!anyPending) return;
    startTutorialFlow('first-case');
  }, [
    caseState.starter.pending,
    caseState.quality.pending,
    caseState.fine.pending,
    tutorialFlags.firstCaseFlow,
    tutorialActiveFlow,
    onboardingActive,
    startTutorialFlow,
  ]);

  // Reactive advance for the first-case flow's step 0 (cases-tab).
  // Covers the race where the player is already on the Cases sub-tab
  // when the flow starts — common in dev testing (SIMULATE WALK lives
  // on Cases) and possible in production if the player happens to be
  // sitting on Cases when their first case fills. Without this, the
  // SubTabs Pressable's `if (isActive) return;` short-circuit eats the
  // tap and the flow gets stuck on step 0 with no advancement path.
  //
  // tutorialActiveFlow + tutorialFlowStep are in deps so the effect
  // re-runs when the flow starts (not just on activeSubTab changes).
  // The store action no-ops when the current step's expected key isn't
  // 'cases-tab', so this is safe to fire on any of these dependency
  // changes regardless of tutorial state.
  useEffect(() => {
    if (activeSubTab === 'cases') {
      advanceFlowStep('cases-tab');
    }
  }, [activeSubTab, tutorialActiveFlow, advanceFlowStep]);

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
  //
  // tutorialTargetKey on the Cases entry lets the JIT first-case flow's
  // step 0 spotlight just the Cases tab Pressable. SubTabs renders the
  // wrapping TutorialTarget around the matching tab automatically.
  const tabs = useMemo<TabSpec[]>(
    () => [
      { label: t('subtabs.mural'), Icon: IconMural },
      {
        label: t('subtabs.cases'),
        Icon: IconCases,
        indicator: casesIndicator,
        tutorialTargetKey: 'cases-tab',
      },
      { label: t('subtabs.profile'), Icon: IconPerson },
    ],
    [casesIndicator, t],
  );

  const activeIndex = TAB_INDEX[activeSubTab];
  const handleTabChange = (idx: number) => {
    const name = TAB_NAMES[idx];
    if (!name) return;
    setActiveSubTab(name);
    // JIT first-case step 0: tapping the spotlit Cases tab advances the
    // flow. Safe to call regardless of which tab was tapped — the store
    // action validates the expected key matches the current step.
    if (name === 'cases') {
      advanceFlowStep('cases-tab');
    }
  };

  return (
    <View style={styles.root}>
      <TopHeader />
      <SeasonCard />
      <SubTabs tabs={tabs} activeIndex={activeIndex} onChange={handleTabChange} />
      <View style={styles.panel}>
        {activeSubTab === 'mural' && <CanvasPanel />}
        {activeSubTab === 'cases' && <CasesPanel />}
        {activeSubTab === 'profile' && <ProfilePanel />}
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

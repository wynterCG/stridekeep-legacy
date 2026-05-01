import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import CaseCard from '../components/CaseCard';
import SimulateWalkButton from '../components/SimulateWalkButton';
import DevGrantTilesButton from '../components/DevGrantTilesButton';
import DevTriggerCeremonyButton from '../components/DevTriggerCeremonyButton';
import TopHeader from '../components/TopHeader';
import InfoStrip from '../components/InfoStrip';
import SectionKicker from '../components/SectionKicker';
import CanvasView from '../components/CanvasView';
import TilePicker from '../components/TilePicker';
import EmptyStateIcon from '../components/EmptyStateIcon';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { useCanvasLiveSync } from '../hooks/useCanvasLiveSync';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, spacing } from '../theme';

const CANVAS_W = 32;
const CANVAS_H = 32;
// Module-frozen empty map. Returned from the canvasFilled selector when
// `team` is still null (briefly during boot) so Zustand's reference-equality
// check doesn't see a fresh `{}` literal each render and force a re-render
// on every unrelated store change.
const EMPTY_FILLED: Readonly<Record<number, string>> = Object.freeze({});

// Phase-4 hero: the player's team canvas paints in real time as teammates
// place tiles. Tap an unfilled pixel → TilePicker modal. Below the canvas
// the case-opening surface still lives — players need both flows reachable
// without tab switching: cases mint tiles, canvas consumes them.
export default function HomeScreen(): React.JSX.Element {
  useTeamsLiveSync();
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const targetPixels = useGameStore((s) => s.canvasTargetPixels);
  const palette = useGameStore((s) => s.seasonPalette);
  const filled = useGameStore((s) => (team ? s.canvasFilled[team] : EMPTY_FILLED));
  useCanvasLiveSync(team, seasonNumber);

  const [pickerPixel, setPickerPixel] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // CaseCard fires this when its reveal panel mounts — `y` is the card's
  // top in scroll-view coordinates. We scroll so the card top sits ~16px
  // below the screen edge, which leaves the full reveal panel (case row
  // + ~120px panel) inside the viewport on the Samsung A52. Otherwise
  // tapping OPEN on the bottom case (starter) shows the panel half-cut
  // by the bottom nav.
  const handleCaseReveal = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, []);

  const handlePixelTap = (idx: number) => {
    // Only opens the picker on UNFILLED pixels. Tapping a placed pixel
    // is a no-op for now (S4.D will surface "placed by <nick>" tooltip).
    if (filled[idx]) return;
    if (!targetPixels) return;
    if (!targetPixels[idx]) return;
    setPickerPixel(idx);
  };

  const targetColorId =
    pickerPixel !== null ? targetPixels?.[pickerPixel] ?? null : null;

  return (
    <View style={styles.root}>
      <TopHeader />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InfoStrip />

        {team && palette ? (
          <View style={styles.canvasBlock}>
            <CanvasView
              team={team}
              width={CANVAS_W}
              height={CANVAS_H}
              targetPixels={targetPixels}
              filled={filled}
              palette={palette}
              onPixelTap={handlePixelTap}
            />
          </View>
        ) : (
          <View style={styles.canvasPlaceholder}>
            <EmptyStateIcon kind="canvas" size={64} />
            <Text style={styles.placeholderText}>
              {seasonNumber === null
                ? 'Awaiting next season…'
                : 'Loading canvas…'}
            </Text>
          </View>
        )}

        <SectionKicker label="materials" />
        <CaseCard tier="fine" onReveal={handleCaseReveal} scrollRef={scrollRef} />
        <CaseCard tier="quality" onReveal={handleCaseReveal} scrollRef={scrollRef} />
        <CaseCard tier="starter" onReveal={handleCaseReveal} scrollRef={scrollRef} />
        {/* TEMP: __DEV__ gate dropped on every dev button so they appear in
            release APKs during pre-internal-testing smoke runs. RE-GATE
            inside a {__DEV__ && (...)} block before shipping to internal
            testers — these would otherwise let players reset themselves and
            trigger ceremonies in production. */}
        <SimulateWalkButton />
        <DevGrantTilesButton />
        <DevTriggerCeremonyButton />
      </ScrollView>

      {pickerPixel !== null && targetColorId && (
        <TilePicker
          pixelIdx={pickerPixel}
          targetColorId={targetColorId}
          onClose={() => setPickerPixel(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  canvasBlock: {
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  canvasPlaceholder: {
    marginVertical: spacing.md,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: 12,
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.muted,
    letterSpacing: 2,
  },
});

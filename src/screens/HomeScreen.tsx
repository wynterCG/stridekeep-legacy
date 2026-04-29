import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, Text } from 'react-native';
import CaseCard from '../components/CaseCard';
import SimulateWalkButton from '../components/SimulateWalkButton';
import DevGrantTilesButton from '../components/DevGrantTilesButton';
import TopHeader from '../components/TopHeader';
import InfoStrip from '../components/InfoStrip';
import SectionKicker from '../components/SectionKicker';
import CanvasView from '../components/CanvasView';
import TilePicker from '../components/TilePicker';
import { useTeamsLiveSync } from '../hooks/useTeamsLiveSync';
import { useCanvasLiveSync } from '../hooks/useCanvasLiveSync';
import { useGameStore } from '../store/gameStore';
import { colors, fonts, spacing } from '../theme';

const CANVAS_W = 32;
const CANVAS_H = 32;

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
  const filled = useGameStore((s) => (team ? s.canvasFilled[team] : {}));
  useCanvasLiveSync(team, seasonNumber);

  const [pickerPixel, setPickerPixel] = useState<number | null>(null);

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
            <Text style={styles.placeholderText}>
              {seasonNumber === null
                ? 'Awaiting next season…'
                : 'Loading canvas…'}
            </Text>
          </View>
        )}

        <SectionKicker label="materials" />
        <CaseCard tier="fine" />
        <CaseCard tier="quality" />
        <CaseCard tier="starter" />
        {/* Dev surfaces — drop these (or re-add a __DEV__ gate) before public beta. */}
        <SimulateWalkButton />
        <DevGrantTilesButton />
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
  },
  placeholderText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.text.muted,
    letterSpacing: 2,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { fetchMyContribution } from '../lib/seasonEnd';
import type { SeasonEndSnapshot, Team } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

type Variant = 'win' | 'lose' | 'tie' | 'noqueue';

// __DEV__-gated ceremony trigger. Constructs a synthetic
// SeasonEndSnapshot from the current store state and pushes it via
// setPendingSeasonEnd, bypassing the boot/realtime path entirely so a
// 14-day rollover wait is unnecessary during UX iteration.
//
// Caveat: pressing CONTINUE on the ceremony still calls applySeasonReset,
// which wipes inventory / purse / case progress / sellHistory and clears
// canvasFilled in memory. The canvas is server-authoritative so
// useCanvasLiveSync re-hydrates it on next focus; inventory is local-
// only and stays gone until DevGrantTilesButton refills it. Acceptable
// trade-off for a __DEV__ surface — never ships in release builds.
export default function DevTriggerCeremonyButton(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const seasonPalette = useGameStore((s) => s.seasonPalette);
  const seasonRecipes = useGameStore((s) => s.seasonCraftRecipes);
  const canvasTargetPixels = useGameStore((s) => s.canvasTargetPixels);
  const canvasFilled = useGameStore((s) => s.canvasFilled);
  const teamsCanvasProgress = useGameStore((s) => s.teamsCanvasProgress);
  const seasonStartedAt = useGameStore((s) => s.seasonStartedAt);
  const seasonSoftCapAt = useGameStore((s) => s.seasonSoftCapAt);
  const setPendingSeasonEnd = useGameStore((s) => s.setPendingSeasonEnd);

  const disabled = seasonNumber === null || team === null;

  async function fireVariant(variant: Variant): Promise<void> {
    if (disabled || seasonNumber === null || team === null) return;
    const otherTeam: Team = team === 'red' ? 'blue' : 'red';
    const winnerTeam: Team | null =
      variant === 'win' ? team : variant === 'lose' ? otherTeam : null;
    const noQueue = variant === 'noqueue';

    // Real per-user contribution count for the active season. Same RPC
    // the production boot path calls. Falls back to 0 on RLS/network
    // failure (the RPC wrapper already swallows + warns).
    const myContribution = await fetchMyContribution(seasonNumber);

    // Approximate completion counts (out of 1024 pixels) for visual
    // realism — real season-end numbers are usually high. Actual placed
    // pixel detail still comes from the live canvasFilled state so the
    // canvases look real, just with the percent labels overridden.
    const fakeProgress =
      variant === 'win'
        ? { red: team === 'red' ? 924 : 781, blue: team === 'blue' ? 924 : 781 }
        : variant === 'lose'
          ? { red: team === 'red' ? 781 : 924, blue: team === 'blue' ? 781 : 924 }
          : { red: 832, blue: 832 };

    const snap: SeasonEndSnapshot = {
      prevSeasonNumber: seasonNumber,
      winnerTeam,
      myTeam: team,
      iWon: winnerTeam !== null && winnerTeam === team,
      myContribution,
      prevPalette: seasonPalette,
      prevTargetPixels: canvasTargetPixels,
      prevFilled: canvasFilled,
      prevCompletion: variant === 'noqueue' ? teamsCanvasProgress : fakeProgress,
      // For the dev button we mirror current season data into the "new"
      // fields so applySeasonReset is effectively a no-op for season
      // data (palette/recipes/target stay valid post-CONTINUE; inventory
      // and case progress still get wiped, see header note).
      newSeasonNumber: noQueue ? null : seasonNumber,
      newSeasonName: noQueue ? null : 'TEST MURAL',
      newPalette: noQueue ? null : seasonPalette,
      newRecipes: noQueue ? null : seasonRecipes,
      newTargetPixels: noQueue ? null : canvasTargetPixels,
      newStartedAt: noQueue ? null : seasonStartedAt,
      newSoftCapAt: noQueue ? null : seasonSoftCapAt,
    };

    setPendingSeasonEnd(snap);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>DEV · TRIGGER CEREMONY</Text>
      <View style={styles.row}>
        {(['win', 'lose', 'tie', 'noqueue'] as Variant[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.pill, disabled && styles.pillDisabled]}
            onPress={() => {
              void fireVariant(v);
            }}
            disabled={disabled}
          >
            <Text style={styles.pillText}>{labelFor(v)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function labelFor(v: Variant): string {
  if (v === 'win') return 'WIN';
  if (v === 'lose') return 'LOSE';
  if (v === 'tie') return 'TIE';
  return 'NO QUEUE';
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  heading: {
    fontFamily: fonts.bebasNeue,
    fontSize: 11,
    color: colors.text.dim,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillText: {
    fontFamily: fonts.bebasNeue,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 1,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { loadSeasonEndSnapshot } from '../lib/seasonEnd';
import { supabase } from '../lib/supabase';
import type { SeasonEndSnapshot, Team } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

// Look up the smallest-numbered season > current. With season 2+ now
// being seeded ahead of rollover, this is what should appear in the
// ceremony's "Next up" preview — the same row that production rollover
// would promote. Returns null if no queued season exists (we then fall
// back to passing current-as-next for UI-standalone testing).
async function findQueuedNextSeasonNumber(
  currentSeasonNumber: number,
): Promise<number | null> {
  const { data } = await supabase
    .from('seasons')
    .select('number')
    .gt('number', currentSeasonNumber)
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const n = Number(data.number);
  return Number.isFinite(n) ? n : null;
}

type Variant = 'win' | 'lose' | 'tie' | 'noqueue';

// __DEV__-gated ceremony trigger. Reuses the production
// loadSeasonEndSnapshot to capture the REAL current state of both
// teams' canvases (the in-memory store only has the player's team
// because useCanvasLiveSync only subscribes to one), then overrides
// just the variant-specific fields (winnerTeam, iWon, prevCompletion).
// The new* fields are mirrored from the active season so CONTINUE's
// applySeasonReset is effectively a palette/target no-op for the dev
// path.
//
// Caveat: pressing CONTINUE still wipes inventory / purse / case
// progress / sellHistory in the store. The canvas is server-
// authoritative so useCanvasLiveSync re-hydrates it on next focus.
// Use DevGrantTilesButton to repopulate inventory between tests.
// Acceptable trade-off for a __DEV__ surface — never ships in release
// builds (re-gate behind __DEV__ before internal testing).
export default function DevTriggerCeremonyButton(): React.JSX.Element {
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const setPendingSeasonEnd = useGameStore((s) => s.setPendingSeasonEnd);

  const disabled = seasonNumber === null || team === null;

  async function fireVariant(variant: Variant): Promise<void> {
    if (disabled || seasonNumber === null || team === null) return;
    const otherTeam: Team = team === 'red' ? 'blue' : 'red';
    const noQueue = variant === 'noqueue';

    // Build the real snapshot for the current season — fetches both
    // teams' canvas_pixels, real palette + target_pixels, real
    // my_contribution_count. For the "next up" preview, look up the
    // actual queued next-season row (e.g. Mistfall when current is
    // Wine Canyon). Falls back to the current season as new if no
    // queued mural exists — keeps the UI testable when only one season
    // has been seeded.
    let nextSeasonNumber: number | null;
    if (noQueue) {
      nextSeasonNumber = null;
    } else {
      const queued = await findQueuedNextSeasonNumber(seasonNumber);
      nextSeasonNumber = queued ?? seasonNumber;
    }
    let baseSnap: SeasonEndSnapshot;
    try {
      baseSnap = await loadSeasonEndSnapshot(seasonNumber, nextSeasonNumber);
    } catch (err) {
      console.warn('[stridekeep] dev ceremony snapshot failed:', err);
      return;
    }

    const winnerTeam: Team | null =
      variant === 'win' ? team : variant === 'lose' ? otherTeam : null;

    // Override completion counts (out of 1024) with season-end-realistic
    // values for the win/lose/tie variants. NO-QUEUE keeps the real
    // live progress so the variant tests against actual canvas state.
    const variantCompletion =
      variant === 'win'
        ? { red: team === 'red' ? 924 : 781, blue: team === 'blue' ? 924 : 781 }
        : variant === 'lose'
          ? { red: team === 'red' ? 781 : 924, blue: team === 'blue' ? 781 : 924 }
          : variant === 'tie'
            ? { red: 832, blue: 832 }
            : baseSnap.prevCompletion;

    // Match prevFilled to variantCompletion so the rendered canvas
    // image agrees with the percent text. Without this, an override
    // saying "RED 90%" alongside the real ~5-pixel canvas (typical
    // solo-test state) reads as a contradiction. Sample pixel_idx
    // entries from the season's target_pixels — colors stay accurate
    // because each filled cell uses the target's intended color.
    const prevFilled = noQueue
      ? baseSnap.prevFilled
      : {
          red: fakeFilledFromTarget(baseSnap.prevTargetPixels, variantCompletion.red),
          blue: fakeFilledFromTarget(baseSnap.prevTargetPixels, variantCompletion.blue),
        };

    const snap: SeasonEndSnapshot = {
      ...baseSnap,
      winnerTeam,
      iWon: winnerTeam !== null && winnerTeam === team,
      prevCompletion: variantCompletion,
      prevFilled,
      newSeasonName: noQueue ? null : (baseSnap.newSeasonName ?? 'TEST MURAL'),
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

// Sample `count` random pixel_idx entries from target_pixels and use
// each entry's target color as the fill color. Result: a synthetic
// filled-pixel map whose Object.keys().length === count, suitable as
// prevFilled for ceremony preview. Caller picks `count` to match the
// variantCompletion they're displaying so the canvas image and percent
// text agree.
function fakeFilledFromTarget(
  targetPixels: Record<number, string> | null,
  count: number,
): Record<number, string> {
  if (!targetPixels || count <= 0) return {};
  const keys = Object.keys(targetPixels);
  const n = Math.min(count, keys.length);
  // Fisher-Yates shuffle is overkill for a __DEV__ surface — sort with a
  // random comparator gives "random enough" sampling for visual ceremony.
  const shuffled = [...keys].sort(() => Math.random() - 0.5);
  const out: Record<number, string> = {};
  for (let i = 0; i < n; i += 1) {
    const idx = Number(shuffled[i]);
    if (!Number.isFinite(idx)) continue;
    const colorId = targetPixels[idx];
    if (typeof colorId === 'string') out[idx] = colorId;
  }
  return out;
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

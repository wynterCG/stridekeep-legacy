import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useCanvasLiveSync } from '../../hooks/useCanvasLiveSync';
import { useTownFeed } from '../../hooks/useTownFeed';
import CanvasView from '../../components/CanvasView';
import TilePicker from '../../components/TilePicker';
import EmptyStateIcon from '../../components/EmptyStateIcon';
import PixelFrame from '../../components/PixelFrame';
import { relativeTime } from '../../hooks/useTownFeed';
import { colorHex, colorName } from '../../data/colors';
import { colors, fonts, spacing } from '../../theme';

const CANVAS_W = 32;
const CANVAS_H = 32;
const RECENT_FEED_ROWS = 3;
const EMPTY_FILLED: Readonly<Record<number, string>> = Object.freeze({});

// CANVAS sub-tab body. Hosts the framed mural canvas + 3-row inline
// "RECENT" feed underneath. Owns its own canvas-related local state
// (pickerPixel + TilePicker mount); ScrollView wraps the whole thing
// so longer recent-feed entries don't push the canvas off-screen.
//
// Per the locked redesign, this panel is the screen's hero — Canvas
// dominates the viewport at glance. The RECENT feed under it gives
// just-enough community context (last few events) without competing
// for attention the way a full LiveFeed would.
export default function CanvasPanel(): React.JSX.Element {
  const { width: screenWidth } = useWindowDimensions();
  const team = useGameStore((s) => s.team);
  const seasonNumber = useGameStore((s) => s.seasonNumber);
  const targetPixels = useGameStore((s) => s.canvasTargetPixels);
  const palette = useGameStore((s) => s.seasonPalette);
  const filled = useGameStore((s) => (team ? s.canvasFilled[team] : EMPTY_FILLED));
  const teamsCanvasProgress = useGameStore((s) => s.teamsCanvasProgress);
  // Pulled out of SeasonCard's stats row and paired with "% FILLED" so
  // the line under the mural reads as a single contribution summary
  // ("3 TILES · 8% FILLED") instead of two stats living in two places.
  const tilesLifetime = useGameStore((s) => s.lifetimeStats.tiles_placed_lifetime);

  // CanvasView already subscribes via useCanvasLiveSync inside the
  // existing HomeScreen pattern; we re-subscribe here so the panel can
  // mount independently. Same hook, idempotent.
  useCanvasLiveSync(team, seasonNumber);

  // RECENT feed — 3 most recent events from the same poll source the
  // (now-retired) LiveFeed used. Slimmer rendering: one line per event,
  // pixel-art row treatment. Skipping the loading state since the panel
  // already shows a richer canvas placeholder when not ready.
  const { events } = useTownFeed();
  const recent = events.slice(0, RECENT_FEED_ROWS);

  const [pickerPixel, setPickerPixel] = useState<number | null>(null);
  const targetColorId =
    pickerPixel !== null ? targetPixels?.[pickerPixel] ?? null : null;

  const handlePixelTap = (idx: number) => {
    if (filled[idx]) return;
    if (!targetPixels) return;
    if (!targetPixels[idx]) return;
    setPickerPixel(idx);
  };

  // Frame accent matches the player's team color so red-team players
  // see a red-toned matte hairline and blue see a blue one. Keeps team
  // identity visible without a separate banner.
  const teamAccent =
    team === 'red'
      ? colors.team.red
      : team === 'blue'
        ? colors.team.blue
        : colors.accent.brassLight;

  // Compute a target canvas size that fits inside the frame (outer
  // wood + matte). The panel padding eats ~32px of width; the frame
  // itself eats wood*2 + matte*2 = ~40px. So canvas can be up to
  // (screen - 32 - 40) wide, capped at 320 for layout sanity.
  const maxCanvasPx = Math.min(screenWidth - 80, 320);

  const completion = teamsCanvasProgress[team ?? 'red'] ?? 0;
  const totalPixels = CANVAS_W * CANVAS_H;
  const pct = totalPixels > 0 ? Math.round((completion / totalPixels) * 100) : 0;

  return (
    <View style={styles.root}>
      {team && palette ? (
        <PixelFrame accentColor={teamAccent}>
          {/* Passing `size` explicitly so CanvasView matches the
              wrapper exactly — without it CanvasView's self-computed
              size (screenWidth - 32) overflows the matte on devices
              wider than ~352dp, breaking the picture-frame illusion
              AND mis-aligning the tap-target Pressable. */}
          <CanvasView
            team={team}
            width={CANVAS_W}
            height={CANVAS_H}
            targetPixels={targetPixels}
            filled={filled}
            palette={palette}
            onPixelTap={handlePixelTap}
            size={maxCanvasPx}
          />
        </PixelFrame>
      ) : (
        <View style={styles.placeholder}>
          <EmptyStateIcon kind="canvas" size={64} />
          <Text style={styles.placeholderText}>
            {seasonNumber === null ? 'Awaiting next season…' : 'Loading canvas…'}
          </Text>
        </View>
      )}

      <View style={styles.completionLine}>
        <Text style={styles.completionText}>
          {`${tilesLifetime.toLocaleString()} TILES`}
          <Text style={styles.completionSep}>{'  ·  '}</Text>
          {`${pct}% FILLED`}
        </Text>
      </View>

      <Text style={styles.recentLabel}>RECENT</Text>
      <View style={styles.recentList}>
        {recent.length === 0 ? (
          <Text style={styles.recentEmpty}>No activity yet.</Text>
        ) : (
          recent.map((e) => {
            const swatchHex = e.color_id ? colorHex(palette, e.color_id) : '#666';
            const name = e.color_id ? colorName(palette, e.color_id) : null;
            return (
              <View key={e.id} style={styles.recentRow}>
                {e.color_id && (
                  <View style={[styles.swatch, { backgroundColor: swatchHex }]} />
                )}
                <Text style={styles.recentText} numberOfLines={1}>
                  <Text style={styles.recentName}>{e.nickname}</Text>
                  <Text style={styles.recentBody}>{verbForKind(e, name)}</Text>
                </Text>
                <Text style={styles.recentTime}>{relativeTime(e.created_at)}</Text>
              </View>
            );
          })
        )}
      </View>

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

// Slim copy variant (vs the retired LiveFeed's longer copy). Compact
// for the 3-row inline strip — keeps each row to one truncated line.
function verbForKind(
  e: { kind: string; team: string | null; tier: string | null; qty: number },
  colorName: string | null,
): string {
  const c = colorName ?? '—';
  switch (e.kind) {
    case 'tile_placed':
      return ` placed ${c}`;
    case 'case_opened':
      return ` opened ${c}`;
    case 'crafted':
      return e.qty > 1 ? ` crafted ${e.qty}× ${c}` : ` crafted ${c}`;
    case 'sold':
      return e.qty > 1 ? ` sold ${e.qty}× ${c}` : ` sold ${c}`;
    case 'shop_bought':
      return ` bought ${c}`;
    case 'milestone':
      return ` ${e.team?.toUpperCase() ?? ''} hit ${e.qty}%`;
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  placeholder: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 2,
    borderColor: colors.ui.border,
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: fonts.pressStart,
    fontSize: 9,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
  completionLine: {
    alignItems: 'center',
  },
  completionText: {
    fontFamily: fonts.pressStart,
    fontSize: 9,
    color: colors.accent.brassLight,
    letterSpacing: 2,
  },
  completionSep: {
    color: colors.text.dim,
  },
  recentLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 8,
    color: colors.accent.brass,
    letterSpacing: 2,
    marginBottom: 4,
    textAlign: 'center',
  },
  recentList: {
    gap: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.bg.overlay,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  swatch: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  recentText: {
    flex: 1,
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
  },
  recentName: {
    color: colors.text.cream,
    fontFamily: fonts.outfitBold,
  },
  recentBody: {
    color: colors.text.secondary,
  },
  recentTime: {
    fontFamily: fonts.outfitRegular,
    fontSize: 10,
    color: colors.text.dim,
  },
  recentEmpty: {
    fontFamily: fonts.outfitRegular,
    fontSize: 12,
    color: colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});

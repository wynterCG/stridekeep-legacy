import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { relativeTime } from '../hooks/useTownFeed';
import { useGameStore } from '../store/gameStore';
import { colorName, colorHex } from '../data/colors';
import type { FeedEvent } from '../types';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  events: FeedEvent[];
  loading: boolean;
}

// Phase-4 5-event-kind feed (replaces Phase-3 deposits). Per plan §215-222:
//   tile_placed   — "<nick> placed [swatch] Gold Leaf on RED's mural" (team-colored accent, bolder)
//   case_opened   — "<nick> opened a Quality case → [swatch] Steel Blue" (quieter)
//   crafted       — "<nick> crafted [swatch] Olive Drab"
//   sold          — "<nick> sold 3× [swatch] Brick Red"
//   shop_bought   — "<nick> bought [swatch] Lapis Ultramarine"
//
// Color name + swatch resolved against the active seasonPalette in the
// store. If palette is null (between rollovers, or pre-Step-5 backend),
// fall back to displaying the colorId — uglier but never crashes.
export default function LiveFeed({ events, loading }: Props): React.JSX.Element {
  const palette = useGameStore((s) => s.seasonPalette);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>LIVE FEED</Text>
        {loading && <Text style={styles.subtle}>refreshing…</Text>}
      </View>

      {events.length === 0 ? (
        <Text style={styles.empty}>No activity yet.</Text>
      ) : (
        events.map((e) => <FeedRow key={e.id} event={e} palette={palette} />)
      )}
    </View>
  );
}

interface FeedRowProps {
  event: FeedEvent;
  palette: ReturnType<typeof useGameStore.getState>['seasonPalette'];
}

function FeedRow({ event, palette }: FeedRowProps): React.JSX.Element {
  const swatchHex = event.color_id ? colorHex(palette, event.color_id) : '#666';
  const name = event.color_id ? colorName(palette, event.color_id) : '—';
  const isTilePlaced = event.kind === 'tile_placed';
  // Step 7: bot-emitted tile_placed rows render distinctly from human
  // ones — humans get the celebratory bold + brass; bots get a quieter
  // italic + muted treatment with a small `· bot` tag. Other bot kinds
  // (atmospheric case_opened/sold/etc.) intentionally blend with humans
  // so the world feels alive — `is_bot` is ignored on those.
  const isBotPlacement = isTilePlaced && event.is_bot;
  const humanTilePlaced = isTilePlaced && !event.is_bot;

  return (
    <View style={[styles.row, humanTilePlaced && styles.rowEmphasis]}>
      <View
        style={[
          styles.swatch,
          { backgroundColor: swatchHex },
          isTilePlaced && {
            borderColor:
              isBotPlacement
                ? colors.ui.border
                : event.team === 'red'
                  ? colors.team.red
                  : event.team === 'blue'
                    ? colors.team.blue
                    : colors.ui.border,
            borderWidth: 1,
            opacity: isBotPlacement ? 0.7 : 1,
          },
        ]}
      />
      <Text style={styles.line} numberOfLines={1}>
        <Text
          style={[
            styles.nickname,
            humanTilePlaced && styles.nicknameEmphasis,
            isBotPlacement && styles.nicknameBot,
          ]}
        >
          {event.nickname}
        </Text>
        <Text style={styles.dim}>{' '}</Text>
        <Text style={humanTilePlaced ? styles.bodyEmphasis : styles.body}>
          {copyForEvent(event, name)}
        </Text>
        {isBotPlacement && <Text style={styles.botTag}> · bot</Text>}
      </Text>
      <Text style={styles.time}>{relativeTime(event.created_at)}</Text>
    </View>
  );
}

function copyForEvent(e: FeedEvent, name: string): string {
  switch (e.kind) {
    case 'tile_placed': {
      const teamLabel = e.team === 'red' ? "RED's mural" : e.team === 'blue' ? "BLUE's mural" : 'the mural';
      return `placed ${name} on ${teamLabel}`;
    }
    case 'case_opened': {
      const tierLabel = e.tier ? capitalize(e.tier) : 'a';
      return `opened a ${tierLabel} case → ${name}`;
    }
    case 'crafted':
      return e.qty > 1 ? `crafted ${e.qty}× ${name}` : `crafted ${name}`;
    case 'sold':
      return e.qty > 1 ? `sold ${e.qty}× ${name}` : `sold ${name}`;
    case 'shop_bought':
      return e.qty > 1 ? `bought ${e.qty}× ${name}` : `bought ${name}`;
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: radii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brass,
    letterSpacing: 2,
  },
  subtle: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
  },
  empty: {
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
    color: colors.text.muted,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowEmphasis: {
    // Subtle background tint for the louder tile-placed events.
    backgroundColor: 'rgba(199,156,74,0.04)',
    borderRadius: radii.button,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  line: {
    flex: 1,
    fontFamily: fonts.outfitRegular,
    fontSize: 13,
  },
  nickname: {
    color: colors.text.cream,
    fontFamily: fonts.outfitBold,
  },
  nicknameEmphasis: {
    color: colors.accent.brassLight,
  },
  nicknameBot: {
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  botTag: {
    color: colors.text.dim,
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    fontStyle: 'italic',
  },
  body: {
    color: colors.text.secondary,
  },
  bodyEmphasis: {
    color: colors.text.cream,
    fontFamily: fonts.outfitBold,
  },
  dim: {
    color: colors.text.muted,
  },
  time: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.dim,
    marginLeft: spacing.sm,
  },
});

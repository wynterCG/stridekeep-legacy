import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useGameStore } from '../../store/gameStore';
import { useCanvasLiveSync } from '../../hooks/useCanvasLiveSync';
import { useTownFeed } from '../../hooks/useTownFeed';
import CanvasView, { type CanvasViewHandle } from '../../components/CanvasView';
import TilePicker from '../../components/TilePicker';
import EmptyStateIcon from '../../components/EmptyStateIcon';
import PixelFrame from '../../components/PixelFrame';
import { placeErrorMessage } from '../../lib/placeErrors';
import { tapLight } from '../../lib/haptics';
import { relativeTime } from '../../hooks/useTownFeed';
import { colorHex, colorName, colorRarity, type Rarity } from '../../data/colors';
import { RarityName } from '../../components/RarityName';
import type { Team } from '../../types';
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
  const teamsCanvasProgress = useGameStore((s) => s.teamsCanvasProgress);
  const placeTile = useGameStore((s) => s.placeTile);
  const setPendingTileFlight = useGameStore((s) => s.setPendingTileFlight);
  const pendingTileFlight = useGameStore((s) => s.pendingTileFlight);
  // Pulled out of SeasonCard's stats row and paired with "% FILLED" so
  // the line under the mural reads as a single contribution summary
  // ("3 TILES · 8% FILLED") instead of two stats living in two places.
  const tilesLifetime = useGameStore((s) => s.lifetimeStats.tiles_placed_lifetime);

  // Horizontal-swipe lets the player toggle the canvas they're looking
  // at — own team by default, swipes flip to the enemy. Both teams stay
  // in `canvasFilled`; the second useCanvasLiveSync below keeps the
  // enemy slot live while the Mural sub-tab is mounted.
  const enemyTeam: Team | null =
    team === 'red' ? 'blue' : team === 'blue' ? 'red' : null;
  const [viewingTeam, setViewingTeam] = useState<Team | null>(team);

  // Card-swipe slide animation. translateX drives the canvas from
  // 0 → ±slideDistance during phase 1 (current canvas leaves), data
  // swaps + value jumps to ∓slideDistance, then phase 2 animates back
  // to 0 (new canvas slides in from the opposite side). swappingRef
  // gates re-fires while a slide is in flight.
  const translateX = useRef(new Animated.Value(0)).current;
  const swappingRef = useRef(false);
  // True only while the post-release snap-back spring is animating.
  // handlePanMove uses this to detect "user re-grabbed mid-snap-back"
  // and run the stopAnimation+setOffset dance (so the new pan is
  // additive to the spring's current position, not relative to 0).
  const snapBackActiveRef = useRef(false);

  useEffect(() => {
    setViewingTeam(team);
    // Defensive reset: if the player's own team changes mid-flip,
    // clear the in-flight animation so the canvas isn't stuck off-axis.
    translateX.setValue(0);
    translateX.setOffset(0);
    swappingRef.current = false;
    snapBackActiveRef.current = false;
  }, [team, translateX]);
  const isOwnView = viewingTeam !== null && viewingTeam === team;
  const filled = useGameStore((s) =>
    viewingTeam ? s.canvasFilled[viewingTeam] : EMPTY_FILLED,
  );

  // Subscribe both teams while CanvasPanel is on screen so the swap is
  // instantaneous (no "loading" flash on first swipe). InventoryScreen
  // still mounts only the own-team sync — no canvas there.
  useCanvasLiveSync(team, seasonNumber);
  useCanvasLiveSync(enemyTeam, seasonNumber);

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

  // Imperative handle on CanvasView so we can resolve any cell's
  // window-coords for the fly-to animation. Used by handleCommit
  // (canvas TilePicker → flight) AND the inventory hand-off effect
  // (CanvasPanel mounts with pendingTileFlight already set; this
  // effect lazily resolves the target rect once layout has settled).
  const canvasRef = useRef<CanvasViewHandle>(null);

  const handleCommit = async () => {
    const idx = pickerPixel;
    const colorId = targetColorId;
    if (idx === null || colorId === null) return;
    const targetRect = await canvasRef.current?.getCellWindowRect(idx);
    setPickerPixel(null);
    if (!targetRect) return;
    setPendingTileFlight({ colorId, pixelIdx: idx, target: targetRect });
    // Confirmation haptic mirrors the inventory branch — both PLACE
    // entry points should buzz on commit. Removed from TilePicker
    // when the await/timeout went away; lives here now.
    tapLight();
    // Fire-and-forget. placeTile handles optimistic deduct + rollback;
    // we surface server failures here because the picker has already
    // closed and there's no in-modal status line to update.
    const result = await placeTile(colorId, idx);
    if (!result.ok) {
      // Clear the in-flight tile so the user doesn't see it land on a
      // cell the server rejected. Mirrors the inventory branch's
      // failure path. No-op if the flight already completed.
      setPendingTileFlight(null);
      Alert.alert('Could not place tile', placeErrorMessage(result, palette));
    }
  };

  // Inventory hand-off resolver. ColorsPanel sets pendingTileFlight
  // with target=null before navigating Home; once we mount and have a
  // canvasRef, measure the destination cell and update the store so
  // FlightOverlay starts the animation. requestAnimationFrame gives
  // the layout one frame to settle (CanvasView wraps in an
  // Animated.View for the swipe-translate, so its measureInWindow
  // result on the very first commit can be off otherwise).
  useEffect(() => {
    if (!pendingTileFlight) return;
    if (pendingTileFlight.target !== null) return;
    const idx = pendingTileFlight.pixelIdx;
    const raf = requestAnimationFrame(() => {
      void canvasRef.current?.getCellWindowRect(idx).then((rect) => {
        if (!rect) return;
        // Re-read from store to confirm the user hasn't navigated
        // away or this flight hasn't been superseded by another.
        const current = useGameStore.getState().pendingTileFlight;
        if (!current || current.pixelIdx !== idx || current.target !== null) {
          return;
        }
        setPendingTileFlight({ ...current, target: rect });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [pendingTileFlight, setPendingTileFlight]);

  // Frame accent + completion both follow the VIEWING team, not the
  // player's own team — so when the user swipes to the enemy canvas
  // they see the enemy's colour hairline + the enemy's % filled.
  const teamAccent =
    viewingTeam === 'red'
      ? colors.team.red
      : viewingTeam === 'blue'
        ? colors.team.blue
        : colors.accent.brassLight;

  // Cap at 230 so all 3 RECENT_FEED_ROWS fit above the bottom tab bar
  // on a ~915dp-tall screen without scrolling. Earlier 280 left the
  // third feed row clipped beneath the nav.
  const maxCanvasPx = Math.min(screenWidth - 80, 230);

  const completion = teamsCanvasProgress[viewingTeam ?? 'red'] ?? 0;
  const totalPixels = CANVAS_W * CANVAS_H;
  const pct = totalPixels > 0 ? Math.round((completion / totalPixels) * 100) : 0;

  // Tinder-style live drag. CanvasView calls handlePanMove with the
  // gestureState dx every move event — we mirror it on translateX so
  // the canvas follows the finger immediately. No setState here:
  // translateX is a single Animated.Value driven directly from JS, so
  // there's no React render churn during the drag.
  const handlePanMove = (dx: number) => {
    if (swappingRef.current) return;
    if (snapBackActiveRef.current) {
      // User re-grabbed during a snap-back. Capture the spring's
      // current value as an offset so this gesture's dx is additive
      // (the canvas stays where it was, then follows the finger
      // from there). The setValue(dx) MUST happen inside the
      // stopAnimation callback — calling it outside races the
      // async callback and produces a visible jump.
      snapBackActiveRef.current = false;
      translateX.stopAnimation((current) => {
        translateX.setOffset(current);
        translateX.setValue(dx);
      });
      return;
    }
    translateX.setValue(dx);
  };

  // On release, commit the swap if the user has dragged past
  // SWIPE_COMMIT_DX OR flicked fast enough (|vx| > SWIPE_COMMIT_VX).
  // Below either threshold we snap back to 0 with a gentle spring.
  const handlePanEnd = (dx: number, vx: number) => {
    // Merge any in-effect offset back into the value so the next
    // animation's toValue is interpreted in absolute coordinates.
    // (Set during a re-grab in handlePanMove; harmless no-op when
    // there's no offset.)
    translateX.flattenOffset();
    if (swappingRef.current) return;
    if (!enemyTeam) {
      snapBackActiveRef.current = true;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start(() => {
        snapBackActiveRef.current = false;
      });
      return;
    }

    const SWIPE_COMMIT_DX = 50;
    const SWIPE_COMMIT_VX = 0.4; // dp/ms — RN gestureState velocity

    const shouldCommit =
      Math.abs(dx) > SWIPE_COMMIT_DX || Math.abs(vx) > SWIPE_COMMIT_VX;

    if (!shouldCommit) {
      snapBackActiveRef.current = true;
      Animated.spring(translateX, {
        toValue: 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }).start(() => {
        snapBackActiveRef.current = false;
      });
      return;
    }

    swappingRef.current = true;
    const sign = dx > 0 ? 1 : -1;
    const slideDistance = maxCanvasPx + 60;

    // Phase 1: from current dx to ±slideDistance. Animation runs on
    // the UI thread via useNativeDriver — JS only owns the start/end
    // callbacks.
    Animated.timing(translateX, {
      toValue: sign * slideDistance,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setViewingTeam((cur) => (cur === team ? enemyTeam : team));
      translateX.setValue(-sign * slideDistance);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        swappingRef.current = false;
      });
    });
  };

  return (
    <View style={styles.root}>
      {team && viewingTeam && palette ? (
        <Animated.View style={{ transform: [{ translateX }] }}>
          <PixelFrame accentColor={teamAccent}>
            {/* Passing `size` explicitly so CanvasView matches the
                wrapper exactly — without it CanvasView's self-computed
                size (screenWidth - 32) overflows the matte on devices
                wider than ~352dp, breaking the picture-frame illusion
                AND mis-aligning the tap-target Pressable. */}
            <CanvasView
              ref={canvasRef}
              team={viewingTeam}
              width={CANVAS_W}
              height={CANVAS_H}
              targetPixels={targetPixels}
              filled={filled}
              palette={palette}
              onPixelTap={isOwnView ? handlePixelTap : undefined}
              onPanMove={enemyTeam ? handlePanMove : undefined}
              onPanEnd={enemyTeam ? handlePanEnd : undefined}
              size={maxCanvasPx}
            />
          </PixelFrame>
        </Animated.View>
      ) : (
        <View style={styles.placeholder}>
          <EmptyStateIcon kind="canvas" size={64} />
          <Text style={styles.placeholderText}>
            {seasonNumber === null ? 'Awaiting next season…' : 'Loading canvas…'}
          </Text>
        </View>
      )}

      {/* Tight pair: viewing-team label stacked directly above the
          contribution summary, with no gap between them. Wrapping in a
          single View keeps the root's `gap` from inserting space here
          — the two lines read as one stat block, so the live-feed
          card below gets back the vertical room. */}
      <View style={styles.metaGroup}>
        {team && viewingTeam && enemyTeam && (
          <View style={styles.viewingLine}>
            <Text style={[styles.viewingText, { color: teamAccent }]}>
              {isOwnView ? 'YOUR TEAM' : 'ENEMY TEAM'}
            </Text>
            <Text style={styles.viewingHint}>
              {isOwnView
                ? '  ·  swipe to see opponent'
                : '  ·  swipe to return'}
            </Text>
          </View>
        )}
        <Text style={styles.completionText}>
          {`${tilesLifetime.toLocaleString()} TILES`}
          <Text style={styles.completionSep}>{'  ·  '}</Text>
          {`${pct}% FILLED`}
        </Text>
      </View>

      {/* Single live-feed card: label + rows in one parchment surface so
          the section reads as a unit. The previous split (bare label
          above a separate card) lost the empty state behind layout
          margins and made the feed feel stranded under the canvas. */}
      <View style={styles.feedCard}>
        <Text style={styles.feedTitle}>LIVE STRIDE FEED</Text>
        {recent.length === 0 ? (
          <Text style={styles.recentEmpty}>No activity yet.</Text>
        ) : (
          recent.map((e) => {
            const swatchHex = e.color_id ? colorHex(palette, e.color_id) : '#666';
            const name = e.color_id ? colorName(palette, e.color_id) : null;
            const rarity: Rarity = e.color_id
              ? colorRarity(palette, e.color_id)
              : 'common';
            const prefix = e.kind !== 'milestone' ? verbPrefix(e) : '';
            return (
              <View key={e.id} style={styles.recentRow}>
                {e.color_id && (
                  <View style={[styles.swatch, { backgroundColor: swatchHex }]} />
                )}
                <Text style={styles.recentText} numberOfLines={1}>
                  <Text style={styles.recentName}>{e.nickname}</Text>
                  {e.kind === 'milestone' ? (
                    <Text style={styles.recentBody}>
                      {` ${e.team?.toUpperCase() ?? ''} hit ${e.qty}%`}
                    </Text>
                  ) : prefix !== '' ? (
                    <>
                      <Text style={styles.recentBody}>{prefix}</Text>
                      <RarityName name={name ?? '—'} rarity={rarity} />
                    </>
                  ) : null}
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
          onCommit={handleCommit}
        />
      )}
    </View>
  );
}

// Slim copy variant (vs the retired LiveFeed's longer copy). Compact
// for the 3-row inline strip — keeps each row to one truncated line.
// Returns the prefix BEFORE the colour name; the JSX appends a
// rarity-tinted <RarityName> after this so the colour pops in the
// rolled rarity colour. Milestone events have no colour name and are
// routed through their own branch in the map.
function verbPrefix(e: { kind: string; qty: number }): string {
  switch (e.kind) {
    case 'tile_placed':
      return ' placed ';
    case 'case_opened':
      return ' opened ';
    case 'crafted':
      return e.qty > 1 ? ` crafted ${e.qty}× ` : ' crafted ';
    case 'sold':
      return e.qty > 1 ? ` sold ${e.qty}× ` : ' sold ';
    case 'shop_bought':
      return ' bought ';
    default:
      // Unknown event kind — return empty so the row renders as just
      // the nickname + relative time. Better than appending a stray
      // space + colour name with no verb when a future kind isn't
      // wired here yet.
      return '';
  }
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  placeholder: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 1.5,
  },
  // Wraps the YOUR/ENEMY-TEAM line + the "X TILES · Y% FILLED"
  // contribution line as a single stat block. Negative top margin
  // pulls it tight under the canvas (cancelling part of the root's
  // `gap: 8`) so the label reads as a caption attached to the frame
  // rather than a free-floating row. The exact value was tuned by
  // hand for the "a bit upper" look — changing it is a visual
  // decision, not a refactor. Don't replace with -spacing.xs (=-4)
  // without confirming the new visual.
  metaGroup: {
    alignItems: 'center',
    marginTop: -5,
  },
  viewingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewingText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  viewingHint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  completionText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 10.5,
    color: colors.text.cream,
    letterSpacing: 1.3,
  },
  completionSep: {
    color: colors.text.muted,
  },
  // Wood-canyon live feed card — single parchment surface holds title
  // + 3 most-recent rows. Replaces the prior bare-label-above-card
  // split that lost the empty state under layout margins.
  feedCard: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.banner.edge,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  feedTitle: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.cream,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingLeft: 10,
    position: 'relative',
  },
  // Brass-deep bullet replacing the prior background-card-per-row look.
  // Drawn as a left-padded row + an absolute dot pseudo-element via an
  // empty View. Cleaner than per-row card chrome on parchment.
  swatch: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: colors.banner.edge,
    borderRadius: 1,
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
    color: colors.text.muted,
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

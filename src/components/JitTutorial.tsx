import React, { useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../store/gameStore';
import { JIT_FLOWS } from '../data/tutorial';
import { colors, fonts, radii, spacing } from '../theme';

// Spotlight padding around the highlighted rect — gives the cutout
// breathing room so the brass-stroke border doesn't sit flush against
// the spotlit element.
const SPOTLIGHT_PADDING = 8;

// Vertical breathing room the tooltip wrapper reserves for its card.
// Larger than the rendered card so any future copy expansion has slack
// without overlapping the cutout.
const TOOLTIP_HEIGHT_ESTIMATE = 200;

// Non-modal spotlight overlay for the JIT (just-in-time) tutorial flows.
// Differs from OnboardingTutorial.tsx in three important ways:
//   1. NOT a <Modal> — renders as absolute-positioned Views at the App
//      root so taps in the cutout area pass through to the underlying
//      spotlit element (the player advances the flow BY interacting with
//      the spotlit UI; we don't want Modal capturing their tap).
//   2. No NEXT button. Only SKIP (which marks the flow's flag true so
//      it doesn't re-fire). Progression is driven by store subscribers
//      reading `tutorialActiveFlow`/`tutorialFlowStep` and the UI
//      action sites calling `advanceFlowStep(expectedKey)`.
//   3. Self-gates on `tutorialActiveFlow` being non-null. When null,
//      renders absolutely nothing — zero layout/measure cost.
//
// Coordinate-system handling mirrors the previous SpotlightTutorial
// fix: TutorialTarget writes the raw measureInWindow rect; this
// component adds `insets.top`/`insets.left` to convert into the
// visual-top-anchored frame the overlay renders in. Without the
// compensation the cutout floats ~status-bar-height above the actual
// element on Android edge-to-edge.
export default function JitTutorial(): React.JSX.Element | null {
  const tutorialActiveFlow = useGameStore((s) => s.tutorialActiveFlow);
  const tutorialFlowStep = useGameStore((s) => s.tutorialFlowStep);
  const tutorialTargetRect = useGameStore((s) => s.tutorialTargetRect);
  const cancelTutorialFlow = useGameStore((s) => s.cancelTutorialFlow);

  const insets = useSafeAreaInsets();
  const win = useMemo(() => Dimensions.get('window'), []);

  if (!tutorialActiveFlow) return null;

  const flowSteps = JIT_FLOWS[tutorialActiveFlow];
  const step = flowSteps[tutorialFlowStep];

  // Out-of-bounds step index shouldn't happen (the store action bounds-
  // checks before advancing) but guard anyway so a future flow rewrite
  // doesn't crash the overlay during a transient state.
  if (!step) return null;

  const rect = tutorialTargetRect;
  // Compensated rect with padding. Null until the active TutorialTarget
  // has reported its measureInWindow result.
  const compRect = rect
    ? {
        x: rect.x + insets.left - SPOTLIGHT_PADDING,
        y: rect.y + insets.top - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      }
    : null;

  // Decide tooltip placement: above the spotlight if the spotlight has
  // enough room above it, otherwise below. The cutoff includes
  // insets.top so we don't push the tooltip into the status-bar zone.
  const placeTooltipAbove =
    compRect !== null && compRect.y > TOOLTIP_HEIGHT_ESTIMATE + insets.top;

  // For "above" placement we anchor with `top` + fixed-height + flex-end
  // alignment. Anchoring via `bottom` was unreliable on Android: the
  // overlay renders in a frame that may be taller than
  // Dimensions.get('window').height under edge-to-edge, so any
  // `bottom: win.height - compRect.y` math drifts the card into the
  // cutout by ~(status-bar + nav-bar) px.
  const tooltipStyle = compRect
    ? placeTooltipAbove
      ? {
          top: Math.max(0, compRect.y - TOOLTIP_HEIGHT_ESTIMATE - spacing.md),
          height: TOOLTIP_HEIGHT_ESTIMATE,
          justifyContent: 'flex-end' as const,
        }
      : {
          top: compRect.y + compRect.height + spacing.md,
        }
    : {
        // No rect yet — center as a fallback. Brief flash; the active
        // TutorialTarget will report its rect within a frame or two.
        top: win.height / 2 - TOOLTIP_HEIGHT_ESTIMATE / 2,
      };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {compRect === null ? (
        // Pre-measure full dim. Tooltip centered below. Briefly visible
        // when the flow switches steps and the next target is mounting.
        <View style={styles.fullDim} pointerEvents="auto" />
      ) : (
        <>
          {/* Top dim band */}
          <View
            pointerEvents="auto"
            style={[
              styles.dim,
              {
                left: 0,
                top: 0,
                width: win.width,
                height: Math.max(0, compRect.y),
              },
            ]}
          />
          {/* Bottom dim band */}
          <View
            pointerEvents="auto"
            style={[
              styles.dim,
              {
                left: 0,
                top: compRect.y + compRect.height,
                width: win.width,
                height: Math.max(
                  0,
                  win.height + insets.top + insets.bottom - (compRect.y + compRect.height),
                ),
              },
            ]}
          />
          {/* Left dim flank */}
          <View
            pointerEvents="auto"
            style={[
              styles.dim,
              {
                left: 0,
                top: compRect.y,
                width: Math.max(0, compRect.x),
                height: compRect.height,
              },
            ]}
          />
          {/* Right dim flank */}
          <View
            pointerEvents="auto"
            style={[
              styles.dim,
              {
                left: compRect.x + compRect.width,
                top: compRect.y,
                width: Math.max(
                  0,
                  win.width - (compRect.x + compRect.width),
                ),
                height: compRect.height,
              },
            ]}
          />
          {/* Brass border outline on the cutout perimeter. pointerEvents
              none so taps inside the cutout pass through to the
              underlying spotlit element. */}
          <View
            pointerEvents="none"
            style={[
              styles.spotlightBorder,
              {
                left: compRect.x,
                top: compRect.y,
                width: compRect.width,
                height: compRect.height,
              },
            ]}
          />
        </>
      )}

      {/* Tooltip card */}
      <View style={[styles.tooltipWrap, tooltipStyle]} pointerEvents="box-none">
        <View style={styles.tooltip}>
          <Text style={styles.tooltipKicker}>{step.title}</Text>
          <Text style={styles.tooltipBody}>{step.body}</Text>
          <View style={styles.buttonRow}>
            <Pressable onPress={cancelTutorialFlow} hitSlop={8}>
              <Text style={styles.skipBtnText}>SKIP TUTORIAL</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullDim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 16, 10, 0.78)',
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(20, 16, 10, 0.78)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.accent.brassLight,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  tooltipWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  tooltip: {
    width: '100%',
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  tooltipKicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  tooltipBody: {
    fontFamily: fonts.outfitRegular,
    fontSize: 15,
    color: colors.text.cream,
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  skipBtnText: {
    fontFamily: fonts.outfitBold,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});

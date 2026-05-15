import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useGameStore } from '../store/gameStore';
import { ONBOARDING_CARDS } from '../data/tutorial';
import { colors, fonts, radii, spacing } from '../theme';

// First-launch welcome. Two cards in a stack, NEXT to advance, GOT IT
// on the last card to finish. SKIP also ends the flow. Replaces the
// previous linear SpotlightTutorial — this is now an orientation-only
// modal with no targets; the gameplay-tied teaching has moved into the
// JIT flows handled by JitTutorial.tsx.
//
// Mounted at App.tsx root so it overlays the bottom-tab bar (matching
// the NicknameOnboardingModal mount pattern). Self-gates on
// `onboardingActive` from the store — HomeScreen flips that flag on
// after the nickname becomes custom AND `tutorialFlags.onboarding` is
// still false.
export default function OnboardingTutorial(): React.JSX.Element | null {
  const onboardingActive = useGameStore((s) => s.onboardingActive);
  const onboardingCardIdx = useGameStore((s) => s.onboardingCardIdx);
  const advanceOnboarding = useGameStore((s) => s.advanceOnboarding);
  const completeOnboarding = useGameStore((s) => s.completeOnboarding);

  if (!onboardingActive) return null;

  const card = ONBOARDING_CARDS[onboardingCardIdx];
  const isLast = onboardingCardIdx === ONBOARDING_CARDS.length - 1;

  // Defensive: out-of-bounds card index shouldn't happen, but if it
  // somehow does (e.g. a future ONBOARDING_CARDS edit shrinks the array
  // while a session is mid-onboarding), close the modal cleanly instead
  // of crashing on `card.title` access.
  if (!card) {
    completeOnboarding();
    return null;
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={completeOnboarding}
    >
      <View style={styles.dim} pointerEvents="auto" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <Text style={styles.kicker}>
            {`STEP ${onboardingCardIdx + 1} OF ${ONBOARDING_CARDS.length}`}
          </Text>
          <Text style={styles.title}>{card.title}</Text>
          <Text style={styles.body}>{card.body}</Text>
          <View style={styles.buttonRow}>
            <Pressable onPress={completeOnboarding} hitSlop={8}>
              <Text style={styles.skipBtnText}>SKIP</Text>
            </Pressable>
            <Pressable
              onPress={advanceOnboarding}
              style={styles.primaryBtn}
              hitSlop={8}
            >
              <Text style={styles.primaryBtnText}>
                {isLast ? 'GOT IT' : 'NEXT'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 16, 10, 0.78)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bg.card,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  kicker: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 11,
    color: colors.accent.brassDeep,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 22,
    color: colors.text.cream,
    letterSpacing: 1.2,
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.outfitRegular,
    fontSize: 15,
    color: colors.text.cream,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtnText: {
    fontFamily: fonts.outfitBold,
    fontSize: 12,
    color: colors.text.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  primaryBtn: {
    backgroundColor: colors.accent.brassLight,
    borderWidth: 1.5,
    borderColor: colors.banner.edge,
    borderRadius: radii.button,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  primaryBtnText: {
    fontFamily: fonts.outfitExtraBold,
    fontSize: 13,
    color: colors.text.cream,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

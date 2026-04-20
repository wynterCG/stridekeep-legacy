import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Milestone } from '../types';
import { colors, fonts, spacing } from '../theme';

interface Props {
  milestone: Milestone;
  onDismiss: () => void;
}

export default function CelebrationOverlay({ milestone, onDismiss }: Props): React.JSX.Element {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Text style={styles.kicker}>YOUR TOWN UNLOCKED</Text>
          <Text style={styles.emoji}>{milestone.emoji}</Text>
          <Text style={styles.name}>{milestone.name}</Text>
          <Text style={styles.hint}>tap anywhere to dismiss</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent.brass,
    minWidth: 260,
  },
  kicker: {
    fontFamily: fonts.bebasNeue,
    fontSize: 14,
    color: colors.accent.brass,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  emoji: {
    fontSize: 92,
    marginBottom: spacing.md,
  },
  name: {
    fontFamily: fonts.playfairItalic,
    fontSize: 30,
    color: colors.accent.brassLight,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  hint: {
    fontFamily: fonts.outfitRegular,
    fontSize: 11,
    color: colors.text.muted,
    letterSpacing: 1,
  },
});

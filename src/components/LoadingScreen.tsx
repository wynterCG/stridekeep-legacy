import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

const { width } = Dimensions.get('window');

// Hand-crafted beautiful diagonal stripe color pattern using game palette colors.
// When fully complete, this reads as a premium, artistic completed pixel mural.
const MURAL_COLORS = [
  '#c43a32', '#3866b6', '#d4a44a', '#5fc9a3', '#8c5ec4', '#f5c842', // row 0
  '#3866b6', '#d4a44a', '#5fc9a3', '#8c5ec4', '#f5c842', '#c43a32', // row 1
  '#d4a44a', '#5fc9a3', '#8c5ec4', '#f5c842', '#c43a32', '#3866b6', // row 2
  '#5fc9a3', '#8c5ec4', '#f5c842', '#c43a32', '#3866b6', '#d4a44a', // row 3
  '#8c5ec4', '#f5c842', '#c43a32', '#3866b6', '#d4a44a', '#5fc9a3', // row 4
  '#f5c842', '#c43a32', '#3866b6', '#d4a44a', '#5fc9a3', '#8c5ec4', // row 5
];

interface Props {
  isReady: boolean; // Bootstrapping + Update checks complete
  progress: number; // 0.0 to 1.0 representing loading stage
  statusText: string; // Dynamic status label (e.g. "CHARGING DATA...")
  onAnimationComplete: () => void; // Triggered when fade-out finishes
}

export default function LoadingScreen({
  isReady,
  progress,
  statusText,
  onAnimationComplete,
}: Props): React.JSX.Element | null {
  const [filledCount, setFilledCount] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Track if we have completed at least one full mural filling loop
  const hasCompletedFirstLoop = useRef(false);

  // 1. Mural filling loop animation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let pauseTimeout: NodeJS.Timeout;

    const startLoop = () => {
      setFilledCount(0);
      interval = setInterval(() => {
        setFilledCount((prev) => {
          if (prev >= 36) {
            clearInterval(interval);
            
            // Grid is fully painted! Wait 300ms so the completed mural can be enjoyed
            pauseTimeout = setTimeout(() => {
              hasCompletedFirstLoop.current = true;
              
              // If the data is ready and first loop is done, we start fade-out
              if (isReady) {
                triggerFadeOut();
              } else {
                // Otherwise, restart the filling cycle
                startLoop();
              }
            }, 300);
            
            return 36;
          }
          return prev + 2; // Paint 2 cells every step (total ~18 steps, 720ms)
        });
      }, 40);
    };

    startLoop();

    return () => {
      clearInterval(interval);
      clearTimeout(pauseTimeout);
    };
  }, [isReady]);

  // 2. Watch isReady and fade out if the first loop is already completed
  useEffect(() => {
    if (isReady && hasCompletedFirstLoop.current && !isFadingOut) {
      triggerFadeOut();
    }
  }, [isReady]);

  // 3. Completed mural pulse shine
  useEffect(() => {
    if (filledCount === 36) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [filledCount]);

  const triggerFadeOut = () => {
    setIsFadingOut(true);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      onAnimationComplete();
    });
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.content}>
        {/* Glowing Brand Title */}
        <Text style={styles.brandTitle}>STRIDEKEEP</Text>
        
        {/* Carved Wood Mural Frame & 6x6 Grid */}
        <Animated.View style={[styles.muralBorder, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.muralGrid}>
            {MURAL_COLORS.map((color, idx) => {
              const isCellFilled = idx < filledCount;
              return (
                <View
                  key={idx}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: isCellFilled
                        ? color
                        : 'rgba(255, 248, 224, 0.05)', // translucent dark cream
                      borderColor: isCellFilled
                        ? colors.ui.border
                        : 'rgba(255, 248, 224, 0.1)',
                    },
                  ]}
                />
              );
            })}
          </View>
        </Animated.View>

        {/* Themed Carved Loading Bar Container */}
        <View style={styles.barContainer}>
          <View style={styles.progressBarTrack}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                },
              ]}
            />
          </View>
        </View>

        {/* Dynamic Status Subtitle */}
        <Text style={styles.statusLabel}>{statusText.toUpperCase()}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg.overlay, // Dark slate
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Render on top of everything
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  brandTitle: {
    fontFamily: fonts.outfitBlack,
    fontSize: 40,
    color: colors.text.lightCream,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(212, 164, 74, 0.45)', // soft brass glow shadow
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 8,
  },
  muralBorder: {
    padding: 8,
    borderRadius: radii.card,
    backgroundColor: '#322212', // Dark wood finish
    borderWidth: 2,
    borderColor: colors.accent.brass,
    // Wood relief shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  muralGrid: {
    width: 180,
    height: 180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#1c1208', // Empty grid depth
    borderRadius: 2,
    overflow: 'hidden',
  },
  cell: {
    width: 30,
    height: 30,
    borderWidth: 0.5,
  },
  barContainer: {
    width: width * 0.7,
    marginTop: spacing.sm,
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.ui.progressBg,
    borderWidth: 1.5,
    borderColor: colors.ui.border,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent.brass,
    borderRadius: 6,
    // Golden glow effect
    borderRightWidth: 2,
    borderRightColor: colors.accent.brassRim,
  },
  statusLabel: {
    fontFamily: fonts.pressStart,
    fontSize: 9,
    color: colors.accent.brassLight,
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});

import Theme from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  interpolate,
  default as Reanimated,
  useAnimatedStyle,
} from 'react-native-reanimated';

interface XpDisplayComponentProps {
  animatedXPValue: number;
  animatedProgress?: number;
  currentLevel?: number;
  nextLevel?: number;
  showProgressBar?: boolean;
  badgeAnimatedStyle?: any;
  progressAnimatedStyle?: any;
}

export default function XpDisplayComponent({
  animatedXPValue,
  animatedProgress = 60,
  currentLevel = 1,
  nextLevel,
  showProgressBar = true,
  badgeAnimatedStyle,
  progressAnimatedStyle
}: XpDisplayComponentProps) {
  const defaultBadgeAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{
        scale: interpolate(
          1, // Since we don't have opacity control here, just use static scale
          [0, 1],
          [0.5, 1]
        )
      }]
    };
  });

  const defaultProgressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${interpolate(
        animatedProgress,
        [0, 100],
        [0, 100]
      )}%` as const
    };
  });

  const calculatedNextLevel = nextLevel || currentLevel + 1;

  return (
    <View style={styles.centerContent}>
      <Reanimated.View style={[styles.xpBadge, badgeAnimatedStyle || defaultBadgeAnimatedStyle]}>
        <Text style={styles.xpValue}>+{animatedXPValue}xp</Text>
      </Reanimated.View>

      {showProgressBar && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>lvl {currentLevel}</Text>
          <View style={styles.progressBar}>
            <Reanimated.View style={[styles.progressFill, progressAnimatedStyle || defaultProgressAnimatedStyle]} />
          </View>
          <Text style={styles.progressLabel}>lvl {calculatedNextLevel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    alignItems: 'center',
  },

  // XP Section
  xpBadge: {
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
    backgroundColor: Theme.colors.special.primary.exp + '20',
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.special.primary.exp + '40',
  },
  xpValue: {
    fontSize: 48,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    textAlign: 'center',
    textShadowColor: Theme.colors.special.primary.exp + '30',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Progress Section
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Theme.spacing.lg,
  },
  progressLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginHorizontal: Theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: Theme.colors.special.primary.exp,
  },
});
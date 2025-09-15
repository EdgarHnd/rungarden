import Theme from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface SyncLoadingBadgeProps {
  visible: boolean;
  source?: 'strava' | 'healthkit';
}

export default function SyncLoadingBadge({
  visible,
  source = 'strava',
}: SyncLoadingBadgeProps) {
  const [dots, setDots] = useState('');

  // Animation values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  // Animated styles
  const badgeAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value }
      ]
    };
  });

  // Animate dots
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  // Entrance/exit animations
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withTiming(0, { duration: 300 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-20, { duration: 200 });
    }
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  const getSourceInfo = () => {
    switch (source) {
      case 'strava':
        return {
          text: 'Syncing from Strava',
          color: Theme.colors.accent.primary
        };
      case 'healthkit':
        return {
          text: 'Syncing from Apple Health',
          color: Theme.colors.accent.primary
        };
      default:
        return {
          text: 'Syncing',
          color: Theme.colors.accent.primary
        };
    }
  };

  const sourceInfo = getSourceInfo();

  return (
    <Reanimated.View style={[styles.badge, badgeAnimatedStyle]}>
      <ActivityIndicator
        size="small"
        color={sourceInfo.color}
        style={styles.spinner}
      />
      <Text style={styles.text}>
        {sourceInfo.text}{dots}
      </Text>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  spinner: {
    marginRight: Theme.spacing.sm,
  },
  text: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
});

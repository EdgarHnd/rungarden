import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Rive from 'rive-react-native';

interface FriendAvatarProps {
  entry: {
    rank: number;
    userId: string;
    name: string;
    totalDistance: number;
    level: number;
    totalWorkouts: number;
  };
  metricSystem?: 'metric' | 'imperial';
  isCurrent?: boolean;
}

// const getAvatarImage = (level: number) => {
//   if (level >= 30) return require('@/assets/images/flame/age4.png');
//   if (level >= 20) return require('@/assets/images/flame/age3.png');
//   if (level >= 10) return require('@/assets/images/flame/age2.png');
//   if (level >= 5) return require('@/assets/images/flame/age1.png');
//   return require('@/assets/images/flame/age0.png');
// };

export default function FriendAvatar({ entry, metricSystem = 'metric', isCurrent = false }: FriendAvatarProps) {
  const xp = Math.floor(entry.totalDistance * 0.1); // Approx XP gained from distance
  const isInactive = entry.totalDistance === 0;
  const RIVE_URL_IDDLE = "https://curious-badger-131.convex.cloud/api/storage/9caf3bc8-1fab-4dab-a8e5-4b6d563ca7d6";

  const riveUrl = RIVE_URL_IDDLE;
  // Animation & haptics refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handlePressIn = () => {
    // Start fast pulsing animation
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ])
    );
    animationRef.current.start();

    // Initial haptic + repeat while holding
    Haptics.selectionAsync();
    hapticIntervalRef.current = setInterval(() => {
      Haptics.selectionAsync();
    }, 100);
  };

  const handlePressOut = () => {
    // Stop animation
    if (animationRef.current) {
      animationRef.current.stop();
      animationRef.current = null;
    }
    scaleAnim.setValue(1);

    // Clear haptic interval
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  };

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View style={[styles.container, isInactive && styles.inactiveContainer]}>
        <Text style={styles.nameBadge}> {isCurrent ? '(You)' : entry.name}</Text>
        {riveUrl && (
          <Animated.View pointerEvents="none" style={{ width: 100, height: 100, transform: [{ scale: scaleAnim }] }}>
            <Rive url={riveUrl} style={styles.avatarImage} autoplay />
          </Animated.View>
        )}
        {/* <Image source={getAvatarImage(entry.level)} style={styles.avatarImage} resizeMode="contain" /> */}
        {/* <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {entry.name}
        {entry.level > 0 && <Text style={styles.levelSup}> lvl{entry.level}</Text>}
        {!isInactive && <Text style={styles.xpLabel}>+{xp}xp</Text>}
        </Text> */}
        <View style={styles.distanceContainer}>
          {/* <Text style={styles.distance}>{formatDistance(entry.totalDistance, metricSystem)}</Text> */}
          <Text style={styles.runs}>{entry.totalWorkouts} runs</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inactiveContainer: {
    opacity: 0.5,
  },
  youLabel: {
    color: Theme.colors.text.primary,
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.xs,
  },
  xpLabel: {
    color: Theme.colors.special.primary.exp,
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    marginTop: Theme.spacing.xs,
  },
  avatarImage: {
    width: 100,
    height: 100,
  },
  nameBadge: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  name: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  levelSup: {
    fontSize: 10,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.tertiary,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  distance: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  runs: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
}); 
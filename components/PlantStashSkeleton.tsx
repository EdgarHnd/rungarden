import { Theme } from '@/constants/theme';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');

interface PlantStashSkeletonProps {
  itemCount?: number;
}

const SkeletonItem = ({ delay = 0 }: { delay?: number }) => {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    // Start pulse animation with delay
    const timer = setTimeout(() => {
      opacity.value = withRepeat(
        withTiming(0.8, { duration: 1000 }),
        -1,
        true
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(opacity.value, [0.4, 0.8], [0.4, 0.7]),
  }));

  return (
    <View style={styles.skeletonItem}>
      <Animated.View style={[styles.skeletonImage, animatedStyle]} />
      <Animated.View style={[styles.skeletonText, animatedStyle]} />
    </View>
  );
};

export default function PlantStashSkeleton({ itemCount = 8 }: PlantStashSkeletonProps) {
  const skeletonItems = Array.from({ length: itemCount }, (_, index) => (
    <SkeletonItem key={index} delay={index * 100} />
  ));

  const renderRows = () => {
    const rows = [];
    for (let i = 0; i < skeletonItems.length; i += 2) {
      rows.push(
        <View key={i} style={styles.row}>
          {skeletonItems[i]}
          {skeletonItems[i + 1] && skeletonItems[i + 1]}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      {renderRows()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  skeletonItem: {
    width: (screenWidth - 40) / 2,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  skeletonImage: {
    width: 120,
    height: 120,
    backgroundColor: Theme.colors.border.primary,
    borderRadius: Theme.borderRadius.medium,
    marginBottom: 8,
  },
  skeletonText: {
    width: 80,
    height: 20,
    backgroundColor: Theme.colors.border.primary,
    borderRadius: Theme.borderRadius.xs,
  },
});

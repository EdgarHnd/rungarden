/**
 * Custom hook for optimized day selection with advanced Reanimated features
 * This can be used for further performance optimizations
 */
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from 'react-native-reanimated';

interface UseOptimizedDaySelectionProps {
  allDays: any[];
  onDayChange?: (dayIndex: number) => void;
  springConfig?: {
    damping: number;
    stiffness: number;
    mass: number;
  };
}

export const useOptimizedDaySelection = ({
  allDays,
  onDayChange,
  springConfig = { damping: 15, stiffness: 150, mass: 1 }
}: UseOptimizedDaySelectionProps) => {
  const currentDayIndex = useSharedValue(0);
  const currentWeekIndex = useSharedValue(1);
  const isAnimating = useSharedValue(false);

  // Optimized day selection with gesture support
  const selectDay = useCallback((dayIndex: number, withHaptics = true) => {
    if (isAnimating.value) return; // Prevent overlapping animations
    
    isAnimating.value = true;
    
    if (withHaptics) {
      runOnJS(Haptics.selectionAsync)();
    }

    currentDayIndex.value = withSpring(
      dayIndex, 
      springConfig,
      (finished) => {
        if (finished) {
          isAnimating.value = false;
          if (onDayChange) {
            runOnJS(onDayChange)(dayIndex);
          }
        }
      }
    );

    // Update week index if needed
    const weekIndex = Math.floor(dayIndex / 7);
    currentWeekIndex.value = withSpring(weekIndex, springConfig);
  }, [allDays, onDayChange, springConfig]);

  // React to external changes
  useAnimatedReaction(
    () => currentDayIndex.value,
    (newIndex) => {
      // Additional logic for coordinated animations can go here
    }
  );

  return {
    currentDayIndex,
    currentWeekIndex,
    selectDay,
    isAnimating,
  };
};
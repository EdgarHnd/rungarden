import XPInfoModal from '@/components/XPInfoModal';
import Theme from '@/constants/theme';
import LevelingService from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

interface DatabaseActivity {
  startDate: string;
  endDate: string;
  duration: number;
  distance: number;
  calories: number;
  averageHeartRate?: number;
  workoutName?: string;
  healthKitUuid: string;
}

interface DayData {
  date: string;
  activities: DatabaseActivity[];
  plannedWorkout: any; // Direct planned workout data from the training plan
  weekIndex: number;
  isRestDayCompleted?: boolean;
}

interface WeekData {
  weekIndex: number;
  startDate: string;
  days: DayData[];
  weeklyProgress: number;
}

interface LevelInfo {
  level: number;
  totalXP: number;
  xpForNextLevel: number;
  remainingXPForNextLevel: number;
  progressToNextLevel: number;
}

interface WeekViewProps {
  dayData: DayData[];
  currentDayIndex: number;
  onDaySelect: (index: number) => void;
  levelInfo: LevelInfo | null;
  currentWeekIndex: number;
  weeks: WeekData[];
  onWeekChange?: (weekIndex: number) => void;
  weekStartDay: number; // 0 = Sunday, 1 = Monday
  streakInfo?: {
    currentStreak: number;
    longestStreak: number;
    lastStreakDate: string | null;
  };
}

const screenWidth = Dimensions.get('window').width; // This is the full window width

export default function WeekView({
  dayData,
  currentDayIndex,
  onDaySelect,
  levelInfo,
  currentWeekIndex,
  weeks,
  onWeekChange,
  weekStartDay,
  streakInfo
}: WeekViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const progressPercentage = levelInfo ? Math.min(levelInfo.progressToNextLevel * 100, 100) : 0;
  const [showXPInfoModal, setShowXPInfoModal] = useState(false);

  // Add ref to track if we're already scrolling to prevent feedback loops
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculate the actual width of each page in the ScrollView
  // This accounts for the horizontal padding of the parent container.
  const pageWidth = screenWidth - 40; // 20px padding on each side

  // Debounced scroll to week to prevent flickering
  useEffect(() => {
    if (scrollViewRef.current && weeks && weeks.length > currentWeekIndex && pageWidth > 0) {
      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Don't scroll if we're already in the process of scrolling
      if (isScrollingRef.current) return;

      scrollTimeoutRef.current = setTimeout(() => {
        if (scrollViewRef.current) {
          isScrollingRef.current = true;
          const offsetX = currentWeekIndex * pageWidth;
          scrollViewRef.current.scrollTo({ x: offsetX, animated: false });

          // Reset scrolling flag after a short delay
          setTimeout(() => {
            isScrollingRef.current = false;
          }, 100);
        }
      }, 50); // 50ms debounce for smooth scrolling
    }
  }, [currentWeekIndex, weeks, pageWidth]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to get date string in local timezone (YYYY-MM-DD)
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDayLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (dateString: string) => {
    const date = new Date(dateString);
    return date.getDate();
  };

  const hasRunActivity = (activities: DatabaseActivity[]) => {
    return activities.some(activity =>
      activity.workoutName?.toLowerCase().includes('run') ||
      activity.distance > 0
    );
  };

  const isToday = (dateString: string) => {
    const today = new Date();
    const todayString = getLocalDateString(today);
    return dateString === todayString;
  };

  const handleScroll = useCallback((event: any) => {
    // Don't handle scroll events if we're programmatically scrolling
    if (isScrollingRef.current) return;

    const contentOffset = event.nativeEvent.contentOffset.x;

    if (pageWidth > 0) { // Ensure pageWidth is positive before division
      const weekIndex = Math.round(contentOffset / pageWidth);
      if (onWeekChange && weekIndex !== currentWeekIndex && weekIndex >= 0 && weekIndex < weeks.length) {
        onWeekChange(weekIndex);
      }
    }
  }, [pageWidth, onWeekChange, currentWeekIndex, weeks.length]);

  const getWeekTitle = (week: WeekData) => {
    const startDate = new Date(week.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const today = new Date();
    const thisWeekStart = getWeekStart(today, weekStartDay);

    if (week.startDate === getLocalDateString(thisWeekStart)) {
      return 'This Week';
    }

    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const isNextWeek = week.startDate === getLocalDateString(nextWeekStart);
    const isLastWeek = week.startDate === getLocalDateString(lastWeekStart);

    if (isNextWeek) return 'Next Week';
    if (isLastWeek) return 'Last Week';

    return `${startDate.getDate()} - ${endDate.getDate()} ${endDate.toLocaleDateString('en-US', { month: 'short' })}`;
  };

  const getWeekStart = (date: Date, weekStartDay: number) => {
    // Create a new date in local timezone
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

    let diff;
    if (weekStartDay === 1) { // Monday start
      // For Monday start: Sunday=6 days back, Monday=0 days back, Tuesday=1 day back, etc.
      diff = day === 0 ? 6 : day - 1;
    } else { // Sunday start
      // For Sunday start: Sunday=0 days back, Monday=1 day back, Tuesday=2 days back, etc.
      diff = day;
    }

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const formatDistance = (meters: number, showKm: boolean = true) => {
    const kilometers = meters / 1000;
    if (showKm) {
      return `${kilometers.toFixed(1)}km`;
    }
    return `${kilometers.toFixed(1)}`;
  };

  const isPartOfStreak = (dateString: string, activities: DatabaseActivity[]) => {
    if (!streakInfo || streakInfo.currentStreak === 0 || !streakInfo.lastStreakDate) {
      return false;
    }

    const currentDate = new Date(dateString);
    const lastStreakDate = new Date(streakInfo.lastStreakDate);
    const daysDiff = Math.floor((lastStreakDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // This day is part of the streak if it's within the streak range and has activity
    return daysDiff >= 0 && daysDiff < streakInfo.currentStreak;
  };

  const shouldShowStreakConnection = (dayIndex: number, week: WeekData) => {
    if (!streakInfo || streakInfo.currentStreak === 0) return false;

    const currentDay = week.days[dayIndex];
    const nextDay = week.days[dayIndex + 1];

    if (!nextDay) return false;

    return isPartOfStreak(currentDay.date, currentDay.activities) &&
      isPartOfStreak(nextDay.date, nextDay.activities);
  };

  return (
    <View style={styles.container}>
      {/* Level Progress Section */}
      {levelInfo && (
        <TouchableOpacity
          style={styles.progressContainer}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowXPInfoModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Lvl {levelInfo.level} - {LevelingService.getLevelTitle(levelInfo.level)}</Text>
            <Text style={styles.progressText}>
              {LevelingService.formatXP(levelInfo.remainingXPForNextLevel, true)} to Lvl {levelInfo.level + 1}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
        </TouchableOpacity>
      )}

      {/* Swipable Week Calendar */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.weeksContainer}
      >
        {weeks.map((week, weekIndex) => (
          <View key={`week-${week.weekIndex}`} style={styles.weekContainer}>
            {week.days.map((day, dayIndex) => {
              const globalDayIndex = week.weekIndex * 7 + dayIndex;
              const isSelected = globalDayIndex === currentDayIndex;
              const hasRun = hasRunActivity(day.activities);
              const isTodayDay = isToday(day.date);
              const hasPlannedWorkout = day.plannedWorkout && day.plannedWorkout.type !== 'rest';
              const isRestDayCompleted = day.plannedWorkout?.type === 'rest' && day.isRestDayCompleted;
              const isStreakDay = isPartOfStreak(day.date, day.activities);
              const showStreakConnection = shouldShowStreakConnection(dayIndex, week);

              return (
                <View key={day.date} style={styles.dayWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.dayContainer,
                      isSelected && styles.selectedDayContainer
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      onDaySelect(globalDayIndex);
                    }}
                    activeOpacity={1}
                  >
                    <Text style={[
                      styles.dayLabel,
                      isSelected && styles.selectedDayLabel
                    ]}>
                      {formatDayLabel(day.date)}
                    </Text>

                    <View style={[
                      styles.dayCircle,
                      isSelected && styles.selectedDayCircle,
                      isTodayDay && !isSelected && styles.todayCircle,
                      isStreakDay && styles.streakDayCircle,
                      isStreakDay && isSelected && styles.selectedStreakDayCircle
                    ]}>
                      <Text style={[
                        styles.dayNumber,
                        isSelected && styles.selectedDayNumber,
                        isTodayDay && !isSelected && styles.todayDayNumber
                      ]}>
                        {getDayNumber(day.date)}
                      </Text>

                      {hasRun && (
                        <View style={[
                          styles.checkmark,
                          isSelected && styles.selectedCheckmark,
                        ]}>
                          <Ionicons name="flash" size={10} color={isSelected ? Theme.colors.special.primary.coin : Theme.colors.text.primary} />
                        </View>
                      )}

                      {hasPlannedWorkout && !hasRun && (
                        <View style={[
                          styles.plannedWorkoutIndicator,
                          isSelected && styles.selectedPlannedWorkoutIndicator
                        ]}>
                          <Ionicons name="flash" size={10} color={isSelected ? Theme.colors.special.primary.exp : Theme.colors.text.primary} />
                        </View>
                      )}

                    </View>
                  </TouchableOpacity>

                  {/* Streak connection line */}
                  {showStreakConnection && (
                    <View style={styles.streakConnection} />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* XP Info Modal */}
      <XPInfoModal
        visible={showXPInfoModal}
        onClose={() => setShowXPInfoModal(false)}
        levelInfo={levelInfo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.background.primary,
    borderTopLeftRadius: Theme.borderRadius.xl,
    borderTopRightRadius: Theme.borderRadius.xl,
    paddingTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 6,
  },
  progressContainer: {
    marginBottom: Theme.spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  progressLabel: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  progressText: {
    fontSize: 14,
    color: Theme.colors.text.muted,
    fontFamily: Theme.fonts.bold,
  },
  progressBar: {
    height: 8,
    backgroundColor: Theme.colors.border.primary,
    borderRadius: Theme.borderRadius.small,
    overflow: 'hidden',
    marginBottom: Theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: Theme.borderRadius.small,
  },
  weekTitle: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    textAlign: 'center',
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: screenWidth - 40,
  },
  dayWrapper: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
  },
  dayContainer: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  selectedDayContainer: {
  },
  dayLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    marginBottom: Theme.spacing.sm,
  },
  selectedDayLabel: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedDayCircle: {
    backgroundColor: Theme.colors.special.primary.exp,
  },
  todayCircle: {
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.text.primary,
  },
  dayNumber: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.semibold,
  },
  selectedDayNumber: {
    color: Theme.colors.text.primary,
  },
  selectedStreakDayCircle: {
    backgroundColor: Theme.colors.special.primary.coin,
  },
  todayDayNumber: {
    // color: Theme.colors.text.primary,
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Theme.colors.special.primary.coin,
    borderRadius: Theme.borderRadius.small,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckmark: {
    backgroundColor: Theme.colors.text.primary,
  },
  checkmarkText: {
    fontSize: 10,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  selectedCheckmarkText: {
    color: Theme.colors.status.success,
  },
  restDayIconContainer: {
    backgroundColor: Theme.colors.special.primary.coin,
  },
  plannedWorkoutIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: Theme.borderRadius.small,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPlannedWorkoutIndicator: {
    backgroundColor: Theme.colors.text.primary,
    color: Theme.colors.special.primary.exp,
  },
  plannedWorkoutText: {
    fontSize: 10,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
  },
  selectedPlannedWorkoutText: {
    color: Theme.colors.accent.primary,
  },
  activityIndicator: {
    fontSize: 12,
    opacity: 0.7,
  },
  selectedActivityIndicator: {
    opacity: 1,
  },
  streakDayCircle: {
    borderWidth: 2,
    borderColor: Theme.colors.special.primary.coin,
  },
  streakConnection: {
    position: 'absolute',
    top: 45,
    left: '50%',
    width: 50,
    height: 2,
    backgroundColor: Theme.colors.special.primary.coin,
    zIndex: -1,
  },
}); 
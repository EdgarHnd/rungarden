import StreakDisplay from '@/components/StreakDisplay';
import XPInfoModal from '@/components/XPInfoModal';
import Theme from '@/constants/theme';
import { SuggestedActivity, getActivityType, isDefaultActivity } from '@/constants/types';
import { Doc } from '@/convex/_generated/dataModel';
import LevelingService from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DayData {
  date: string;
  activities: Doc<"activities">[];
  plannedWorkout?: SuggestedActivity | null;
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
    lastStreakWeek: string | null;
  };
  simpleSchedule?: {
    runsPerWeek: number;
    preferredDays: string[];
    isActive: boolean;
  } | null;
  todaysRunStatus?: {
    runsThisWeek: number;
    runsNeeded: number;
    weeklyGoalMet: boolean;
  } | null;
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
  streakInfo,
  simpleSchedule,
  todaysRunStatus
}: WeekViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const progressPercentage = levelInfo ? Math.min(levelInfo.progressToNextLevel * 100, 100) : 0;
  const [showXPInfoModal, setShowXPInfoModal] = useState(false);
  const [showStreakModal, setShowStreakModal] = useState(false);
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

  const hasRunActivity = (activities: Doc<"activities">[]) => {
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

  const isPartOfStreak = (dateString: string, activities: Doc<"activities">[]) => {
    if (!streakInfo || streakInfo.currentStreak === 0 || !streakInfo.lastStreakWeek) {
      return false;
    }

    const currentDate = new Date(dateString);
    const lastStreakWeek = new Date(streakInfo.lastStreakWeek);
    const daysDiff = Math.floor((lastStreakWeek.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

    // This day is part of the streak if it's within the streak range and has activity
    return daysDiff >= 0 && daysDiff < streakInfo.currentStreak;
  };

  const shouldShowStreakConnection = (dayIndex: number, week: WeekData) => {
    if (!streakInfo || streakInfo.currentStreak === 0) return false;

    const currentDay = week.days[dayIndex];
    const nextDay = week.days[dayIndex + 1];

    if (!currentDay || !nextDay) return false;

    const currentHasActivity = hasRunActivity(currentDay.activities);
    const nextHasActivity = hasRunActivity(nextDay.activities);

    return currentHasActivity && nextHasActivity &&
      isPartOfStreak(currentDay.date, currentDay.activities) &&
      isPartOfStreak(nextDay.date, nextDay.activities);
  };

  const isPreferredRunDay = (dateString: string) => {
    if (!simpleSchedule?.isActive || !simpleSchedule.preferredDays) return false;

    const date = new Date(dateString);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    return simpleSchedule.preferredDays.includes(dayName);
  };

  const shouldShowSimpleScheduleIndicators = (day: DayData) => {
    if (!simpleSchedule?.isActive) return false;

    // Only show for rest days that are defaults 
    return day.plannedWorkout && isDefaultActivity(day.plannedWorkout) &&
      getActivityType(day.plannedWorkout) === 'rest';
  };

  const isMissedDay = (day: DayData) => {
    if (!day.plannedWorkout) return false;

    // Check if this day is in the past
    const workoutDate = new Date(day.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    workoutDate.setHours(0, 0, 0, 0);

    const isPastDay = workoutDate < today;
    const workoutType = getActivityType(day.plannedWorkout);
    const hasNoActivity = day.activities.length === 0;

    // A day is missed if it's in the past, it's not a rest day, and has no activities
    return isPastDay && workoutType !== 'rest' && hasNoActivity;
  };

  return (
    <View style={styles.container}>
      {/* Weekly Progress & Streak Section */}
      {(simpleSchedule?.isActive && todaysRunStatus) ? (
        <TouchableOpacity
          style={styles.progressContainer}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowStreakModal(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.progressHeader}>
            <View style={styles.progressTextContainer}>
              <Text style={styles.progressLabel}>
                {todaysRunStatus.weeklyGoalMet ? 'Weekly Goal Complete!' : `Weekly Progress`}
              </Text>
              <Text style={styles.progressText}>
                {todaysRunStatus.runsThisWeek}/{todaysRunStatus.runsNeeded} runs
              </Text>
            </View>

            {streakInfo && (
              <Text style={styles.streakText}>
                🔥 {streakInfo.currentStreak}
              </Text>)}
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${Math.min(100, (todaysRunStatus.runsThisWeek / todaysRunStatus.runsNeeded) * 100)}%`,
                backgroundColor: todaysRunStatus.weeklyGoalMet ? Theme.colors.accent.primary : Theme.colors.special.primary.exp
              }
            ]} />
          </View>
          {/* {streakInfo && (
            <View style={styles.streakInfo}>
              <Text style={styles.streakText}>
                🔥 {streakInfo.currentStreak} week{streakInfo.currentStreak !== 1 ? 's' : ''} streak
              </Text>
              {streakInfo.longestStreak > streakInfo.currentStreak && (
                <Text style={styles.streakSubtext}>
                  Best: {streakInfo.longestStreak} week{streakInfo.longestStreak !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )} */}
        </TouchableOpacity>
      ) : (
        // Fallback to level progress for non-simple schedule users
        levelInfo && (
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
        )
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
              const hasPlannedWorkout = day.plannedWorkout && getActivityType(day.plannedWorkout) !== 'rest';
              const isRestDayCompleted = getActivityType(day.plannedWorkout) === 'rest' && day.isRestDayCompleted;
              const isStreakDay = isPartOfStreak(day.date, day.activities);
              const showStreakConnection = shouldShowStreakConnection(dayIndex, week);

              // Simple schedule logic
              const showSimpleIndicators = shouldShowSimpleScheduleIndicators(day);
              const isPreferredDay = showSimpleIndicators && isPreferredRunDay(day.date);
              const isSimpleRestDay = showSimpleIndicators && !isPreferredDay;
              const isDayMissed = isMissedDay(day);

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

                      {(hasPlannedWorkout || (isPreferredDay && getActivityType(day.plannedWorkout) !== 'rest')) && !hasRun && (
                        <View style={[
                          styles.plannedWorkoutIndicator,
                          isSelected && styles.selectedPlannedWorkoutIndicator,
                          isDayMissed && styles.missedWorkoutIndicator
                        ]}>
                          <Ionicons
                            name="flash"
                            size={10}
                            color={
                              isDayMissed
                                ? Theme.colors.background.primary
                                : isSelected
                                  ? Theme.colors.special.primary.exp
                                  : Theme.colors.text.primary
                            }
                          />
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

      {/* Streak Modal */}
      <StreakDisplay
        visible={showStreakModal}
        onClose={() => setShowStreakModal(false)}
        streakInfo={streakInfo || null}
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
  preferredDayIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.small,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.text.muted,
  },
  selectedPreferredDayIndicator: {
    backgroundColor: Theme.colors.special.primary.coin,
    borderColor: Theme.colors.text.primary,
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.sm,
  },
  streakText: {
    fontSize: 14,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
  },
  streakSubtext: {
    fontSize: 12,
    color: Theme.colors.text.muted,
    fontFamily: Theme.fonts.medium,
  },
  missedWorkoutIndicator: {
    backgroundColor: Theme.colors.text.muted,
  },
  progressTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
}); 
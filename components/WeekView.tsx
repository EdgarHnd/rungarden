import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
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
}

interface WeekData {
  weekIndex: number;
  startDate: string;
  days: DayData[];
  weeklyProgress: number;
}

interface LevelInfo {
  level: number;
  totalDistance: number;
  distanceForNextLevel: number;
  remainingDistanceForNextLevel: number;
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
  weekStartDay
}: WeekViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const progressPercentage = levelInfo ? Math.min(levelInfo.progressToNextLevel * 100, 100) : 0;

  // Calculate the actual width of each page in the ScrollView
  // This accounts for the horizontal padding of the parent container.
  const pageWidth = screenWidth - 40; // 20px padding on each side

  useEffect(() => {
    if (scrollViewRef.current && weeks && weeks.length > currentWeekIndex) {
      if (pageWidth > 0) { // Ensure pageWidth is positive
        const offsetX = currentWeekIndex * pageWidth;
        scrollViewRef.current.scrollTo({ x: offsetX, animated: false });
      }
    }
  }, [currentWeekIndex, weeks, pageWidth]); // Added pageWidth to dependencies

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

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;

    if (pageWidth > 0) { // Ensure pageWidth is positive before division
      const weekIndex = Math.round(contentOffset / pageWidth);
      if (onWeekChange && weekIndex !== currentWeekIndex) {
        onWeekChange(weekIndex);
      }
    }
  };

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

  return (
    <View style={styles.container}>
      {/* Level Progress Section */}
      {levelInfo && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Level {levelInfo.level}</Text>
            <Text style={styles.progressText}>
              {formatDistance(levelInfo.totalDistance, false)} / {formatDistance(levelInfo.distanceForNextLevel, true)}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
          {/* <View style={styles.levelDetails}>
            <Text style={styles.levelDetailText}>
              {formatDistance(levelInfo.totalDistance)} total distance
            </Text>
            <Text style={styles.levelDetailText}>
              {formatDistance(levelInfo.distanceForNextLevel)} for Level {levelInfo.level + 1}
            </Text>
          </View> */}
        </View>
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

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.dayContainer,
                    isSelected && styles.selectedDayContainer
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    onDaySelect(globalDayIndex);
                  }}
                  activeOpacity={0.7}
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
                    isTodayDay && !isSelected && styles.todayCircle
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
                        isSelected && styles.selectedCheckmark
                      ]}>
                        <Text style={[
                          styles.checkmarkText,
                          isSelected && styles.selectedCheckmarkText
                        ]}>
                          ✓
                        </Text>
                      </View>
                    )}

                    {hasPlannedWorkout && !hasRun && (
                      <View style={[
                        styles.plannedWorkoutIndicator,
                        isSelected && styles.selectedPlannedWorkoutIndicator
                      ]}>
                        <Ionicons name="flash" size={10} color={isSelected ? Theme.colors.accent.primary : Theme.colors.text.primary} />
                      </View>
                    )}
                  </View>

                  {/* Activity type indicator */}
                  {/* <Text style={[
                    styles.activityIndicator,
                    isSelected && styles.selectedActivityIndicator
                  ]}>
                    {day.suggestedActivity.emoji}
                  </Text> */}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>
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
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },
  progressText: {
    fontSize: 16,
    color: Theme.colors.text.primary,
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
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
  },
  levelDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelDetailText: {
    fontSize: 12,
    color: Theme.colors.text.muted,
    fontFamily: Theme.fonts.medium,
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
  dayContainer: {
    alignItems: 'center',
    flex: 1,
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
    color: Theme.colors.accent.primary,
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
    backgroundColor: Theme.colors.accent.primary,
  },
  todayCircle: {
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  dayNumber: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.semibold,
  },
  selectedDayNumber: {
    color: Theme.colors.text.primary,
  },
  todayDayNumber: {
    color: Theme.colors.accent.primary,
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Theme.colors.status.success,
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
  plannedWorkoutIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPlannedWorkoutIndicator: {
    backgroundColor: Theme.colors.text.primary,
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
}); 
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
  suggestedActivity: Activity;
  weekIndex: number;
}

interface WeekData {
  weekIndex: number;
  startDate: string;
  days: DayData[];
  weeklyProgress: number;
}

interface WeekViewProps {
  dayData: DayData[];
  currentDayIndex: number;
  onDaySelect: (index: number) => void;
  weeklyProgress: number;
  weeklyGoal: number;
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
  weeklyProgress,
  weeklyGoal,
  currentWeekIndex,
  weeks,
  onWeekChange,
  weekStartDay
}: WeekViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const currentWeek = weeks[currentWeekIndex];
  const progressPercentage = Math.min((currentWeek?.weeklyProgress || 0) / weeklyGoal * 100, 100);

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

  return (
    <View style={styles.container}>
      {/* Weekly Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Weekly Goal</Text>
          <Text style={styles.progressText}>
            {(currentWeek?.weeklyProgress || 0).toFixed(1)} / {weeklyGoal} km
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
        </View>
      </View>

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
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  progressText: {
    fontSize: 16,
    color: '#111827',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 8,
  },
  weekTitle: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'SF-Pro-Rounded-Medium',
    textAlign: 'center',
  },
  weeksContainer: {
    flexDirection: 'row',
  },
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: screenWidth - 40, // Account for container padding
  },
  dayContainer: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  selectedDayContainer: {
  },
  dayLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'SF-Pro-Rounded-Medium',
    marginBottom: 8,
  },
  selectedDayLabel: {
    color: '#007AFF',
    fontFamily: 'SF-Pro-Rounded-Semibold',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    //  marginBottom: 8,
  },
  selectedDayCircle: {
    backgroundColor: '#007AFF',
  },
  todayCircle: {
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  dayNumber: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'SF-Pro-Rounded-Semibold',
  },
  selectedDayNumber: {
    color: 'white',
  },
  todayDayNumber: {
    color: '#007AFF',
  },
  checkmark: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10B981',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckmark: {
    backgroundColor: 'white',
  },
  checkmarkText: {
    fontSize: 10,
    color: 'white',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  selectedCheckmarkText: {
    color: '#10B981',
  },
  activityIndicator: {
    fontSize: 12,
    opacity: 0.7,
  },
  selectedActivityIndicator: {
    opacity: 1,
  },
}); 
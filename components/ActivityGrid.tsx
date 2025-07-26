import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface ActivityGridProps {
  activities: any[];
  profile?: any;
}

export const ActivityGrid = ({ activities, profile }: ActivityGridProps) => {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const monthScrollRef = React.useRef<ScrollView>(null);

  // Keep month labels in sync with grid scrolling
  const handleGridScroll = React.useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    if (monthScrollRef.current) {
      monthScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
  }, []);

  // Get week start preference (0 = Sunday, 1 = Monday)
  const weekStartDay = profile?.weekStartDay ?? 1;

  // Helper function to get week start based on user preference
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

    let diff;
    if (weekStartDay === 1) { // Monday start
      diff = day === 0 ? 6 : day - 1;
    } else { // Sunday start
      diff = day;
    }

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // Generate data from beginning of current year
  const generateGridData = () => {
    const weeks = [];
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Find the first week start of the year based on user preference
    const firstWeekStart = getWeekStart(startOfYear);

    // Calculate how many weeks to show (from first week start to current week)
    const currentWeekStart = getWeekStart(today);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((currentWeekStart.getTime() - firstWeekStart.getTime()) / msPerWeek) + 1;

    for (let week = 0; week < totalWeeks; week++) {
      const weekData = [];
      const weekStartDate = new Date(firstWeekStart);
      weekStartDate.setDate(firstWeekStart.getDate() + (week * 7));

      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(weekStartDate);
        currentDate.setDate(weekStartDate.getDate() + day);

        // Skip future dates
        if (currentDate > today) {
          break;
        }

        // Only include dates from current year
        if (currentDate.getFullYear() !== today.getFullYear()) {
          continue;
        }

        // Find activities for this date
        const dayActivities = activities.filter(activity => {
          const activityDate = new Date(activity.startDate);
          return activityDate.toDateString() === currentDate.toDateString();
        });

        // Calculate intensity based on distance
        let intensity = 0;
        if (dayActivities.length > 0) {
          const totalDistance = dayActivities.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000; // Convert to km
          if (totalDistance > 0) {
            intensity = Math.min(Math.floor(totalDistance / 2) + 1, 4); // 1-4 intensity levels
          }
        }

        weekData.push({
          date: currentDate.toISOString().split('T')[0],
          intensity,
          activities: dayActivities.length,
          distance: dayActivities.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000
        });
      }

      // Only add weeks that have at least one day from current year
      if (weekData.length > 0) {
        weeks.push(weekData);
      }
    }
    return weeks;
  };

  const getIntensityColor = (intensity: number) => {
    switch (intensity) {
      case 0: return Theme.colors.background.tertiary;
      case 1: return `${Theme.colors.accent.primary}40`; // 25% opacity
      case 2: return `${Theme.colors.accent.primary}80`; // 50% opacity
      case 3: return `${Theme.colors.accent.primary}B0`; // 70% opacity
      case 4: return Theme.colors.accent.primary; // 100% opacity
      default: return Theme.colors.background.tertiary;
    }
  };

  const gridData = generateGridData();
  const totalActivities = activities.length;
  const totalDistance = activities.reduce((sum, activity) => sum + (activity.distance || 0), 0) / 1000;

  // Generate month labels for the grid
  const generateMonthLabels = (weeks: any[]) => {
    const monthLabels: { label: string; width: number }[] = [];
    let lastProcessedMonth = -1;
    let weekCount = 0;
    const targetYear = new Date().getFullYear();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    weeks.forEach((week, weekIndex) => {
      if (week.length > 0) {
        // Use the first day of the week to determine the month
        const firstDayOfWeek = new Date(week[0].date);
        const month = firstDayOfWeek.getMonth();
        const year = firstDayOfWeek.getFullYear();

        // Only process months from the current year
        if (year === targetYear) {
          if (month !== lastProcessedMonth) {
            // Finalize the previous month's width
            if (weekCount > 0 && monthLabels.length > 0) {
              monthLabels[monthLabels.length - 1].width = Math.max(weekCount * 16, 30); // 12px width + 4px gap, minimum 30px
            }

            // Start new month
            monthLabels.push({
              label: monthNames[month],
              width: 0
            });

            lastProcessedMonth = month;
            weekCount = 1;
          } else {
            weekCount++;
          }
        }
      }
    });

    // Set width for the last month
    if (monthLabels.length > 0 && weekCount > 0) {
      monthLabels[monthLabels.length - 1].width = Math.max(weekCount * 16, 30); // Minimum width of 30px
    }

    return monthLabels;
  };

  // Scroll to the end (most recent) when component mounts
  React.useEffect(() => {
    if (gridData.length === 0) return;
    // small timeout to ensure layout pass is complete
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
      monthScrollRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [gridData.length]);

  return (
    <View style={styles.activityGrid}>
      <TouchableOpacity style={styles.activityGridHeader} onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/activities');
      }}>
        <Text style={styles.activityGridPeriod}>{new Date().getFullYear()} • {totalActivities} runs • {(profile?.metricSystem ?? 'metric') === 'metric'
          ? `${totalDistance.toFixed(0)}km`
          : `${(totalDistance * 0.621371).toFixed(0)}mi`
        }</Text>
        <View style={styles.activityGridViewAll}>
          <Text style={styles.activityGridStats}>
            View all
          </Text>
          <Ionicons name="arrow-forward" size={20} color={Theme.colors.text.primary} />
        </View>
      </TouchableOpacity>

      <View style={styles.activityGridWrapper}>
        {/* Month labels */}
        <ScrollView
          ref={monthScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={styles.activityGridMonthsScrollView}
          contentContainerStyle={styles.activityGridScrollContent}
        >
          <View style={styles.activityGridMonths}>
            {generateMonthLabels(gridData).map((month, index) => (
              <Text
                key={index}
                style={[styles.activityGridMonth, { width: month.width }]}
              >
                {month.label}
              </Text>
            ))}
          </View>
        </ScrollView>

        {/* Day labels and grid */}
        <View style={styles.activityGridWithDays}>
          {/* Day labels */}
          <View style={styles.activityGridDayLabels}>
            {(() => {
              const dayLabels = weekStartDay === 0
                ? ['Sun', 'Mon', '', 'Wed', '', 'Fri', ''] // Sunday start
                : ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']; // Monday start
              return dayLabels.map((label, index) => (
                <Text key={index} style={styles.activityGridDayLabel}>
                  {label}
                </Text>
              ));
            })()}
          </View>

          {/* Scrollable grid */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.activityGridScrollView}
            contentContainerStyle={styles.activityGridScrollContent}
            onScroll={handleGridScroll}
            scrollEventThrottle={16}
          >
            <View style={styles.activityGridWeeks}>
              {gridData.map((week, weekIndex) => (
                <View key={weekIndex} style={styles.activityGridWeek}>
                  {week.map((day, dayIndex) => (
                    <View
                      key={dayIndex}
                      style={[
                        styles.activityGridDay,
                        { backgroundColor: getIntensityColor(day.intensity) }
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={styles.activityGridLegend}>
        <Text style={styles.activityGridLegendText}>Less</Text>
        {[0, 1, 2, 3, 4].map((intensity) => (
          <View
            key={intensity}
            style={[
              styles.activityGridLegendItem,
              { backgroundColor: getIntensityColor(intensity) }
            ]}
          />
        ))}
        <Text style={styles.activityGridLegendText}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  activityGrid: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 0,
    borderColor: Theme.colors.background.tertiary,
    padding: Theme.spacing.lg,
  },
  activityGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  activityGridPeriod: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  activityGridViewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  activityGridStats: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  activityGridScrollView: {
    marginBottom: Theme.spacing.md,
  },
  activityGridScrollContent: {
    paddingRight: Theme.spacing.lg,
  },
  activityGridWeeks: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
  activityGridWeek: {
    flexDirection: 'column',
    gap: Theme.spacing.xs,
  },
  activityGridDay: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  activityGridLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Theme.spacing.sm,
  },
  activityGridLegendText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  activityGridLegendItem: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginLeft: Theme.spacing.xs,
  },
  activityGridWrapper: {
    marginBottom: Theme.spacing.md,
  },
  activityGridMonthsScrollView: {
    marginBottom: Theme.spacing.xs,
    marginLeft: 30, // Start after day labels
    overflow: 'hidden',
  },
  activityGridMonths: {
    flexDirection: 'row',
  },
  activityGridMonth: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'left',
  },
  activityGridWithDays: {
    flexDirection: 'row',
  },
  activityGridDayLabels: {
    width: 30,
    height: 110, // 7 days * 12px = 84px to match grid height
    justifyContent: 'space-between',
    paddingRight: Theme.spacing.xs,
  },
  activityGridDayLabel: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    height: 12,
    textAlign: 'right',
    lineHeight: 12,
  },
}); 
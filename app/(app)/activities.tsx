import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface WeekSummary {
  weekNumber: number;
  dateRange: string;
  totalWorkouts: number;
  totalDistance: number;
  workouts: Array<{
    day: string;
    date: string;
    displayDate: string;
    type: string;
    distance: number;
    duration: string;
    description: string;
    completed?: boolean;
  }>;
}

export default function ProgressScreen() {
  const { isAuthenticated } = useConvexAuth();

  // Get current year and month data
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const activitiesForYear = useQuery(api.activities.getUserActivitiesForYear, {
    year: currentYear,
    limit: 100,
  });

  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const stats = useQuery(api.activities.getActivityStats, { days: 365 });
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const plannedWorkouts = useQuery(api.trainingPlan.getPlannedWorkouts, {
    startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });
  const completedWorkouts: any[] = [];
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const formatDistance = (kilometers: number) => {
    return `${kilometers.toFixed(0)}km`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPace = (pace: number) => {
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
  };

  const handleActivityPress = (activity: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Convert database activity to the format expected by the activity detail screen
    const activityForDetail = {
      uuid: activity.healthKitUuid || `strava_${activity.stravaId}`,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    };

    router.push({
      pathname: '/activity-detail',
      params: {
        activity: JSON.stringify(activityForDetail)
      }
    });
  };

  const getGoalDisplayName = (goal: string): string => {
    const names: Record<string, string> = {
      '5K': 'From 0 to 5K',
      '10K': 'First 10K',
      'just-run-more': 'Get Fit'
    };
    return names[goal] || goal;
  };

  const formatDateRange = (start: Date, end: Date) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const startFormatted = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const endFormatted = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });

    return `${startFormatted.toUpperCase()} - ${endFormatted.toUpperCase()}`;
  };

  const calculateDurationFromSteps = (steps?: Array<{ duration?: string;[key: string]: any; }>): number => {
    if (!steps || steps.length === 0) return 30;

    const durations = steps.map(step => step.duration).filter(Boolean);
    if (durations.length === 0) return 30;

    const totalMinutes = durations.reduce((sum, duration) => {
      const match = duration!.match(/(\d+)\s*min/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    return totalMinutes > 0 ? totalMinutes : 30;
  };

  const calculateDistanceFromSteps = (steps?: Array<{ distance?: number;[key: string]: any; }>): number => {
    if (!steps || steps.length === 0) return 0;

    const totalDistance = steps.reduce((sum, step) => sum + (step.distance || 0), 0);
    return totalDistance / 1000; // Convert meters to km
  };

  const calculateWeekSummaries = (): WeekSummary[] => {
    if (!trainingPlan?.plan || !plannedWorkouts) return [];

    const weekSummaries: WeekSummary[] = [];

    trainingPlan.plan.forEach((planWeek) => {
      const weekWorkouts = plannedWorkouts.filter(workout => {
        return planWeek.days.some(day => day.date === workout.scheduledDate);
      });

      const firstWorkoutDate = weekWorkouts.length > 0
        ? new Date(weekWorkouts[0].scheduledDate)
        : new Date();

      const weekStart = new Date(firstWorkoutDate);
      weekStart.setDate(firstWorkoutDate.getDate() - firstWorkoutDate.getDay());

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      const workouts = planWeek.days
        .map(day => {
          const scheduledWorkout = weekWorkouts.find(w =>
            w.scheduledDate === day.date
          );

          const workoutDate = new Date(`${day.date}T00:00:00`);

          let workoutType, workoutDescription, distance, duration;

          if (scheduledWorkout && (scheduledWorkout as any).workout) {
            const enrichedWorkout = (scheduledWorkout as any).workout;
            workoutType = enrichedWorkout.type || day.type;
            workoutDescription = enrichedWorkout.description || day.description;
            distance = calculateDistanceFromSteps(enrichedWorkout.steps);
            duration = calculateDurationFromSteps(enrichedWorkout.steps);
          } else {
            workoutType = day.type;
            workoutDescription = day.description;
            distance = day.type === 'long' ? 5.0 : day.type === 'easy' ? 3.0 : day.type === 'tempo' ? 4.0 : 0;
            duration = day.type === 'long' ? 45 : day.type === 'easy' ? 30 : day.type === 'tempo' ? 35 : day.type === 'interval' ? 40 : 20;
          }

          return {
            day: dayNames[workoutDate.getDay()],
            date: day.date,
            displayDate: workoutDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            type: workoutType,
            distance,
            duration: `${duration}m`,
            description: workoutDescription,
            completed: completedWorkouts?.some(c =>
              new Date(c._creationTime).toDateString() === workoutDate.toDateString()
            )
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const totalWorkouts = workouts.length;
      const totalDistance = workouts.reduce((sum, w) => sum + w.distance, 0);

      weekSummaries.push({
        weekNumber: planWeek.week,
        dateRange: formatDateRange(weekStart, weekEnd),
        totalWorkouts,
        totalDistance: Math.round(totalDistance * 10) / 10,
        workouts
      });
    });

    return weekSummaries;
  };

  const calculateOverallProgress = () => {
    if (!trainingPlan?.plan || !completedWorkouts) return { weeksCompleted: 0, totalWeeks: 0, totalDistance: 0 };

    const totalWeeks = trainingPlan.plan.length;
    const currentWeek = Math.min(
      Math.floor((Date.now() - new Date(trainingPlan._creationTime).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
      totalWeeks
    );

    const totalDistance = completedWorkouts.reduce((sum: number, completion: any) =>
      sum + (completion.actualDistance || 0), 0
    ) / 1000;

    return {
      weeksCompleted: Math.max(0, currentWeek - 1),
      totalWeeks,
      totalDistance: Math.round(totalDistance * 10) / 10
    };
  };

  // Group activities by month
  const getActivitiesForMonth = (monthOffset: number = 0) => {
    if (!activitiesForYear) return [];

    const targetMonth = currentMonth + monthOffset;
    const targetYear = currentYear + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    return activitiesForYear
      .filter(activity => {
        const activityDate = new Date(activity.startDate);
        return activityDate.getMonth() === normalizedMonth &&
          activityDate.getFullYear() === targetYear;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  };

  // Calculate monthly distances
  const getMonthlyDistance = (monthOffset: number = 0) => {
    const activities = getActivitiesForMonth(monthOffset);
    const distanceInMeters = activities.reduce((total, activity) => total + (activity.distance || 0), 0);
    return distanceInMeters / 1000; // Return km
  };

  const getMonthName = (monthOffset: number = 0) => {
    const targetMonth = currentMonth + monthOffset;
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const year = currentYear + Math.floor(targetMonth / 12);
    return `${monthNames[normalizedMonth]} ${year}`;
  };

  const currentMonthActivities = getActivitiesForMonth(0);
  const currentMonthDistance = getMonthlyDistance(0);
  const weekSummaries = calculateWeekSummaries();
  const progress = calculateOverallProgress();
  const planName = trainingProfile ? `${getGoalDisplayName(trainingProfile.goalDistance)} Plan` : '';

  // Loading state
  if (!isAuthenticated || activitiesForYear === undefined || profile === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>Progress</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Theme.colors.accent.primary} />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No data source configured
  if (profile && !profile.healthKitSyncEnabled && !profile.stravaSyncEnabled) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.pageHeader}>
          <Text style={styles.headerTitle}>Progress</Text>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.permissionContainer}>
          <Text style={styles.title}>Connect a Data Source</Text>
          <Text style={styles.description}>
            Connect to HealthKit or Strava in Settings to start tracking your running progress.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Prepare sections for SectionList
  const sections = [
    {
      title: 'This Month',
      distance: formatDistance(currentMonthDistance),
      runCount: currentMonthActivities.length,
      data: currentMonthActivities,
    },
    {
      title: getMonthName(-1),
      distance: formatDistance(getMonthlyDistance(-1)),
      runCount: getActivitiesForMonth(-1).length,
      data: getActivitiesForMonth(-1),
    },
    {
      title: getMonthName(-2),
      distance: formatDistance(getMonthlyDistance(-2)),
      runCount: getActivitiesForMonth(-2).length,
      data: getActivitiesForMonth(-2),
    },
    {
      title: getMonthName(-3),
      distance: formatDistance(getMonthlyDistance(-3)),
      runCount: getActivitiesForMonth(-3).length,
      data: getActivitiesForMonth(-3),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item._id.toString()}
        renderItem={({ item }) => (
          <View style={styles.activityItemWrapper}>
            <ActivityCard
              activity={item}
              handleActivityPress={handleActivityPress}
              formatDistance={formatDistance}
              formatDate={formatDate}
              formatPace={formatPace}
            />
          </View>
        )}
        renderSectionHeader={({ section }) => (
          <MonthHeader title={section.title} distance={section.distance} runCount={section.runCount} />
        )}
        renderSectionFooter={({ section }) => (
          section.data.length === 0 ? (
            <View style={styles.activitiesContainer}>
              <View style={styles.emptyMonthState}>
                <Text style={styles.emptyMonthText}>No runs this month</Text>
              </View>
            </View>
          ) : (
            <View style={styles.sectionBottomSpacing} />
          )
        )}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={() => (
          <>
            {/* Page Header - now part of scrollable content */}
            <View style={styles.pageHeader}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerTitle}>Progress</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/manage-plan');
                  }}
                >
                  <Text style={styles.editButtonText}>edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Training Plan Section */}
            {trainingPlan && trainingProfile ? (
              <View style={styles.trainingPlanContainer}>
                <TouchableOpacity onPress={() => router.push('/training')}>
                  <View style={styles.overviewCard}>
                    <View style={styles.overviewHeader}>
                      <View>
                        <Text style={styles.planTitle}>{planName}</Text>
                        {trainingProfile.goalDistance !== 'just-run-more' && trainingProfile.goalDate && (
                          <Text style={styles.trialText}>
                            Race Day: {new Date(trainingProfile.goalDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Weeks Completed</Text>
                        <Text style={styles.statValue}>{progress.weeksCompleted}/{progress.totalWeeks}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.trainingPlanContainer}>
                <View style={styles.trainingPlanCard}>
                  <Text style={styles.trainingPlanText}>No custom training plan</Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/manage-plan');
                    }}
                  >
                    <Text style={styles.generateButtonText}>Generate Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={Theme.colors.accent.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Theme.spacing.xxxl }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  loadingText: {
    marginTop: Theme.spacing.lg,
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    marginBottom: Theme.spacing.lg,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xxxl,
    lineHeight: 24,
    fontFamily: Theme.fonts.regular,
  },
  button: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 200,
  },
  buttonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    textAlign: 'center',
  },
  trainingPlanContainer: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.md,
  },
  trainingPlanCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    alignItems: 'center',
  },
  trainingPlanText: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  generateButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
  },
  generateButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  monthTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  monthDistance: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.secondary,
  },
  activitiesContainer: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  emptyMonthState: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  emptyMonthText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  activityCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  activityTitleContainer: {
    flex: 1,
  },
  activityType: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  activityDate: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.regular,
  },
  chevron: {
    fontSize: 20,
    color: Theme.colors.accent.primary,
    fontFamily: Theme.fonts.medium,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityStat: {
    alignItems: 'center',
    flex: 1,
  },
  activityValue: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  activityLabel: {
    fontSize: 10,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
    fontFamily: Theme.fonts.regular,
  },
  statValue: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
  },
  pageHeader: {
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
  },
  stickyMonthHeader: {
    paddingHorizontal: Theme.spacing.xl,
    backgroundColor: Theme.colors.background.primary,
    marginBottom: Theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background.secondary,
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  monthRunCount: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  activityItemWrapper: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.sm,
  },
  sectionBottomSpacing: {
    height: Theme.spacing.lg,
  },
  overviewCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.xl,
  },
  planTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  trialText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  progressContainer: {
    marginBottom: Theme.spacing.xl,
  },
  progressBar: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: Theme.borderRadius.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
});

const ActivityCard = ({ activity, handleActivityPress, formatDistance, formatDate, formatPace }: any) => (
  <TouchableOpacity
    style={styles.activityCard}
    onPress={() => handleActivityPress(activity)}
    activeOpacity={0.7}
  >
    <View style={styles.activityHeader}>
      <View style={styles.activityTitleContainer}>
        <Text style={styles.activityType}>{activity.workoutName || 'Running'}</Text>
        <Text style={styles.activityDate}>{formatDate(activity.startDate)}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
    <View style={styles.activityStats}>
      <View style={styles.activityStat}>
        <Text style={styles.activityValue}>
          {formatDistance(activity.distance)}
        </Text>
        <Text style={styles.activityLabel}>Distance</Text>
      </View>
      <View style={styles.activityStat}>
        <Text style={styles.activityValue}>{activity.duration} min</Text>
        <Text style={styles.activityLabel}>Duration</Text>
      </View>
      <View style={styles.activityStat}>
        <Text style={styles.activityValue}>{activity.calories}</Text>
        <Text style={styles.activityLabel}>Calories</Text>
      </View>
      {activity.pace && (
        <View style={styles.activityStat}>
          <Text style={styles.activityValue}>
            {formatPace(activity.pace)}
          </Text>
          <Text style={styles.activityLabel}>Pace</Text>
        </View>
      )}
    </View>
  </TouchableOpacity>
);

const MonthHeader = ({ title, distance, runCount }: { title: string, distance: string, runCount: number }) => (
  <View style={styles.stickyMonthHeader}>
    <View style={styles.monthHeader}>
      <Text style={styles.monthTitle}>{title}</Text>
      <View style={styles.monthStats}>
        <Text style={styles.monthDistance}>{distance}</Text>
        <Text style={styles.monthRunCount}>{runCount} runs</Text>
      </View>
    </View>
  </View>
);
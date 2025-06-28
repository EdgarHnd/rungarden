import { ActivityCard } from '@/components/ActivityCard';
import { ActivityGrid } from '@/components/ActivityGrid';
import { MonthHeader } from '@/components/MonthHeader';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistanceValue, getDistanceUnit } from '@/utils/formatters';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const simpleSchedule = useQuery(api.simpleTrainingSchedule.getSimpleTrainingSchedule);
  const completedWorkouts: any[] = [];
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleStartNowPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if we're in development mode
    if (__DEV__) {
      router.push('/manage-plan');
    } else {
      Alert.alert(
        'Coming Soon',
        'Training plan generation is coming soon! Stay tuned for updates.',
        [{ text: 'OK', style: 'default' }]
      );
    }
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
    return distanceInMeters; // Return meters for consistent usage with centralized formatters
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

  // Generate dynamic sections based on months that have activities
  const generateDynamicSections = () => {
    if (!activitiesForYear || activitiesForYear.length === 0) return [];

    // Get unique months from activities
    const monthsWithActivities = new Set<string>();
    activitiesForYear.forEach(activity => {
      const activityDate = new Date(activity.startDate);
      const monthKey = `${activityDate.getFullYear()}-${activityDate.getMonth()}`;
      monthsWithActivities.add(monthKey);
    });

    // Convert to array and sort by date (newest first)
    const sortedMonths = Array.from(monthsWithActivities)
      .map(monthKey => {
        const [year, month] = monthKey.split('-').map(Number);
        return { year, month, monthKey };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    // Generate sections for each month with activities
    return sortedMonths.map(({ year, month }) => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();

      // Calculate month offset
      const monthOffset = (year - currentYear) * 12 + (month - currentMonth);

      const activities = getActivitiesForMonth(monthOffset);
      const distanceInMeters = getMonthlyDistance(monthOffset);

      // Generate title
      let title: string;
      if (year === currentYear && month === currentMonth) {
        title = 'This Month';
      } else {
        title = getMonthName(monthOffset);
      }

      return {
        title,
        distance: `${formatDistanceValue(distanceInMeters, metricSystem)} ${getDistanceUnit(metricSystem)}`,
        runCount: activities.length,
        data: activities,
      };
    });
  };

  const progress = calculateOverallProgress();
  const planName = trainingProfile ? `${getGoalDisplayName(trainingProfile.goalDistance || '5K')} Plan` : '';
  const sections = generateDynamicSections();

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
              </View>
            </View>

            {/* Training Plan Section */}
            {trainingPlan && trainingProfile ? (
              <View style={styles.trainingPlanContainer}>
                <TouchableOpacity onPress={() => router.push('/training')}>
                  <View style={styles.overviewCard}>
                    <View style={styles.overviewHeader}>
                      <View style={styles.planInfo}>
                        <Text style={styles.planTitle}>{planName}</Text>
                      </View>

                      {/* Manage Plan Button at top right */}
                      <TouchableOpacity
                        style={styles.inCardButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push('/manage-plan');
                        }}
                      >
                        <Text style={styles.inCardButtonText}>View</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        {trainingProfile.goalDistance !== 'just-run-more' && trainingProfile.goalDate && (
                          <View>
                            <Text style={styles.statLabel}>Race Day</Text>
                            <Text style={styles.statValue}>
                              {new Date(trainingProfile.goalDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              }).toUpperCase()}
                            </Text>
                          </View>
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
            ) : simpleSchedule && simpleSchedule.isActive ? (
              <View style={styles.trainingPlanContainer}>
                <TouchableOpacity onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/manage-schedule');
                }}>
                  <View style={styles.overviewCard}>
                    <View style={styles.overviewHeader}>
                      <View style={styles.planInfo}>
                        <Text style={styles.planTitle}>Basic Training</Text>
                      </View>

                      {/* Manage Schedule Button at top right */}
                      <TouchableOpacity
                        style={styles.inCardButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push('/manage-schedule');
                        }}
                      >
                        <Text style={styles.inCardButtonText}>Manage</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Runs per week</Text>
                        <Text style={styles.statValue}>{simpleSchedule.runsPerWeek}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Preferred Days</Text>
                        <Text style={styles.statValue}>{simpleSchedule.preferredDays.join(', ')}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Start Custom Training Plan button outside */}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleStartNowPress}
                >
                  <Text style={styles.actionButtonText}>Start Custom Training Plan</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.trainingPlanContainer}>
                <View style={styles.trainingPlanCard}>
                  <Text style={styles.trainingPlanText}>No training schedule</Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={handleStartNowPress}
                  >
                    <Text style={styles.generateButtonText}>Start Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* GitHub-style Activity Grid */}
            <View style={styles.activityGridContainer}>
              <Text style={styles.activityGridTitle}>Activity Overview</Text>
              <ActivityGrid activities={activitiesForYear || []} profile={profile} />

            </View>
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
        contentContainerStyle={{ paddingBottom: 100 }}
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
    marginBottom: Theme.spacing.xl,
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
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  generateButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
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
  statValue: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  statLabel: {
    fontSize: 14,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
  },
  pageHeader: {
    paddingTop: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
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
    marginBottom: Theme.spacing.lg,
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
  },
  statItem: {
    alignItems: 'center',
  },
  activityGridContainer: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  activityGridTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
    marginTop: Theme.spacing.lg,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  inCardButton: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.small,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
  },
  inCardButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  planInfo: {
    flex: 1,
    marginRight: Theme.spacing.md,
  },
});


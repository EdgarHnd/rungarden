import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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

const getWorkoutTypeColor = (type: string): string => {
  const colorMap: Record<string, string> = {
    'easy': '#4CAF50',          // Green
    'tempo': '#FF9500',         // Orange
    'interval': '#FF3B30',      // Red
    'intervals': '#FF3B30',     // Red
    'long': '#9C27B0',          // Purple
    'recovery': '#10B981',      // Green
    'cross-train': '#8B5CF6',   // Purple
    'strength': '#9333EA',      // Purple
    'rest': '#757575',          // Gray
    'race': '#FF5722',          // Deep orange
    'run': '#4CAF50',           // Green
  };
  return colorMap[type] || colorMap['run'];
};

const getWorkoutEmoji = (type: string): string => {
  const emojiMap: Record<string, string> = {
    'easy': '🏃‍♂️',
    'tempo': '🔥',
    'interval': '⚡',
    'intervals': '⚡',
    'long': '🏃‍♂️',
    'recovery': '🧘‍♀️',
    'cross-train': '🚴‍♂️',
    'strength': '💪',
    'rest': '😴',
    'race': '🏆',
    'run': '🏃‍♂️'
  };
  return emojiMap[type] || '🏃‍♂️';
};

const getWorkoutDisplayName = (type: string): string => {
  const displayNames: Record<string, string> = {
    'easy': 'Easy Run',
    'tempo': 'Tempo Run',
    'interval': 'Interval Training',
    'intervals': 'Interval Training',
    'long': 'Long Run',
    'recovery': 'Recovery Run',
    'cross-train': 'Cross Training',
    'strength': 'Strength Training',
    'rest': 'Rest Day',
    'race': 'Race Day',
    'run': 'Run'
  };
  return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ');
};

const getGoalDisplayName = (goal: string): string => {
  const names: Record<string, string> = {
    '5K': 'From 0 to 5K',
    '10K': 'First 10K',
    'just-run-more': 'Get Fit'
  };
  return names[goal] || goal;
};

const getCurrentWeek = (weekSummaries: WeekSummary[]): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const week of weekSummaries) {
    const weekWorkouts = week.workouts;
    if (weekWorkouts.length > 0) {
      const firstWorkoutDate = new Date(`${weekWorkouts[0].date}T00:00:00`);
      const lastWorkoutDate = new Date(`${weekWorkouts[weekWorkouts.length - 1].date}T00:00:00`);

      if (today >= firstWorkoutDate && today <= lastWorkoutDate) {
        return week.weekNumber;
      }
    }
  }

  for (const week of weekSummaries) {
    for (const workout of week.workouts) {
      const workoutDate = new Date(`${workout.date}T00:00:00`);
      const weekStart = new Date(workoutDate);
      weekStart.setDate(workoutDate.getDate() - workoutDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      if (today >= weekStart && today <= weekEnd) {
        return week.weekNumber;
      }
    }
  }

  return 1;
};

const handleCurrentWeek = (weekSummaries: WeekSummary[], setSelectedWeek: (week: number) => void) => {
  const currentWeek = getCurrentWeek(weekSummaries);
  setSelectedWeek(currentWeek);
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

const handleManagePlan = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  router.push('/manage-plan');
};

// Helper function to format distance based on metric system preference
const formatDistance = (distanceKm: number, isMetric: boolean): string => {
  if (isMetric) {
    return `${distanceKm}km`;
  } else {
    const miles = distanceKm * 0.621371;
    return `${miles.toFixed(1)}mi`;
  }
};

export default function TrainingPlanScreen() {
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const plannedWorkouts = useQuery(api.trainingPlan.getPlannedWorkouts, {
    startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 months ago
    endDate: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]    // 6 months ahead
  });
  // const completedWorkouts = useQuery(api.workoutCompletions.getUserCompletions, { days: 365 });
  const completedWorkouts: any[] = [];
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);
  const regenerateTrainingPlan = useMutation(api.trainingPlan.regenerateTrainingPlan);

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get workout style preference
  const preferTimeOverDistance = trainingProfile?.preferTimeOverDistance ?? true;

  const handleMainBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
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

  // Helper function to calculate duration from workout steps
  const calculateDurationFromSteps = (steps?: Array<{ duration?: string;[key: string]: any; }>): number => {
    if (!steps || steps.length === 0) return 30;

    const durations = steps.map(step => step.duration).filter(Boolean);
    if (durations.length === 0) return 30;

    // Sum up durations if they're all in minutes
    const totalMinutes = durations.reduce((sum, duration) => {
      const match = duration!.match(/(\d+)\s*min/);
      return sum + (match ? parseInt(match[1]) : 0);
    }, 0);

    return totalMinutes > 0 ? totalMinutes : 30;
  };

  // Helper function to calculate distance from workout steps
  const calculateDistanceFromSteps = (steps?: Array<{ distance?: number;[key: string]: any; }>): number => {
    if (!steps || steps.length === 0) return 0;

    const totalDistance = steps.reduce((sum, step) => sum + (step.distance || 0), 0);
    return totalDistance / 1000; // Convert meters to km
  };

  const calculateWeekSummaries = (): WeekSummary[] => {
    if (!trainingPlan?.plan || !plannedWorkouts) return [];

    const weekSummaries: WeekSummary[] = [];

    trainingPlan.plan.forEach((planWeek) => {
      // Filter workouts by date range
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

          // Extract workout data from the enriched planned workout, with fallback to plan day data
          let workoutType, workoutDescription, distance, duration;

          if (scheduledWorkout && (scheduledWorkout as any).workout) {
            // Use enriched workout data
            const enrichedWorkout = (scheduledWorkout as any).workout;
            workoutType = enrichedWorkout.type || day.type;
            workoutDescription = enrichedWorkout.description || day.description;
            distance = calculateDistanceFromSteps(enrichedWorkout.steps);
            duration = calculateDurationFromSteps(enrichedWorkout.steps);
          } else {
            // Fallback to plan day data
            workoutType = day.type;
            workoutDescription = day.description;
            // Estimate distance and duration based on workout type
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

  if (!trainingPlan || !trainingProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleMainBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Your Plan</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No Training Plan</Text>
          <Text style={styles.emptySubtitle}>
            {!trainingProfile
              ? "Complete onboarding to get your personalized plan"
              : "Generate your personalized training plan"
            }
          </Text>
          {trainingProfile && (
            <TouchableOpacity
              style={styles.generatePlanButton}
              onPress={async () => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await generateTrainingPlan();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error) {
                  console.error('Failed to generate training plan:', error);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                }
              }}
            >
              <Text style={styles.generatePlanButtonText}>Generate Training Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  const weekSummaries = calculateWeekSummaries();
  const progress = calculateOverallProgress();
  const progressPercent = progress.totalWeeks > 0 ? (progress.weeksCompleted / progress.totalWeeks) * 100 : 0;

  const planName = `${getGoalDisplayName(trainingProfile.goalDistance ?? 'just-run-more')} Plan`;

  const handleWeekPress = (weekNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedWeek(weekNumber);
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedWeek(null);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!selectedWeek) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newWeek = direction === 'prev' ? selectedWeek - 1 : selectedWeek + 1;

    if (newWeek >= 1 && newWeek <= weekSummaries.length) {
      setSelectedWeek(newWeek);
    }
  };

  // If a week is selected, show the detailed view
  if (selectedWeek) {
    const selectedWeekData = weekSummaries.find(w => w.weekNumber === selectedWeek);

    if (selectedWeekData) {
      return (
        <View style={styles.container}>
          <View style={styles.weekDetailHeader}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
            </TouchableOpacity>

            <Text style={styles.planOverviewTitle}>Plan Overview</Text>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.weekDetailNavigation}>
            <TouchableOpacity
              onPress={() => navigateWeek('prev')}
              style={[styles.navButton, selectedWeek === 1 && styles.navButtonDisabled]}
              disabled={selectedWeek === 1}
            >
              <Ionicons name="chevron-back" size={20} color={selectedWeek === 1 ? Theme.colors.text.tertiary : Theme.colors.text.primary} />
            </TouchableOpacity>

            <Text style={styles.weekTitle}>Week {selectedWeek}</Text>

            <TouchableOpacity
              onPress={() => navigateWeek('next')}
              style={[styles.navButton, selectedWeek === weekSummaries.length && styles.navButtonDisabled]}
              disabled={selectedWeek === weekSummaries.length}
            >
              <Ionicons name="chevron-forward" size={20} color={selectedWeek === weekSummaries.length ? Theme.colors.text.tertiary : Theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekDetailProgress}>
            <View style={styles.weekProgressBar}>
              {Array.from({ length: Math.max(selectedWeekData.totalWorkouts, 3) }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.weekProgressSegment,
                    {
                      backgroundColor: i < selectedWeekData.workouts.filter(w => w.completed).length
                        ? Theme.colors.accent.primary
                        : Theme.colors.background.tertiary
                    }
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.weekDetailStats}>
            <Text style={styles.weekDetailStatsText}>
              Total Workouts: <Text style={styles.weekDetailStatsValue}>{selectedWeekData.totalWorkouts}</Text>
            </Text>
            <Text style={styles.weekDetailStatsText}>
              Distance: <Text style={styles.weekDetailStatsValue}>{formatDistance(selectedWeekData.totalDistance, isMetric)}</Text>
            </Text>
          </View>

          <ScrollView style={styles.weekDetailContent} showsVerticalScrollIndicator={false}>
            {selectedWeekData.workouts.map((workout, index) => (
              <TouchableOpacity
                key={index}
                style={styles.detailedWorkoutCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                  // Find the corresponding planned workout for enriched data
                  const correspondingPlannedWorkout = plannedWorkouts?.find(pw =>
                    pw.scheduledDate === workout.date
                  );

                  // Navigate to training detail with the planned workout ID
                  router.push({
                    pathname: '/training-detail',
                    params: {
                      scheduleWorkoutId: correspondingPlannedWorkout?._id
                    }
                  });
                }}
              >
                <View
                  style={[
                    styles.workoutColorBar,
                    { backgroundColor: getWorkoutTypeColor(workout.type) }
                  ]}
                />

                <View style={styles.detailedWorkoutContent}>
                  <View style={styles.detailedWorkoutHeader}>
                    <Text style={styles.detailedWorkoutDay}>
                      {workout.displayDate}
                    </Text>
                    <Text style={styles.detailedWorkoutTime}>{workout.duration}</Text>
                    <TouchableOpacity style={styles.workoutCheckbox}>
                      <View style={[
                        styles.checkbox,
                        workout.completed && styles.checkboxCompleted
                      ]}>
                        {workout.completed && (
                          <Ionicons name="checkmark" size={16} color={Theme.colors.text.primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.detailedWorkoutTitle}>
                    {preferTimeOverDistance
                      ? `${workout.duration} ${getWorkoutDisplayName(workout.type)}`
                      : `${formatDistance(workout.distance, isMetric)} ${getWorkoutDisplayName(workout.type)}`
                    }
                  </Text>

                  <Text style={styles.detailedWorkoutType}>
                    {preferTimeOverDistance
                      ? `${getWorkoutDisplayName(workout.type)} · ${workout.duration}`
                      : `${getWorkoutDisplayName(workout.type)} · ${formatDistance(workout.distance, isMetric)}`
                    }
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMainBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Your Plan</Text>
            <Text style={styles.betaText}>Training Plans are still in BETA</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              {Array.from({ length: progress.totalWeeks }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    {
                      backgroundColor: i < progress.weeksCompleted
                        ? Theme.colors.accent.primary
                        : Theme.colors.background.tertiary
                    }
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Weeks Completed</Text>
              <Text style={styles.statValue}>{progress.weeksCompleted}/{progress.totalWeeks}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Distance</Text>
              <Text style={styles.statValue}>
                {formatDistance(progress.totalDistance, isMetric)}/{formatDistance(Math.round(weekSummaries.reduce((sum, week) => sum + week.totalDistance, 0)), isMetric)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleManagePlan}
          >
            <Ionicons name="create" size={20} color={Theme.colors.text.primary} />
            <Text style={styles.actionButtonText}>Manage Plan</Text>
          </TouchableOpacity>
        </View>

        {weekSummaries.map((week, index) => (
          <TouchableOpacity
            key={week.weekNumber}
            style={styles.weekCard}
            onPress={() => handleWeekPress(week.weekNumber)}
          >
            <View style={styles.weekHeader}>
              <View>
                <Text style={styles.weekDateRange}>{week.dateRange}</Text>
                <Text style={styles.weekTitle}>Week {week.weekNumber}</Text>
              </View>
            </View>

            <View style={styles.weekProgressContainer}>
              <View style={styles.weekProgressBar}>
                {Array.from({ length: Math.max(week.totalWorkouts, 3) }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.weekProgressSegment,
                      {
                        backgroundColor: i < week.workouts.filter(w => w.completed).length
                          ? Theme.colors.accent.primary
                          : Theme.colors.background.tertiary
                      }
                    ]}
                  />
                ))}
              </View>
            </View>

            <View style={styles.weekStatsRow}>
              <Text style={styles.weekStat}>Total Workouts: {week.totalWorkouts}</Text>
              <Text style={styles.weekStat}>Distance: {formatDistance(week.totalDistance, isMetric)}</Text>
            </View>

            <View style={styles.workoutsList}>
              {week.workouts.map((workout, workoutIndex) => (
                <View key={workoutIndex} style={styles.workoutItem}>
                  <View style={[styles.workoutDot, { backgroundColor: getWorkoutTypeColor(workout.type) }]} />
                  <View style={styles.workoutContent}>
                    <Text style={styles.workoutDay}>{workout.day}</Text>
                    <Text style={styles.workoutDescription}>
                      {preferTimeOverDistance
                        ? `${getWorkoutDisplayName(workout.type)} · ${workout.duration}`
                        : `${getWorkoutDisplayName(workout.type)} · ${formatDistance(workout.distance, isMetric)}`
                      }
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 200 }} />

        {/* <View style={styles.premiumCard}>
          <View style={styles.premiumHeader}>
            <Ionicons name="diamond" size={24} color={Theme.colors.accent.primary} />
            <Text style={styles.premiumTitle}>Edgar, join Koko Premium</Text>
          </View>
          <Text style={styles.premiumSubtitle}>
            Subscribe to unlock the rest of your weeks and reach your full potential
          </Text>
          <View style={styles.premiumButtons}>
            <TouchableOpacity style={styles.subscribeButton}>
              <Text style={styles.subscribeButtonText}>SUBSCRIBE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restoreButton}>
              <Text style={styles.restoreButtonText}>RESTORE</Text>
            </TouchableOpacity>
          </View>
        </View> */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.lg,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  titleRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  betaText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.background.tertiary,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.small,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  generatePlanButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.lg,
    marginTop: Theme.spacing.lg,
  },
  generatePlanButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
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
  planBadge: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  planBadgeText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
  statLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.md,
  },
  actionButton: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    flexDirection: 'column',
    gap: Theme.spacing.sm,
  },
  actionButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  weekCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
  },
  weekHeader: {
    marginBottom: Theme.spacing.lg,
  },
  weekDateRange: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xs,
  },
  weekTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  weekProgressContainer: {
    marginBottom: Theme.spacing.lg,
  },
  weekProgressBar: {
    flexDirection: 'row',
    gap: Theme.spacing.xs,
  },
  weekProgressSegment: {
    flex: 1,
    height: 6,
    borderRadius: Theme.borderRadius.small,
  },
  weekStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  weekStat: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  workoutsList: {
    gap: Theme.spacing.md,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  workoutDot: {
    width: 16,
    height: 16,
    borderRadius: Theme.borderRadius.full,
  },
  workoutContent: {
    flex: 1,
  },
  workoutDay: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  workoutDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  premiumCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xl,
    marginBottom: 100,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
  },
  premiumTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  premiumSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 24,
    marginBottom: Theme.spacing.xl,
  },
  premiumButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.lg,
  },
  subscribeButton: {
    flex: 1,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  restoreButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },

  // Week Detail View Styles
  weekDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.sm,
  },
  planOverviewTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  weekDetailNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.lg,
  },
  navButton: {
    padding: Theme.spacing.sm,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  headerSpacer: {
    width: 40,
  },
  weekDetailProgress: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.lg,
  },
  weekDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xl,
  },
  weekDetailStatsText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  weekDetailStatsValue: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  weekDetailContent: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  detailedWorkoutCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    marginBottom: Theme.spacing.lg,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  workoutColorBar: {
    width: 6,
  },
  detailedWorkoutContent: {
    flex: 1,
    padding: Theme.spacing.xl,
  },
  detailedWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.md,
  },
  detailedWorkoutDay: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  detailedWorkoutTime: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginRight: Theme.spacing.md,
  },
  workoutCheckbox: {
    padding: Theme.spacing.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: Theme.borderRadius.small,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: Theme.colors.accent.primary,
    borderColor: Theme.colors.accent.primary,
  },
  detailedWorkoutTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  detailedWorkoutType: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
});
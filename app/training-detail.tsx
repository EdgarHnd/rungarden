import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Activity {
  type: string;
  title: string;
  description: string;
  duration: string;
  distance?: number;
  emoji: string;
  date?: string;
  workoutSections?: WorkoutSection[];
}

interface WorkoutSection {
  id: number;
  type: 'warmup' | 'run' | 'rest' | 'repeat' | 'cooldown';
  title: string;
  subtitle?: string;
  duration?: string;
  distance?: string;
  pace?: string;
  repeats?: number;
}

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams();
  const [scaleAnim] = useState(new Animated.Value(0));

  // Get the scheduleWorkoutId from params
  const scheduleWorkoutId = params.scheduleWorkoutId as Id<"plannedWorkouts"> | undefined;

  // Fetch the planned workout data
  const plannedWorkout = useQuery(
    api.trainingPlan.getPlannedWorkoutById,
    scheduleWorkoutId ? { plannedWorkoutId: scheduleWorkoutId } : "skip"
  );

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get training profile for workout style preference
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const preferTimeOverDistance = trainingProfile?.preferTimeOverDistance ?? true;

  // Check if this planned workout has linked activities
  const linkedActivities = useQuery(
    api.activities.getActivitiesForPlannedWorkout,
    scheduleWorkoutId ? { plannedWorkoutId: scheduleWorkoutId } : "skip"
  );

  // Check if the current planned workout is completed
  const isWorkoutCompleted = plannedWorkout?.status === 'completed' || (linkedActivities?.length ?? 0) > 0;

  // Transform planned workout data to match the existing Activity interface
  const activity: Activity | null = plannedWorkout ? {
    type: plannedWorkout.workout?.subType || plannedWorkout.workout?.type || 'run',
    title: plannedWorkout.workout?.name || 'Training Session',
    description: plannedWorkout.workout?.description || '',
    duration: extractDurationFromSteps(plannedWorkout.workout?.steps || []),
    distance: extractDistanceFromSteps(plannedWorkout.workout?.steps || []),
    emoji: getWorkoutEmoji(plannedWorkout.workout?.subType || plannedWorkout.workout?.type || 'run'),
    date: plannedWorkout.scheduledDate,
    workoutSections: transformStepsToSections(plannedWorkout.workout?.steps || [])
  } : null;

  // Debug logging
  React.useEffect(() => {
    if (plannedWorkout) {
      console.log('Planned workout data:', JSON.stringify(plannedWorkout, null, 2));
      console.log('Activity data:', JSON.stringify(activity, null, 2));
    }
  }, [plannedWorkout, activity]);

  // Helper functions to extract data from workout steps
  function extractDurationFromSteps(steps: any[]): string {
    console.log('Extracting duration from steps:', steps);
    const totalDuration = steps.reduce((total, step) => {
      if (step.duration) {
        const match = step.duration.match(/(\d+)\s*min/);
        if (match) {
          return total + parseInt(match[1]);
        }
      }
      return total;
    }, 0);
    const result = totalDuration > 0 ? `${totalDuration} min` : '30 min';
    console.log('Extracted duration:', result);
    return result;
  }

  function extractDistanceFromSteps(steps: any[]): number {
    console.log('Extracting distance from steps:', steps);
    const totalDistance = steps.reduce((total, step) => {
      if (step.distance) {
        return total + step.distance;
      }
      return total;
    }, 0);
    const result = totalDistance > 0 ? totalDistance / 1000 : 3; // Convert to km, default to 3km
    console.log('Extracted distance:', result);
    return result;
  }

  function getWorkoutEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
      'run': '🏃‍♂️',
      'rest': '😴',
      'cross-train': '🚴‍♂️',
      'strength': '💪',
    };
    return emojiMap[type] || '🏃‍♂️';
  }

  function transformStepsToSections(steps: any[]): WorkoutSection[] {
    return steps.map((step, index) => ({
      id: index + 1,
      type: getSectionType(step.label || ''),
      title: step.label || `Step ${index + 1}`,
      subtitle: step.notes || step.target || '',
      duration: step.duration || '',
      distance: step.distance ? (isMetric ? `${(step.distance / 1000).toFixed(1)}km` : `${((step.distance / 1000) * 0.621371).toFixed(1)}mi`) : '',
      pace: step.pace ? formatPace(step.pace) : '',
    }));
  }

  function getSectionType(label: string): 'warmup' | 'run' | 'rest' | 'repeat' | 'cooldown' {
    const lower = label.toLowerCase();
    if (lower.includes('warm')) return 'warmup';
    if (lower.includes('cool')) return 'cooldown';
    if (lower.includes('rest')) return 'rest';
    if (lower.includes('repeat')) return 'repeat';
    return 'run';
  }

  function formatPace(paceSecondsPerKm: number): string {
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = paceSecondsPerKm % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  }

  // Helper function to format distance based on metric system preference
  const formatDistanceForDisplay = (distanceKm: number): string => {
    if (isMetric) {
      return `${distanceKm}km`;
    } else {
      const miles = distanceKm * 0.621371;
      return `${miles.toFixed(1)}mi`;
    }
  };

  useEffect(() => {
    if (!scheduleWorkoutId) {
      console.error('No scheduleWorkoutId provided');
      router.back();
      return;
    }

    // Entrance animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [scheduleWorkoutId]);

  const getWorkoutTypeColor = (type: string) => {
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

  const getWorkoutTypeInfo = (type: string) => {
    const infoMap: Record<string, { level: string; emoji: string; subtitle: string }> = {
      'easy': { level: 'EASY RUN', emoji: '🏃‍♂️', subtitle: 'Comfortable Pace' },
      'tempo': { level: 'TEMPO RUN', emoji: '🔥', subtitle: 'Comfortably Hard' },
      'interval': { level: 'INTERVAL TRAINING', emoji: '⚡', subtitle: 'Speed Work' },
      'intervals': { level: 'INTERVAL TRAINING', emoji: '⚡', subtitle: 'Speed Work' },
      'long': { level: 'LONG RUN', emoji: '🏃‍♂️', subtitle: 'Endurance Building' },
      'recovery': { level: 'RECOVERY RUN', emoji: '🧘‍♀️', subtitle: 'Active Recovery' },
      'cross-train': { level: 'CROSS TRAINING', emoji: '🚴‍♂️', subtitle: 'Alternative Exercise' },
      'strength': { level: 'STRENGTH TRAINING', emoji: '💪', subtitle: 'Build Power' },
      'rest': { level: 'REST DAY', emoji: '😴', subtitle: 'Recovery Time' },
      'race': { level: 'RACE DAY', emoji: '🏆', subtitle: 'Give Your Best' },
      'run': { level: 'RUN', emoji: '🏃‍♂️', subtitle: 'Training Session' },
    };
    return infoMap[type] || { level: 'WORKOUT', emoji: '⭐', subtitle: 'Training Session' };
  };

  const getSimpleRewards = (activity: Activity) => {
    // Simple reward calculation based on workout type
    const distanceKm = activity.distance || 3; // Use the activity distance directly in km

    // Rest days get minimal rewards, running days get full rewards
    if (activity.type === 'rest') {
      return {
        distance: 0,
        coins: 1, // Small reward for rest day completion
        xp: 50,   // Small XP for recovery
        progress: 'Recovery',
      };
    }

    const coins = Math.max(1, Math.floor(distanceKm * 10));  // 10 coins per km
    const xp = Math.max(5, Math.floor(distanceKm * 100));    // 100 XP per km

    return {
      distance: distanceKm,
      coins: coins,
      xp: xp,
      progress: 'Fitness',
    };
  };

  const getHelpfulTips = (activity: Activity) => {
    switch (activity.type) {
      case 'easy':
        return [
          { icon: '💬', tip: 'You should be able to hold a conversation while running', category: 'Pacing' },
          { icon: '🔥', tip: 'Start with a gentle 5-minute warm-up walk', category: 'Warm-up' },
          { icon: '💧', tip: 'Stay hydrated throughout your run', category: 'Hydration' },
        ];
      case 'tempo':
        return [
          { icon: '🔥', tip: 'Run at a comfortably hard pace - you can speak 1-2 words', category: 'Pacing' },
          { icon: '⏱️', tip: 'Maintain steady effort throughout the tempo portion', category: 'Effort' },
          { icon: '🎯', tip: 'This improves your lactate threshold', category: 'Benefits' },
        ];
      case 'interval':
      case 'intervals':
        return [
          { icon: '⚡', tip: 'Give maximum effort during work intervals', category: 'Intensity' },
          { icon: '😤', tip: 'Use recovery intervals to catch your breath', category: 'Recovery' },
          { icon: '🔁', tip: 'Focus on consistent pacing across all intervals', category: 'Consistency' },
        ];
      case 'long':
        return [
          { icon: '🐌', tip: 'Start slower than you think you need to', category: 'Pacing' },
          { icon: '💪', tip: 'Focus on staying strong and steady', category: 'Form' },
          { icon: '🎯', tip: 'The goal is distance, not speed', category: 'Mindset' },
        ];
      case 'recovery':
        return [
          { icon: '🧘‍♀️', tip: 'Keep it very easy and comfortable', category: 'Effort' },
          { icon: '🩹', tip: 'This helps your body recover from harder sessions', category: 'Purpose' },
          { icon: '😌', tip: 'Focus on relaxed form and breathing', category: 'Technique' },
        ];
      case 'cross-train':
        return [
          { icon: '🚴‍♂️', tip: 'Choose activities you enjoy like cycling or swimming', category: 'Activity' },
          { icon: '💪', tip: 'Maintain moderate effort without high impact', category: 'Intensity' },
          { icon: '🔄', tip: 'Great for recovery while staying active', category: 'Benefits' },
        ];
      case 'strength':
        return [
          { icon: '💪', tip: 'Focus on proper form over heavy weights', category: 'Form' },
          { icon: '🦵', tip: 'Emphasize exercises that support running', category: 'Focus' },
          { icon: '⚖️', tip: 'Include both upper and lower body movements', category: 'Balance' },
        ];
      case 'rest':
        return [
          { icon: '😴', tip: 'Get plenty of sleep for optimal recovery', category: 'Rest' },
          { icon: '🧘', tip: 'Try gentle stretching or yoga', category: 'Mobility' },
          { icon: '💧', tip: 'Stay hydrated and eat nutritious foods', category: 'Nutrition' },
        ];
      case 'race':
        return [
          { icon: '🎯', tip: 'Trust your training and stick to your plan', category: 'Strategy' },
          { icon: '😊', tip: 'Smile and enjoy the experience', category: 'Mindset' },
          { icon: '⚡', tip: 'Save energy for a strong finish', category: 'Pacing' },
        ];
      case 'run':
      default:
        return [
          { icon: '🏃‍♂️', tip: 'Listen to your body and adjust as needed', category: 'Awareness' },
          { icon: '🔥', tip: 'Start with a proper warm-up', category: 'Preparation' },
          { icon: '💧', tip: 'Stay hydrated before, during, and after', category: 'Hydration' },
        ];
    }
  };

  const formatWorkoutDate = (dateStr?: string) => {
    console.log('Formatting date:', dateStr); // Debug log

    if (!dateStr) {
      console.log('No date provided, using today'); // Debug log
      return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    }

    try {
      const date = new Date(dateStr);
      console.log('Parsed date:', date); // Debug log

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.log('Invalid date, using today'); // Debug log
        return new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }).toUpperCase();
      }

      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    } catch (error) {
      console.log('Error parsing date:', error); // Debug log
      return new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    }
  };

  const isComplexWorkout = (activity: Activity) => {
    return activity.workoutSections && activity.workoutSections.length > 0;
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'warmup':
        return 'flame-outline';
      case 'run':
        return 'fitness-outline';
      case 'rest':
        return 'pause-outline';
      case 'repeat':
        return 'repeat-outline';
      case 'cooldown':
        return 'snow-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getSectionColor = (type: string) => {
    switch (type) {
      case 'warmup':
        return '#FF9500';
      case 'run':
        return '#007AFF';
      case 'rest':
        return '#8E8E93';
      case 'repeat':
        return '#FF3B30';
      case 'cooldown':
        return '#30D158';
      default:
        return Theme.colors.text.tertiary;
    }
  };

  const renderWorkoutBreakdown = () => {
    if (!activity) return null;

    return (
      <View style={styles.workoutBreakdownSection}>
        <View style={styles.descriptionHeader}>
          <View style={styles.descriptionHeaderLeft}>
            <Ionicons name="clipboard-outline" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.descriptionHeaderText}>Description</Text>
          </View>
          {/* <View style={styles.workoutTypeButtons}>
            <View style={[styles.workoutTypeButton, styles.workoutTypeButtonActive]}>
              <Text style={styles.workoutTypeButtonText}>OUTDOOR</Text>
            </View>
            <View style={styles.workoutTypeButton}>
              <Text style={[styles.workoutTypeButtonText, styles.workoutTypeButtonInactive]}>TREADMILL</Text>
            </View>
          </View> */}
        </View>

        {/* If complex workout, show all sections */}
        {isComplexWorkout(activity) ? (
          activity.workoutSections!.map((section, index) => (
            <View key={section.id} style={styles.workoutSectionContainer}>
              {section.type === 'repeat' && (
                <View style={styles.repeatBanner}>
                  <Ionicons name="repeat-outline" size={20} color="#fff" />
                  <Text style={styles.repeatText}>Repeat x{section.repeats || 4}</Text>
                </View>
              )}

              {section.type !== 'repeat' && (
                <View style={styles.workoutSection}>
                  <Text style={styles.sectionNumber}>{index + 1}</Text>
                  <View style={styles.sectionDivider} />
                  <View style={styles.sectionContent}>
                    <Text style={styles.workoutSectionTitle}>{section.title}</Text>
                    {section.subtitle && (
                      <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                    )}
                  </View>
                  <View style={styles.sectionType}>
                    <Ionicons
                      name={getSectionIcon(section.type) as any}
                      size={20}
                      color={Theme.colors.text.tertiary}
                    />
                    <Text style={styles.sectionTypeText}>
                      {section.type.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))
        ) : (
          /* If simple activity, show as single workout section */
          <View style={styles.workoutSectionContainer}>
            <View style={styles.workoutSection}>
              <Text style={styles.sectionNumber}>1</Text>
              <View style={styles.sectionDivider} />
              <View style={styles.sectionContent}>
                <Text style={styles.workoutSectionTitle}>
                  {preferTimeOverDistance
                    ? `${activity.duration} at a conversational pace`
                    : (rewards.distance > 0 ? `${formatDistanceForDisplay(rewards.distance)} at a conversational pace` : activity.title)
                  }
                </Text>
                {activity.description && (
                  <Text style={styles.sectionSubtitle}>{activity.description}</Text>
                )}
              </View>
              <View style={styles.sectionType}>
                <Ionicons
                  name="fitness-outline"
                  size={20}
                  color={Theme.colors.text.tertiary}
                />
                <Text style={styles.sectionTypeText}>RUN</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (!scheduleWorkoutId) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>No workout ID provided...</Text>
      </View>
    );
  }

  if (plannedWorkout === undefined) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading workout...</Text>
      </View>
    );
  }

  if (!plannedWorkout || !activity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Workout not found...</Text>
      </View>
    );
  }

  const workoutInfo = getWorkoutTypeInfo(activity.type);
  const rewards = getSimpleRewards(activity);
  const helpfulTips = getHelpfulTips(activity);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>
            {activity?.date ?
              formatWorkoutDate(activity.date) :
              formatWorkoutDate()
            }
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View style={[styles.heroSection, { transform: [{ scale: scaleAnim }] }]}>
          {isWorkoutCompleted && (
            <View style={styles.completedBanner}>
              <Text style={styles.completedBannerText}>✅ WORKOUT COMPLETED</Text>
            </View>
          )}
          <View style={styles.workoutTypeContainer}>
            <Text style={styles.workoutType}>{activity.title.toUpperCase()}</Text>
            <Text style={styles.workoutSubtitle}>
              {workoutInfo.subtitle}
              {preferTimeOverDistance
                ? (activity.duration && ` • ${activity.duration}`)
                : (rewards.distance > 0 && ` • ${formatDistanceForDisplay(rewards.distance)}`)
              }
            </Text>
          </View>
        </Animated.View>

        {/* Main Training Info */}
        <View style={styles.mainInfoSection}>
          <Text style={styles.sectionTitle}>Training Details</Text>
          <View style={styles.mainInfoGrid}>
            {/* Show based on user preference, but always show something */}
            {preferTimeOverDistance ? (
              <View style={styles.mainInfoCard}>
                <View style={[styles.mainInfoIcon, { backgroundColor: Theme.colors.special.primary.level }]}>
                  <Ionicons name="time-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.mainInfoValue}>{activity.duration}</Text>
                <Text style={styles.mainInfoLabel}>Duration</Text>
              </View>
            ) : (
              <View style={styles.mainInfoCard}>
                <View style={[styles.mainInfoIcon, { backgroundColor: getWorkoutTypeColor(activity.type) }]}>
                  <Ionicons name="location-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.mainInfoValue}>{formatDistanceForDisplay(activity.distance || 3)}</Text>
                <Text style={styles.mainInfoLabel}>Distance</Text>
              </View>
            )}

            {/* Show secondary info */}
            <View style={styles.mainInfoCard}>
              <View style={[styles.mainInfoIcon, { backgroundColor: getWorkoutTypeColor(activity.type) }]}>
                <Ionicons name="fitness-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.mainInfoValue}>{activity.type.toUpperCase()}</Text>
              <Text style={styles.mainInfoLabel}>Workout Type</Text>
            </View>
          </View>
        </View>

        {/* Debug Section - remove this later */}
        {/* <View style={styles.mainInfoSection}>
          <Text style={styles.sectionTitle}>Debug Info</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>
              Workout Type: {plannedWorkout?.workout?.type || 'N/A'}{'\n'}
              Workout SubType: {plannedWorkout?.workout?.subType || 'N/A'}{'\n'}
              Steps Count: {plannedWorkout?.workout?.steps?.length || 0}{'\n'}
              Steps: {JSON.stringify(plannedWorkout?.workout?.steps || [], null, 2)}{'\n'}
              Activity Duration: {activity?.duration}{'\n'}
              Activity Distance: {activity?.distance}{'\n'}
              Rewards Distance: {rewards.distance}{'\n'}
              Prefer Time: {preferTimeOverDistance ? 'Yes' : 'No'}
            </Text>
          </View>
        </View> */}

        {/* Workout Description/Breakdown */}
        {renderWorkoutBreakdown()}

        {/* Expected Rewards */}
        {isWorkoutCompleted ? (
          <View style={styles.completedActivitiesSection}>
            <Text style={styles.sectionTitle}>🎉 Completed Activities</Text>
            {linkedActivities?.map((completedActivity, index) => (
              <View key={index} style={styles.completedActivityCard}>
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>
                    {completedActivity.workoutName || 'Running Activity'}
                  </Text>
                  <Text style={styles.activityStats}>
                    {isMetric
                      ? `${(completedActivity.distance / 1000).toFixed(2)}km`
                      : `${((completedActivity.distance / 1000) * 0.621371).toFixed(2)}mi`
                    } • {completedActivity.duration}min
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/activity-detail',
                      params: {
                        activity: JSON.stringify(completedActivity)
                      }
                    });
                  }}
                  style={styles.viewActivityButton}
                >
                  <Text style={styles.viewActivityButtonText}>View</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.rewardsSection}>
            <Text style={styles.sectionTitle}>Expected Rewards</Text>
            <View style={styles.rewardsGrid}>
              <View style={styles.rewardCard}>
                <Ionicons name="flash" size={24} style={styles.rewardEmoji} color={Theme.colors.special.primary.exp} />
                <Text style={styles.rewardExpValue}>+{rewards.xp}</Text>
                <Text style={styles.rewardLabel}>XP</Text>
              </View>
              <View style={styles.rewardCard}>
                <Image source={require('@/assets/images/icons/coal.png')} style={styles.rewardImage} />
                <Text style={styles.rewardLeavesValue}>+{rewards.coins}</Text>
                <Text style={styles.rewardLabel}>Embers</Text>
              </View>
            </View>
          </View>
        )}

        {/* Helpful Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Helpful Tips</Text>
          {helpfulTips.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Text style={styles.tipIconText}>{tip.icon}</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipCategory}>{tip.category}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Start Workout Button */}
        {/* <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              router.back();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.startButtonText}>
              {activity.type === 'rest' ? '😴 TAKE REST' : '🏃‍♂️ START WORKOUT'}
            </Text>
          </TouchableOpacity>
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
    paddingBottom: Theme.spacing.xl,
  },
  backButton: {
    padding: Theme.spacing.sm,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDate: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xxxl,
  },
  workoutTypeContainer: {
    alignItems: 'center',
  },
  workoutType: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    letterSpacing: 1,
    marginBottom: Theme.spacing.sm,
    textAlign: 'center',
  },
  workoutSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  mainInfoSection: {
    paddingHorizontal: Theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
  },
  mainInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.xl,
  },
  mainInfoCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    minWidth: 120,
    flex: 1,
    marginHorizontal: Theme.spacing.sm,
  },
  mainInfoIcon: {
    width: 56,
    height: 56,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
  },
  mainInfoValue: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  mainInfoLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  descriptionCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  descriptionText: {
    fontSize: 16,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    lineHeight: 24,
    textAlign: 'center',
  },
  rewardsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  rewardEmoji: {
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.lg,
  },
  rewardImage: {
    width: 32,
    height: 32,
    marginBottom: Theme.spacing.md,
  },
  rewardExpValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    marginBottom: Theme.spacing.xs,
  },
  rewardLeavesValue: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.coin,
    marginBottom: Theme.spacing.xs,
  },
  rewardLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  tipsSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    alignItems: 'flex-start',
  },
  tipIcon: {
    width: 40,
    height: 40,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  tipIconText: {
    fontSize: 20,
  },
  tipContent: {
    flex: 1,
  },
  tipCategory: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tipText: {
    fontSize: 14,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.regular,
    lineHeight: 20,
  },
  actionSection: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 100,
  },
  startButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  startButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    letterSpacing: 1,
  },
  loading: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: 100,
  },

  workoutBreakdownSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
  },
  descriptionHeaderText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  descriptionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  workoutTypeButtons: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: 2,
  },
  workoutTypeButton: {
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  workoutTypeButtonActive: {
    backgroundColor: Theme.colors.background.primary,
  },
  workoutTypeButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  workoutTypeButtonInactive: {
    color: Theme.colors.text.tertiary,
  },
  workoutSectionContainer: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
  },
  repeatBanner: {
    backgroundColor: '#FF6B35',
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: '#fff',
    marginLeft: Theme.spacing.sm,
  },
  workoutSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
  },
  sectionNumber: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    width: 40,
    textAlign: 'center',
  },
  sectionDivider: {
    width: 2,
    backgroundColor: Theme.colors.text.tertiary,
    height: 50,
    marginHorizontal: Theme.spacing.lg,
  },
  sectionContent: {
    flex: 1,
  },
  workoutSectionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    lineHeight: 18,
  },
  sectionType: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  sectionTypeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  completedBanner: {
    backgroundColor: Theme.colors.status.success,
    borderRadius: Theme.borderRadius.full,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    marginBottom: Theme.spacing.lg,
    alignSelf: 'center',
  },
  completedBannerText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  completedActivitiesSection: {
    paddingHorizontal: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl,
  },
  completedActivityCard: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.status.success,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  activityStats: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  viewActivityButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.medium,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
  },
  viewActivityButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
}); 
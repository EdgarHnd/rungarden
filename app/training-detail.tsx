import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
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
  executableSteps?: any[]; // <-- Add this
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

  // Add mutation for rest day completion
  const completeRestDay = useMutation(api.userProfile.completeRestDay);
  const [completingRest, setCompletingRest] = useState(false);

  // Check if the current planned workout is completed
  const isWorkoutCompleted = plannedWorkout?.status === 'completed' || (linkedActivities?.length ?? 0) > 0;

  // Handle rest day completion
  const handleRestDayCompletion = async () => {
    if (!plannedWorkout || completingRest) return;

    setCompletingRest(true);
    try {
      await completeRestDay({
        date: plannedWorkout.scheduledDate,
        notes: "Rest day completed from training plan"
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Failed to complete rest day:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCompletingRest(false);
    }
  };

  // Transform planned workout data to match the existing Activity interface
  const activity: Activity | null = plannedWorkout ? {
    type: plannedWorkout.workout?.subType || plannedWorkout.workout?.type || 'run',
    title: (plannedWorkout.workout?.name?.startsWith('TOKEN_') ? plannedWorkout.workout?.description : plannedWorkout.workout?.name) || 'Training Session',
    description: plannedWorkout.hydrated?.globalDescription || plannedWorkout.workout?.description || '',
    duration: extractDurationFromSteps(plannedWorkout.executableSteps || plannedWorkout.workout?.steps || []),
    distance: extractDistanceFromSteps(plannedWorkout.workout?.steps || []),
    emoji: getWorkoutEmoji(plannedWorkout.workout?.subType || plannedWorkout.workout?.type || 'run'),
    date: plannedWorkout.scheduledDate,
    workoutSections: transformStepsToSections(plannedWorkout.workout?.steps || []),
    executableSteps: plannedWorkout.executableSteps || [],
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
    const totalSeconds = steps.reduce((total, step) => {
      if (step.duration) {
        const minMatch = step.duration.match(/(\d+(?:\.\d+)?)\s*min/);
        if (minMatch) {
          return total + parseFloat(minMatch[1]) * 60;
        }
        const secMatch = step.duration.match(/(\d+(?:\.\d+)?)\s*sec/);
        if (secMatch) {
          return total + parseFloat(secMatch[1]);
        }
      }
      return total;
    }, 0);

    if (totalSeconds > 0) {
      return `${Math.round(totalSeconds / 60)} min`;
    }
    return '30 min'; // Default
  }

  function extractDistanceFromSteps(steps: any[]): number {
    const totalDistance = steps.reduce((total, step) => {
      if (step.distance) {
        return total + step.distance;
      }
      return total;
    }, 0);
    return totalDistance > 0 ? totalDistance / 1000 : 0; // Convert to km, no default distance
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
    return steps.map((step, index) => {
      const hasSubtitle = step.notes || step.target;
      const stepType = getSectionType(step.label || '');

      let title = step.label || `Step ${index + 1}`;
      if (!hasSubtitle && step.duration) {
        title = `${step.duration} ${step.label}`;
      }
      if (stepType === 'warmup' && step.duration) {
        title = `${step.duration} Warmup`;
      }
      if (stepType === 'cooldown' && step.duration) {
        title = `${step.duration} Cooldown`;
      }

      return {
        id: index + 1,
        type: stepType,
        title: title,
        subtitle: step.notes || step.target || '',
        duration: step.duration || '',
        distance: step.distance ? (isMetric ? `${(step.distance / 1000).toFixed(1)}km` : `${((step.distance / 1000) * 0.621371).toFixed(1)}mi`) : '',
        pace: step.pace ? formatPace(step.pace) : '',
      };
    });
  }

  function getSectionType(label: string): 'warmup' | 'run' | 'rest' | 'repeat' | 'cooldown' {
    const lower = label.toLowerCase();
    if (lower.includes('warm')) return 'warmup';
    if (lower.includes('cool')) return 'cooldown';
    if (lower.includes('rest')) return 'rest';
    if (lower.includes('repeat')) return 'repeat';
    if (lower.includes('main set')) return 'run'; // Treat "Main Set" as a run type for icon purposes
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
    // Reward calculation based on workout type, duration, and distance.
    const distanceKm = activity.distance || 0;
    const durationMin = parseInt(activity.duration.replace(' min', ''), 10) || 30;

    const XP_PER_KM = 100;
    const COINS_PER_KM = 10;
    const XP_PER_MIN_RUN = 5; // Less than distance to incentivize completing goals
    const COINS_PER_MIN_RUN = 1;
    const XP_PER_MIN_OTHER = 3;
    const COINS_PER_MIN_OTHER = 0.5;
    const REST_XP = 25;
    const REST_COINS = 10;

    let xp = 0;
    let coins = 0;

    if (activity.type === 'rest') {
      xp = REST_XP;
      coins = REST_COINS;
    } else if (distanceKm > 0) {
      // Prioritize distance for rewards if available
      xp = Math.max(10, Math.floor(distanceKm * XP_PER_KM));
      coins = Math.max(1, Math.floor(distanceKm * COINS_PER_KM));
    } else {
      // Fallback to time-based rewards
      if (activity.type === 'run' || activity.type === 'long' || activity.type === 'easy' || activity.type === 'tempo') {
        xp = Math.max(10, Math.floor(durationMin * XP_PER_MIN_RUN));
        coins = Math.max(1, Math.floor(durationMin * COINS_PER_MIN_RUN));
      } else { // Cross-train, strength, etc.
        xp = Math.max(10, Math.floor(durationMin * XP_PER_MIN_OTHER));
        coins = Math.max(1, Math.floor(durationMin * COINS_PER_MIN_OTHER));
      }
    }

    return {
      distance: distanceKm,
      duration: durationMin,
      coins: coins,
      xp: xp,
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
        return 'footsteps-outline';
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
        return Theme.colors.special.primary.coin;
      case 'run':
        return Theme.colors.special.primary.exp;
      case 'rest':
        return '#8E8E93';
      case 'repeat':
        return '#FF3B30';
      case 'cooldown':
        return Theme.colors.special.primary.level;
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
            <Ionicons name="list-outline" size={24} color={Theme.colors.text.primary} />
            <Text style={styles.descriptionHeaderText}>Workout Session</Text>
          </View>
        </View>
        <View style={styles.workoutBreakdownContainer}>

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
                    <View style={[styles.sectionDivider]} />
                    <View style={styles.sectionContent}>
                      <Text style={styles.workoutSectionTitle}>{section.title}</Text>
                      {section.subtitle && (
                        <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
                      )}
                    </View>
                    <View style={styles.sectionType}>
                      <Ionicons
                        name={getSectionIcon(section.type) as any}
                        size={24}
                        color={getSectionColor(section.type)}
                      />
                      <Text style={[styles.sectionTypeText, { color: getSectionColor(section.type) }]}>
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

  return (
    <SafeAreaView style={styles.container}>
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
            {/* Show duration as primary if distance is 0 or not preferred */}
            {(preferTimeOverDistance || (rewards.distance === 0 && rewards.duration > 0)) ? (
              <Text style={styles.mainInfoValue}>{activity.duration}</Text>
            ) : (
              <Text style={styles.mainInfoValue}>{(activity.distance || 0) > 0 ? formatDistanceForDisplay(activity.distance!) : '--'}</Text>
            )}
          </View>
        </Animated.View>

        {/* Main Training Info */}
        <View style={styles.mainInfoSection}>
          <Text style={styles.sectionTitle}>Training Details</Text>
          <Text style={styles.mainInfoDescription}>{activity.description}</Text>
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
                <Ionicons name="flash-outline" size={24} style={styles.rewardEmoji} color={Theme.colors.special.primary.exp} />
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
      </ScrollView>

      {/* Start Workout Button */}
      {!isWorkoutCompleted && (
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              if (activity.type === 'rest') {
                // Handle rest day completion
                handleRestDayCompletion();
              } else {
                // Start the structured workout
                router.push({
                  pathname: '/run',
                  params: {
                    plannedWorkoutId: scheduleWorkoutId,
                    // Pass executable steps to the run screen
                    executableSteps: JSON.stringify(activity.executableSteps || [])
                  }
                });
              }
            }}
            activeOpacity={0.8}
            disabled={completingRest}
          >
            <Text style={styles.startButtonText}>
              {activity.type === 'rest'
                ? (completingRest ? '😴 COMPLETING...' : '😴 TAKE REST')
                : 'START WORKOUT'
              }
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
    paddingBottom: Theme.spacing.md,
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
  },
  workoutTypeContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
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
  },
  mainInfoCard: {
    alignItems: 'center',
    minWidth: 120,
    flex: 1,
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
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xs,
  },
  mainInfoDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'left',
    marginBottom: Theme.spacing.xxxl,
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
    marginBottom: 100,
  },
  rewardsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardCard: {
    flex: 1,
    alignItems: 'center',
  },
  rewardEmoji: {
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.lg,
  },
  rewardImage: {
    width: 28,
    height: 28,
    marginBottom: Theme.spacing.md,
    marginTop: Theme.spacing.xs,
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: 40, // Adjust for safe area
    paddingTop: Theme.spacing.md,
    backgroundColor: 'transparent',
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
    marginVertical: Theme.spacing.sm,
  },
  workoutBreakdownContainer: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.sm,
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
    height: '100%',
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
    minWidth: 80,
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
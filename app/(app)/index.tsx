import DayCard from '@/components/DayCard';
import RunCelebrationModal from '@/components/RunCelebrationModal';
import WeekView from '@/components/WeekView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useOnboardingSync } from '@/hooks/useOnboardingSync';
import ChallengeService from '@/services/ChallengeService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import HealthService from '@/services/HealthService';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Rive, { RiveRef } from 'rive-react-native';

// Constants for scrolling background
const SCROLLING_BG_LOOP_WIDTH = 2000;
const SCROLLING_BG_ANIMATION_DURATION = 8000;

// Match WeekView's expected DatabaseActivity interface
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

// RunningActivity interface for DayCard
interface RunningActivity {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;
  distance: number;
  calories: number;
  averageHeartRate?: number;
  workoutName?: string;
}

interface DayData {
  date: string;
  activities: DatabaseActivity[];
  plannedWorkout: any;
  weekIndex: number;
}

interface WeekData {
  weekIndex: number;
  startDate: string;
  days: DayData[];
  weeklyProgress: number;
}

export default function HomeScreen() {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  // Sync pending onboarding data when user becomes authenticated
  useOnboardingSync();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const activities = useQuery(api.activities.getUserActivities, { days: 21, limit: 100 });
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const plannedWorkouts = useQuery(api.plannedWorkouts.getPlannedWorkouts, { days: 21 });
  const streakInfo = useQuery(api.userProfile.getStreakInfo);
  const syncActivities = useMutation(api.activities.syncActivitiesFromHealthKit);
  const syncStravaActivities = useMutation(api.activities.syncActivitiesFromStrava);
  const createProfile = useMutation(api.userProfile.createProfile);

  // Proper state management for week navigation
  const [currentWeekIndex, setCurrentWeekIndex] = useState(1); // 0=last week, 1=this week, 2=next week
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [riveUrl, setRiveUrl] = useState("https://fast-dragon-309.convex.cloud/api/storage/43099ea6-083b-43a8-b845-ed7d2431b719");
  const [isBgAnimationRunning, setIsBgAnimationRunning] = useState(false);
  const bgAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Add Rive ref for controlling the animation
  const riveRef = useRef<RiveRef>(null);

  // Run celebration state
  const [showRunCelebrationModal, setShowRunCelebrationModal] = useState(false);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [runCelebrationData, setRunCelebrationData] = useState<{
    runData: any | null;
    rewards: {
      distanceGained: number;
      coinsGained: number;
      leveledUp?: boolean;
      newLevel?: number;
      oldLevel?: number;
      challengesUnlocked?: string[];
    };
  } | null>(null);

  // Debug modal state
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived values from queries
  const weekStartDay = profile?.weekStartDay ?? 1; // Default to Monday

  const RIVE_URLS = [
    "https://fast-dragon-309.convex.cloud/api/storage/43099ea6-083b-43a8-b845-ed7d2431b719",
    "https://fast-dragon-309.convex.cloud/api/storage/04bf0340-7d79-4865-8dd6-2966b4befaff",
    "https://deafening-mule-576.convex.cloud/api/storage/fcdc254a-5fb8-421b-b22e-85af6b3f765a",
    "https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e"
  ];

  const toggleRiveUrl = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRiveUrl(prevUrl => {
      const currentIndex = RIVE_URLS.indexOf(prevUrl);
      const nextIndex = (currentIndex + 1) % RIVE_URLS.length;
      return RIVE_URLS[nextIndex];
    });
  };

  const toggleBgAnimation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isBgAnimationRunning) {
      if (bgAnimationRef.current) {
        bgAnimationRef.current.stop();
      }
      setIsBgAnimationRunning(false);
    } else {
      scrollX.setValue(0);
      const bgAnimation = Animated.loop(
        Animated.timing(scrollX, {
          toValue: -SCROLLING_BG_LOOP_WIDTH,
          duration: SCROLLING_BG_ANIMATION_DURATION,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      bgAnimationRef.current = bgAnimation;
      bgAnimation.start();
      setIsBgAnimationRunning(true);
    }
  };

  // Add jump trigger function
  const handleJump = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Trigger the jump in the Rive animation
    // You may need to adjust the state machine name and input name based on your Rive file
    riveRef.current?.fireState('State Machine 1', 'jump');
  };

  // Handle triple tap on title for debug modal
  const handleTitlePress = () => {
    setTapCount(prev => prev + 1);

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      if (tapCount >= 2) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowDebugModal(true);
      }
      setTapCount(0);
    }, 500);
  };

  // Helper functions
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekStart = (date: Date, weekStartDay: number) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();

    let diff;
    if (weekStartDay === 1) {
      diff = day === 0 ? 6 : day - 1;
    } else {
      diff = day;
    }

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  // Transform Convex activities to match WeekView expected format
  const transformActivities = (convexActivities: any[]): DatabaseActivity[] => {
    return convexActivities.map(activity => ({
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
      healthKitUuid: activity.healthKitUuid || activity._id || 'unknown', // Ensure string
    }));
  };

  // Convert DatabaseActivity to RunningActivity for DayCard
  const convertToRunningActivities = (dbActivities: DatabaseActivity[]): RunningActivity[] => {
    return dbActivities.map(activity => ({
      uuid: activity.healthKitUuid,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    }));
  };

  // Generate proper week data for WeekView
  const generateWeekData = (): { weeks: WeekData[], allDays: DayData[], todayIndex: number } => {
    if (!activities || !plannedWorkouts) return { weeks: [], allDays: [], todayIndex: 0 };

    const today = new Date();
    const thisWeekStart = getWeekStart(today, weekStartDay);
    const weeks: WeekData[] = [];
    const allDays: DayData[] = [];
    let todayIndex = 0;

    // Generate 3 weeks: last week, this week, next week
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const weekStart = new Date(thisWeekStart);
      weekStart.setDate(thisWeekStart.getDate() + (weekOffset * 7));

      const days: DayData[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateString = getLocalDateString(date);

        // Get activities for this day
        const dayActivities = activities.filter((activity: any) => {
          const activityDate = new Date(activity.startDate);
          return getLocalDateString(activityDate) === dateString;
        });

        // Get planned workout for this day
        const plannedWorkout = plannedWorkouts?.find(workout => workout.scheduledDate === dateString);

        // Create a default rest activity if no planned workout exists
        const finalPlannedWorkout = plannedWorkout || {
          scheduledDate: dateString,
          type: "rest",
          duration: "15-30 min",
          description: "Rest day - Perfect time for gentle stretching, foam rolling, or mobility work. Listen to your body and recover well!",
          target: "Active recovery",
          status: "scheduled",
          distance: 0,
          workoutId: null,
          isDefault: true // Flag to indicate this is a default rest day
        };

        const dayData: DayData = {
          date: dateString,
          activities: transformActivities(dayActivities),
          plannedWorkout: finalPlannedWorkout,
          weekIndex: weekOffset + 1
        };

        days.push(dayData);
        allDays.push(dayData);

        // Check if this is today
        if (date.toDateString() === today.toDateString()) {
          todayIndex = allDays.length - 1;
        }
      }

      weeks.push({
        weekIndex: weekOffset + 1,
        startDate: getLocalDateString(weekStart),
        days,
        weeklyProgress: days.reduce((sum, day) => sum + day.activities.reduce((daySum, act) => daySum + act.distance, 0), 0) / 1000
      });
    }

    return { weeks, allDays, todayIndex };
  };

  // Calculate level info
  useEffect(() => {
    if (profile) {
      const userLevelInfo = LevelingService.calculateLevelInfo(profile.totalXP || 0);
      setLevelInfo(userLevelInfo);
    }
  }, [profile]);

  // Set initial day index to today
  useEffect(() => {
    if (activities && plannedWorkouts) {
      const { todayIndex } = generateWeekData();
      setCurrentDayIndex(todayIndex);
      setCurrentWeekIndex(Math.floor(todayIndex / 7)); // Set current week based on today
    }
  }, [activities, plannedWorkouts, weekStartDay]);

  // Create profile if it doesn't exist
  useEffect(() => {
    if (isAuthenticated && profile === null) {
      // Profile doesn't exist, create it
      createProfile();
    }
  }, [isAuthenticated, profile, createProfile]);

  // Auto-sync Strava activities when app loads (if enabled)
  useEffect(() => {
    const performAutoSync = async () => {
      if (!isAuthenticated || !profile || !convex) return;

      // Only auto-sync if both Strava sync and auto-sync are enabled
      if (profile.stravaSyncEnabled && profile.autoSyncEnabled) {
        try {
          console.log('[HomeScreen] Auto-syncing Strava activities...');
          const stravaService = new DatabaseStravaService(convex);

          // Check if authenticated with Strava first
          const isStravaAuthenticated = await stravaService.isAuthenticated();
          if (!isStravaAuthenticated) {
            console.log('[HomeScreen] Not authenticated with Strava, skipping auto-sync');
            return;
          }

          const syncResult = await stravaService.syncActivitiesIfEnabled(21);
          if (syncResult && syncResult.created > 0) {
            console.log(`[HomeScreen] Auto-sync completed: ${syncResult.created} new activities synced`);

            // Show celebration if new activities were found
            if (syncResult.distanceGained && syncResult.distanceGained > 0) {
              const recentRun = syncResult.newRuns?.[0];
              if (recentRun) {
                const isFirstRun = (profile?.totalWorkouts || 0) === 0;
                const unlockedChallenges = ChallengeService.checkChallengesForRun(recentRun, {
                  totalRuns: profile?.totalWorkouts || 0,
                  totalDistance: profile?.totalDistance || 0,
                  isFirstRun: isFirstRun
                });

                setRunCelebrationData({
                  runData: recentRun,
                  rewards: {
                    distanceGained: syncResult.distanceGained,
                    coinsGained: syncResult.coinsGained || 0,
                    leveledUp: syncResult.leveledUp,
                    newLevel: syncResult.newLevel,
                    oldLevel: syncResult.oldLevel,
                    challengesUnlocked: unlockedChallenges.map(c => c.name),
                  }
                });

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowRunCelebrationModal(true);
              }
            }
          }
        } catch (error) {
          console.error('[HomeScreen] Auto-sync failed:', error);
          // Silently fail auto-sync, don't show error to user
        }
      }
    };

    // Delay auto-sync slightly to let the UI load first
    const timeoutId = setTimeout(performAutoSync, 1000);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, profile, convex]);

  useEffect(() => {
    console.log('HomeScreen mounted');
    return () => {
      if (bgAnimationRef.current) {
        bgAnimationRef.current.stop();
      }
    };
  }, [isAuthenticated]);

  const handleRefresh = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check which data source is enabled
      if (profile?.healthKitSyncEnabled) {
        // Sync from HealthKit
        const healthKitActivities = await HealthService.getRunningActivities(21);

        if (healthKitActivities.length === 0) {
          return;
        }

        const activitiesForDb = healthKitActivities.map((activity) => ({
          healthKitUuid: activity.uuid,
          startDate: activity.startDate,
          endDate: activity.endDate,
          duration: activity.duration,
          distance: activity.distance,
          calories: activity.calories,
          averageHeartRate: activity.averageHeartRate,
          workoutName: activity.workoutName,
        }));

        const syncResult = await syncActivities({ activities: activitiesForDb });

        if (syncResult.created > 0 && syncResult.distanceGained && syncResult.distanceGained > 0) {
          const recentRun = syncResult.newRuns?.[0];

          if (recentRun) {
            const isFirstRun = (profile?.totalWorkouts || 0) === 0;
            const unlockedChallenges = ChallengeService.checkChallengesForRun(recentRun, {
              totalRuns: profile?.totalWorkouts || 0,
              totalDistance: profile?.totalDistance || 0,
              isFirstRun: isFirstRun
            });

            setRunCelebrationData({
              runData: recentRun,
              rewards: {
                distanceGained: syncResult.distanceGained,
                coinsGained: syncResult.coinsGained || 0,
                leveledUp: syncResult.leveledUp,
                newLevel: syncResult.newLevel,
                oldLevel: syncResult.oldLevel,
                challengesUnlocked: unlockedChallenges.map(c => c.name),
              }
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowRunCelebrationModal(true);
          }
        } else if (syncResult.coinsGained && syncResult.coinsGained > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else if (profile?.stravaSyncEnabled) {
        // Sync from Strava
        const stravaService = new DatabaseStravaService(convex);

        // Check if authenticated with Strava first
        const isStravaAuthenticated = await stravaService.isAuthenticated();
        if (!isStravaAuthenticated) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Alert.alert(
            'Strava Not Connected',
            'Please connect to Strava in Settings to sync your workouts.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Settings', onPress: () => router.push('/settings'), style: 'default' }
            ]
          );
          return;
        }

        const syncResult = await stravaService.forceSyncFromStrava(21);

        if (syncResult && syncResult.created > 0 && syncResult.distanceGained && syncResult.distanceGained > 0) {
          const recentRun = syncResult.newRuns?.[0];

          if (recentRun) {
            const isFirstRun = (profile?.totalWorkouts || 0) === 0;
            const unlockedChallenges = ChallengeService.checkChallengesForRun(recentRun, {
              totalRuns: profile?.totalWorkouts || 0,
              totalDistance: profile?.totalDistance || 0,
              isFirstRun: isFirstRun
            });

            setRunCelebrationData({
              runData: recentRun,
              rewards: {
                distanceGained: syncResult.distanceGained,
                coinsGained: syncResult.coinsGained || 0,
                leveledUp: syncResult.leveledUp,
                newLevel: syncResult.newLevel,
                oldLevel: syncResult.oldLevel,
                challengesUnlocked: unlockedChallenges.map(c => c.name),
              }
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowRunCelebrationModal(true);
          }
        } else if (syncResult && syncResult.coinsGained && syncResult.coinsGained > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } else {
        // No data source enabled
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'No Data Source',
          'Please enable HealthKit or Strava sync in Settings to sync your workouts.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Settings', onPress: () => router.push('/settings'), style: 'default' }
          ]
        );
      }
    } catch (error) {
      console.error('Error refreshing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to refresh data');
    }
  };

  // Fixed event handlers
  const handleDaySelect = (dayIndex: number) => {
    Haptics.selectionAsync();
    setCurrentDayIndex(dayIndex);

    // Update current week index based on selected day
    const weekIndex = Math.floor(dayIndex / 7);
    if (weekIndex !== currentWeekIndex) {
      setCurrentWeekIndex(weekIndex);
    }
  };

  const handleWeekChange = (weekIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentWeekIndex(weekIndex);

    // Auto-select the first day of the new week if current day is not in this week
    const currentWeek = Math.floor(currentDayIndex / 7);
    if (currentWeek !== weekIndex) {
      const firstDayOfWeek = weekIndex * 7;
      setCurrentDayIndex(firstDayOfWeek);
    }
  };

  // Format helpers
  const formatDistance = (meters: number) => {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(2)}`;
  };

  const formatPace = (duration: number, distance: number) => {
    const paceMinPerKm = (duration / (distance / 1000));
    const minutes = Math.floor(paceMinPerKm);
    const seconds = Math.round((paceMinPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Show loading state when queries are loading
  if (!profile || !activities || plannedWorkouts === undefined) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const { weeks, allDays } = generateWeekData();
  const selectedDayData = allDays[currentDayIndex];

  try {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.scrollingBackgroundContainer,
            { transform: [{ translateX: scrollX }] }
          ]}
        >
          <Image source={require('@/assets/images/bg/bgstadium.jpg')} style={styles.scrollingBackgroundImage} />
          <Image source={require('@/assets/images/bg/bgstadium.jpg')} style={styles.scrollingBackgroundImage} />
        </Animated.View>

        <View style={styles.headerContainer}>
          <View style={styles.leftHeaderSection}>
            <TouchableOpacity onPress={handleTitlePress}>
              <Text style={styles.title}>Koko</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.rightHeaderSection}>
            <TouchableOpacity
              style={styles.livesContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="heart"
                size={20}
                color={Theme.colors.status.error}
                style={styles.livesIcon}
              />
              <Text style={styles.livesText}>3</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.streakContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/profile');
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="flame"
                size={20}
                color={Theme.colors.accent.primary}
                style={styles.streakIcon}
              />
              <Text style={styles.streakText}>{streakInfo?.currentStreak || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Alert.alert(
                "Coming Soon",
                "Store is coming soon!",
                [{ text: "OK", style: "default" }]
              )}
              activeOpacity={0.7}
            >
              <View style={styles.coinContainer}>
                <Image source={require('@/assets/images/icons/eucaleaf.png')} style={styles.coinIcon} />
                <Text style={styles.coinText}>{profile?.coins || 0}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.animationContainer}>
          <Rive
            ref={riveRef}
            url={riveUrl}
            style={styles.animation}
            autoplay={true}
          />
        </View>

        <ScrollView
          style={styles.mainScrollView}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          <View style={styles.scrollSpacer} onTouchStart={handleJump} />

          {/* Fixed Week View */}
          <WeekView
            dayData={allDays}
            currentDayIndex={currentDayIndex}
            onDaySelect={handleDaySelect}
            levelInfo={levelInfo}
            currentWeekIndex={currentWeekIndex}
            weeks={weeks}
            onWeekChange={handleWeekChange}
            weekStartDay={weekStartDay}
          />

          {/* Day Card */}
          <View style={styles.selectedDayCardContainer}>
            {selectedDayData && (
              <DayCard
                key={`selected-day-${selectedDayData.date}`}
                date={selectedDayData.date}
                activities={convertToRunningActivities(selectedDayData.activities)}
                plannedWorkout={selectedDayData.plannedWorkout}
                formatDistance={formatDistance}
                formatPace={formatPace}
              />
            )}
          </View>
        </ScrollView>
        {/* Run Celebration Modal */}
        <RunCelebrationModal
          visible={showRunCelebrationModal}
          runData={runCelebrationData?.runData || null}
          rewards={runCelebrationData?.rewards || {
            distanceGained: 0,
            coinsGained: 0,
            challengesUnlocked: []
          }}
          metricSystem={profile?.metricSystem || 'metric'}
          streakInfo={{
            currentStreak: streakInfo?.currentStreak || 0,
            longestStreak: streakInfo?.longestStreak || 0,
          }}
          onClose={() => {
            setShowRunCelebrationModal(false);
            setRunCelebrationData(null);

            // Show level up modal after run celebration if user leveled up
            if (runCelebrationData?.rewards.leveledUp &&
              runCelebrationData?.rewards.newLevel &&
              runCelebrationData?.rewards.oldLevel) {
              setShowRunCelebrationModal(false);
              setRunCelebrationData(null);
            }
          }}
        />

        {/* Debug Modal */}
        <Modal
          visible={showDebugModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowDebugModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.debugModal}>
              <Text style={styles.debugTitle}>🛠️ Debug Options</Text>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  toggleRiveUrl();
                }}
              >
                <Text style={styles.debugButtonText}>👀 Change Animation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  toggleBgAnimation();
                }}
              >
                <Text style={styles.debugButtonText}>
                  {isBgAnimationRunning ? '⏸️ Stop Background' : '▶️ Start Background'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  // Show training plan info
                  const planInfo = trainingPlan ? `Active plan: ${trainingPlan.meta.goal} (${trainingPlan.meta.weeks} weeks)` : 'No active plan';
                  const workoutsInfo = `Planned workouts: ${plannedWorkouts?.length || 0}`;
                  const todaysWorkout = plannedWorkouts?.find(w => w.scheduledDate === new Date().toISOString().split('T')[0]);
                  const todayInfo = todaysWorkout ? `Today: ${todaysWorkout.description}` : 'No workout today';

                  Alert.alert(
                    'Training Plan Status',
                    `${planInfo}\n${workoutsInfo}\n${todayInfo}`,
                    [{ text: 'OK' }]
                  );
                }}
              >
                <Text style={styles.debugButtonText}>📋 Training Plan Info</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  // Trigger run celebration with last activity
                  const lastActivity = activities?.[0];
                  if (lastActivity) {
                    // Mock some rewards data for testing
                    const mockRewards = {
                      distanceGained: lastActivity.distance,
                      coinsGained: Math.floor(lastActivity.distance / 1000),
                      leveledUp: Math.random() > 0.7, // 30% chance of level up for demo
                      newLevel: (profile?.level || 1) + 1,
                      oldLevel: profile?.level || 1,
                      challengesUnlocked: ChallengeService.checkChallengesForRun(lastActivity, {
                        totalRuns: profile?.totalWorkouts || 0,
                        totalDistance: profile?.totalDistance || 0,
                        isFirstRun: false
                      }).map(c => c.name),
                    };

                    setRunCelebrationData({
                      runData: lastActivity,
                      rewards: mockRewards
                    });

                    setShowDebugModal(false);
                    setShowRunCelebrationModal(true);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } else {
                    Alert.alert('No Activities', 'No activities found to celebrate!');
                  }
                }}
              >
                <Text style={styles.debugButtonText}>🎉 Test Run Celebration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.debugButton, styles.debugCloseButton]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowDebugModal(false);
                }}
              >
                <Text style={styles.debugCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View >
    );
  } catch (error) {
    console.error('Render error:', error);
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Failed to render the screen</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  solidBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    backgroundColor: Theme.colors.background.tertiary
  },
  scrollingBackgroundContainer: {
    position: 'absolute',
    top: -200,
    left: 0,
    height: '120%', // Should match original visual intent
    width: SCROLLING_BG_LOOP_WIDTH * 2, // To hold two images side-by-side
    flexDirection: 'row', // Arrange images horizontally
    zIndex: 0, // Ensure it's behind other content
  },
  scrollingBackgroundImage: {
    width: SCROLLING_BG_LOOP_WIDTH,
    height: '100%',
    resizeMode: 'cover',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  leftHeaderSection: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  livesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.text.primary,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.medium,
  },
  livesIcon: {
    marginRight: 2,
  },
  livesText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.heart,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.text.primary,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.medium,
  },
  streakIcon: {
    marginRight: 2,
  },
  streakText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  rightHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.text.primary,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
    borderRadius: Theme.borderRadius.medium,
  },
  coinIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
  coinText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.coin,
  },
  mainScrollView: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  animationContainer: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    zIndex: 1,
    position: 'relative',
  },
  animation: {
    width: 300,
    height: 300,
    textAlign: 'center',
    margin: Theme.spacing.xl,
  },
  selectedDayCardContainer: {
    backgroundColor: Theme.colors.background.primary,
    minHeight: 400,
  },
  error: {
    color: Theme.colors.status.error,
    fontSize: 16,
    textAlign: 'center',
    margin: Theme.spacing.xl,
  },
  loading: {
    fontSize: 16,
    textAlign: 'center',
    margin: Theme.spacing.xl,
    color: Theme.colors.text.tertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Theme.colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContentContainer: {
  },
  scrollSpacer: {
    height: 300,
  },
  debugModal: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xxl,
    alignItems: 'center',
    marginHorizontal: 40,
    ...Theme.shadows.large,
    minWidth: 280,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  debugTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  debugButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    marginBottom: Theme.spacing.md,
    minWidth: 200,
  },
  debugButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    textAlign: 'center',
  },
  debugCloseButton: {
    backgroundColor: Theme.colors.text.muted,
    marginTop: Theme.spacing.sm,
  },
  debugCloseButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    textAlign: 'center',
  },
});

import DayCard from '@/components/DayCard';
import InitialSyncModal from '@/components/InitialSyncModal';
import RestCelebrationModal from '@/components/RestCelebrationModal';
import RunCelebrationModal from '@/components/RunCelebrationModal';
import StreakDisplay from '@/components/StreakDisplay';
import WeekView from '@/components/WeekView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useOnboardingSync } from '@/hooks/useOnboardingSync';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConvex, useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RiveRef } from 'rive-react-native';

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
  isRestDayCompleted?: boolean;
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
  const activitiesNeedingCelebration = useQuery(api.activities.getActivitiesNeedingCelebration);
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const plannedWorkouts = useQuery(api.trainingPlan.getPlannedWorkouts, {
    startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 20 days ago
    endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]    // 20 days ahead
  });
  const createProfile = useMutation(api.userProfile.createProfile);
  const markCelebrationShown = useMutation(api.activities.markCelebrationShown);
  const refreshStreak = useMutation(api.streak.refreshStreak);
  // const processAchievements = useMutation(api.achievements.processAchievementsForActivity);

  // Proper state management for week navigation
  const [currentWeekIndex, setCurrentWeekIndex] = useState(1); // 0=last week, 1=this week, 2=next week
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentAnimationType, setCurrentAnimationType] = useState<'running' | 'idle'>('idle');
  const [showPuff, setShowPuff] = useState(false);
  const [isBgAnimationRunning, setIsBgAnimationRunning] = useState(false);
  const bgAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isTransitioningRef = useRef(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Add debounce ref to prevent cascading updates
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add Rive refs for controlling the animations
  const runningRiveRef = useRef<RiveRef>(null);
  const idleRiveRef = useRef<RiveRef>(null);

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
    isInitialSync: boolean;
  } | null>(null);

  // Rest celebration state
  const [showRestCelebrationModal, setShowRestCelebrationModal] = useState(false);

  // Streak modal state
  const [showStreakModal, setShowStreakModal] = useState(false);

  // Debug modal state
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refresh streak on first app load of the day
  const [streakRefreshed, setStreakRefreshed] = useState(false);
  useEffect(() => {
    const runRefresh = async () => {
      if (!isAuthenticated || !profile || streakRefreshed) return;

      try {
        await refreshStreak({});
        setStreakRefreshed(true);
      } catch (err) {
        console.error("Failed to refresh streak:", err);
      }
    };

    runRefresh();
  }, [isAuthenticated, profile, streakRefreshed, refreshStreak]);

  // Derived values from queries
  const weekStartDay = profile?.weekStartDay ?? 1; // Default to Monday

  const RIVE_URL_IDDLE = "https://fast-dragon-309.convex.cloud/api/storage/ef5f29cd-b5d6-4fb2-9288-0edb260744c6";
  const RIVE_URL_ANGRY = "https://fast-dragon-309.convex.cloud/api/storage/04bf0340-7d79-4865-8dd6-2966b4befaff";
  const RIVE_URL_RUNNING = "https://deafening-mule-576.convex.cloud/api/storage/fcdc254a-5fb8-421b-b22e-85af6b3f765a";
  const RIVE_URL_CYCLE = "https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e";

  const BG_IMAGE_STADIUM = require("@/assets/images/bg/bgstadium.jpg");
  const BG_IMAGE_PARIS = require("@/assets/images/bg/bgparis.jpg");

  const RIVE_URLS = [
    RIVE_URL_RUNNING,
    RIVE_URL_ANGRY,
    RIVE_URL_IDDLE,
    RIVE_URL_CYCLE
  ];

  const startBgAnimation = () => {
    if (isBgAnimationRunning) return;
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
  };

  const stopBgAnimation = () => {
    if (!isBgAnimationRunning) return;
    if (bgAnimationRef.current) {
      bgAnimationRef.current.stop();
    }
    setIsBgAnimationRunning(false);
  };

  const toggleBgAnimation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isBgAnimationRunning) {
      stopBgAnimation();
    } else {
      startBgAnimation();
    }
  };

  // Add jump trigger function
  const handleJump = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Trigger the jump in the active Rive animation
    const activeRef = currentAnimationType === 'running' ? runningRiveRef : idleRiveRef;
    activeRef.current?.fireState('State Machine 1', 'jump');
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
    today.setHours(0, 0, 0, 0);
    const thisWeekStart = getWeekStart(new Date(), weekStartDay);
    const todayString = getLocalDateString(today);

    const weeks: WeekData[] = [];
    const allDays: DayData[] = [];
    let todayIndex = 0;

    // Create activity lookup map for better performance
    const activityMap = new Map<string, any[]>();
    activities.forEach((activity: any) => {
      const activityDate = getLocalDateString(new Date(activity.startDate));
      if (!activityMap.has(activityDate)) {
        activityMap.set(activityDate, []);
      }
      activityMap.get(activityDate)!.push(activity);
    });

    // Create planned workout lookup map
    const plannedWorkoutMap = new Map<string, any>();
    plannedWorkouts?.forEach(workout => {
      plannedWorkoutMap.set(workout.scheduledDate, workout);
    });

    // Generate 3 weeks: last week, this week, next week
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const weekStart = new Date(thisWeekStart);
      weekStart.setDate(thisWeekStart.getDate() + (weekOffset * 7));
      const days: DayData[] = [];

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateString = getLocalDateString(date);

        // Get activities and planned workout for this day
        const dayActivities = activityMap.get(dateString) || [];
        const plannedWorkout = plannedWorkoutMap.get(dateString);

        // Create workout data (planned or default rest)
        const finalPlannedWorkout = plannedWorkout || {
          scheduledDate: dateString,
          type: "rest",
          duration: "15-30 min",
          description: "Rest day - Perfect time for gentle stretching, foam rolling, or mobility work. Listen to your body and recover well!",
          target: "Active recovery",
          status: "scheduled",
          distance: 0,
          workoutId: null,
          workout: { type: "rest" },
          isDefault: true
        };

        // Determine if rest day is completed
        let isRestDayCompleted = false;
        const workoutType = plannedWorkout?.workout?.type || "rest";

        if (workoutType === 'rest') {
          if (finalPlannedWorkout.status === 'completed') {
            isRestDayCompleted = true;
          } else {
            const isPastDay = dateString < todayString;
            const isToday = dateString === todayString;

            if (isPastDay) {
              isRestDayCompleted = dayActivities.length === 0;
            } else if (isToday && profile?.lastStreakDate === dateString) {
              isRestDayCompleted = dayActivities.length === 0;
            }
          }
        }

        const dayData: DayData = {
          date: dateString,
          activities: transformActivities(dayActivities),
          plannedWorkout: finalPlannedWorkout,
          weekIndex: weekOffset + 1,
          isRestDayCompleted,
        };

        days.push(dayData);
        allDays.push(dayData);

        // Mark today's index
        if (dateString === todayString) {
          todayIndex = allDays.length - 1;
        }
      }

      weeks.push({
        weekIndex: weekOffset + 1,
        startDate: getLocalDateString(weekStart),
        days,
        weeklyProgress: days.reduce((sum, day) =>
          sum + day.activities.reduce((daySum, act) => daySum + act.distance, 0), 0
        ) / 1000
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

  // Auto-sync Strava activities when app first loads (once only)
  const [hasPerformedInitialSync, setHasPerformedInitialSync] = useState(false);
  const [initialSyncModalVisible, setInitialSyncModalVisible] = useState(false);
  const [initialSyncResult, setInitialSyncResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    distanceGained: number;
    leveledUp?: boolean;
    newLevel?: number;
    oldLevel?: number;
  } | null>(null);

  // Check for data source connection
  useEffect(() => {
    const checkDataSource = async () => {
      if (isAuthenticated && profile && !profile.healthKitSyncEnabled && !profile.stravaSyncEnabled) {
        // Check if we've shown the alert before
        const hasShownAlert = await AsyncStorage.getItem('hasShownDataSourceAlert');
        if (!hasShownAlert) {
          Alert.alert(
            'Connect a Data Source',
            'To track your runs, you need to connect either Strava or Apple Health. Strava is recommended for the best experience.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => router.push('/settings')
              }
            ]
          );
          // Mark that we've shown the alert
          await AsyncStorage.setItem('hasShownDataSourceAlert', 'true');
        }
      }
    };

    checkDataSource();
  }, [isAuthenticated, profile]);

  useEffect(() => {
    const performInitialSync = async () => {
      // Only perform initial connection sync for new Strava users
      if (!isAuthenticated || !profile?.stravaSyncEnabled || hasPerformedInitialSync) {
        return;
      }

      // Check if this is the initial connection (no previous sync and no recent activities)
      const lastSync = profile.lastStravaSync;
      const isInitialConnection = !lastSync;

      if (isInitialConnection) {
        console.log('[HomeScreen] Performing initial connection sync for Strava activities...');

        try {
          setHasPerformedInitialSync(true);

          const { default: DatabaseStravaService } = await import('@/services/DatabaseStravaService');
          const stravaService = new DatabaseStravaService(convex);

          const syncResult = await stravaService.syncActivitiesFromStrava(30); // Sync last 30 days for initial connection

          if (syncResult && syncResult.created > 0) {
            console.log(`[HomeScreen] Initial sync completed: ${syncResult.created} new activities`);

            // Show modal for first-time sync with significant results
            if (syncResult.created >= 5 || (syncResult.distanceGained && syncResult.distanceGained > 10000)) {
              setInitialSyncResult({
                created: syncResult.created,
                updated: syncResult.updated || 0,
                skipped: syncResult.skipped || 0,
                distanceGained: syncResult.distanceGained || 0,
                leveledUp: syncResult.leveledUp,
                newLevel: syncResult.newLevel,
                oldLevel: syncResult.oldLevel,
              });
              setInitialSyncModalVisible(true);
            }
          } else {
            console.log('[HomeScreen] Initial sync completed: no new activities found');
          }
        } catch (error) {
          console.error('[HomeScreen] Initial sync failed:', error);
          // Show alert if authentication error
          if (error instanceof Error && error.message.includes('Not authenticated with Strava')) {
            Alert.alert(
              'Strava Connection Required',
              'Please connect to Strava in Settings to enable activity syncing.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => router.push('/settings')
                }
              ]
            );
          }
        }
      } else {
        // Already connected - webhooks handle new activities automatically
        console.log('[HomeScreen] Strava already connected, webhooks handle new activities');
        setHasPerformedInitialSync(true);
      }
    };

    const timeoutId = setTimeout(performInitialSync, 1000); // Small delay to ensure profile is loaded
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, profile?.stravaSyncEnabled, profile?.lastStravaSync, hasPerformedInitialSync, convex]);



  // Check for activities needing celebration
  useEffect(() => {
    if (activitiesNeedingCelebration && activitiesNeedingCelebration.length > 0 && !showRunCelebrationModal) {
      const activityTocelebrate = activitiesNeedingCelebration[0]; // Get the most recent one

      // Calculate rewards for this activity
      const mockRewards = {
        distanceGained: activityTocelebrate.distance,
        coinsGained: 0, // No coins for initial sync
        leveledUp: false,
        challengesUnlocked: [],
      };

      setRunCelebrationData({
        runData: activityTocelebrate,
        rewards: mockRewards,
        isInitialSync: false // Not an initial sync for notification
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRunCelebrationModal(true);
    }
  }, [activitiesNeedingCelebration, showRunCelebrationModal]);

  useEffect(() => {
    console.log('HomeScreen mounted');
    return () => {
      if (bgAnimationRef.current) {
        bgAnimationRef.current.stop();
      }
    };
  }, [isAuthenticated]);

  // Memoize week data generation to prevent unnecessary recalculations
  const weekData = useMemo(() => {
    return generateWeekData();
  }, [activities, plannedWorkouts, weekStartDay]);

  const { weeks, allDays } = weekData;

  // Use useCallback for stable handler references
  const handleDaySelect = useCallback((dayIndex: number) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    Haptics.selectionAsync();

    // Batch the state updates to prevent cascading re-renders
    updateTimeoutRef.current = setTimeout(() => {
      setCurrentDayIndex(dayIndex);

      // Update current week index based on selected day
      const weekIndex = Math.floor(dayIndex / 7);
      if (weekIndex !== currentWeekIndex) {
        setCurrentWeekIndex(weekIndex);
      }
    }, 0);
  }, [currentWeekIndex]);

  const handleWeekChange = useCallback((weekIndex: number) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Batch the state updates to prevent cascading re-renders
    updateTimeoutRef.current = setTimeout(() => {
      setCurrentWeekIndex(weekIndex);

      // Auto-select today if it's in the selected week, otherwise select first day
      const today = new Date();
      const todayIndex = allDays.findIndex(day =>
        new Date(day.date).toDateString() === today.toDateString()
      );

      const weekStartIndex = weekIndex * 7;
      const weekEndIndex = weekStartIndex + 6;

      if (todayIndex >= weekStartIndex && todayIndex <= weekEndIndex) {
        setCurrentDayIndex(todayIndex);
      } else {
        setCurrentDayIndex(weekStartIndex);
      }
    }, 0);
  }, [allDays]);

  // Debounced effect for animation type and background animation changes
  useEffect(() => {
    if (allDays.length === 0 || isTransitioningRef.current) return;

    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Debounce the animation changes to prevent flickering
    updateTimeoutRef.current = setTimeout(() => {
      const selectedDayData = allDays[currentDayIndex];
      if (selectedDayData) {
        const workoutType = selectedDayData.plannedWorkout?.type;
        const newAnimationType: 'running' | 'idle' = workoutType === 'rest' ? 'idle' : 'running';

        if (newAnimationType === 'running') {
          startBgAnimation();
        } else {
          stopBgAnimation();
        }

        if (currentAnimationType !== newAnimationType) {
          isTransitioningRef.current = true;
          setShowPuff(true);
          // Scale down animation with smooth easing
          Animated.timing(scaleAnim, {
            toValue: 0,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start(() => {
            // Change animation type at scale 0
            setCurrentAnimationType(newAnimationType);

            // Scale back up with bouncy easing
            Animated.sequence([
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 80,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
              }),
              Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              })
            ]).start(() => {
              setShowPuff(false);
              isTransitioningRef.current = false;
            });
          });
        }
      }
    }, 100); // 100ms debounce to prevent rapid changes
  }, [allDays, currentDayIndex, currentAnimationType]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

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
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!allDays.length) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const selectedDayData = allDays[currentDayIndex];

  try {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[Theme.colors.background.primary, Theme.colors.background.secondary, Theme.colors.background.tertiary]}
          style={styles.solidBackground}
        />
        {/* <Animated.View
          style={[
            styles.scrollingBackgroundContainer,
            { transform: [{ translateX: scrollX }] }
          ]}
        >
          <Image source={BG_IMAGE_STADIUM} style={styles.scrollingBackgroundImage} />
          <Image source={BG_IMAGE_STADIUM} style={styles.scrollingBackgroundImage} />
        </Animated.View> */}
        <View style={styles.headerContainer}>
          <View style={styles.leftHeaderSection}>
            <TouchableOpacity onPress={handleTitlePress}>
              <Text style={styles.title}>Blaze</Text>
            </TouchableOpacity>
            <View style={styles.livesRowContainer}>
              {[...Array(4)].map((_, index) => {
                const currentLives = 3; // TODO: Get from user profile/state
                const isAlive = index < currentLives;
                return (
                  <Ionicons
                    key={index}
                    name={isAlive ? "flash" : "flash-outline"}
                    size={25}
                    color={isAlive ? Theme.colors.special.primary.coin : Theme.colors.text.primary}
                  />
                );
              })}
            </View>
          </View>
          <View style={styles.rightHeaderSection}>
            {/* <TouchableOpacity
              style={styles.streakContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowStreakModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>{profile?.currentStreak || 0}</Text>
            </TouchableOpacity> */}
            <TouchableOpacity
              onPress={() => Alert.alert(
                "Coming Soon",
                "Store is coming soon!",
                [{ text: "OK", style: "default" }]
              )}
              activeOpacity={0.7}
            >
              <View style={styles.coinContainer}>
                <Image source={require('@/assets/images/icons/coal.png')} style={styles.coinIcon} />
                <Text style={styles.coinText}>{profile?.coins || 0}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.animationContainer}>
          {/* <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Rive
              ref={runningRiveRef}
              url={RIVE_URL_RUNNING}
              style={{
                ...styles.animation,
                opacity: currentAnimationType === 'running' ? 1 : 0
              }}
              autoplay={true}
            />

            <Rive
              ref={idleRiveRef}
              url={RIVE_URL_IDDLE}
              style={{
                ...styles.animation,
                position: 'absolute',
                opacity: currentAnimationType === 'idle' ? 1 : 0
              }}
              autoplay={true}
            />
          </Animated.View> */}

          {/* {showPuff && (
            <Image
              source={require('@/assets/images/bg/puff.gif')}
              style={styles.puffImage}
            />
          )} */}
          <View style={styles.shadowDisc} />
          <Image
            source={require('@/assets/images/blaze/blazetr.gif')}
            style={styles.blazeImage}
            resizeMode="contain"
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
            streakInfo={profile ? {
              currentStreak: profile.currentStreak,
              longestStreak: profile.longestStreak,
              lastStreakDate: profile.lastStreakDate || null,
            } : undefined}
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
                streakInfo={{
                  currentStreak: profile?.currentStreak || 0,
                  longestStreak: profile?.longestStreak || 0,
                }}
                isRestDayCompleted={selectedDayData.isRestDayCompleted}
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
            currentStreak: profile?.currentStreak || 0,
            longestStreak: profile?.longestStreak || 0,
          }}
          isInitialSync={runCelebrationData?.isInitialSync || false}
          onClose={async () => {
            // Process achievements for this activity
            if (runCelebrationData?.runData?._id) {
              try {
                // const achievementResult = await processAchievements({
                //   activityId: runCelebrationData.runData._id
                // });
                // console.log('Achievements processed:', achievementResult);
              } catch (error) {
                console.error('Failed to process achievements:', error);
              }
            }

            // Mark celebration as shown if this was for a new activity
            if (runCelebrationData?.runData?._id) {
              try {
                await markCelebrationShown({ activityId: runCelebrationData.runData._id });
              } catch (error) {
                console.error('Failed to mark celebration as shown:', error);
              }
            }

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

        {/* Rest Celebration Modal */}
        <RestCelebrationModal
          visible={showRestCelebrationModal}
          onClose={() => setShowRestCelebrationModal(false)}
          streakInfo={{
            currentStreak: profile?.currentStreak || 0,
            longestStreak: profile?.longestStreak || 0,
          }}
        />

        {/* Streak Modal */}
        <StreakDisplay
          visible={showStreakModal}
          streakInfo={profile ? {
            currentStreak: profile.currentStreak,
            longestStreak: profile.longestStreak,
            lastStreakDate: profile.lastStreakDate || null,
          } : null}
          onClose={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowStreakModal(false);
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
                  const todayInfo = todaysWorkout ? `Today: Planned workout (${todaysWorkout.status})` : 'No workout today';

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
                      coinsGained: Math.floor(lastActivity.distance / 100),
                      leveledUp: Math.random() > 0.7, // 30% chance of level up for demo
                      newLevel: (profile?.level || 1) + 1,
                      oldLevel: profile?.level || 1,
                      challengesUnlocked: [],
                    };

                    setRunCelebrationData({
                      runData: lastActivity,
                      rewards: mockRewards,
                      isInitialSync: false // Not an initial sync for debug
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
                style={styles.debugButton}
                onPress={() => {
                  setShowDebugModal(false);
                  setShowRestCelebrationModal(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Text style={styles.debugButtonText}>🧘‍♂️ Test Rest Celebration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  try {
                    const { default: DatabaseStravaService } = await import('@/services/DatabaseStravaService');
                    const stravaService = new DatabaseStravaService(convex);

                    const debugInfo = await stravaService.debugAuthenticationStatus();

                    Alert.alert(
                      'Strava Auth Debug',
                      `Local Auth: ${debugInfo.localAuth}\n` +
                      `Local Tokens Expired: ${debugInfo.localTokens.isExpired}\n` +
                      `Local Time Until Expiry: ${debugInfo.localTokens.timeUntilExpiry}s\n\n` +
                      `DB Auth: ${debugInfo.dbAuth}\n` +
                      `DB Strava Sync Enabled: ${debugInfo.dbTokens.stravaSyncEnabled}\n` +
                      `DB Tokens Expired: ${debugInfo.dbTokens.isExpired}\n` +
                      `DB Time Until Expiry: ${debugInfo.dbTokens.timeUntilExpiry}s\n` +
                      `DB Athlete ID: ${debugInfo.dbTokens.stravaAthleteId}`,
                      [{ text: 'OK' }]
                    );
                  } catch (error) {
                    Alert.alert('Debug Error', `Failed to get auth info: ${error}`);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>🔍 Debug Strava Auth</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  Alert.alert(
                    'Reset Strava Auth',
                    'This will clear all Strava authentication data. You will need to reconnect to Strava. Continue?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            const { default: DatabaseStravaService } = await import('@/services/DatabaseStravaService');
                            const stravaService = new DatabaseStravaService(convex);

                            await stravaService.resetAuthentication();

                            Alert.alert(
                              'Reset Complete',
                              'Strava authentication has been reset. Please go to Settings to reconnect.',
                              [
                                { text: 'OK' },
                                {
                                  text: 'Open Settings',
                                  onPress: () => router.push('/settings')
                                }
                              ]
                            );
                          } catch (error) {
                            Alert.alert('Reset Failed', `Failed to reset auth: ${error}`);
                          }
                        }
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.debugButtonText}>🔄 Reset Strava Auth</Text>
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

        <InitialSyncModal
          visible={initialSyncModalVisible}
          syncResult={initialSyncResult}
          onClose={() => {
            setInitialSyncModalVisible(false);
            setInitialSyncResult(null);
          }}
          metricSystem={profile?.metricSystem || 'metric'}
        />
      </SafeAreaView >
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
    backgroundColor: '#0D0C0F'
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
  livesRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    gap: 2,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakIcon: {
    width: 24,
    height: 24,
    marginRight: 2,
  },
  streakEmoji: {
    fontSize: 20,
    marginRight: 2,
  },
  streakText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  rightHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 24,
    height: 24,
    marginRight: 4,
  },
  coinText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    zIndex: 1,
    position: 'relative',
  },
  animation: {
    width: 300,
    height: 300,
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
  puffImage: {
    position: 'absolute',
    width: 250,
    height: 250,
    zIndex: 10,
  },
  blazeImage: {
    position: 'absolute',
    width: 350,
    height: 350,
    zIndex: 10,
  },
  shadowDisc: {
    position: 'absolute',
    width: 500,
    height: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '100%',
    bottom: 40,
    zIndex: 5,
  },
});

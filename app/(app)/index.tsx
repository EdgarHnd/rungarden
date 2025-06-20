import DayCard from '@/components/DayCard';
import HealthModal from '@/components/HealthModal';
import InitialSyncModal from '@/components/InitialSyncModal';
import RestCelebrationModal from '@/components/RestCelebrationModal';
import RunCelebrationModal from '@/components/RunCelebrationModal';
import StreakDisplay from '@/components/StreakDisplay';
import WeekView from '@/components/WeekView';
import Theme from '@/constants/theme';
import { getActivityType, SuggestedActivity } from '@/constants/types';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
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

interface DayData {
  date: string;
  activities: Doc<"activities">[]; // Use Doc<"activities">[] to match DayCard expectations
  plannedWorkout?: SuggestedActivity | null;
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
  const restActivities = useQuery(api.userProfile.getRestActivities, {
    startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 20 days ago
    endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]    // 20 days ahead
  });
  const simpleSchedule = useQuery(api.simpleTrainingSchedule.getSimpleTrainingSchedule);
  const createProfile = useMutation(api.userProfile.createProfile);
  const markCelebrationShown = useMutation(api.activities.markCelebrationShown);
  const refreshStreak = useMutation(api.streak.refreshStreak);
  const setSimpleSchedule = useMutation(api.simpleTrainingSchedule.setSimpleTrainingSchedule);
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

  // Health modal state
  const [showHealthModal, setShowHealthModal] = useState(false);

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

  // Helper function to get day name from date string
  const getDayName = (dateString: string): string => {
    const date = new Date(dateString);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  };

  // Generate proper week data for WeekView
  const generateWeekData = (): { weeks: WeekData[], allDays: DayData[], todayIndex: number } => {
    if (!activities || !plannedWorkouts || !restActivities) return { weeks: [], allDays: [], todayIndex: 0 };

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

    // Create rest activities lookup map
    const restActivitiesMap = new Map<string, any>();
    restActivities?.forEach(restActivity => {
      restActivitiesMap.set(restActivity.date, restActivity);
    });

    // Helper function to calculate week progress for any given week
    const calculateWeekProgress = (weekStartDate: Date) => {
      const weekStart = getLocalDateString(weekStartDate);
      const weekEnd = new Date(weekStartDate);
      weekEnd.setDate(weekStartDate.getDate() + 6);
      const weekEndStr = getLocalDateString(weekEnd);

      const runDays = new Set<string>();
      activities.forEach((activity: any) => {
        const activityDate = getLocalDateString(new Date(activity.startDate));
        if (activityDate >= weekStart && activityDate <= weekEndStr) {
          runDays.add(activityDate);
        }
      });

      return {
        runsThisWeek: runDays.size,
        weeklyGoalMet: simpleSchedule ? runDays.size >= simpleSchedule.runsPerWeek : false,
        hasRunsThisWeek: runDays.size > 0
      };
    };

    // Generate 3 weeks: last week, this week, next week
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const weekStart = new Date(thisWeekStart);
      weekStart.setDate(thisWeekStart.getDate() + (weekOffset * 7));
      const days: DayData[] = [];

      // Calculate this week's progress
      const weekProgress = calculateWeekProgress(weekStart);

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateString = getLocalDateString(date);

        // Get activities and planned workout for this day
        const dayActivities = activityMap.get(dateString) || [];
        const plannedWorkout = plannedWorkoutMap.get(dateString);

        // Create appropriate planned workout based on user's mode
        let finalPlannedWorkout = plannedWorkout;

        if (!plannedWorkout) {
          if (trainingPlan?.isActive) {
            // Structured training plan users get default rest days
            finalPlannedWorkout = {
              scheduledDate: dateString,
              type: "rest",
              duration: "15-30 min",
              description: "Rest day - Perfect time for gentle stretching, foam rolling, or mobility work. Listen to your body and recover well!",
              target: "Active recovery",
              status: "scheduled",
              distance: 0,
              workoutId: null,
              workout: { type: "rest", steps: [] },
              isDefault: true
            };
          } else if (simpleSchedule?.isActive) {
            // For simple schedule users, create rest days when:
            // 1. Weekly goal is already met, OR
            // 2. It's not a preferred day AND they've done some runs this week (for current/past weeks)
            // 3. It's not a preferred day AND it's a future week (show planned rest days)
            const dayName = getDayName(dateString);
            const isPreferredDay = simpleSchedule.preferredDays.includes(dayName);
            const isFutureWeek = weekOffset > 0; // Next week is weekOffset = 1
            const isPastOrCurrentWeek = weekOffset <= 0;

            const shouldShowRestDay =
              weekProgress.weeklyGoalMet || // Goal already met
              (!isPreferredDay && weekProgress.hasRunsThisWeek && isPastOrCurrentWeek) || // Non-preferred day with some runs (current/past weeks)
              (!isPreferredDay && isFutureWeek); // Non-preferred day in future weeks

            if (shouldShowRestDay) {
              finalPlannedWorkout = {
                scheduledDate: dateString,
                type: "rest",
                duration: "15-30 min",
                description: weekProgress.weeklyGoalMet
                  ? "Great job! You've hit your weekly goal. Time to rest and recover! 🎉"
                  : isFutureWeek
                    ? "Planned rest day - Perfect time for gentle stretching, foam rolling, or mobility work."
                    : "Rest day - Perfect time for gentle stretching, foam rolling, or mobility work. Listen to your body and recover well!",
                target: "Active recovery",
                status: "scheduled",
                distance: 0,
                workoutId: null,
                workout: { type: "rest" },
                isDefault: true,
                isSimpleScheduleRest: true
              };
            } else {
              // Create a simple run workout for preferred days or when weekly goal isn't met
              finalPlannedWorkout = {
                scheduledDate: dateString,
                type: "run",
                duration: "30-45 min",
                description: isPreferredDay
                  ? "Go for a run! Perfect day for your weekly training."
                  : "Optional run day - Go for a run if you have time and energy.",
                target: "Easy run",
                status: "scheduled",
                distance: 3000, // 3km default
                workoutId: null,
                workout: { type: "run" },
                isDefault: true,
                isSimpleScheduleRun: true
              };
            }
          }
        }

        // Determine if rest day is completed using the restActivities table
        let isRestDayCompleted = false;
        const workoutType = plannedWorkout?.workout?.type || finalPlannedWorkout?.type || "rest";

        if (workoutType === 'rest' && finalPlannedWorkout) {
          if (finalPlannedWorkout.status === 'completed') {
            isRestDayCompleted = true;
          } else {
            // Check if there's a rest activity for this date
            const restActivity = restActivitiesMap.get(dateString);
            isRestDayCompleted = !!restActivity;
          }
        }

        const dayData: DayData = {
          date: dateString,
          activities: dayActivities, // Use activities directly without transformation
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
        try {
          setHasPerformedInitialSync(true);

          const { default: DatabaseStravaService } = await import('@/services/DatabaseStravaService');
          const stravaService = new DatabaseStravaService(convex);

          const syncResult = await stravaService.syncActivitiesFromStrava(30); // Sync last 30 days for initial connection

          if (syncResult && syncResult.created > 0) {
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
          }
        } catch (error) {
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
        const workoutType = getActivityType(selectedDayData.plannedWorkout);
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



  // Helper function to calculate week-specific run progress
  const getWeekProgress = (weekIndex: number) => {
    if (!simpleSchedule?.isActive || !activities) {
      return null;
    }

    // Get the week start date for the specified week
    const today = new Date();
    const thisWeekStart = getWeekStart(today, weekStartDay);
    const targetWeekStart = new Date(thisWeekStart);
    targetWeekStart.setDate(thisWeekStart.getDate() + ((weekIndex - 1) * 7)); // weekIndex 0=last week, 1=this week, 2=next week

    // Calculate week end date
    const weekEnd = new Date(targetWeekStart);
    weekEnd.setDate(targetWeekStart.getDate() + 6);

    const weekStartISO = getLocalDateString(targetWeekStart);
    const weekEndISO = getLocalDateString(weekEnd);

    // Count unique run days in this week
    const runDays = new Set<string>();
    activities.forEach((activity: any) => {
      const activityDate = getLocalDateString(new Date(activity.startDate));
      if (activityDate >= weekStartISO && activityDate <= weekEndISO) {
        runDays.add(activityDate);
      }
    });

    return {
      completed: runDays.size,
      target: simpleSchedule.runsPerWeek,
    };
  };

  // Show loading state when queries are loading
  if (!profile || !activities || plannedWorkouts === undefined || restActivities === undefined || simpleSchedule === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
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
        <View style={styles.headerContainer}>
          <View style={styles.leftHeaderSection}>
            <View style={styles.titleContainer}>
              <TouchableOpacity onPress={handleTitlePress}>
                <Text style={styles.title}>Blaze</Text>
              </TouchableOpacity>
              {levelInfo && (
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>LVL {levelInfo.level}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.livesRowContainer}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowHealthModal(true);
              }}
              activeOpacity={0.7}
            >
              {[...Array(4)].map((_, index) => {
                const currentLives = profile?.mascotHealth || 0;
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
            </TouchableOpacity>
          </View>
          <View style={styles.rightHeaderSection}>
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
              lastStreakWeek: profile.lastStreakWeek || null,
            } : undefined}
            simpleSchedule={simpleSchedule ? {
              runsPerWeek: simpleSchedule.runsPerWeek,
              preferredDays: simpleSchedule.preferredDays,
              isActive: simpleSchedule.isActive,
            } : null}
            todaysRunStatus={(() => {
              const weekProgress = getWeekProgress(currentWeekIndex);
              if (!weekProgress) return null;

              return {
                runsThisWeek: weekProgress.completed,
                runsNeeded: Math.max(0, weekProgress.target - weekProgress.completed),
                weeklyGoalMet: weekProgress.completed >= weekProgress.target,
              };
            })()}
          />

          {/* Day Card */}
          <View style={styles.selectedDayCardContainer}>
            {selectedDayData && (
              <DayCard
                key={`selected-day-${selectedDayData.date}`}
                date={selectedDayData.date}
                activities={selectedDayData.activities}
                plannedWorkout={selectedDayData.plannedWorkout}
                restActivity={(() => {
                  // Get rest activity for this date from restActivitiesMap
                  const restActivitiesMap = new Map<string, any>();
                  restActivities?.forEach(restActivity => {
                    restActivitiesMap.set(restActivity.date, restActivity);
                  });
                  return restActivitiesMap.get(selectedDayData.date) || null;
                })()}
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
            if (runCelebrationData?.runData?._id) {
              try {
                await markCelebrationShown({ activityId: runCelebrationData.runData._id });
              } catch (error) {
                console.error('Failed to mark celebration as shown:', error);
              }
            }

            setShowRunCelebrationModal(false);
            setRunCelebrationData(null);
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
            lastStreakWeek: profile.lastStreakWeek || null,
          } : null}
          onClose={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowStreakModal(false);
          }}
        />

        {/* Health Modal */}
        <HealthModal
          visible={showHealthModal}
          onClose={() => setShowHealthModal(false)}
          mascotHealth={profile?.mascotHealth || 0}
          simpleSchedule={simpleSchedule ? {
            runsPerWeek: simpleSchedule.runsPerWeek,
            preferredDays: simpleSchedule.preferredDays,
            isActive: simpleSchedule.isActive,
          } : null}
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
                  setShowDebugModal(false);
                  setShowRestCelebrationModal(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Text style={styles.debugButtonText}>🧘‍♂️ Test Rest Celebration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  if (activities && activities.length > 0) {
                    const lastRun = activities[0]; // Most recent activity
                    const mockRewards = {
                      distanceGained: lastRun.distance,
                      coinsGained: Math.floor(lastRun.distance / 1000) * 10, // 10 coins per km
                      leveledUp: false,
                      challengesUnlocked: [],
                    };

                    setRunCelebrationData({
                      runData: lastRun,
                      rewards: mockRewards,
                      isInitialSync: false
                    });

                    setShowDebugModal(false);
                    setShowRunCelebrationModal(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } else {
                    Alert.alert('No Runs', 'No runs found to test with');
                  }
                }}
              >
                <Text style={styles.debugButtonText}>🏃‍♂️ Test Run Celebration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  try {
                    await setSimpleSchedule({
                      runsPerWeek: 3,
                      preferredDays: ['Mon', 'Wed', 'Fri']
                    });
                    Alert.alert('Success', 'Simple training schedule created: 3 runs per week on Mon/Wed/Fri');
                  } catch (error) {
                    Alert.alert('Error', 'Failed to create simple schedule: ' + error);
                  }
                }}
              >
                <Text style={styles.debugButtonText}>🏃‍♂️ Create Simple Schedule</Text>
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  levelBadge: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  levelText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  livesRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
    gap: 2,
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Theme.colors.text.tertiary,
  },
});
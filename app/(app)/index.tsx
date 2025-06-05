import DayCard from '@/components/DayCard';
import RunCelebrationModal from '@/components/RunCelebrationModal';
import WeekView from '@/components/WeekView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import ChallengeService from '@/services/ChallengeService';
import { DatabaseActivity } from '@/services/DatabaseStravaService';
import HealthService from '@/services/HealthService';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Rive from 'rive-react-native';

interface Activity {
  type: 'run' | 'rest';
  title: string;
  description: string;
  duration: string;
  intensity: 'Easy' | 'Medium' | 'Hard';
  emoji: string;
}

interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  distanceGained?: number;
  coinsGained?: number;
  leveledUp?: boolean;
  newLevel?: number;
  oldLevel?: number;
  newRuns?: DatabaseActivity[];
}

// 7-day training plan - alternating running and rest days
const weeklyPlan: Activity[] = [
  {
    type: 'run',
    title: 'Easy Run',
    description: 'Start your week with a comfortable pace run to build base fitness',
    duration: '30-40 min',
    intensity: 'Easy',
    emoji: '🏃‍♂️'
  },
  {
    type: 'rest',
    title: 'Active Recovery',
    description: 'Stretching, light walking, and mobility work for recovery',
    duration: '20-30 min',
    intensity: 'Easy',
    emoji: '🧘‍♀️'
  },
  {
    type: 'run',
    title: 'Interval Training',
    description: '6x 400m intervals with 90s recovery between each',
    duration: '35 min',
    intensity: 'Hard',
    emoji: '⚡'
  },
  {
    type: 'rest',
    title: 'Recovery & Stretching',
    description: 'Full body stretching routine and foam rolling',
    duration: '25 min',
    intensity: 'Easy',
    emoji: '🤸‍♂️'
  },
  {
    type: 'run',
    title: 'Tempo Run',
    description: 'Sustained effort at comfortably hard pace',
    duration: '25 min',
    intensity: 'Hard',
    emoji: '🔥'
  },
  {
    type: 'run',
    title: 'Long Run',
    description: 'Build endurance with a longer, steady-paced run',
    duration: '45-60 min',
    intensity: 'Hard',
    emoji: '🏃‍♂️'
  },
  {
    type: 'rest',
    title: 'Rest Day',
    description: 'Complete rest or gentle yoga for full recovery',
    duration: 'As needed',
    intensity: 'Easy',
    emoji: '😴'
  }
];

// Constants for scrolling background
const SCROLLING_BG_LOOP_WIDTH = 2000; // The width of one segment of the looping background
const SCROLLING_BG_ANIMATION_DURATION = 8000; // Duration for one loop

const getSuggestedActivityForDay = (date: Date): Activity => {
  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  return weeklyPlan[dayIndex];
};

interface DayData {
  date: string;
  activities: any[]; // Use any[] to avoid type conflicts between different DatabaseActivity interfaces
  suggestedActivity: Activity;
  weekIndex: number;
}

interface WeekData {
  weekIndex: number;
  startDate: string; // Monday of this week
  days: DayData[];
  weeklyProgress: number;
}

export default function HomeScreen() {
  const { isAuthenticated } = useConvexAuth();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const activities = useQuery(api.activities.getUserActivities, { days: 21, limit: 100 });
  const syncActivities = useMutation(api.activities.syncActivitiesFromHealthKit);

  const [dayData, setDayData] = useState<DayData[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(1); // Start with current week (index 1 of 3 weeks)
  const scrollX = useRef(new Animated.Value(0)).current;
  const [riveUrl, setRiveUrl] = useState("https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e");
  const [isBgAnimationRunning, setIsBgAnimationRunning] = useState(false);
  const bgAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Leveling state
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; newLevel: number; distanceGained: number; coinsGained?: number } | null>(null);

  // Run celebration state
  const [showRunCelebrationModal, setShowRunCelebrationModal] = useState(false);
  const [runCelebrationData, setRunCelebrationData] = useState<{
    runData: DatabaseActivity | null;
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
  const weeklyGoal = profile?.weeklyGoal ? profile.weeklyGoal / 1000 : 20; // Convert to km, default 20
  const weekStartDay = profile?.weekStartDay ?? 1; // Default to Monday
  const userCoins = profile?.coins ?? 0; // User's current coin balance

  const RIVE_URLS = [
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
      // Stop the animation
      if (bgAnimationRef.current) {
        bgAnimationRef.current.stop();
      }
      setIsBgAnimationRunning(false);
    } else {
      // Start the animation
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

  // Handle triple tap on title for debug modal
  const handleTitlePress = () => {
    setTapCount(prev => prev + 1);

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    tapTimeoutRef.current = setTimeout(() => {
      if (tapCount >= 2) { // 3rd tap (0, 1, 2)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowDebugModal(true);
      }
      setTapCount(0);
    }, 500); // Reset after 500ms
  };

  // Helper function to get date string in local timezone (YYYY-MM-DD)
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get first day of week based on user preference (timezone-robust)
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

  // Generate weeks data starting from user's preferred week start day
  const generateWeeksData = (loadedActivities: any[]) => {
    const today = new Date();
    const thisWeekStart = getWeekStart(today, weekStartDay);

    const weeksData: WeekData[] = [];
    const allDays: DayData[] = [];
    let todayDayIndex = 0;

    // Generate 3 weeks: last week, this week, next week
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const weekStart = new Date(thisWeekStart);
      weekStart.setDate(thisWeekStart.getDate() + (weekOffset * 7));

      const weekDays: DayData[] = [];
      let weeklyDistance = 0;

      // Generate 7 days for this week starting from user's preferred day
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + dayOffset);
        const dateString = getLocalDateString(date);

        // Filter activities for this day using timezone-robust comparison
        const dayActivities = loadedActivities.filter((activity: any) => {
          const activityDate = new Date(activity.startDate);
          const activityDateString = getLocalDateString(activityDate);
          return activityDateString === dateString;
        });

        // Calculate distance for this day
        const dayDistance = dayActivities.reduce((sum, activity) => sum + activity.distance, 0);
        weeklyDistance += dayDistance;

        const dayData: DayData = {
          date: dateString,
          activities: dayActivities,
          suggestedActivity: getSuggestedActivityForDay(date),
          weekIndex: weekOffset + 1 // 0, 1, 2 for last week, this week, next week
        };

        weekDays.push(dayData);
        allDays.push(dayData);

        // Check if this is today to set the current day index
        if (date.toDateString() === today.toDateString()) {
          todayDayIndex = allDays.length - 1;
        }
      }

      const weekData: WeekData = {
        weekIndex: weekOffset + 1,
        startDate: getLocalDateString(weekStart),
        days: weekDays,
        weeklyProgress: weeklyDistance / 1000 // Convert to km
      };

      weeksData.push(weekData);
    }

    setWeeks(weeksData);
    setDayData(allDays);
    setCurrentDayIndex(todayDayIndex);

    // Set current week index to "this week" (index 1)
    const todayWeekIndex = Math.floor(todayDayIndex / 7);
    setCurrentWeekIndex(todayWeekIndex);
  };

  // Effect to handle data loading and level calculation
  useEffect(() => {
    if (profile && activities) {
      // Calculate level info from profile
      const userLevelInfo = LevelingService.calculateLevelInfo(profile.totalDistance);
      setLevelInfo(userLevelInfo);

      // Generate weeks data from activities
      generateWeeksData(activities as any[]);
    }
  }, [profile, activities, weekStartDay]);

  useEffect(() => {
    console.log('HomeScreen mounted');

    if (isAuthenticated) {
      // Background animation is stopped by default - user can start it with the button
    }

    return () => {
      if (bgAnimationRef.current) {
        bgAnimationRef.current.stop();
      }
    };
  }, [isAuthenticated]);

  const handleRefresh = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if HealthKit sync is enabled
      if (!profile?.healthKitSyncEnabled) {
        // Just refresh the UI without syncing
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'HealthKit Sync Disabled',
          'HealthKit sync is disabled. Enable it in Settings to sync your workouts.',
          [
            { text: 'OK', style: 'default' },
            {
              text: 'Settings',
              onPress: () => router.push('/settings'),
              style: 'default'
            }
          ]
        );
        return;
      }

      // Get HealthKit data first
      const healthKitActivities = await HealthService.getRunningActivities(21);

      if (healthKitActivities.length === 0) {
        // No new activities to sync
        return;
      }

      // Transform to database format
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

      // Sync to Convex
      const syncResult = await syncActivities({ activities: activitiesForDb });

      // Check if new runs were created and show celebration modal
      if (syncResult.created > 0 && syncResult.distanceGained && syncResult.distanceGained > 0) {
        // Get the most recent run from the sync result
        const recentRun = syncResult.newRuns?.[0]; // Get the first new run

        if (recentRun) {
          // Detect challenges for the new run
          const isFirstRun = (profile?.totalWorkouts || 0) === 0;
          const unlockedChallenges = ChallengeService.checkChallengesForRun(recentRun, {
            totalRuns: profile?.totalWorkouts || 0,
            totalDistance: profile?.totalDistance || 0,
            isFirstRun: isFirstRun
          });

          // Set up celebration data
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

          // Show celebration modal instead of or before level up modal
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowRunCelebrationModal(true);
        }
      } else if (syncResult.leveledUp && syncResult.newLevel && syncResult.oldLevel && syncResult.distanceGained) {
        // Only show level up modal if no new runs to celebrate
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLevelUpInfo({
          oldLevel: syncResult.oldLevel,
          newLevel: syncResult.newLevel,
          distanceGained: syncResult.distanceGained,
          coinsGained: syncResult.coinsGained || 0,
        });
        setShowLevelUpModal(true);
      } else if (syncResult.coinsGained && syncResult.coinsGained > 0) {
        // Show brief notification for coins gained even without level up
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Could add a separate coins notification here in the future
      }

      // Data will automatically refresh via Convex queries
    } catch (error) {
      console.error('Error refreshing:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to refresh data');
    }
  };

  const handleProfilePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(app)/profile');
  };

  const handleDaySelect = (index: number) => {
    Haptics.selectionAsync();
    setCurrentDayIndex(index);

    // Update current week index based on selected day
    const weekIndex = Math.floor(index / 7);
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

  // Convert database activities to legacy format for DayCard
  const formatActivitiesForDayCard = (activities: any[]) => {
    return activities.map((activity: any) => ({
      uuid: activity.healthKitUuid || `strava_${activity.stravaId}` || activity._id,
      startDate: activity.startDate,
      endDate: activity.endDate,
      duration: activity.duration,
      distance: activity.distance,
      calories: activity.calories,
      averageHeartRate: activity.averageHeartRate,
      workoutName: activity.workoutName,
    }));
  };

  // Show loading state when queries are loading
  if (!profile || !activities) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  try {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.scrollingBackgroundContainer,
            {
              transform: [{ translateX: scrollX }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/bg/bgstadium.jpg')}
            style={styles.scrollingBackgroundImage}
          />
          <Image
            source={require('@/assets/images/bg/bgstadium.jpg')}
            style={styles.scrollingBackgroundImage}
          />
          {/* <View style={styles.solidBackground} /> */}
        </Animated.View>

        <View style={styles.headerContainer}>
          <View style={styles.leftHeaderSection}>
            <TouchableOpacity onPress={handleTitlePress}>
              <Text style={styles.title}>Koko</Text>
            </TouchableOpacity>
            <View style={styles.flashIconsContainer}>
              <Ionicons name="flash" size={24} color={Theme.colors.accent.primary} />
              <Ionicons name="flash" size={24} color={Theme.colors.accent.primary} />
              <Ionicons name="flash-outline" size={24} color={Theme.colors.text.primary} />
              <Ionicons name="flash-outline" size={24} color={Theme.colors.text.primary} />
            </View>
          </View>
          <View style={styles.rightHeaderSection}>
            <TouchableOpacity onPress={() => router.push('/challenges')}>
              <Text style={styles.challengesIcon}>🏅</Text>
            </TouchableOpacity>
          </View>
          {/* <View style={styles.rightHeaderSection}>
            <Text style={styles.coinIcon}>🥥</Text>
            <Text style={styles.coinText}>{userCoins}</Text>
          </View> */}
        </View>

        <View style={styles.animationContainer} onTouchEnd={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <Rive
            url={riveUrl}
            style={styles.animation}
            autoplay={true}
          />
        </View>
        {/* Challenges Button */}

        <ScrollView
          style={styles.mainScrollView}
          stickyHeaderIndices={[1]} // WeekView is now at index 1 after the spacer
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Spacer to push week view below animation initially */}
          <View style={styles.scrollSpacer}>
            {/* <View style={styles.challengesButtonContainer}>
              <TouchableOpacity onPress={() => router.push('/challenges')}>
                <Text style={styles.challengesIcon}>🏅</Text>
              </TouchableOpacity>
            </View> */}
          </View>

          {/* Week View Component */}
          <WeekView
            dayData={dayData}
            currentDayIndex={currentDayIndex}
            onDaySelect={handleDaySelect}
            levelInfo={levelInfo}
            currentWeekIndex={currentWeekIndex}
            weeks={weeks}
            onWeekChange={handleWeekChange}
            weekStartDay={weekStartDay}
          />

          {/* Single Day Card for Selected Day */}
          <View style={styles.selectedDayCardContainer}>
            {dayData[currentDayIndex] && (
              <DayCard
                key={`selected-day-${dayData[currentDayIndex].date}`}
                date={dayData[currentDayIndex].date}
                activities={formatActivitiesForDayCard(dayData[currentDayIndex].activities)}
                suggestedActivity={dayData[currentDayIndex].suggestedActivity}
                formatDistance={formatDistance}
                formatPace={formatPace}
              />
            )}
          </View>
        </ScrollView>

        {/* Level Up Modal */}
        <Modal
          visible={showLevelUpModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLevelUpModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.levelUpModal}>
              <Text style={styles.levelUpTitle}>🎉 Level Up! 🎉</Text>
              {levelUpInfo && (
                <>
                  <Text style={styles.levelUpSubtitle}>
                    {LevelingService.getLevelTitle(levelUpInfo.oldLevel)} → {LevelingService.getLevelTitle(levelUpInfo.newLevel)}
                  </Text>
                  <View style={styles.levelUpDetails}>
                    <Text style={styles.levelUpLevel}>
                      Level {levelUpInfo.oldLevel} → Level {levelUpInfo.newLevel}
                    </Text>
                    <Text style={styles.levelUpXP}>
                      +{LevelingService.formatDistance(levelUpInfo.distanceGained)} distance gained!
                    </Text>
                    {levelUpInfo.coinsGained && levelUpInfo.coinsGained > 0 && (
                      <Text style={styles.levelUpCoins}>
                        +{levelUpInfo.coinsGained} coins earned! 🪙
                      </Text>
                    )}
                  </View>
                  <Text style={styles.levelUpEmoji}>
                    {LevelingService.getLevelEmoji(levelUpInfo.newLevel)}
                  </Text>
                </>
              )}
              <TouchableOpacity
                style={styles.levelUpButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowLevelUpModal(false);
                }}
              >
                <Text style={styles.levelUpButtonText}>Awesome!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Run Celebration Modal */}
        <RunCelebrationModal
          visible={showRunCelebrationModal}
          runData={runCelebrationData?.runData || null}
          rewards={runCelebrationData?.rewards || {
            distanceGained: 0,
            coinsGained: 0,
            challengesUnlocked: []
          }}
          onClose={() => {
            setShowRunCelebrationModal(false);
            setRunCelebrationData(null);

            // Show level up modal after run celebration if user leveled up
            if (runCelebrationData?.rewards.leveledUp &&
              runCelebrationData?.rewards.newLevel &&
              runCelebrationData?.rewards.oldLevel) {
              setLevelUpInfo({
                oldLevel: runCelebrationData.rewards.oldLevel,
                newLevel: runCelebrationData.rewards.newLevel,
                distanceGained: runCelebrationData.rewards.distanceGained,
                coinsGained: runCelebrationData.rewards.coinsGained || 0,
              });
              setShowLevelUpModal(true);
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
      </View>
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
  flashIconsContainer: {
    flexDirection: 'row',
  },
  rightHeaderSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    fontSize: 20,
    marginRight: 4,
  },
  challengesButtonContainer: {
    position: 'absolute',
    bottom: 10,
    left: Theme.spacing.xl,
  },
  challengesIcon: {
    fontSize: 40,
  },
  coinText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  levelProgressContainer: {
    alignItems: 'flex-end',
  },
  levelSection: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textShadowColor: Theme.colors.transparent.black50,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  levelTitle: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textShadowColor: Theme.colors.transparent.black50,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressSection: {
    alignItems: 'flex-end',
  },
  progressBar: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.small,
    height: 10,
    width: 120,
    marginBottom: 2,
  },
  progressFill: {
    backgroundColor: Theme.colors.special.level,
    borderRadius: Theme.borderRadius.small,
    height: '100%',
  },
  progressText: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.secondary,
    textShadowColor: Theme.colors.transparent.black50,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressDetailText: {
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
    textShadowColor: Theme.colors.transparent.black30,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
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
  levelUpModal: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.xl,
    padding: Theme.spacing.xxxl,
    alignItems: 'center',
    marginHorizontal: 40,
    ...Theme.shadows.large,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  levelUpTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  levelUpSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  levelUpDetails: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  levelUpLevel: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.sm,
  },
  levelUpXP: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.status.success,
  },
  levelUpEmoji: {
    fontSize: 48,
    marginBottom: Theme.spacing.xxl,
  },
  levelUpButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingHorizontal: Theme.spacing.xxxl,
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
  },
  levelUpButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
  },
  levelUpCoins: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.special.coin,
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

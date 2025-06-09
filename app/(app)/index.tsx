import DayCard from '@/components/DayCard';
import RunCelebrationModal from '@/components/RunCelebrationModal';
import WeekView from '@/components/WeekView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useOnboardingSync } from '@/hooks/useOnboardingSync';
import ChallengeService from '@/services/ChallengeService';
// Removed conflicting import
import HealthService from '@/services/HealthService';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Rive from 'rive-react-native';

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

  // Sync pending onboarding data when user becomes authenticated
  useOnboardingSync();

  // Convex queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const activities = useQuery(api.activities.getUserActivities, { days: 21, limit: 100 });
  const trainingPlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const plannedWorkouts = useQuery(api.plannedWorkouts.getPlannedWorkouts, { days: 21 });
  const syncActivities = useMutation(api.activities.syncActivitiesFromHealthKit);

  // Proper state management for week navigation
  const [currentWeekIndex, setCurrentWeekIndex] = useState(1); // 0=last week, 1=this week, 2=next week
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
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
      const userLevelInfo = LevelingService.calculateLevelInfo(profile.totalDistance);
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

      if (!profile?.healthKitSyncEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          'HealthKit Sync Disabled',
          'HealthKit sync is disabled. Enable it in Settings to sync your workouts.',
          [
            { text: 'OK', style: 'default' },
            { text: 'Settings', onPress: () => router.push('/settings'), style: 'default' }
          ]
        );
        return;
      }

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
      } else if (syncResult.leveledUp && syncResult.newLevel && syncResult.oldLevel && syncResult.distanceGained) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLevelUpInfo({
          oldLevel: syncResult.oldLevel,
          newLevel: syncResult.newLevel,
          distanceGained: syncResult.distanceGained,
          coinsGained: syncResult.coinsGained || 0,
        });
        setShowLevelUpModal(true);
      } else if (syncResult.coinsGained && syncResult.coinsGained > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <View style={styles.flashIconsContainer}>
              <Ionicons name="flash" size={24} color={Theme.colors.accent.primary} />
              <Ionicons name="flash" size={24} color={Theme.colors.accent.primary} />
              <Ionicons name="flash-outline" size={24} color={Theme.colors.text.primary} />
              <Ionicons name="flash-outline" size={24} color={Theme.colors.text.primary} />
            </View>
          </View>
          <View style={styles.rightHeaderSection}>
            <TouchableOpacity onPress={() => router.push('/challenges')} style={styles.headerButton}>
              <Ionicons name="trophy" size={28} color={Theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.animationContainer} onTouchEnd={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
          <Rive url={riveUrl} style={styles.animation} autoplay={true} />
        </View>

        <ScrollView
          style={styles.mainScrollView}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          <View style={styles.scrollSpacer} />

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
  headerButton: {
    padding: Theme.spacing.sm,
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

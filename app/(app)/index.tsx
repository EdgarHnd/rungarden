import DayCard from '@/components/DayCard';
import WeekView from '@/components/WeekView';
import { api } from '@/convex/_generated/api';
import DatabaseHealthService, { DatabaseActivity, SyncResult } from '@/services/DatabaseHealthService';
import LevelingService, { LevelInfo } from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import { useConvex, useConvexAuth, useQuery } from "convex/react";
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
  activities: DatabaseActivity[];
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
  const convex = useConvex();

  // Convex queries
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const activities = useQuery(api.activities.getUserActivities, { days: 21, limit: 100 });

  const [dayData, setDayData] = useState<DayData[]>([]);
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(1); // Start with current week (index 1 of 3 weeks)
  const scrollX = useRef(new Animated.Value(0)).current;
  const [riveUrl, setRiveUrl] = useState("https://fast-dragon-309.convex.cloud/api/storage/122e4793-89da-41de-9e4f-ed67741def2e");
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);

  // Leveling state
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpInfo, setLevelUpInfo] = useState<{ oldLevel: number; newLevel: number; distanceGained: number } | null>(null);

  // Derived values from queries
  const weeklyGoal = profile?.weeklyGoal ? profile.weeklyGoal / 1000 : 20; // Convert to km, default 20
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
  const generateWeeksData = (loadedActivities: DatabaseActivity[]) => {
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
        const dayActivities = loadedActivities.filter((activity: DatabaseActivity) => {
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
      generateWeeksData(activities as DatabaseActivity[]);
    }
  }, [profile, activities, weekStartDay]);

  useEffect(() => {
    console.log('HomeScreen mounted');

    if (isAuthenticated && convex) {
      const service = new DatabaseHealthService(convex);
      setHealthService(service);
    }

    // Start the background scrolling animation
    scrollX.setValue(0);
    const bgAnimation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -SCROLLING_BG_LOOP_WIDTH,
        duration: SCROLLING_BG_ANIMATION_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    return () => {
      bgAnimation.stop();
    };
  }, [isAuthenticated, convex, scrollX]);

  const handleRefresh = async () => {
    if (!healthService) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Force sync and check for level ups
      const syncResult: SyncResult = await healthService.forceSyncFromHealthKit(21);

      if (syncResult.leveledUp && syncResult.newLevel && syncResult.oldLevel && syncResult.distanceGained) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLevelUpInfo({
          oldLevel: syncResult.oldLevel,
          newLevel: syncResult.newLevel,
          distanceGained: syncResult.distanceGained
        });
        setShowLevelUpModal(true);
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
  const formatActivitiesForDayCard = (activities: DatabaseActivity[]) => {
    return activities.map(activity => ({
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
        </Animated.View>

        <View style={styles.headerContainer}>
          <View style={styles.leftHeaderSection}>
            <Text style={styles.title}>Koko</Text>
            <View style={styles.flashIconsContainer}>
              <Ionicons name="flash" size={20} color="yellow" />
              <Ionicons name="flash-outline" size={20} color="white" />
              <Ionicons name="flash-outline" size={20} color="white" />
              <Ionicons name="flash-outline" size={20} color="white" />
            </View>
            <TouchableOpacity onPress={toggleRiveUrl} style={styles.toggleButton}>
              <Text style={styles.toggleButtonText}>👀</Text>
            </TouchableOpacity>
          </View>

          {levelInfo && (
            <TouchableOpacity style={styles.levelProgressContainer} onPress={handleProfilePress}>
              <View style={styles.levelSection}>
                <Text style={styles.levelText}>Lv.{levelInfo.level}</Text>
              </View>
              <View style={styles.progressSection}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${levelInfo.progressToNextLevel * 100}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressDetailText}>
                  {`${(levelInfo.totalDistance / 1000).toFixed(1)}km / ${(levelInfo.distanceForNextLevel / 1000).toFixed(1)}km`}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.animationContainer}>
          <Rive
            url={riveUrl}
            style={styles.animation}
            autoplay={true}
          />
        </View>

        <ScrollView
          style={styles.mainScrollView}
          stickyHeaderIndices={[1]} // WeekView is now at index 1 after the spacer
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Spacer to push week view below animation initially */}
          <View style={styles.scrollSpacer} />

          {/* Week View Component */}
          <WeekView
            dayData={dayData}
            currentDayIndex={currentDayIndex}
            onDaySelect={handleDaySelect}
            weeklyProgress={weeks[currentWeekIndex]?.weeklyProgress || 0}
            weeklyGoal={weeklyGoal}
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
    resizeMode: 'cover', // Ensures the image covers the segment, maintaining aspect ratio
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  leftHeaderSection: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#fff',
  },
  flashIconsContainer: {
    flexDirection: 'row',
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
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  levelTitle: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressSection: {
    alignItems: 'flex-end',
  },
  progressBar: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 8,
    height: 10,
    width: 120,
    marginBottom: 2,
  },
  progressFill: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    height: '100%',
  },
  progressText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  progressDetailText: {
    fontSize: 10,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  mainScrollView: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
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
    margin: 20,
  },
  selectedDayCardContainer: {
    backgroundColor: 'white',
    minHeight: 400,
  },
  error: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  loading: {
    fontSize: 16,
    textAlign: 'center',
    margin: 20,
  },
  toggleButton: {
    // position: 'absolute',
    // bottom: 10,
    // right: 10,
  },
  toggleButtonText: {
    color: '#fff',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelUpModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  levelUpTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  levelUpSubtitle: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  levelUpDetails: {
    alignItems: 'center',
    marginBottom: 20,
  },
  levelUpLevel: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#007AFF',
    marginBottom: 8,
  },
  levelUpXP: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#10B981',
  },
  levelUpEmoji: {
    fontSize: 48,
    marginBottom: 24,
  },
  levelUpButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  levelUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
  },
  scrollContentContainer: {
  },
  scrollSpacer: {
    height: 300, // Height to position week view below animation
  },
});

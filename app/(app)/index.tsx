import DayCard from '@/components/DayCard';
import HealthService, { RunningActivity } from '@/services/HealthService';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  activities: RunningActivity[];
  suggestedActivity: Activity;
}

export default function HomeScreen() {
  const [dayData, setDayData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDayIndex, setCurrentDayIndex] = useState(3); // Today is at index 3
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    console.log('HomeScreen mounted');
    loadTodayActivity();

    // Start the background scrolling animation
    scrollX.setValue(0); // Ensure starting at 0
    const bgAnimation = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -SCROLLING_BG_LOOP_WIDTH,
        duration: SCROLLING_BG_ANIMATION_DURATION,
        easing: Easing.linear, // Ensures constant speed
        useNativeDriver: true,
      })
    );
    bgAnimation.start();

    return () => {
      bgAnimation.stop(); // Clean up animation on unmount
    };
  }, [scrollX]); // scrollX is a stable ref, but good practice to list if logic depends on it. Or keep [] if mount-only.

  const loadTodayActivity = async () => {
    try {
      console.log('Loading activities...');
      const loadedActivities = await HealthService.getRunningActivities(7); // Load last 7 days
      console.log('Activities loaded:', loadedActivities);

      // Generate day data: 3 past days + today + 3 future days
      const days: DayData[] = [];
      for (let i = 3; i >= -3; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toISOString().split('T')[0];

        // Filter activities for this day
        const dayActivities = loadedActivities.filter(activity => {
          const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
          return activityDate === dateString;
        });

        days.push({
          date: dateString,
          activities: dayActivities,
          suggestedActivity: getSuggestedActivityForDay(date)
        });
      }

      setDayData(days);

      // Scroll to today (index 3) after a short delay to ensure the ScrollView is rendered
      setTimeout(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            x: 3 * 382, // Today is at index 3, card width + margin = 382
            animated: false // Use false for initial positioning to avoid animation delay
          });
          // currentDayIndex is already set to 3 in the initial state
        }
      }, 100);
    } catch (error) {
      console.error('Error loading activity:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToDay = (index: number) => {
    if (scrollViewRef.current && index >= 0 && index < dayData.length) {
      scrollViewRef.current.scrollTo({
        x: index * 382, // Card width + margin = 382
        animated: true
      });
      setCurrentDayIndex(index);
    }
  };

  const goToPreviousDay = () => {
    if (currentDayIndex > 0) {
      scrollToDay(currentDayIndex - 1);
    }
  };

  const goToNextDay = () => {
    if (currentDayIndex < dayData.length - 1) {
      scrollToDay(currentDayIndex + 1);
    }
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / 382);

    // Only update if the index has actually changed
    if (index !== currentDayIndex && index >= 0 && index < dayData.length) {
      setCurrentDayIndex(index);
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

  const formatDateTitle = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // If there's an error, show error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  // Show loading state
  if (isLoading) {
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
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.title}>Koko</Text>
            <View style={styles.iconContainer}>
              <Text style={styles.lightning}>⚡️⚡️⚡️</Text>
            </View>
          </View>

          <View style={styles.animationContainer}>
            <Rive
              //url="https://deafening-mule-576.convex.cloud/api/storage/fcdc254a-5fb8-421b-b22e-85af6b3f765a"
              url="https://fast-dragon-309.convex.cloud/api/storage/04bf0340-7d79-4865-8dd6-2966b4befaff"
              style={styles.animation}
              autoplay={true}
            />
          </View>

          {/* Day Navigation Header */}
          <View style={styles.dayNavigationContainer}>
            <TouchableOpacity
              style={[styles.navButton, currentDayIndex === 0 && styles.navButtonDisabled]}
              onPress={goToPreviousDay}
              disabled={currentDayIndex === 0}
            >
              <Text style={[styles.navButtonText, currentDayIndex === 0 && styles.navButtonTextDisabled]}>‹</Text>
            </TouchableOpacity>

            <View style={styles.dayTitleContainer}>
              <Text style={styles.dayNavigationTitle}>
                {dayData[currentDayIndex] ? formatDateTitle(dayData[currentDayIndex].date) : ''}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.navButton, currentDayIndex === dayData.length - 1 && styles.navButtonDisabled]}
              onPress={goToNextDay}
              disabled={currentDayIndex === dayData.length - 1}
            >
              <Text style={[styles.navButtonText, currentDayIndex === dayData.length - 1 && styles.navButtonTextDisabled]}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.workoutCardContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollViewContent}
              style={styles.scrollView}
              snapToInterval={382} // Card width (350) + container margin (32)
              snapToAlignment="start"
              decelerationRate="fast"
              pagingEnabled={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {dayData.map((day, index) => (
                <View key={day.date} style={styles.cardContainer}>
                  <DayCard
                    date={day.date}
                    activities={day.activities}
                    suggestedActivity={day.suggestedActivity}
                    formatDistance={formatDistance}
                    formatPace={formatPace}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
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
    top: -300,
    left: 0,
    height: '140%', // Should match original visual intent
    width: SCROLLING_BG_LOOP_WIDTH * 2, // To hold two images side-by-side
    flexDirection: 'row', // Arrange images horizontally
    zIndex: 0, // Ensure it's behind other content
  },
  scrollingBackgroundImage: {
    width: SCROLLING_BG_LOOP_WIDTH,
    height: '100%',
    resizeMode: 'cover', // Ensures the image covers the segment, maintaining aspect ratio
  },
  content: {
    flex: 1,
    paddingTop: 60,
    zIndex: 1,
  },
  logoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#fff',
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 8,
  },
  lightning: {
    fontSize: 20,
  },
  animationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 300,
    height: 300,
  },
  dayNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
  },
  navButtonText: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#fff',
  },
  navButtonTextDisabled: {
  },
  dayTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dayNavigationTitle: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  workoutCardContainer: {
    marginBottom: 100,
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollViewContent: {
    paddingHorizontal: 10,
    alignItems: 'flex-start',
    paddingRight: 30, // Extra padding for the last card
  },
  cardContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
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
});

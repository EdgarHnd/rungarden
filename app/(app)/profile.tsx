import { ActivityGrid } from '@/components/ActivityGrid';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistance } from '@/utils/formatters';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Helper function to get image source from path
const getImageSource = (imagePath: string) => {
  // Map image paths to actual require statements
  const imageMap: { [key: string]: any } = {
    'assets/images/plants/01.png': require('../../assets/images/plants/01.png'),
    'assets/images/plants/carrot.png': require('../../assets/images/plants/carrot.png'),
    'assets/images/plants/sakura.png': require('../../assets/images/plants/sakura.png'),
  };

  return imageMap[imagePath] || null;
};

interface ActivityWithPlant {
  _id: string;
  startDate: string;
  distance: number;
  duration: number;
  calories: number;
  workoutName?: string;
  plantEarned?: string;
  source?: string;
}

interface DayData {
  date: string;
  activities: ActivityWithPlant[];
  plantsEarned: any[];
}

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const currentUser = useQuery(api.userProfile.currentUser);
  // Convex queries
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const profileStats = useQuery(api.activities.getProfileStats);
  const activities = useQuery(api.activities.getUserActivitiesForYear, {
    year: new Date().getFullYear(),
    limit: 100,
  });

  // Get user's activities and plants for path functionality
  const pathActivities = useQuery(api.activities.getUserActivities, { days: 90, limit: 200 });
  const userPlants = useQuery(api.plants.getUserPlants);

  // Get the most recent activity for "Last run" display
  const lastRun = useMemo(() => {
    if (!pathActivities || pathActivities.length === 0) return null;
    return pathActivities[0]; // Activities are typically sorted by date descending
  }, [pathActivities]);

  // Get plant associated with the last run
  const lastRunPlant = useMemo(() => {
    if (!lastRun || !userPlants) return null;

    // Find the plant that was earned from the last run
    const plant = userPlants.find((plant: any) =>
      plant.earnedFromActivityId === lastRun._id
    );

    return plant;
  }, [lastRun, userPlants]);

  // Generate calendar days for the selected month
  const calendarDays = useMemo(() => {
    if (!pathActivities || !userPlants) return [];

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days: DayData[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];

      // Find activities for this day
      const dayActivities = pathActivities.filter((activity: ActivityWithPlant) => {
        const activityDate = new Date(activity.startDate).toISOString().split('T')[0];
        return activityDate === dateStr;
      });

      // Find plants earned on this day
      const plantsEarned = userPlants.filter((plant: any) => {
        if (!plant.earnedFromActivity) return false;
        const plantDate = new Date(plant.earnedFromActivity.startDate).toISOString().split('T')[0];
        return plantDate === dateStr;
      });

      days.push({
        date: dateStr,
        activities: dayActivities,
        plantsEarned,
      });
    }

    return days;
  }, [selectedMonth, pathActivities, userPlants]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMonth = new Date(selectedMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setSelectedMonth(newMonth);
  };

  const showDayDetails = (day: DayData) => {
    if (day.activities.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // If there's only one activity, navigate directly to detail page
    if (day.activities.length === 1) {
      router.push({
        pathname: '/activity-detail',
        params: {
          id: day.activities[0]._id
        }
      });
      return;
    }

    // If multiple activities, show alert with option to view each
    const totalDistance = day.activities.reduce((sum, act) => sum + act.distance, 0);
    const totalDuration = day.activities.reduce((sum, act) => sum + act.duration, 0);
    const plantsText = day.plantsEarned.length > 0
      ? `\n\n🌱 Plants earned: ${day.plantsEarned.map(p => p.plantType?.emoji || '🌱').join(' ')}`
      : '';

    Alert.alert(
      `📅 ${new Date(day.date).toLocaleDateString()}`,
      `🏃‍♂️ ${day.activities.length} runs\n` +
      `📏 ${formatDistance(totalDistance, 'metric')}\n` +
      `⏱️ ${Math.round(totalDuration)} minutes\n` +
      `🔥 ${day.activities.reduce((sum, act) => sum + act.calories, 0)} calories` +
      plantsText,
      [
        { text: 'Cancel', style: 'cancel' },
        ...day.activities.map((activity, index) => ({
          text: `View Run ${index + 1}`,
          onPress: () => {
            router.push({
              pathname: '/activity-detail',
              params: {
                id: activity._id
              }
            });
          }
        }))
      ]
    );
  };

  const getPlantEmoji = (day: DayData) => {
    if (day.plantsEarned.length === 0) return null;
    return day.plantsEarned[0]?.plantType?.emoji || '🌱';
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/');
  };

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  const formatDistanceForProfile = (meters: number) => {
    if (profile?.metricSystem === 'imperial') {
      const miles = meters * 0.000621371;
      return `${miles.toFixed(1)} mi`;
    }
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
  };

  const userName = currentUser?.name || profile?.firstName || 'Gardener';
  const totalDistance = profileStats?.totalDistance || 0;
  const totalWorkouts = profileStats?.totalWorkouts || 0;
  const totalCalories = profileStats?.totalCalories || 0;

  const monthName = selectedMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  });

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return selectedMonth.getMonth() === now.getMonth() &&
      selectedMonth.getFullYear() === now.getFullYear();
  }, [selectedMonth]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.userSubtitle}>Garden Runner 🌱</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <FontAwesome5 name="cog" size={20} color={Theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Garden Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Running Garden Stats</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <FontAwesome5 name="route" size={24} color={Theme.colors.accent.primary} />
              <Text style={styles.statValue}>{formatDistanceForProfile(totalDistance)}</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome5 name="running" size={24} color={Theme.colors.accent.secondary} />
              <Text style={styles.statValue}>{totalWorkouts}</Text>
              <Text style={styles.statLabel}>Total Runs</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome5 name="fire" size={24} color={Theme.colors.accent.secondary} />
              <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories Burned</Text>
            </View>
          </View>
        </View>

        {/* Last Run Card */}
        {lastRun && (
          <View style={styles.lastRunContainer}>
            <Text style={styles.sectionTitle}>Last Run</Text>
            <TouchableOpacity
              style={styles.lastRunCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/activity-detail',
                  params: {
                    id: lastRun._id
                  }
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.dayOfWeek}>
                {new Date(lastRun.startDate).toLocaleDateString('en-US', { weekday: 'long' })}
              </Text>
              <Text style={styles.runDate}>
                {new Date(lastRun.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>

              {/* Plant Illustration */}
              <View style={styles.treeContainer}>
                {(() => {
                  const imagePath = lastRunPlant?.plantType?.imagePath;
                  const imageSource = imagePath ? getImageSource(imagePath) : null;

                  if (imageSource) {
                    return (
                      <Image
                        source={imageSource}
                        style={styles.treeImage}
                        resizeMode="contain"
                      />
                    );
                  } else {
                    return (
                      <Text style={styles.treeEmoji}>
                        {lastRunPlant?.plantType?.emoji || '🌳'}
                      </Text>
                    );
                  }
                })()}
              </View>

              <Text style={styles.distanceText}>
                DISTANCE {formatDistance(lastRun.distance, 'metric')}
              </Text>
              <Text style={styles.paceText}>
                PACE {lastRun.duration > 0 ? Math.round((lastRun.duration / 60) / (lastRun.distance / 1000)) : 0}:{String(Math.round(((lastRun.duration / 60) / (lastRun.distance / 1000) % 1) * 60)).padStart(2, '0')} /km
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Monthly Calendar */}
        <View style={styles.calendarContainer}>
          <View style={styles.monthNavigation}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => navigateMonth('prev')}
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </TouchableOpacity>

            <Text style={styles.monthTitle}>{isCurrentMonth ? 'This month' : monthName}</Text>

            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => navigateMonth('next')}
            >
              <Text style={styles.monthButtonText}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Add empty cells for first week offset */}
            {Array.from({ length: new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() }, (_, i) => (
              <View key={`empty-${i}`} style={styles.calendarDay} />
            ))}

            {calendarDays.map((day, index) => {
              const plantEmoji = getPlantEmoji(day);
              const hasActivity = day.activities.length > 0;
              const dayNumber = new Date(day.date).getDate();

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.calendarDay,
                    hasActivity && styles.calendarDayWithActivity,
                    plantEmoji && styles.calendarDayWithPlant
                  ]}
                  onPress={() => showDayDetails(day)}
                  disabled={!hasActivity}
                  activeOpacity={0.7}
                >
                  {plantEmoji ? (
                    <Text style={styles.dayPlantEmoji}>{plantEmoji}</Text>
                  ) : (
                    <Text style={[
                      styles.dayNumber,
                      hasActivity && styles.dayNumberActive
                    ]}>
                      {dayNumber}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.activitiesContainer}>
          <Text style={styles.sectionTitle}>Recent Runs</Text>
          {activities && activities.length > 0 ? (
            <ActivityGrid
              activities={activities.slice(0, 6)}
              showPlants={true}
            />
          ) : (
            <View style={styles.emptyState}>
              <FontAwesome5 name="seedling" size={48} color={Theme.colors.text.secondary} />
              <Text style={styles.emptyStateText}>Start running to grow your garden!</Text>
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <FontAwesome5 name="sign-out-alt" size={18} color={Theme.colors.status.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Theme.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
  },
  settingsButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.colors.background.secondary,
  },
  statsContainer: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  lastRunContainer: {
    margin: 20,
    marginTop: 0,
  },
  lastRunCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  dayOfWeek: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  runDate: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    marginBottom: 20,
  },
  treeContainer: {
    marginVertical: 20,
  },
  treeEmoji: {
    fontSize: 80,
  },
  treeImage: {
    width: 80,
    height: 80,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: 1,
  },
  paceText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    letterSpacing: 1,
  },
  calendarContainer: {
    margin: 20,
    marginTop: 0,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonText: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.accent.primary,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: Theme.colors.accent.primary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  calendarDay: {
    width: '14.28%', // 100% / 7 days
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 20,
  },
  calendarDayWithActivity: {
    // Light green background for activity days
  },
  calendarDayWithPlant: {
    // Slightly darker green for plant days
  },
  dayNumber: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.accent.primary,
  },
  dayNumberActive: {
    color: '#000000',
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  dayPlantEmoji: {
    fontSize: 24,
  },
  activitiesContainer: {
    margin: 20,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.status.error,
  },
  signOutText: {
    fontSize: 16,
    color: Theme.colors.status.error,
    marginLeft: 8,
    fontWeight: '600',
  },
});
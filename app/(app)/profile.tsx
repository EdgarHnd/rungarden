import LoadingScreen from '@/components/LoadingScreen';
import PrimaryButton from '@/components/PrimaryButton';
import { Fonts } from '@/constants/Fonts';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistance, formatPace } from '@/utils/formatters';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAnalytics } from '@/provider/AnalyticsProvider';
import { getImageSource } from '@/utils/plantImageMapping';

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
  const analytics = useAnalytics();
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const currentUser = useQuery(api.userProfile.currentUser);
  // Convex queries
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';
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
      ? `\n\n🌱 Plants earned: ${day.plantsEarned.map(p => p.plantType?.name || 'Unknown Plant').join(', ')}`
      : '';

    Alert.alert(
      `📅 ${new Date(day.date).toLocaleDateString()}`,
      `🏃‍♂️ ${day.activities.length} runs\n` +
      `📏 ${formatDistance(totalDistance, metricSystem)}\n` +
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

  const getPlantData = (day: DayData) => {
    if (day.plantsEarned.length === 0) return null;
    return day.plantsEarned[0]?.plantType || null;
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

  const userName = profile?.firstName
    ? `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`
    : currentUser?.name || 'Gardener';
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
          <PrimaryButton
            title="Support"
            size="small"
            hapticFeedback="light"
            textTransform='none'
            icon={<FontAwesome5 name="headset" size={20} color={Theme.colors.background.primary} />}
            style={styles.supportButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/support');
            }}
          />
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

        {/* Centered Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{userName}</Text>

          {/* Integrated Stats */}
          <View style={styles.integratedStats}>
            <View style={styles.integratedStatItem}>
              <Text style={styles.integratedStatValue}>{formatDistanceForProfile(totalDistance)}</Text>
              <Text style={styles.integratedStatLabel}>Total Distance</Text>
            </View>

            <View style={styles.integratedStatItem}>
              <Text style={styles.integratedStatValue}>{totalWorkouts}</Text>
              <Text style={styles.integratedStatLabel}>Total Runs</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                analytics.track({
                  name: 'edit_profile_opened',
                  properties: {
                    from_screen: 'profile',
                  },
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/edit-profile');
              }}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="edit" size={16} color={Theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                analytics.track({
                  name: 'add_friend_opened',
                  properties: {
                    from_screen: 'profile',
                  },
                });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/add-friend');
              }}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="user-plus" size={16} color={Theme.colors.text.primary} />
              <Text style={styles.actionButtonText}>Add Friends</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Run Card */}
        {lastRun && (
          <View style={styles.lastRunContainer}>
            <View style={styles.lastRunHeader}>
              <Text style={styles.sectionTitle}>Last Run</Text>
              <TouchableOpacity
                style={styles.lastRunHeaderButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/activities');
                }}
              >
                <Text style={styles.lastRunHeaderButtonText}>View All</Text>
                <FontAwesome5 name="arrow-right" size={20} color={Theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
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
                <Image
                  source={getImageSource(lastRunPlant?.plantType?.imagePath, lastRunPlant?.plantType?.distanceRequired)}
                  style={styles.treeImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.distanceText}>
                DISTANCE {formatDistance(lastRun.distance, metricSystem)}
              </Text>
              <Text style={styles.paceText}>
                PACE {formatPace(lastRun.duration, lastRun.distance, metricSystem)}
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
              const plantData = getPlantData(day);
              const hasActivity = day.activities.length > 0;
              const dayNumber = new Date(day.date).getDate();

              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    styles.calendarDay,
                    hasActivity && styles.calendarDayWithActivity,
                    plantData && styles.calendarDayWithPlant
                  ]}
                  onPress={() => showDayDetails(day)}
                  disabled={!hasActivity}
                  activeOpacity={0.7}
                >
                  {plantData ? (
                    <Image
                      source={getImageSource(plantData.imagePath, plantData.distanceRequired)}
                      style={styles.dayPlantImage}
                      resizeMode="contain"
                    />
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
        {/* <View style={styles.activitiesContainer}>
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
        </View> */}
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 0,
  },
  supportButton: {
    // padding: 12,
    // borderRadius: 8,
    // flexDirection: 'row',
    // alignItems: 'center',
    // gap: 8,
    // backgroundColor: Theme.colors.accent.primary,
  },
  settingsButton: {
    padding: 12,
    borderRadius: 8,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Theme.colors.background.primary,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.text.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontFamily: Fonts.SFProRounded.Bold,
    color: 'white',
  },
  userName: {
    fontSize: 28,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: Fonts.SFProRounded.Semibold,
    color: Theme.colors.text.primary,
  },
  integratedStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 24,
  },
  integratedStatItem: {
    alignItems: 'center',
    gap: 8,
  },
  integratedStatValue: {
    fontSize: 20,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
  },
  integratedStatLabel: {
    fontSize: 14,
    fontFamily: Fonts.SFProRounded.Regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
  },
  lastRunContainer: {
    margin: 20,
    marginTop: 0,
  },
  lastRunCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.text.primary,
  },
  lastRunHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lastRunHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastRunHeaderButtonText: {
    fontSize: 16,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
  },
  dayOfWeek: {
    fontSize: 24,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  runDate: {
    fontSize: 16,
    fontFamily: Fonts.SFProRounded.Regular,
    color: Theme.colors.text.secondary,
    marginBottom: 20,
  },
  treeContainer: {
  },
  treeEmoji: {
    fontSize: 80,
  },
  treeImage: {
    width: 140,
    height: 140,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: 1,
  },
  paceText: {
    fontSize: 14,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
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
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
  },
  monthTitle: {
    fontSize: 18,
    fontFamily: Fonts.SFProRounded.Bold,
    color: Theme.colors.text.primary,
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
    fontFamily: Fonts.SFProRounded.Semibold,
    color: Theme.colors.text.primary,
  },
  dayNumberActive: {
    color: Theme.colors.text.primary,
    fontFamily: Fonts.SFProRounded.Bold,
  },
  dayPlantImage: {
    width: 32,
    height: 32,
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
    fontFamily: Fonts.SFProRounded.Regular,
    color: Theme.colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
});
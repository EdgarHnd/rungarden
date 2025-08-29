import { ActivityGrid } from '@/components/ActivityGrid';
import LoadingScreen from '@/components/LoadingScreen';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAuthActions } from "@convex-dev/auth/react";
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvexAuth, useQuery } from "convex/react";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const { signOut } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const currentUser = useQuery(api.userProfile.currentUser);
  // Convex queries
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const profileStats = useQuery(api.activities.getProfileStats);
  const activities = useQuery(api.activities.getUserActivitiesForYear, {
    year: new Date().getFullYear(),
    limit: 100,
  });

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await signOut();
    router.replace('/');
  };

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  const formatDistance = (meters: number) => {
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
            <FontAwesome5 name="cog" size={20} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Garden Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Running Garden Stats</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <FontAwesome5 name="route" size={24} color={Theme.colors.primary} />
              <Text style={styles.statValue}>{formatDistance(totalDistance)}</Text>
              <Text style={styles.statLabel}>Total Distance</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome5 name="running" size={24} color={Theme.colors.secondary} />
              <Text style={styles.statValue}>{totalWorkouts}</Text>
              <Text style={styles.statLabel}>Total Runs</Text>
            </View>

            <View style={styles.statCard}>
              <FontAwesome5 name="fire" size={24} color={Theme.colors.accent} />
              <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Calories Burned</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/add-friend');
            }}
          >
            <FontAwesome5 name="user-friends" size={20} color={Theme.colors.primary} />
            <Text style={styles.actionButtonText}>Add Friends</Text>
            <FontAwesome5 name="chevron-right" size={16} color={Theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/settings');
            }}
          >
            <FontAwesome5 name="cog" size={20} color={Theme.colors.primary} />
            <Text style={styles.actionButtonText}>Settings</Text>
            <FontAwesome5 name="chevron-right" size={16} color={Theme.colors.textSecondary} />
          </TouchableOpacity>
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
              <FontAwesome5 name="seedling" size={48} color={Theme.colors.textSecondary} />
              <Text style={styles.emptyStateText}>Start running to grow your garden!</Text>
            </View>
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <FontAwesome5 name="sign-out-alt" size={18} color={Theme.colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
    backgroundColor: Theme.colors.primary,
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
    color: Theme.colors.text,
    marginBottom: 4,
  },
  userSubtitle: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
  },
  settingsButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: Theme.colors.surface,
  },
  statsContainer: {
    margin: 20,
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Theme.colors.textSecondary,
    textAlign: 'center',
  },
  actionsContainer: {
    margin: 20,
    marginTop: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: Theme.colors.text,
    marginLeft: 12,
  },
  activitiesContainer: {
    margin: 20,
    marginTop: 0,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: Theme.colors.surface,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: Theme.colors.textSecondary,
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
    backgroundColor: Theme.colors.surface,
    borderWidth: 1,
    borderColor: Theme.colors.error,
  },
  signOutText: {
    fontSize: 16,
    color: Theme.colors.error,
    marginLeft: 8,
    fontWeight: '600',
  },
});
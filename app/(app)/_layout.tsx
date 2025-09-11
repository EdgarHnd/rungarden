import InitialSyncModal from '@/components/modals/InitialSyncModal';
import PlantCelebrationModal from '@/components/modals/PlantCelebrationModal';
import SyncLoadingModal from '@/components/modals/SyncLoadingModal';
import WelcomeModal from '@/components/modals/WelcomeModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useTrackNavigation } from '@/hooks/useTrackNavigation';
import { useSyncProvider } from '@/provider/SyncProvider';
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvex, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CelebrationData = {
  runData: {
    distance: number;
    duration: number;
    calories: number;
    startDate: string;
  } | null;
  plantData: {
    emoji: string;
    name: string;
  } | null;
}


export default function AppLayout() {
  useTrackNavigation();
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  // Initial Sync Modal state
  const [showInitialSyncModal, setShowInitialSyncModal] = useState(false);
  const [initialSyncResult, setInitialSyncResult] = useState<any>(null);

  // Welcome Modal state
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const pathname = usePathname();
  const convex = useConvex();

  // Get sync states from SyncProvider
  const { isHealthKitSyncing, isStravaSyncing } = useSyncProvider();

  // Query for activities that need celebration
  const uncelebratedActivities = useQuery(api.activities.getUncelebratedActivities);
  const markActivityCelebrated = useMutation(api.activities.markActivityCelebrated);

  // Mutations for initial sync modal
  const updateProfile = useMutation(api.userProfile.updateProfile);
  const markCurrentYearActivitiesCelebrated = useMutation(api.activities.markCurrentYearActivitiesCelebrated);

  // Track previous completion flags to edge-trigger the initial sync modal
  const initialSyncPrevRef = useRef<{ hk: boolean; st: boolean }>({ hk: false, st: false });
  const modalProcessingRef = useRef(false); // Prevent concurrent modal processing

  // Check for welcome modal - show for new users
  useEffect(() => {
    if (!profile) return;

    // Show welcome modal for new users who haven't seen it and don't have any sync enabled
    const shouldShowWelcome = !profile.hasSeenWelcomeModal &&
      !profile.healthKitSyncEnabled &&
      !profile.stravaSyncEnabled &&
      !showInitialSyncModal &&
      !modalProcessingRef.current;

    if (shouldShowWelcome) {
      console.log('[AppLayout] New user detected - showing welcome modal');
      setShowWelcomeModal(true);
    }
  }, [profile, showInitialSyncModal]);

  const checkInitialSyncModal = async () => {
    if (!profile) return;

    // Edge-trigger: only react when completion flag transitions from false -> true
    const hkCompleted = !!profile.healthKitInitialSyncCompleted;
    const stCompleted = !!profile.stravaInitialSyncCompleted;
    const prev = initialSyncPrevRef.current;
    const becameCompleted = (!prev.hk && hkCompleted) || (!prev.st && stCompleted);

    console.log('[AppLayout] Edge check:', {
      prev,
      current: { hk: hkCompleted, st: stCompleted },
      becameCompleted,
      alreadyProcessing: modalProcessingRef.current,
      showingModal: showInitialSyncModal,
      hasSeenModal: profile.hasSeenInitialSyncModal
    });

    // Update previous snapshot immediately
    initialSyncPrevRef.current = { hk: hkCompleted, st: stCompleted };

    // Skip if not an edge, already processing, or if already showing/seen
    if (!becameCompleted || modalProcessingRef.current || showInitialSyncModal || profile.hasSeenInitialSyncModal) {
      return;
    }

    console.log('[AppLayout] Initial sync needed - showing modal');
    modalProcessingRef.current = true;

    // Get activities from the past year to build celebration stats
    try {
      const recentActivities = await convex.query(api.activities.getUserActivities, {
        days: 365,
        limit: 1000
      });

      // Filter by sync source and calculate totals
      let sourceFilter: 'strava' | 'healthkit' | null = null;
      if (profile?.stravaSyncEnabled) sourceFilter = 'strava';
      else if (profile?.healthKitSyncEnabled) sourceFilter = 'healthkit';

      const sourceActivities = recentActivities.filter(a => a.source === sourceFilter);

      if (sourceActivities.length === 0) {
        console.log('[AppLayout] No activities found for initial sync modal');
        return;
      }

      const totalDistance = sourceActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
      const createdRuns = sourceActivities.length;

      // Get detailed plant information for activities with plants
      const activitiesWithPlants = sourceActivities.filter(a => a.plantEarned);

      // Get plant data efficiently using the new query
      let plantsEarned: any[] = [];
      if (activitiesWithPlants.length > 0) {
        try {
          const activityIds = activitiesWithPlants.map(a => a._id);
          plantsEarned = await convex.query(api.plants.getPlantsEarnedFromActivities, {
            activityIds
          });
          console.log('[AppLayout] Fetched plant data for', activitiesWithPlants.length, 'activities, got', plantsEarned.length, 'plant types');
        } catch (error) {
          console.error('[AppLayout] Error fetching plants for activities:', error);
          plantsEarned = [];
        }
      }

      // Show celebration modal with computed stats
      setInitialSyncResult({
        created: createdRuns,
        updated: 0,
        skipped: 0,
        distanceGained: totalDistance,
        plantsAwarded: activitiesWithPlants.length,
        plantsEarned: plantsEarned.length > 0 ? plantsEarned : undefined,
      });
      setShowInitialSyncModal(true);
      console.log('[AppLayout] Showing initial sync modal for', sourceFilter, 'with', createdRuns, 'activities and', plantsEarned.length, 'plant types');
    } catch (error) {
      console.error('[AppLayout] Error checking initial sync modal:', error);
      modalProcessingRef.current = false;
    }
  };
  // Check for initial sync modal - reactive to profile changes
  useEffect(() => {
    checkInitialSyncModal();
  }, [profile, convex]);

  // Check for uncelebrated activities - reactive to query changes
  useEffect(() => {
    if (uncelebratedActivities && uncelebratedActivities.length > 0 && !showCelebrationModal && !showInitialSyncModal) {
      const activity = uncelebratedActivities[0]; // Show celebration for the first uncelebrated activity

      console.log('[AppLayout] Found uncelebrated activity, showing celebration modal');

      setCelebrationData({
        runData: {
          distance: activity.distance,
          duration: activity.duration,
          calories: activity.calories,
          startDate: activity.startDate,
        },
        plantData: activity.plantData ? {
          emoji: activity.plantData.emoji,
          name: activity.plantData.name,
        } : null,
      });

      setShowCelebrationModal(true);
    }
  }, [uncelebratedActivities, showCelebrationModal, showInitialSyncModal]);

  // Also check when app becomes active
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        console.log('[AppLayout] App became active, rechecking modals');
        // The reactive useEffects above will automatically handle showing modals
        // when the queries update
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  const handlePlantAllFromInitialSync = async () => {
    try {
      console.log('[AppLayout] Planting all plants from initial sync');
      // The actual planting logic is handled by the existing celebration system
      // We just need to mark all current year activities as celebrated
      await markCurrentYearActivitiesCelebrated({});
    } catch (error) {
      console.error('[AppLayout] Error planting all from initial sync:', error);
    }
  };

  const createTabBarButton = (onPress: () => void) => {
    return ({ children, style, ...props }: any) => (
      <TouchableOpacity
        {...props}
        style={style}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  };

  // Check if we're on the index screen
  const isOnIndexScreen = pathname === '/' || pathname === '/index';

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            backgroundColor: Theme.colors.background.primary,
            height: 80,
            paddingBottom: 20,
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarBackground: () => (
            <View

            >
              <LinearGradient
                colors={[Theme.colors.background.primary + '00', Theme.colors.background.primary]}
                locations={[0, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{
                  position: 'absolute',
                  top: -100,
                  left: 0,
                  right: 0,
                  height: 100,
                }}
              />
            </View>
          ),
          tabBarShowLabel: false,
          tabBarLabelStyle: {
            fontSize: 16,
            fontFamily: 'SF-Pro-Rounded-Medium',
            marginTop: 5,
          },
          tabBarActiveTintColor: Theme.colors.accent.primary,
          tabBarInactiveTintColor: Theme.colors.text.muted,
        }}
      >
        <Tabs.Screen
          name="leaderboard"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="users" size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('leaderboard')),
          })}
        />
        <Tabs.Screen
          name="index"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="seedling" size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('index')),
          })}
        />
        <Tabs.Screen
          name="profile"
          options={({ navigation }) => ({
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5 name="user" solid size={size} color={color} />
            ),
            tabBarButton: createTabBarButton(() => navigation.navigate('profile')),
          })}
        />
      </Tabs>

      {/* Floating Record Run Button - Only show on index screen */}
      {isOnIndexScreen && (
        <TouchableOpacity
          style={styles.floatingButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/run');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.floatingButtonText}>Record Run</Text>
        </TouchableOpacity>
      )}

      {/* Plant Celebration Modal */}
      <PlantCelebrationModal
        visible={showCelebrationModal}
        runData={celebrationData?.runData || null}
        plantData={celebrationData?.plantData || null}
        onClose={async () => {
          console.log('[AppLayout] Closing celebration modal');

          // Mark the activity as celebrated
          if (uncelebratedActivities && uncelebratedActivities.length > 0) {
            const activity = uncelebratedActivities[0];
            await markActivityCelebrated({ activityId: activity._id });
            console.log('[AppLayout] Marked activity as celebrated:', activity._id);
          }

          setShowCelebrationModal(false);
          setCelebrationData(null);
        }}
        metricSystem={profile?.metricSystem || 'metric'}
        streakInfo={{
          currentStreak: 1, // TODO: Calculate actual streak
          longestStreak: 1, // TODO: Calculate actual streak
        }}
      />

      {/* Initial Sync Modal */}
      <InitialSyncModal
        visible={showInitialSyncModal}
        syncResult={initialSyncResult}
        onClose={async () => {
          try {
            await updateProfile({
              hasSeenInitialSyncModal: true,
            });
            console.log('[AppLayout] Marked initial sync modal as seen');

            // Clear any syncing states that might be stuck
            // This helps resolve modal conflicts after initial sync
            console.log('[AppLayout] Initial sync modal closed, states should be cleared by SyncProvider');
          } catch (error) {
            console.error('[AppLayout] Error marking initial sync modal as seen:', error);
          }
          setShowInitialSyncModal(false);
          setInitialSyncResult(null);
          modalProcessingRef.current = false;
        }}
        onPlantAll={async () => {
          await handlePlantAllFromInitialSync();
        }}
        metricSystem={profile?.metricSystem || 'metric'}
        source={profile?.stravaSyncEnabled ? "strava" : "healthkit"}
      />

      {/* Welcome Modal */}
      <WelcomeModal
        visible={showWelcomeModal}
        onClose={async () => {
          try {
            await updateProfile({
              hasSeenWelcomeModal: true,
            });
            console.log('[AppLayout] Marked welcome modal as seen');
          } catch (error) {
            console.error('[AppLayout] Error marking welcome modal as seen:', error);
          }
          setShowWelcomeModal(false);
        }}
      />

      {/* Sync Loading Modal - shows during initial sync */}
      <SyncLoadingModal
        visible={isHealthKitSyncing || isStravaSyncing}
        source={profile?.stravaSyncEnabled ? "strava" : "healthkit"}
      />
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    left: '50%',
    transform: [{ translateX: -75 }],
    width: 150,
    height: 50,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  floatingButtonText: {
    fontSize: 20,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.background.primary,
  },
});

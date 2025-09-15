import { api } from '@/convex/_generated/api';
import { useOnboardingSync } from '@/hooks/useOnboardingSync';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import DatabaseHealthService from '@/services/DatabaseHealthService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { trackRatingAction } from '@/services/RatingService';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';

interface SyncContextType {
  // Health Kit
  connectHealthKit: (options?: { autoSyncEnabled?: boolean }) => Promise<void>;
  disconnectHealthKit: () => Promise<void>;
  syncHealthKitManually: () => Promise<void>;

  // Strava
  connectStrava: () => Promise<void>;
  disconnectStrava: () => Promise<void>;
  syncStravaManually: () => Promise<void>;

  // Activity celebration trigger
  triggerCelebrationCheck: () => void;
  celebrationCheckTrigger: number;

  // States
  isHealthKitSyncing: boolean;
  isStravaSyncing: boolean;
  isConnecting: boolean;
}

const SyncContext = createContext<SyncContextType | null>(null);

export const useSyncProvider = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSyncProvider must be used within SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: React.ReactNode;
}

export default function SyncProvider({ children }: SyncProviderProps) {
  const analytics = useAnalytics();
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  // Services
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [stravaService, setStravaService] = useState<DatabaseStravaService | null>(null);

  // States
  const [isHealthKitSyncing, setIsHealthKitSyncing] = useState(false);
  const [isStravaSyncing, setIsStravaSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [celebrationCheckTrigger, setCelebrationCheckTrigger] = useState(0);

  // Auto-sync state
  const appState = useRef(AppState.currentState);
  const lastSyncTime = useRef<Date | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const createProfile = useMutation(api.userProfile.createProfile);

  // Process pending onboarding data after authentication
  useOnboardingSync();

  // User profile query for identification
  const currentUser = useQuery(api.userProfile.currentUser);

  // Identify user to analytics when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser && profile) {
      const userId = currentUser._id;
      const traits = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: currentUser.email,
        metricSystem: profile.metricSystem,
        createdAt: currentUser._creationTime,
      };

      analytics.identify(userId, traits);
    }
  }, [isAuthenticated, currentUser, profile, analytics]);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      if (isAuthenticated && convex) {
        const healthSvc = new DatabaseHealthService(convex);
        const stravaSvc = new DatabaseStravaService(convex);
        setHealthService(healthSvc);
        setStravaService(stravaSvc);

        // If profile query has loaded but returned null, create a profile
        if (profile === null) {
          try {
            await createProfile({});
          } catch (error) {
            console.error('[SyncProvider] Error creating profile:', error);
          }
        }
      }
    };

    initializeServices();
  }, [isAuthenticated, convex, createProfile, profile]);

  // Celebration trigger function
  const triggerCelebrationCheck = () => {
    setCelebrationCheckTrigger(prev => prev + 1);
  };

  // Auto-sync helper functions
  const shouldAutoSync = (): boolean => {
    if (!profile) return false;

    // Check if HealthKit is enabled and auto-sync is enabled
    const healthKitEnabled = profile.healthKitSyncEnabled;
    const stravaEnabled = profile.stravaSyncEnabled;
    const autoSyncEnabled = profile.autoSyncEnabled ?? true; // Default to true

    return autoSyncEnabled && Boolean(healthKitEnabled || stravaEnabled);
  };

  const isRecentSync = (): boolean => {
    if (!lastSyncTime.current) return false;

    const now = new Date();
    const timeDiff = now.getTime() - lastSyncTime.current.getTime();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    return timeDiff < fiveMinutes;
  };

  const performAutoSync = async (source: 'foreground' | 'background' | 'periodic'): Promise<void> => {
    if (!shouldAutoSync() || isRecentSync()) {
      return;
    }

    if (isHealthKitSyncing || isStravaSyncing || isConnecting) {
      return;
    }

    lastSyncTime.current = new Date();

    try {
      // Auto-sync HealthKit if enabled
      if (profile?.healthKitSyncEnabled && healthService) {
        setIsHealthKitSyncing(true);

        try {
          const syncResult = await healthService.syncActivitiesFromHealthKit(30, profile.healthKitSyncAnchor);

          // Update sync preferences with new anchor and last sync time
          if (syncResult.newAnchor) {
            await updateSyncPreferences({
              healthKitSyncAnchor: syncResult.newAnchor,
              lastHealthKitSync: new Date().toISOString()
            });
          }

          if (syncResult.created > 0 || syncResult.updated > 0) {
            // Only show haptic feedback for foreground syncs
            if (source === 'foreground') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            // Trigger celebration check after successful sync with new activities
            setTimeout(() => {
              triggerCelebrationCheck();
            }, 1000); // Small delay to ensure database operations complete
          }
        } catch (healthError) {
          console.error(`[SyncProvider] Auto-sync HealthKit (${source}) error:`, healthError);
        } finally {
          setIsHealthKitSyncing(false);
        }
      }

      // Auto-sync Strava if enabled
      if (profile?.stravaSyncEnabled && stravaService) {
        setIsStravaSyncing(true);

        try {
          const syncResult = await stravaService.syncActivitiesFromStrava();

          if (syncResult.created > 0 || syncResult.updated > 0) {
            // Only show haptic feedback for foreground syncs
            if (source === 'foreground') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        } catch (stravaError) {
          console.error(`[SyncProvider] Auto-sync Strava (${source}) error:`, stravaError);
        } finally {
          setIsStravaSyncing(false);
        }
      }
    } catch (error) {
      console.error(`[SyncProvider] Auto-sync (${source}) error:`, error);
    }
  };

  // App state change handler for auto-sync
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {

      // Sync when app comes to foreground
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Small delay to ensure everything is ready
        setTimeout(() => {
          performAutoSync('foreground');
        }, 1000);
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [profile, healthService, stravaService, isHealthKitSyncing, isStravaSyncing, isConnecting]);

  // Periodic sync setup
  useEffect(() => {
    if (!shouldAutoSync()) {
      // Clear any existing timeout if auto-sync is disabled
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return;
    }

    // Set up periodic sync every 30 minutes when app is active
    const setupPeriodicSync = () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(() => {
        if (AppState.currentState === 'active') {
          performAutoSync('periodic');
        }
        setupPeriodicSync(); // Reschedule
      }, 30 * 60 * 1000) as any; // 30 minutes
    };

    setupPeriodicSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [profile, healthService, stravaService]);

  const connectHealthKit = async (options?: { autoSyncEnabled?: boolean }) => {
    if (!healthService) {
      throw new Error('Health service not initialized');
    }

    try {
      analytics.track({
        name: 'healthkit_connection_started',
        properties: {
          auto_sync_enabled: options?.autoSyncEnabled ?? true,
        },
      });

      setIsConnecting(true);

      // Request HealthKit permissions
      if (Platform.OS === 'ios') {
        const hasPermissions = await healthService.initializeHealthKit();

        if (!hasPermissions) {
          const doubleCheck = await healthService.hasRequiredPermissions();
          if (!doubleCheck) {
            throw new Error('HealthKit permissions required. Please grant permissions in the Health app.');
          }
        }
      }

      // Check if Strava is currently enabled
      if (profile?.stravaSyncEnabled) {
        // Disable Strava first
        await updateSyncPreferences({
          stravaSyncEnabled: false,
          stravaAccessToken: undefined,
          stravaRefreshToken: undefined,
          stravaTokenExpiresAt: undefined,
          stravaAthleteId: undefined,
        });
      }

      // Enable HealthKit with auto-sync enabled by default
      await updateSyncPreferences({
        healthKitSyncEnabled: true,
        lastHealthKitSync: undefined,
        autoSyncEnabled: options?.autoSyncEnabled ?? true, // Default to true
      });

      // Check if this is the first sync
      const isFirstSync = !profile?.lastHealthKitSync && !profile?.healthKitInitialSyncCompleted;

      if (isFirstSync) {
        setIsHealthKitSyncing(true);

        // Perform initial sync in background
        setTimeout(async () => {
          try {
            const syncResult = await healthService.initialSyncFromHealthKit();

            // Always clear syncing state when sync completes successfully
            // The InitialSyncModal will show if there are results
            setIsHealthKitSyncing(false);

            // Always mark the sync as completed regardless of results
            try {
              await updateSyncPreferences({
                healthKitInitialSyncCompleted: true,
              });
            } catch (retryError) {
              console.warn('[SyncProvider] Could not mark initial sync completed, will retry later:', retryError);
            }

            if (syncResult && (syncResult.created > 0 || syncResult.updated > 0)) {

              // Trigger celebration check after initial sync completes
              // This is for cases where user might have activities that should show individual celebrations
              setTimeout(() => {
                triggerCelebrationCheck();
              }, 2000); // Longer delay for initial sync to ensure all processing completes
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (syncError) {
            console.error('[SyncProvider] Error during initial sync:', syncError);
            setIsHealthKitSyncing(false);
            Alert.alert('Sync Error', 'Initial sync failed, but you can manually sync later.');
          }
        }, 100);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Enable auto-sync for HealthKit
      if (healthService) {
        try {
          await healthService.enableAutoSync();
        } catch (autoSyncError) {
          console.warn('[SyncProvider] Could not enable auto-sync for HealthKit:', autoSyncError);
        }
      }


      // Track rating action for successful connection
      trackRatingAction();
    } catch (error: any) {
      console.error('[SyncProvider] Error connecting HealthKit:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectHealthKit = async () => {
    try {
      setIsConnecting(true);

      // Disable auto-sync for HealthKit
      if (healthService) {
        try {
          await healthService.disableAutoSync();
        } catch (autoSyncError) {
          console.warn('[SyncProvider] Could not disable auto-sync for HealthKit:', autoSyncError);
        }
      }

      await updateSyncPreferences({
        healthKitSyncEnabled: false,
        lastHealthKitSync: undefined,
        autoSyncEnabled: false,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const syncHealthKitManually = async () => {
    if (!profile?.healthKitSyncEnabled || !healthService) {
      throw new Error('HealthKit not connected');
    }

    try {
      analytics.track({
        name: 'healthkit_manual_sync_started',
        properties: {},
      });

      setIsHealthKitSyncing(true);
      const syncResult = await healthService.forceSyncFromHealthKitWithPlants(30);

      if (syncResult) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const plantsAwarded = syncResult.plantsAwarded || 0;

        // Track rating action for successful manual sync
        trackRatingAction();

        Alert.alert(
          'Sync Complete! 🌱',
          `Synced ${syncResult.created} new activities and updated ${syncResult.updated} existing ones.\n\n🌱 Plants awarded: ${plantsAwarded}\n\n${plantsAwarded > 0 ? 'Check your garden to see your new plants!' : 'Keep running to earn more plants!'}`
        );

        // Trigger celebration check after manual sync with new activities
        if (syncResult.created > 0) {
          setTimeout(() => {
            triggerCelebrationCheck();
          }, 1000); // Small delay to ensure database operations complete
        }
      }
    } finally {
      setIsHealthKitSyncing(false);
    }
  };

  const connectStrava = async () => {
    if (!stravaService) {
      throw new Error('Strava service not initialized');
    }

    try {
      analytics.track({
        name: 'strava_connection_started',
        properties: {},
      });

      setIsConnecting(true);

      // Check if HealthKit is currently enabled
      if (profile?.healthKitSyncEnabled) {
        // Disable HealthKit first
        await updateSyncPreferences({
          healthKitSyncEnabled: false,
          lastHealthKitSync: undefined,
          healthKitSyncAnchor: undefined,
        });
      }

      const success = await stravaService.authenticate();
      if (!success) {
        throw new Error('Strava authentication failed');
      }

      // Enable Strava
      await updateSyncPreferences({
        stravaSyncEnabled: true,
      });

      // Check if this is the first sync
      const isFirstSync = !profile?.lastStravaSync && !profile?.stravaInitialSyncCompleted;

      if (isFirstSync) {
        setIsStravaSyncing(true);

        // Perform initial sync in background
        setTimeout(async () => {
          try {
            const syncResult = await stravaService.initialSyncFromStrava();

            // Always clear syncing state when sync completes successfully
            // The InitialSyncModal will show regardless of results
            setIsStravaSyncing(false);

            // Always mark the sync as completed regardless of results
            try {
              await updateSyncPreferences({
                stravaInitialSyncCompleted: true,
              });
            } catch (retryError) {
              console.warn('[SyncProvider] Could not mark Strava initial sync completed:', retryError);
            }

            if (syncResult && (syncResult.created > 0 || syncResult.updated > 0)) {
            } else {
            }

            // Setup webhook
            try {
              const webhookResult = await stravaService.setupWebhook();
              if (webhookResult?.success) {
              } else {
                console.warn('[SyncProvider] Webhook setup failed:', webhookResult?.message);
              }
            } catch (webhookError) {
              console.error('[SyncProvider] Webhook setup error:', webhookError);
            }
          } catch (syncError) {
            console.error('[SyncProvider] Error during initial Strava sync:', syncError);
            setIsStravaSyncing(false);
            Alert.alert('Sync Error', 'Initial sync failed, but you can manually sync later.');
          }
        }, 100);
      } else {
        // Regular connection, just setup webhook
        try {
          const webhookResult = await stravaService.setupWebhook();
          if (webhookResult?.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            console.warn('[SyncProvider] Webhook setup failed:', webhookResult?.message);
          }
        } catch (webhookError) {
          console.error('[SyncProvider] Webhook setup error:', webhookError);
        }
      }


      // Track rating action for successful connection
      trackRatingAction();
    } catch (error: any) {
      console.error('[SyncProvider] Error connecting Strava:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectStrava = async () => {
    try {
      setIsConnecting(true);
      if (stravaService) {
        await stravaService.disconnect();
      }
      await updateSyncPreferences({
        stravaSyncEnabled: false,
        stravaAccessToken: undefined,
        stravaRefreshToken: undefined,
        stravaTokenExpiresAt: undefined,
        stravaAthleteId: undefined,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const syncStravaManually = async () => {
    if (!profile?.stravaSyncEnabled || !stravaService) {
      throw new Error('Strava not connected');
    }

    try {
      setIsStravaSyncing(true);
      const syncResult = await stravaService.forceSyncFromStrava();

      if (syncResult) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const plantsAwarded = syncResult.plantsAwarded || 0;

        // Track rating action for successful manual sync
        trackRatingAction();

        Alert.alert(
          'Sync Complete! 🌱',
          `Synced ${syncResult.created} new activities and updated ${syncResult.updated} existing ones.\n\n🌱 Plants awarded: ${plantsAwarded}\n\n${plantsAwarded > 0 ? 'Check your garden to see your new plants!' : 'Keep running to earn more plants!'}`
        );
      }
    } finally {
      setIsStravaSyncing(false);
    }
  };

  // Note: Syncing states are now cleared immediately when sync completes
  // This ensures proper coordination between SyncLoadingBadge and InitialSyncModal

  const contextValue: SyncContextType = {
    connectHealthKit,
    disconnectHealthKit,
    syncHealthKitManually,
    connectStrava,
    disconnectStrava,
    syncStravaManually,
    triggerCelebrationCheck,
    celebrationCheckTrigger,
    isHealthKitSyncing,
    isStravaSyncing,
    isConnecting,
  };

  return (
    <SyncContext.Provider value={contextValue}>
      {children}
    </SyncContext.Provider>
  );
}

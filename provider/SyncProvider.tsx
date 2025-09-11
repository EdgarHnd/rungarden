import { api } from '@/convex/_generated/api';
import DatabaseHealthService from '@/services/DatabaseHealthService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { useConvex, useConvexAuth, useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

interface SyncContextType {
  // Health Kit
  connectHealthKit: () => Promise<void>;
  disconnectHealthKit: () => Promise<void>;
  syncHealthKitManually: () => Promise<void>;

  // Strava
  connectStrava: () => Promise<void>;
  disconnectStrava: () => Promise<void>;
  syncStravaManually: () => Promise<void>;

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
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  // Services
  const [healthService, setHealthService] = useState<DatabaseHealthService | null>(null);
  const [stravaService, setStravaService] = useState<DatabaseStravaService | null>(null);

  // States
  const [isHealthKitSyncing, setIsHealthKitSyncing] = useState(false);
  const [isStravaSyncing, setIsStravaSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Queries and mutations
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);
  const createProfile = useMutation(api.userProfile.createProfile);

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

  const connectHealthKit = async () => {
    if (!healthService) {
      throw new Error('Health service not initialized');
    }

    try {
      setIsConnecting(true);
      console.log('[SyncProvider] Starting HealthKit connection...');

      // Request HealthKit permissions
      if (Platform.OS === 'ios') {
        const hasPermissions = await healthService.initializeHealthKit();
        console.log('[SyncProvider] HealthKit permissions check:', hasPermissions);

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

      // Enable HealthKit
      await updateSyncPreferences({
        healthKitSyncEnabled: true,
        lastHealthKitSync: undefined,
      });

      // Check if this is the first sync
      const isFirstSync = !profile?.lastHealthKitSync && !profile?.healthKitInitialSyncCompleted;

      if (isFirstSync) {
        console.log('[SyncProvider] Starting initial HealthKit sync...');
        setIsHealthKitSyncing(true);

        // Perform initial sync in background
        setTimeout(async () => {
          try {
            const syncResult = await healthService.initialSyncFromHealthKit();
            console.log('[SyncProvider] Initial HealthKit sync completed:', syncResult);

            // Always clear syncing state when sync completes successfully
            // The InitialSyncModal will show if there are results
            setIsHealthKitSyncing(false);

            if (syncResult && (syncResult.created > 0 || syncResult.updated > 0)) {
              console.log('[SyncProvider] Initial sync successful, modal will show');
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

      console.log('[SyncProvider] HealthKit connected successfully');
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
      await updateSyncPreferences({
        healthKitSyncEnabled: false,
        lastHealthKitSync: undefined,
      });
      console.log('[SyncProvider] HealthKit disconnected');
    } finally {
      setIsConnecting(false);
    }
  };

  const syncHealthKitManually = async () => {
    if (!profile?.healthKitSyncEnabled || !healthService) {
      throw new Error('HealthKit not connected');
    }

    try {
      setIsHealthKitSyncing(true);
      const syncResult = await healthService.forceSyncFromHealthKitWithPlants(30);

      if (syncResult) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const plantsAwarded = syncResult.plantsAwarded || 0;
        Alert.alert(
          'Sync Complete! 🌱',
          `Synced ${syncResult.created} new activities and updated ${syncResult.updated} existing ones.\n\n🌱 Plants awarded: ${plantsAwarded}\n\n${plantsAwarded > 0 ? 'Check your garden to see your new plants!' : 'Keep running to earn more plants!'}`
        );
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
      setIsConnecting(true);
      console.log('[SyncProvider] Starting Strava connection...');

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
        console.log('[SyncProvider] Starting initial Strava sync...');
        setIsStravaSyncing(true);

        // Perform initial sync in background
        setTimeout(async () => {
          try {
            const syncResult = await stravaService.initialSyncFromStrava();
            console.log('[SyncProvider] Initial Strava sync completed:', syncResult);

            // Always clear syncing state when sync completes successfully
            // The InitialSyncModal will show if there are results
            setIsStravaSyncing(false);

            if (syncResult && (syncResult.created > 0 || syncResult.updated > 0)) {
              console.log('[SyncProvider] Initial Strava sync successful, modal will show');
            }

            // Setup webhook
            try {
              const webhookResult = await stravaService.setupWebhook();
              if (webhookResult?.success) {
                console.log('[SyncProvider] Webhook setup successful:', webhookResult.id);
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
            console.log('[SyncProvider] Webhook setup successful:', webhookResult.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } else {
            console.warn('[SyncProvider] Webhook setup failed:', webhookResult?.message);
          }
        } catch (webhookError) {
          console.error('[SyncProvider] Webhook setup error:', webhookError);
        }
      }

      console.log('[SyncProvider] Strava connected successfully');
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
      console.log('[SyncProvider] Strava disconnected');
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
  // This ensures proper coordination between SyncLoadingModal and InitialSyncModal

  const contextValue: SyncContextType = {
    connectHealthKit,
    disconnectHealthKit,
    syncHealthKitManually,
    connectStrava,
    disconnectStrava,
    syncStravaManually,
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

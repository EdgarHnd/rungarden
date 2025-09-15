import { Theme } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useSyncProvider } from '@/provider/SyncProvider';
import { FontAwesome5 } from '@expo/vector-icons';
import { useConvex, useMutation, useQuery } from 'convex/react';
import { Asset } from 'expo-asset';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { formatDate, formatPlantDistance } from '../utils/formatters';
import {
  DEFAULT_GRID_CONFIG,
  GridPosition
} from '../utils/isometricGrid';
import DraggablePlant from './DraggablePlant';
import GardenCanvas from './GardenCanvas';
import IsometricPlatform from './IsometricPlatform';
import InitialSyncModal from './modals/InitialSyncModal';
import PlantCelebrationModal from './modals/PlantCelebrationModal';
import PrimaryButton from './PrimaryButton';

const { width: screenWidth } = Dimensions.get('window');

import { CLASSIC_PLANT_IMAGES, getImageSource } from '../utils/plantImageMapping';
import LoadingScreen from './LoadingScreen';

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  earnedFromActivityId?: string;
  gridPosition?: { row: number; col: number };
  currentStage: number;
  waterLevel: number;
  isWilted?: boolean;

  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    distanceRequired?: number;
    growthStages: Array<{ stage: number; name: string; emoji: string }>;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';
    category?: string;
    description?: string;
    _id?: string;
    _creationTime?: number;
  } | null;
}

interface PlantInventoryItem {
  _id: string;
  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
}




export default function GardenView() {
  const analytics = useAnalytics();
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [showInitialSyncModal, setShowInitialSyncModal] = useState(false);
  const [debugSyncResult, setDebugSyncResult] = useState<any>(null);
  const [shouldAnimatePlants, setShouldAnimatePlants] = useState(true);
  const [imagesReady, setImagesReady] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    action?: string;
  }>({
    show: false,
    title: '',
    message: '',
  });

  const [selectedPlantDetails, setSelectedPlantDetails] = useState<PlantInGarden | null>(null);

  // Screen dimensions
  const screen = Dimensions.get('window');

  // Queries
  const gardenLayout = useQuery(api.garden.getGardenLayout);
  const gardenPlants = useQuery(api.garden.getGardenPlants);
  const plantInventory = useQuery(api.garden.getPlantInventory);

  // Get user profile for metric system preference
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const metricSystem = (profile?.metricSystem ?? 'metric') as 'metric' | 'imperial';

  // Convex client for manual queries
  const convex = useConvex();

  // Get celebration trigger from SyncProvider
  const { triggerCelebrationCheck } = useSyncProvider();

  // Get activity data for selected plant
  const selectedPlantActivity = useQuery(
    api.activities.getActivityById,
    selectedPlantDetails?.earnedFromActivityId
      ? { activityId: selectedPlantDetails.earnedFromActivityId as any }
      : 'skip'
  );

  // Mutations
  const initializeGarden = useMutation(api.garden.initializeGarden);
  const updatePlantInGarden = useMutation(api.garden.updatePlantInGarden);

  // Debug mutations - temporarily use the sync function directly
  const syncActivitiesFromHealthKit = useMutation(api.activities.syncActivitiesFromHealthKit);
  const resetAllData = useMutation(api.migration.resetAllData);
  const resetPlants = useMutation(api.migration.resetPlants);
  const resetActivities = useMutation(api.migration.resetActivities);
  const resetGardensOnly = useMutation(api.migration.resetGardensOnly);
  const resetUserProfiles = useMutation(api.migration.resetUserProfiles);
  const getDataCounts = useQuery(api.migration.getDataCounts);

  // Initialize garden on first load
  useEffect(() => {
    if (gardenLayout === null || gardenLayout === undefined) {
      // No garden exists, initialize one
      initializeGarden().catch(console.error);
    }
  }, [gardenLayout, initializeGarden]);

  // Function to trigger new plant animations (can be called when plants are added)
  const triggerPlantAnimations = useCallback(() => {
    setShouldAnimatePlants(true);

    // Auto-reset after animations complete
    const resetTimer = setTimeout(() => {
      setShouldAnimatePlants(false);
    }, 3000);

    return () => clearTimeout(resetTimer);
  }, []);

  // Trigger animations when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Add a small delay to ensure the screen is fully rendered
      const focusTimer = setTimeout(() => {
        if (gardenPlants && gardenPlants.length > 0 && imagesReady) {
          triggerPlantAnimations();
        }
      }, 300); // 300ms delay for smooth transition

      return () => clearTimeout(focusTimer);
    }, [gardenPlants?.length, imagesReady, triggerPlantAnimations])
  );

  // Calculate animation delays for chained effect
  const getPlantAnimationDelay = (plant: PlantInGarden, index: number) => {
    if (!shouldAnimatePlants) return 0;

    // Create a beautiful wave-like animation pattern across the garden
    const row = plant.gridPosition?.row || 0;
    const col = plant.gridPosition?.col || 0;

    // Create multiple wave patterns for more organic feel
    const centerRow = 2;
    const centerCol = 2;

    // Primary wave: Distance from center
    const distanceFromCenter = Math.sqrt(
      Math.pow(row - centerRow, 2) + Math.pow(col - centerCol, 2)
    );

    // Secondary wave: Diagonal pattern
    const diagonalDistance = Math.abs(row - col);

    // Tertiary wave: Spiral pattern
    const angle = Math.atan2(row - centerRow, col - centerCol);
    const spiralOffset = (angle + Math.PI) / (2 * Math.PI) * 300;

    // Combine all patterns
    const baseDelay = distanceFromCenter * 120;
    const diagonalDelay = diagonalDistance * 50;
    const spiralDelay = spiralOffset;

    // Add controlled randomness for natural variation
    const plantSeed = plant._id.charCodeAt(0) % 100;
    const randomOffset = (plantSeed / 100) * 80;

    const totalDelay = baseDelay + diagonalDelay * 0.3 + spiralDelay * 0.2 + randomOffset;

    return Math.max(0, totalDelay);
  };

  // Reset animations when plants change significantly
  useEffect(() => {
    if (gardenPlants && gardenPlants.length > 0 && imagesReady) {
      // Trigger animations on initial load or when new plants are added
      setShouldAnimatePlants(true);

      // Reset animation flag after all animations should be complete
      const maxDelay = gardenPlants.reduce((max, plant, index) => {
        return Math.max(max, getPlantAnimationDelay(plant, index));
      }, 0);

      const resetTimer = setTimeout(() => {
        setShouldAnimatePlants(false);
      }, maxDelay + 2000); // Give extra time for animations to complete

      return () => {
        clearTimeout(resetTimer);
      };
    }
  }, [gardenPlants?.length, imagesReady]); // Only trigger when plant count changes

  // Preload all plant images used in the current garden
  useEffect(() => {
    let isMounted = true;
    const preload = async () => {
      try {
        if (!gardenPlants || gardenPlants.length === 0) {
          if (isMounted) setImagesReady(true);
          return;
        }

        // Collect unique image asset paths from plant types
        const paths = Array.from(new Set(
          gardenPlants
            .map(p => p.plantType?.imagePath)
            .filter(Boolean) as string[]
        ));

        // Map paths to static requires to allow Asset loading
        const requireMap: Record<string, any> = {
          'assets/images/plants/01.png': require('../assets/images/plants/01.png'),
          'assets/images/plants/carrot.png': require('../assets/images/plants/carrot.png'),
          'assets/images/plants/sakura.png': require('../assets/images/plants/sakura.png'),
          'assets/images/plants/dandelion.png': require('../assets/images/plants/dandelion.png'),
          ...CLASSIC_PLANT_IMAGES
        };

        const assets = paths.map(p => {
          // Check if it's a classic plant path
          const classicMatch = p.match(/classic\/(\d+)\.png$/);
          if (classicMatch) {
            const kmDistance = classicMatch[1];
            return CLASSIC_PLANT_IMAGES[kmDistance] ?? require('../assets/images/plants/dandelion.png');
          }
          return requireMap[p] ?? require('../assets/images/plants/dandelion.png');
        });

        // If no mapped assets, still mark ready
        if (assets.length === 0) {
          if (isMounted) setImagesReady(true);
          return;
        }

        await Asset.loadAsync(assets);
        if (isMounted) setImagesReady(true);
      } catch (e) {
        if (isMounted) setImagesReady(true);
      }
    };

    setImagesReady(false);
    preload();
    return () => { isMounted = false; };
  }, [gardenPlants?.length]);



  // Handle grid tap (no longer used for manual planting)
  const handleGridTap = (gridPosition: GridPosition) => {
    // Grid taps no longer trigger manual planting since we have auto-planting
  };

  // Handle plant tap - show plant details modal
  const handlePlantTap = (plant: PlantInGarden) => {
    try {
      analytics.track({
        name: 'plant_tapped',
        properties: {
          plant_type: plant.plantType?.name,
          plant_rarity: plant.plantType?.rarity,
          plant_stage: plant.currentStage,
          has_activity: !!plant.earnedFromActivityId,
        },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPlantDetails(plant);
    } catch (error) {
      console.error('Error showing plant details:', error);
    }
  };





  // Grid plant interaction handlers
  const handlePlantGridPositionChange = async (plantId: string, gridPosition: GridPosition) => {
    if (!gardenLayout) return;

    const plant = gardenPlants?.find(p => p._id === plantId);

    try {
      analytics.track({
        name: 'plant_moved',
        properties: {
          plant_type: plant?.plantType?.name,
          plant_rarity: plant?.plantType?.rarity,
          from_position: plant?.gridPosition,
          to_position: gridPosition,
        },
      });

      // In simplified grid, all positions are available
      await updatePlantInGarden({
        plantId: plantId as any,
        gridPosition,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      showErrorModal(
        '❌ Move Failed',
        error?.message || 'Could not move your plant to that position.',
        'Try Again'
      );
    }
  };



  const showErrorModal = (title: string, message: string, action?: string) => {
    setErrorModal({
      show: true,
      title,
      message,
      action,
    });
  };

  const hideErrorModal = () => {
    setErrorModal({
      show: false,
      title: '',
      message: '',
    });
  };



  const openStash = () => {
    analytics.track({
      name: 'stash_opened',
      properties: {
        from_screen: 'garden',
      },
    });
    router.push('/stash');
  };


  const confirmResetAllData = async () => {
    try {
      showErrorModal(
        '🔄 Resetting Data...',
        'Starting reset process. This may take a moment...',
        'Please Wait'
      );

      let totalDeleted = 0;
      let totalProfilesReset = 0;
      let totalGardensDeleted = 0;
      let totalPlantTypesDeleted = 0;

      // Step 1: Reset plants in batches
      let hasMorePlants = true;
      let plantsDeleted = 0;
      while (hasMorePlants) {
        const result = await resetPlants({});
        plantsDeleted += result.deleted;
        totalDeleted += result.deleted;
        hasMorePlants = result.hasMore;

        if (hasMorePlants) {
          // Small delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Step 2: Reset activities in batches
      let hasMoreActivities = true;
      let activitiesDeleted = 0;
      while (hasMoreActivities) {
        const result = await resetActivities({});
        activitiesDeleted += result.deleted;
        totalDeleted += result.deleted;
        hasMoreActivities = result.hasMore;

        if (hasMoreActivities) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Step 3: Reset gardens only (preserve plant types)
      const gardensResult = await resetGardensOnly({});
      totalGardensDeleted = gardensResult.gardensDeleted;
      totalPlantTypesDeleted = 0; // Plant types are preserved
      totalDeleted += gardensResult.gardensDeleted;

      // Step 4: Reset user profiles
      const profilesResult = await resetUserProfiles({});
      totalProfilesReset = profilesResult.profilesReset;

      showErrorModal(
        '✅ Reset Complete!',
        `Successfully reset all data:\n• ${plantsDeleted} plants deleted\n• ${activitiesDeleted} activities deleted\n• ${totalGardensDeleted} gardens deleted\n• Plant types preserved ✨\n• ${totalProfilesReset} profiles reset\n\nTotal: ${totalDeleted} items deleted`,
        'Done'
      );

    } catch (error) {
      console.error('Reset failed:', error);
      showErrorModal(
        '❌ Reset Failed',
        `Reset failed: ${error}`,
        'OK'
      );
    }
  };

  // Generate real sync result data for debug modal
  const generateDebugSyncResult = async () => {
    try {
      if (!profile) {
        return null;
      }

      // Get activities from the past year using the same logic as app layout
      const recentActivities = await convex.query(api.activities.getUserActivities, {
        days: 365,
        limit: 1000
      });

      // Filter by sync source
      let sourceFilter: 'strava' | 'healthkit' | null = null;
      if (profile?.stravaSyncEnabled) sourceFilter = 'strava';
      else if (profile?.healthKitSyncEnabled) sourceFilter = 'healthkit';

      const sourceActivities = recentActivities.filter(a => a.source === sourceFilter);

      if (sourceActivities.length === 0) {
        return {
          created: 0,
          updated: 0,
          skipped: 0,
          distanceGained: 0,
          plantsAwarded: 0,
          plantsEarned: []
        };
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
        } catch (error) {
          console.error('[GardenView] Error fetching plants for activities:', error);
          plantsEarned = [];
        }
      }

      return {
        created: createdRuns,
        updated: 0,
        skipped: 0,
        distanceGained: totalDistance,
        plantsAwarded: activitiesWithPlants.length,
        plantsEarned: plantsEarned.length > 0 ? plantsEarned : undefined,
      };
    } catch (error) {
      console.error('[GardenView] Error generating debug sync result:', error);
      return null;
    }
  };

  // Debug functions for testing
  const createFakeActivity = async (distance: number) => {
    try {
      setShowDebugModal(false);

      const now = new Date();
      const fakeActivity = {
        healthKitUuid: `debug-${Date.now()}`,
        startDate: now.toISOString(),
        endDate: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min later
        duration: Math.max(Math.round(distance / 100), 5), // Rough pace calculation, min 5 minutes
        distance: distance,
        calories: Math.round(distance * 0.06), // Rough estimate
        workoutName: `Debug Run ${(distance / 1000).toFixed(1)}km`,
      };

      const result = await syncActivitiesFromHealthKit({
        activities: [fakeActivity],
        initialSync: false,
      });

      // Trigger celebration check after debug activity creation
      setTimeout(() => {
        triggerCelebrationCheck();
      }, 1000); // Small delay to ensure database operations complete

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '🧪 Debug Activity Created!',
        `Created a ${(distance / 1000).toFixed(1)}km debug run! Check your garden and activities for new plants.`,
        'Awesome!'
      );
    } catch (error) {
      console.error('Debug activity creation failed:', error);
      showErrorModal(
        '🧪 Debug Failed',
        `Failed to create debug activity: ${error}`,
        'Try Again'
      );
    }
  };



  if (!gardenLayout) {
    return (
      <LoadingScreen />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={__DEV__ ? () => setShowDebugModal(true) : undefined} activeOpacity={0.7}>
          <Text style={styles.title}>RunGarden</Text>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <PrimaryButton
            title="Plants"
            onPress={openStash}
            size="small"
            hapticFeedback="light"
            icon={<FontAwesome5 name="seedling" size={20} color={Theme.colors.background.primary} />}
            textTransform='none'
          />
        </View>
      </View>


      {/* Garden Canvas */}
      <GardenCanvas
        onGridTap={handleGridTap}
        onDoubleTap={() => {
          // Simple haptic feedback on double-tap
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          triggerPlantAnimations();
        }}
        unlockedTiles={[]} // All tiles are available in simplified grid
        showGrid={false}
      >
        {/* Isometric platform (background) */}
        <IsometricPlatform
          gridConfig={DEFAULT_GRID_CONFIG}
        />
        {/* Render planted plants with chained animations */}
        {gardenPlants?.filter(plant => plant.plantType !== null).map((plant, index) => (
          <DraggablePlant
            key={plant._id}
            plant={plant as PlantInGarden}
            onGridPositionChange={handlePlantGridPositionChange}
            onPlantTap={handlePlantTap}
            unlockedTiles={[]} // All tiles are available in simplified grid
            animationDelay={getPlantAnimationDelay(plant, index)}
            shouldAnimate={shouldAnimatePlants}
          />
        ))}
      </GardenCanvas>



      {/* Error Modal */}
      {errorModal.show && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>{errorModal.title}</Text>
            <Text style={styles.errorMessage}>{errorModal.message}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => {
                hideErrorModal();
              }}
            >
              <Text style={styles.errorButtonText}>
                {errorModal.action || 'OK'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Plant Details Modal */}
      {selectedPlantDetails && (
        <View style={styles.errorOverlay}>
          <View style={styles.plantModal}>
            <Image
              source={getImageSource(selectedPlantDetails.plantType?.imagePath, selectedPlantDetails.plantType?.distanceRequired)}
              style={styles.plantImage}
              resizeMode="contain"
            />
            <Text style={styles.plantName}>{selectedPlantDetails.plantType?.name || 'Unknown Plant'}</Text>

            {/* Distance Required */}
            {selectedPlantDetails.plantType?.distanceRequired && (
              <Text style={styles.plantDistance}>
                Distance required: {formatPlantDistance(selectedPlantDetails.plantType.distanceRequired, metricSystem)}
              </Text>
            )}

            {/* Run Date */}
            {selectedPlantDetails.earnedFromActivityId && selectedPlantActivity && (
              <Text style={styles.plantDate}>
                Planted on {formatDate(selectedPlantActivity.startDate)}
              </Text>
            )}

            <View style={styles.modalButtonsContainer}>
              <PrimaryButton
                title="Close"
                onPress={() => setSelectedPlantDetails(null)}
                size="small"
                variant="secondary"
                hapticFeedback="light"
                style={styles.modalButton}
                textTransform="none"
              />
              {selectedPlantDetails.earnedFromActivityId && (
                <PrimaryButton
                  title="View Run"
                  onPress={() => {
                    setSelectedPlantDetails(null);
                    router.push({
                      pathname: '/activity-detail',
                      params: {
                        id: selectedPlantDetails.earnedFromActivityId
                      }
                    });
                  }}
                  size="small"
                  variant="primary"
                  hapticFeedback="light"
                  textTransform="none"
                  style={styles.modalButton}
                />
              )}
            </View>
          </View>
        </View>
      )}

      {/* Debug Modal */}
      {__DEV__ && showDebugModal && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>🧪 Debug Mode</Text>
            <Text style={styles.errorMessage}>
              Current data: {getDataCounts?.plants || 0} plants, {getDataCounts?.activities || 0} activities, {getDataCounts?.gardens || 0} gardens
            </Text>
            <View style={styles.debugButtonsContainer}>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  setShowDebugModal(false);
                  Alert.prompt(
                    'Create Debug Run',
                    'Enter distance in km:',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Create',
                        onPress: (text) => {
                          const km = parseFloat(text || '5');
                          if (!isNaN(km) && km > 0) {
                            createFakeActivity(km * 1000);
                          }
                        }
                      }
                    ],
                    'plain-text',
                    '5'
                  );
                }}
              >
                <Text style={styles.debugButtonText}>Create Activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  setShowDebugModal(false);
                  setShowCelebrationModal(true);
                }}
              >
                <Text style={styles.debugButtonText}>Show Celebration</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  setShowDebugModal(false);
                  triggerPlantAnimations();
                }}
              >
                <Text style={styles.debugButtonText}>Trigger Plant Animations</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={async () => {
                  setShowDebugModal(false);

                  // Generate real sync result data
                  showErrorModal(
                    '🔄 Loading...',
                    'Generating real sync data from your activities...',
                    'Please Wait'
                  );

                  const syncResult = await generateDebugSyncResult();
                  hideErrorModal();

                  if (syncResult) {
                    setDebugSyncResult(syncResult);
                    setShowInitialSyncModal(true);
                  } else {
                    showErrorModal(
                      '❌ Debug Failed',
                      'Could not generate debug sync result. Make sure you have some activities with plants.',
                      'OK'
                    );
                  }
                }}
              >
                <Text style={styles.debugButtonText}>Show Initial Sync (Real Data)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.debugButton, styles.resetAllButton]}
                onPress={() => {
                  setShowDebugModal(false);
                  Alert.alert(
                    '⚠️ DANGER: Reset All Data',
                    'This will permanently delete ALL plants, activities, and gardens for ALL users. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'RESET ALL',
                        style: 'destructive',
                        onPress: confirmResetAllData
                      }
                    ]
                  );
                }}
              >
                <Text style={styles.debugButtonText}>⚠️ RESET ALL DATA</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setShowDebugModal(false)}
            >
              <Text style={styles.errorButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Initial Sync Modal */}
      <InitialSyncModal
        visible={showInitialSyncModal}
        syncResult={debugSyncResult}
        onClose={async () => {
          setShowInitialSyncModal(false);
          setDebugSyncResult(null);
        }}
        onPlantAll={async () => {
          setShowInitialSyncModal(false);
          setDebugSyncResult(null);
          // In a real scenario, this would plant all the earned plants
        }}
        metricSystem={metricSystem}
        source={profile?.stravaSyncEnabled ? "strava" : "healthkit"}
      />

      {/* Plant Celebration Modal */}
      <PlantCelebrationModal
        visible={showCelebrationModal}
        runData={{
          distance: 5000,
          duration: 30,
          calories: 300,
          startDate: new Date().toISOString(),
        }}
        plantData={{
          emoji: '🌻',
          name: 'Sunflower',
          isNewType: true,
        }}
        onClose={() => setShowCelebrationModal(false)}
        metricSystem={metricSystem}
        streakInfo={{
          currentStreak: 3,
          longestStreak: 5,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.primary,
  },
  loadingText: {
    fontSize: 18,
    color: Theme.colors.accent.primary,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Black',
    fontWeight: 'black',
    color: Theme.colors.text.primary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },



  // Error modal styles
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    maxWidth: '85%',
    minWidth: '75%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
  },
  modalButtonsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    maxWidth: 120,
  },

  // Plant Details Modal styles
  plantModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    margin: 20,
    maxWidth: '85%',
    minWidth: '75%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  plantImage: {
    width: 180,
    height: 180,
  },
  plantName: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 8,
  },
  plantDistance: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  plantDate: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },

  // Debug modal styles
  debugButtonsContainer: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  debugButtonText: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  resetAllButton: {
    backgroundColor: '#ef4444',
  },



});

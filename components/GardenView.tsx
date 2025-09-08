import { Theme } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { formatDate, formatDistance } from '../utils/formatters';
import {
  GridPosition
} from '../utils/isometricGrid';
import DraggablePlant from './DraggablePlant';
import GardenCanvas from './GardenCanvas';
import PlantCelebrationModal from './modals/PlantCelebrationModal';

const { width: screenWidth } = Dimensions.get('window');

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  earnedFromActivityId?: string;
  gridPosition?: { row: number; col: number };
  currentStage: number;
  waterLevel: number;
  isWilted: boolean;

  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    distanceRequired?: number;
    growthStages: Array<{ stage: number; name: string; emoji: string }>;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
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

interface PlantStashItem {
  _id: string;
  name: string;
  emoji: string;
  distanceRequired: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  category: string;
  description: string;
  isUnlocked: boolean;
  totalCount: number;
  unplantedCount: number;
  distanceToUnlock: number;
}



export default function GardenView() {
  const [selectedPlant, setSelectedPlant] = useState<PlantStashItem | null>(null);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
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

  // Get activity data for selected plant
  const selectedPlantActivity = useQuery(
    api.activities.getActivityById,
    selectedPlantDetails?.earnedFromActivityId
      ? { activityId: selectedPlantDetails.earnedFromActivityId as any }
      : 'skip'
  );

  // Mutations
  const initializeGarden = useMutation(api.garden.initializeGarden);
  const plantInGarden = useMutation(api.garden.plantInGarden);
  const autoPlantInGarden = useMutation(api.garden.autoPlantInGarden);
  const updatePlantInGarden = useMutation(api.garden.updatePlantInGarden);

  // Debug mutations - temporarily use the sync function directly
  const syncActivitiesFromHealthKit = useMutation(api.activities.syncActivitiesFromHealthKit);
  const resetAllData = useMutation(api.migration.resetAllData);
  const resetPlants = useMutation(api.migration.resetPlants);
  const resetActivities = useMutation(api.migration.resetActivities);
  const resetGardensAndPlantTypes = useMutation(api.migration.resetGardensAndPlantTypes);
  const resetUserProfiles = useMutation(api.migration.resetUserProfiles);
  const getDataCounts = useQuery(api.migration.getDataCounts);

  // Initialize garden on first load
  useEffect(() => {
    if (gardenLayout === null || gardenLayout === undefined) {
      // No garden exists, initialize one
      initializeGarden().catch(console.error);
    }
  }, [gardenLayout, initializeGarden]);

  // Handle grid tap for planting
  const handleGridTap = (gridPosition: GridPosition) => {
    // If user has selected a plant to plant
    if (selectedPlant) {
      handlePlantAtGridPosition(gridPosition);
    }
  };

  // Handle plant tap - show plant details modal
  const handlePlantTap = (plant: PlantInGarden) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPlantDetails(plant);
    } catch (error) {
      console.error('Error showing plant details:', error);
    }
  };

  const handlePlantSelection = async (stashPlant: PlantStashItem) => {
    setSelectedPlant(stashPlant);
    showErrorModal(
      '🌱 Plant Selected!',
      `Tap any empty tile in your garden to plant your ${stashPlant.name || 'plant'}. All tiles are available for planting.`,
      'Got it!'
    );
  };

  const handlePlantAtGridPosition = async (gridPosition: GridPosition) => {
    if (!selectedPlant || !gardenLayout) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // In simplified grid, all positions are available
      // Find a plant from inventory that matches the selected stash plant
      const matchingInventoryPlant = plantInventory?.find(
        (invPlant) => invPlant.plantTypeId === selectedPlant._id
      );

      if (!matchingInventoryPlant) {
        showErrorModal(
          '❌ Plant Not Available',
          'This plant is not available in your inventory.',
          'OK'
        );
        return;
      }

      await plantInGarden({
        plantId: matchingInventoryPlant._id as any,
        gridPosition,
      });

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '🌱 Successfully Planted!',
        `Your ${selectedPlant.name || 'plant'} has been planted in your garden!`,
        'Awesome!'
      );
      setSelectedPlant(null);

    } catch (error: any) {
      console.log('Plant error:', error);
      showErrorModal(
        '❌ Planting Failed',
        error?.message || 'Something went wrong while planting your plant.',
        'Try Again'
      );
    }
  };




  // Grid plant interaction handlers
  const handlePlantGridPositionChange = async (plantId: string, gridPosition: GridPosition) => {
    if (!gardenLayout) return;

    try {
      // In simplified grid, all positions are available
      await updatePlantInGarden({
        plantId: plantId as any,
        gridPosition,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      console.log('Grid position update error:', error);
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
    // Set up callback for plant selection
    (global as any).onPlantSelected = handlePlantSelection;
    router.push('/stash');
  };



  // Reset all data function
  const handleResetAllData = async () => {
    try {
      setShowDebugModal(false);

      showErrorModal(
        '⚠️ Confirm Reset',
        'This will permanently delete ALL plants, activities, and gardens for ALL users. This cannot be undone. Are you sure?',
        'Cancel'
      );

      // We'll handle the actual reset in a separate confirmation
    } catch (error) {
      console.error('Reset preparation failed:', error);
    }
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

      // Step 3: Reset gardens and plant types
      const gardensResult = await resetGardensAndPlantTypes({});
      totalGardensDeleted = gardensResult.gardensDeleted;
      totalPlantTypesDeleted = gardensResult.plantTypesDeleted;
      totalDeleted += gardensResult.gardensDeleted + gardensResult.plantTypesDeleted;

      // Step 4: Reset user profiles
      const profilesResult = await resetUserProfiles({});
      totalProfilesReset = profilesResult.profilesReset;

      showErrorModal(
        '✅ Reset Complete!',
        `Successfully reset all data:\n• ${plantsDeleted} plants deleted\n• ${activitiesDeleted} activities deleted\n• ${totalGardensDeleted} gardens deleted\n• ${totalPlantTypesDeleted} plant types deleted\n• ${totalProfilesReset} profiles reset\n\nTotal: ${totalDeleted} items deleted`,
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

  // Debug functions for testing
  const createFakeActivity = async (distance: number) => {
    try {
      console.log('Creating fake activity with distance:', distance);
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
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>🌱 Preparing your garden...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowDebugModal(true)} activeOpacity={0.7}>
          <Text style={styles.title}>Run Garden</Text>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.inventoryButton}
            onPress={openStash}
          >
            <Text style={styles.inventoryButtonText}>
              Plant Collection
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Plant instruction */}
      {/* <Text style={[
        styles.instruction,
        selectedPlant && styles.instructionActive
      ]}>
        {selectedPlant
          ? `Tap anywhere to plant your ${selectedPlant.name}`
          : 'Select a plant from stash, then tap to plant it'
        }
      </Text> */}

      {/* Garden Canvas */}
      <GardenCanvas
        backgroundColor={Theme.colors.background.primary}
        onGridTap={handleGridTap}
        unlockedTiles={[]} // All tiles are available in simplified grid
        showGrid={true}
      >
        {/* Render planted plants */}
        {gardenPlants?.map((plant) => (
          <DraggablePlant
            key={plant._id}
            plant={plant as PlantInGarden}
            onGridPositionChange={handlePlantGridPositionChange}
            onPlantTap={handlePlantTap}
            unlockedTiles={[]} // All tiles are available in simplified grid
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
                if (errorModal.action === 'Open Stash') {
                  router.push('/stash');
                }
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
            <Text style={styles.plantEmoji}>{selectedPlantDetails.plantType?.emoji || '🌱'}</Text>
            <Text style={styles.plantName}>{selectedPlantDetails.plantType?.name || 'Unknown Plant'}</Text>

            {/* Distance Required */}
            {selectedPlantDetails.plantType?.distanceRequired && (
              <Text style={styles.plantDistance}>
                Distance required: {formatDistance(selectedPlantDetails.plantType.distanceRequired, metricSystem)}
              </Text>
            )}

            {/* Run Date */}
            {selectedPlantDetails.earnedFromActivityId && selectedPlantActivity && (
              <Text style={styles.plantDate}>
                Planted on {formatDate(selectedPlantActivity.startDate)}
              </Text>
            )}

            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.errorButton, styles.cancelButton]}
                onPress={() => setSelectedPlantDetails(null)}
              >
                <Text style={styles.errorButtonText}>Close</Text>
              </TouchableOpacity>
              {selectedPlantDetails.earnedFromActivityId && (
                <TouchableOpacity
                  style={[styles.errorButton, styles.viewRunButton]}
                  onPress={() => {
                    setSelectedPlantDetails(null);
                    router.push({
                      pathname: '/activity-detail',
                      params: {
                        id: selectedPlantDetails.earnedFromActivityId
                      }
                    });
                  }}
                >
                  <Text style={styles.errorButtonText}>View Run</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Debug Modal */}
      {showDebugModal && (
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
    paddingHorizontal: 24,
    paddingTop: 20,
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
  inventoryButton: {
    backgroundColor: Theme.colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  inventoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  instruction: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  instructionActive: {
    color: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
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
  },
  cancelButton: {
    backgroundColor: '#6b7280',
    marginRight: 6,
  },
  viewRunButton: {
    backgroundColor: '#22c55e',
    marginLeft: 6,
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
  plantEmoji: {
    fontSize: 64,
    marginBottom: 16,
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

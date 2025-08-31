import { Theme } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { State } from 'react-native-gesture-handler';
import DraggablePlant from './DraggablePlant';
import GardenCanvas from './GardenCanvas';
import PlantCelebrationModal from './modals/PlantCelebrationModal';

const { width: screenWidth } = Dimensions.get('window');

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  earnedFromActivityId?: string;
  gardenPosition: { x: number; y: number };
  currentStage: number;
  waterLevel: number;
  isWilted: boolean;
  plantSize?: number;
  zIndex?: number;

  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
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



export default function GardenView() {
  const [selectedPlant, setSelectedPlant] = useState<PlantInventoryItem | null>(null);
  const [plantInGestureMode, setPlantInGestureMode] = useState<string | null>(null); // Track which plant is in gesture mode
  const [optimisticPlants, setOptimisticPlants] = useState<{ [plantId: string]: Partial<PlantInGarden> }>({}); // Optimistic updates
  const [showInventory, setShowInventory] = useState(false);
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

  const [resetConfirmModal, setResetConfirmModal] = useState({
    show: false,
  });

  // Screen dimensions
  const screen = Dimensions.get('window');

  // Queries
  const gardenLayout = useQuery(api.garden.getGardenLayout);
  const baseGardenPlants = useQuery(api.garden.getGardenPlants);
  const plantInventory = useQuery(api.garden.getPlantInventory);

  // Merge base plants with optimistic updates
  const gardenPlants = baseGardenPlants?.map(plant => {
    const optimisticUpdate = optimisticPlants[plant._id];
    return optimisticUpdate ? { ...plant, ...optimisticUpdate } : plant;
  });

  // Mutations
  const initializeGarden = useMutation(api.garden.initializeGarden);
  const plantInGarden = useMutation(api.garden.plantInGarden);
  const updatePlantInGarden = useMutation(api.garden.updatePlantInGarden);
  const migratePlantsToCanvas = useMutation(api.garden.migratePlantsToCanvas);
  const cleanupRotationField = useMutation(api.garden.cleanupRotationField);
  const waterPlant = useMutation(api.garden.waterPlant);
  const resetGarden = useMutation(api.garden.resetGarden);
  const removeFromGarden = useMutation(api.garden.removeFromGarden);

  // Debug mutations - temporarily use the sync function directly
  const syncActivitiesFromHealthKit = useMutation(api.activities.syncActivitiesFromHealthKit);

  // Initialize garden on first load and migrate old plants
  useEffect(() => {
    if (gardenLayout === null || gardenLayout === undefined) {
      // No garden exists, initialize one
      initializeGarden().catch(console.error);
    }
  }, [gardenLayout, initializeGarden]);

  // Run migration for existing plants once
  useEffect(() => {
    if (baseGardenPlants && baseGardenPlants.length > 0) {
      // Check if any plants need migration
      const needsMigration = baseGardenPlants.some(plant =>
        plant.gardenPosition &&
        (plant.plantSize === undefined || plant.zIndex === undefined ||
          (Number.isInteger(plant.gardenPosition.x) && Number.isInteger(plant.gardenPosition.y) &&
            plant.gardenPosition.x < 50 && plant.gardenPosition.y < 50))
      );

      if (needsMigration) {
        console.log('Migrating old plants to new canvas system...');
        Promise.all([
          migratePlantsToCanvas(),
          cleanupRotationField()
        ])
          .then(([migrationResult, cleanupResult]) => {
            console.log(`Migrated ${migrationResult.migratedCount} plants to canvas system`);
            console.log(`Cleaned up ${cleanupResult.cleanedCount} rotation fields`);
            if (migrationResult.migratedCount > 0 || cleanupResult.cleanedCount > 0) {
              showErrorModal(
                '🔄 Plants Updated!',
                `Successfully migrated ${migrationResult.migratedCount} plants and cleaned up ${cleanupResult.cleanedCount} deprecated fields.`,
                'Awesome!'
              );
            }
          })
          .catch(console.error);
      }
    }
  }, [baseGardenPlants, migratePlantsToCanvas]);

  // Clear optimistic updates when backend data changes (to prevent stale state)
  useEffect(() => {
    if (baseGardenPlants) {
      setOptimisticPlants(prev => {
        // Only keep optimistic updates for plants that still exist in the backend
        const existingPlantIds = new Set(baseGardenPlants.map(p => p._id));
        const filtered: { [plantId: string]: Partial<PlantInGarden> } = {};

        Object.keys(prev).forEach(plantId => {
          if (existingPlantIds.has(plantId as any)) {
            filtered[plantId] = prev[plantId];
          }
        });

        return filtered;
      });
    }
  }, [baseGardenPlants]);

  // Handle canvas tap for planting
  const handleCanvasTap = (event: any) => {
    // For TapGestureHandler, we need to check the state and get coordinates differently
    if (event.nativeEvent.state === State.END) {
      // If a plant is in gesture mode, exit it
      if (plantInGestureMode) {
        setPlantInGestureMode(null);
        return;
      }

      // If user has selected a plant to plant
      if (selectedPlant) {
        const { x, y } = event.nativeEvent;
        // Plant at tapped position
        handlePlantAtPosition({ x, y });
      }
    }
  };

  // Handle long press - show run details
  const handlePlantLongPress = (plant: PlantInGarden) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (!plant.earnedFromActivityId) {
        showErrorModal(
          '🏃‍♂️ No Run Associated',
          'This plant doesn\'t have an associated run. It might be from an older version of the app or a test plant.',
          'Got it!'
        );
        return;
      }

      // Navigate to the activity detail screen using the plant's earnedFromActivityId
      router.push({
        pathname: '/activity-detail',
        params: {
          id: plant.earnedFromActivityId
        }
      });
    } catch (error) {
      console.error('Error navigating to activity detail:', error);
      showErrorModal(
        '❌ Navigation Error',
        'Could not open the run details. Please try again.',
        'OK'
      );
    }
  };

  const handlePlantSelection = async (inventoryPlant: PlantInventoryItem) => {
    setSelectedPlant(inventoryPlant);
    setShowInventory(false);
    showErrorModal(
      '🌱 Plant Selected!',
      `Tap anywhere on the canvas to plant your ${inventoryPlant.plantType?.name || 'plant'}. You can drag, resize, and rotate it after planting.`,
      'Got it!'
    );
  };

  const handlePlantAtPosition = async (position: { x: number; y: number }) => {
    if (!selectedPlant) {
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await plantInGarden({
        plantId: selectedPlant._id as any,
        position,
        plantSize: 1.0,
      });

      // Success feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '🌱 Successfully Planted!',
        `Your ${selectedPlant.plantType?.name || 'plant'} has been planted! You can now drag it around, resize it by pinching, rotate it, and change its layer.`,
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

  const handleWaterPlant = async (plantId: string) => {
    try {
      const result = await waterPlant({ plantId: plantId as any });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '💧 Plant Watered!',
        `Your plant is happy and refreshed! Water level is now ${result.waterLevel}%. Keep caring for your plants to help them grow.`,
        'Great!'
      );
    } catch (error: any) {
      console.log('Water error:', error);
      showErrorModal(
        '💧 Watering Failed',
        error?.message || 'Could not water your plant right now. Please try again in a moment.',
        'Try Again'
      );
    }
  };



  // Canvas plant interaction handlers
  const handlePlantPositionChange = async (plantId: string, position: { x: number; y: number }) => {
    try {
      // Fire and forget for smoother interaction - don't wait for response
      updatePlantInGarden({
        plantId: plantId as any,
        position,
      }).catch((error) => {
        console.log('Position update error:', error);
        // Could show a toast here if needed, but don't block the UI
      });
    } catch (error) {
      console.log('Position update error:', error);
    }
  };

  const handlePlantSizeChange = async (plantId: string, size: number) => {
    try {
      // Fire and forget for smoother interaction
      updatePlantInGarden({
        plantId: plantId as any,
        plantSize: size,
      }).catch((error) => {
        console.log('Size update error:', error);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Size update error:', error);
    }
  };

  const handlePlantLayerChange = async (plantId: string, direction: 'front' | 'back') => {
    try {
      const plantedPlants = gardenPlants || [];
      const currentPlant = plantedPlants.find(p => p._id === plantId);

      if (!currentPlant) return;

      let newZIndex = currentPlant.zIndex || 0;

      if (direction === 'front') {
        // Move to front: get max z-index and add 1
        const maxZIndex = Math.max(0, ...plantedPlants.map(p => p.zIndex || 0));
        newZIndex = maxZIndex + 1;
      } else {
        // Move to back: get min z-index and subtract 1 (or set to 0)
        const minZIndex = Math.min(0, ...plantedPlants.map(p => p.zIndex || 0));
        newZIndex = Math.max(0, minZIndex - 1);
      }

      await updatePlantInGarden({
        plantId: plantId as any,
        zIndex: newZIndex,
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Layer update error:', error);
    }
  };

  const handleEnterGestureMode = (plantId: string) => {
    // Exit current gesture mode if another plant is selected
    if (plantInGestureMode && plantInGestureMode !== plantId) {
      setPlantInGestureMode(null);
    }
    // Set this plant as the one in gesture mode
    setPlantInGestureMode(plantId);
  };

  const handleExitGestureMode = () => {
    setPlantInGestureMode(null);
  };

  const handleDeletePlant = async (plantId: string) => {
    try {
      await removeFromGarden({ plantId: plantId as any });
      setPlantInGestureMode(null); // Exit gesture mode after deletion
      // Clear optimistic state for this plant
      setOptimisticPlants(prev => {
        const { [plantId]: removed, ...rest } = prev;
        return rest;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '🗑️ Plant Removed!',
        'Your plant has been removed from the garden and moved back to your inventory.',
        'Got it!'
      );
    } catch (error: any) {
      console.log('Remove error:', error);
      showErrorModal(
        '🗑️ Remove Failed',
        error?.message || 'Could not remove your plant right now. Please try again in a moment.',
        'Try Again'
      );
    }
  };

  const handleResetGarden = () => {
    setResetConfirmModal({ show: true });
  };

  const confirmResetGarden = async () => {
    try {
      setResetConfirmModal({ show: false });

      const result = await resetGarden();

      // Clear all optimistic updates
      setOptimisticPlants({});

      // Exit gesture mode
      setPlantInGestureMode(null);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showErrorModal(
        '🗑️ Garden Reset Complete!',
        `${result.removedCount} plants returned to inventory.`,
        'Continue'
      );
    } catch (error) {
      console.log('Reset garden error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showErrorModal(
        '❌ Reset Failed',
        'Failed to reset garden. Please try again.',
        'Try Again'
      );
    }
  };

  // Handle optimistic updates with throttling
  const handleOptimisticUpdate = (plantId: string, updates: Partial<PlantInGarden>) => {
    setOptimisticPlants(prev => ({
      ...prev,
      [plantId]: {
        ...prev[plantId],
        ...updates
      }
    }));
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



  const toggleInventory = () => {
    setShowInventory(!showInventory);
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
            style={styles.resetButton}
            onPress={handleResetGarden}
          >
            <Text style={styles.resetButtonText}>reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inventoryButton}
            onPress={toggleInventory}
          >
            <Text style={styles.inventoryButtonText}>
              stash ({plantInventory?.length || 0})
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
          ? `Tap anywhere to plant your ${selectedPlant.plantType?.name}`
          : 'Select a plant from stash, then tap to plant it'
        }
      </Text> */}

      {/* Garden Canvas */}
      <GardenCanvas backgroundColor="#F8F9FA" onCanvasTap={handleCanvasTap}>
        {/* Render planted plants */}
        {gardenPlants?.map((plant) => (
          <DraggablePlant
            key={plant._id}
            plant={plant as PlantInGarden}
            onPositionChange={handlePlantPositionChange}
            onSizeChange={handlePlantSizeChange}
            onLayerChange={handlePlantLayerChange}
            onPlantLongPress={handlePlantLongPress}
            onDeletePlant={handleDeletePlant}
            onEnterGestureMode={handleEnterGestureMode}
            onExitGestureMode={handleExitGestureMode}
            onOptimisticUpdate={handleOptimisticUpdate}
            isInGestureMode={plantInGestureMode === plant._id}
          />
        ))}
      </GardenCanvas>

      {/* Plant Inventory Modal */}
      {showInventory && (
        <View style={styles.inventoryOverlay}>
          <View style={styles.inventoryModal}>
            <View style={styles.inventoryHeader}>
              <Text style={styles.inventoryTitle}>🎒 Plant Inventory</Text>
              <TouchableOpacity onPress={() => setShowInventory(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.inventoryList}>
              {plantInventory?.length === 0 ? (
                <Text style={styles.emptyInventoryText}>
                  🏃‍♂️ Go for a run to earn your first plant!
                </Text>
              ) : (
                <>
                  <Text style={styles.inventorySubtitle}>
                    Tap to select a plant for planting
                  </Text>

                  {Object.entries(
                    plantInventory?.reduce((acc, item) => {
                      const key = item.plantType?.name || 'unknown';
                      if (!acc[key]) {
                        acc[key] = { ...item, count: 0 };
                      }
                      acc[key].count++;
                      return acc;
                    }, {} as Record<string, any>) || {}
                  ).map(([name, item]) => (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.inventoryItem,
                        selectedPlant === item && styles.selectedPlantItem
                      ]}
                      onPress={() => {
                        if (selectedPlant === item) {
                          setSelectedPlant(null);
                        } else {
                          handlePlantSelection(item);
                        }
                      }}
                    >
                      <Text style={styles.inventoryPlantEmoji}>
                        {item.plantType?.emoji || '🌱'}
                      </Text>
                      <View style={styles.plantInfo}>
                        <Text style={styles.plantName}>{item.count}k {item.plantType?.name || 'plant'}</Text>
                        <Text style={styles.plantCount}>x{item.count}</Text>
                      </View>
                      {selectedPlant === item && (
                        <Text style={styles.selectedIndicator}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

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
                if (errorModal.action === 'Open Inventory') {
                  setShowInventory(true);
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

      {/* Reset Confirmation Modal */}
      {resetConfirmModal.show && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>🗑️ Reset Garden</Text>
            <Text style={styles.errorMessage}>
              Are you sure you want to reset your entire garden? All plants will be removed and returned to your inventory. This action cannot be undone.
            </Text>
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.errorButton, styles.cancelButton]}
                onPress={() => setResetConfirmModal({ show: false })}
              >
                <Text style={styles.errorButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.errorButton, styles.resetConfirmButton]}
                onPress={confirmResetGarden}
              >
                <Text style={[styles.errorButtonText, styles.resetConfirmButtonText]}>Reset Garden</Text>
              </TouchableOpacity>
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
              Simulate different run distances to test plant unlocking:
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

      {/* Floating Record Run Button */}
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
        metricSystem="metric"
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
    fontFamily: 'Times',
    color: Theme.colors.accent.primary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  resetButtonText: {
    color: Theme.colors.accent.primary,
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Medium',
  },
  inventoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  inventoryButtonText: {
    color: Theme.colors.accent.primary,
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

  // Inventory modal styles
  inventoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inventoryModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    maxHeight: '80%',
    minWidth: '80%',
  },
  inventoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  closeButton: {
    fontSize: 20,
    color: '#666666',
    padding: 5,
  },
  inventoryList: {
    maxHeight: 400,
  },
  inventorySubtitle: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#666666',
    padding: 15,
    paddingBottom: 5,
  },
  inventoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedPlantItem: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  selectedIndicator: {
    fontSize: 20,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  // Missing styles
  inventoryTitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#000000',
  },
  inventoryPlantEmoji: {
    fontSize: 32,
    width: 48,
    height: 48,
    textAlign: 'center',
    lineHeight: 48,
    marginRight: 16,
  },
  plantInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plantName: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#000000',
  },
  plantCount: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#666666',
  },
  emptyInventoryText: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    padding: 40,
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
  resetConfirmButton: {
    backgroundColor: '#ef4444',
    marginLeft: 6,
  },
  resetConfirmButtonText: {
    color: '#FFFFFF',
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

  // Floating button styles
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
    fontFamily: 'Times',
    color: Theme.colors.background.primary,
  },

});

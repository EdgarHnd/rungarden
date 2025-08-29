import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  LongPressGestureHandler,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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
  rotation?: number;
  plantType: {
    name: string;
    emoji: string;
    growthStages: Array<{ stage: number; name: string; emoji: string }>;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
}

interface DraggablePlantProps {
  plant: PlantInGarden;
  onPositionChange: (plantId: string, position: { x: number; y: number }) => void;
  onSizeChange: (plantId: string, size: number) => void;
  onLayerChange: (plantId: string, direction: 'front' | 'back') => void;
  onPlantLongPress: (plant: PlantInGarden) => void;
  onDeletePlant: (plantId: string) => void;
  onEnterGestureMode: (plantId: string) => void;
  onExitGestureMode: () => void;
  onOptimisticUpdate: (plantId: string, updates: Partial<PlantInGarden>) => void;
  isInGestureMode?: boolean;
}

// Helper function to get the correct plant emoji
const getPlantEmoji = (plant: PlantInGarden) => {
  // Use the plant type emoji if available
  if (plant.plantType?.emoji) {
    return plant.plantType.emoji;
  }

  // Use growth stage emoji if available
  const currentStageEmoji = plant.plantType?.growthStages?.[plant.currentStage]?.emoji;
  if (currentStageEmoji) {
    return currentStageEmoji;
  }

  // Fallback to a generic plant emoji
  return '🌱';
};

export default function DraggablePlant({
  plant,
  onPositionChange,
  onSizeChange,
  onLayerChange,
  onPlantLongPress,
  onDeletePlant,
  onEnterGestureMode,
  onExitGestureMode,
  onOptimisticUpdate,
  isInGestureMode = false,
}: DraggablePlantProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Shared values for gestures
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  // Base plant size
  const baseSize = 80;

  // Tap gesture handler - enters gesture mode
  const tapGestureHandler = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      onEnterGestureMode(plant._id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Long press gesture handler - shows run details
  const longPressGestureHandler = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      onPlantLongPress(plant);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  // Pan gesture handler - only works in gesture mode
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      runOnJS(setIsDragging)(true);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    },
    onActive: (event) => {
      // Only update animated translation - no optimistic updates during drag
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    },
    onEnd: (event) => {
      runOnJS(setIsDragging)(false);

      // Calculate final position
      const finalX = plant.gardenPosition.x + event.translationX;
      const finalY = plant.gardenPosition.y + event.translationY;

      // Single optimistic update at the end
      runOnJS(onOptimisticUpdate)(plant._id, {
        gardenPosition: { x: finalX, y: finalY }
      });

      // Update backend in background
      runOnJS(onPositionChange)(plant._id, { x: finalX, y: finalY });

      // Smooth spring back to 0 since position is now updated in plant state
      translateX.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        mass: 0.8,
      });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        mass: 0.8,
      });
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler({
    onActive: (event: any) => {
      // Only update animated scale - no optimistic updates during pinch
      scale.value = event.scale;
    },
    onEnd: (event: any) => {
      const newSize = Math.max(0.5, Math.min(2.0, event.scale * (plant.plantSize || 1.0)));

      // Single optimistic update at the end
      runOnJS(onOptimisticUpdate)(plant._id, {
        plantSize: newSize
      });

      // Update backend in background
      runOnJS(onSizeChange)(plant._id, newSize);
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);

      // Smooth spring back to 1 since size is now in plant state
      scale.value = withSpring(1, {
        damping: 20,
        stiffness: 300,
        mass: 0.8,
      });
    },
  });



  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value * (plant.plantSize || 1.0) },
      ],
    };
  });

  // Gesture mode indicator animation - simple fade
  const indicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: withSpring(isInGestureMode ? 0.5 : 0, {
        damping: 20,
        stiffness: 300,
      }),
    };
  });

  // Plant shadow animation - simple enhancement during drag
  const shadowStyle = useAnimatedStyle(() => {
    const isDragging = translateX.value !== 0 || translateY.value !== 0;
    return {
      shadowOpacity: withSpring(isDragging ? 0.25 : 0.1, {
        damping: 25,
        stiffness: 400
      }),
      elevation: withSpring(isDragging ? 6 : 2, {
        damping: 25,
        stiffness: 400
      }),
    };
  });

  // Exit gesture mode
  const exitGestureMode = () => {
    onExitGestureMode();
  };

  const currentScale = (plant.plantSize || 1.0);

  return (
    <View
      style={[
        styles.plantContainer,
        {
          left: plant.gardenPosition.x - (baseSize * currentScale) / 2,
          top: plant.gardenPosition.y - (baseSize * currentScale) / 2,
          zIndex: plant.zIndex || 0,
        },
      ]}
    >
      <Animated.View>
        <PinchGestureHandler
          onGestureEvent={pinchGestureHandler}
          enabled={isInGestureMode}
        >
          <Animated.View>
            <PanGestureHandler
              onGestureEvent={panGestureHandler}
              enabled={isInGestureMode}
            >
              <Animated.View>
                <LongPressGestureHandler
                  onHandlerStateChange={longPressGestureHandler}
                  minDurationMs={500}
                >
                  <Animated.View>
                    <TapGestureHandler
                      onHandlerStateChange={tapGestureHandler}
                      enabled={!isInGestureMode}
                    >
                      <Animated.View style={[styles.plantTouchArea, animatedStyle, shadowStyle]}>
                        <View style={styles.plantImageContainer}>
                          {/* Gesture mode indicator */}
                          <Animated.View style={[styles.gestureModeIndicator, indicatorStyle]} />



                          {/* Plant emoji */}
                          <Text style={[
                            styles.plantEmoji,
                            plant.isWilted && styles.wiltedPlant,
                          ]}>
                            {getPlantEmoji(plant)}
                          </Text>

                          {/* Water level indicator */}
                          {plant.waterLevel < 30 && (
                            <View style={styles.waterIndicator}>
                              <Text style={styles.waterText}>💧</Text>
                            </View>
                          )}
                        </View>
                      </Animated.View>
                    </TapGestureHandler>
                  </Animated.View>
                </LongPressGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </Animated.View>

      {/* Plant controls - only show in gesture mode */}
      {isInGestureMode && (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => onLayerChange(plant._id, 'front')}
          >
            <Text style={styles.controlButtonText}>⬆️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => onLayerChange(plant._id, 'back')}
          >
            <Text style={styles.controlButtonText}>⬇️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={exitGestureMode}
          >
            <Text style={styles.controlButtonText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.controlButton, styles.deleteButton]}
            onPress={() => onDeletePlant(plant._id)}
          >
            <Text style={styles.controlButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plantContainer: {
    position: 'absolute',
  },
  plantTouchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  plantImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  plantEmoji: {
    fontSize: 64,
    textAlign: 'center',
    lineHeight: 80,
  },
  wiltedPlant: {
    opacity: 0.6,
  },
  waterIndicator: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
  waterText: {
    fontSize: 16,
  },
  controlsContainer: {
    position: 'absolute',
    top: -40,
    right: -40,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  controlButtonText: {
    fontSize: 16,
  },
  gestureModeIndicator: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#22c55e',
    borderStyle: 'dashed',
    zIndex: -1,
    opacity: 0.7,
  },
  exitButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
});

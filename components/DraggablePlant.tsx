import React, { useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  TapGestureHandler
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import {
  DEFAULT_GRID_CONFIG,
  getGridDepth,
  GridPosition,
  gridToScreen
} from '../utils/isometricGrid';

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
    growthStages: Array<{ stage: number; name: string; emoji: string }>;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythical';
    category?: string;
    description?: string;
    _id?: string;
    _creationTime?: number;
  } | null;
}

interface DraggablePlantProps {
  plant: PlantInGarden;
  onGridPositionChange: (plantId: string, gridPosition: GridPosition) => void;
  onPlantTap: (plant: PlantInGarden) => void;
  unlockedTiles?: Array<{ x: number; y: number; unlockedAt: string }>;
  animationDelay?: number; // For chained animations
  shouldAnimate?: boolean; // Whether to animate on mount
}

// Helper function to get the correct plant emoji
const getPlantEmoji = (plant: PlantInGarden) => {
  // Always use the main plant type emoji (mature form)
  if (plant.plantType?.emoji) {
    return plant.plantType.emoji;
  }

  // Fallback to a generic plant emoji
  return '🌱';
};

// Helper function to get the correct plant image path
const getPlantImagePath = (plant: PlantInGarden) => {
  // Check if plant type has an image
  if (plant.plantType?.imagePath) {
    return plant.plantType.imagePath;
  }

  return null;
};

// Helper function to get image source from path
const getImageSource = (imagePath: string) => {
  // Map image paths to actual require statements
  const imageMap: { [key: string]: any } = {
    'assets/images/plants/01.png': require('../assets/images/plants/01.png'),
    'assets/images/plants/carrot.png': require('../assets/images/plants/carrot.png'),
    'assets/images/plants/sakura.png': require('../assets/images/plants/sakura.png'),
  };

  return imageMap[imagePath] || null;
};

export default function DraggablePlant({
  plant,
  onGridPositionChange,
  onPlantTap,
  unlockedTiles = [],
  animationDelay = 0,
  shouldAnimate = true,
}: DraggablePlantProps) {
  // Base plant size
  const baseSize = 18;

  // Animation shared values
  const scale = useSharedValue(shouldAnimate ? 0 : 1);
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(shouldAnimate ? 20 : 0);
  const scaleX = useSharedValue(shouldAnimate ? 0.8 : 1);
  const scaleY = useSharedValue(shouldAnimate ? 1.2 : 1);

  // Get the plant's screen position from grid coordinates
  const getPlantScreenPosition = () => {
    if (plant.gridPosition) {
      return gridToScreen(plant.gridPosition, DEFAULT_GRID_CONFIG);
    } else {
      // Default position if none set (shouldn't happen with fresh DB)
      return gridToScreen({ row: 2, col: 2 }, DEFAULT_GRID_CONFIG);
    }
  };

  const screenPosition = getPlantScreenPosition();
  const gridDepth = plant.gridPosition ? getGridDepth(plant.gridPosition) : 0;

  // Growing animation effect
  useEffect(() => {
    if (shouldAnimate) {
      // Create a beautiful growing sequence with delay for chained effect
      const startAnimation = () => {
        // First phase: Fade in and emerge from ground
        opacity.value = withTiming(1, { duration: 400 });
        translateY.value = withSpring(0, {
          damping: 15,
          stiffness: 200,
          mass: 0.8
        });

        // Second phase: Squash and stretch effect (like sprouting)
        scaleX.value = withSequence(
          withTiming(1.1, { duration: 150 }),
          withSpring(1, { damping: 10, stiffness: 300 })
        );
        scaleY.value = withSequence(
          withTiming(0.9, { duration: 150 }),
          withSpring(1, { damping: 10, stiffness: 300 })
        );

        // Third phase: Main scale up with bounce effect
        scale.value = withSequence(
          withDelay(100, withTiming(0.4, { duration: 150 })),
          withSpring(1.3, {
            damping: 6,
            stiffness: 250,
            mass: 0.4
          }),
          withSpring(1, {
            damping: 10,
            stiffness: 350,
            mass: 0.6
          })
        );

        // Fourth phase: Gentle celebration sway
        rotation.value = withSequence(
          withDelay(500, withTiming(8, { duration: 250 })),
          withTiming(-5, { duration: 400 }),
          withTiming(2, { duration: 300 }),
          withTiming(0, { duration: 250 })
        );
      };

      // Apply delay for chained animation effect
      const timeoutId = setTimeout(startAnimation, animationDelay);
      return () => clearTimeout(timeoutId);
    }
  }, [shouldAnimate, animationDelay, scale, opacity, rotation, translateY, scaleX, scaleY]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  // Tap gesture handler - shows plant details modal
  const tapGestureHandler = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      onPlantTap(plant);

      // Add a subtle tap animation
      scale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withSpring(1, { damping: 10, stiffness: 400 })
      );
    }
  };




  return (
    <View
      style={[
        styles.plantContainer,
        {
          left: screenPosition.x - baseSize / 2,
          top: screenPosition.y - baseSize,
          zIndex: gridDepth,
        },
      ]}
    >
      <TapGestureHandler
        onHandlerStateChange={tapGestureHandler}
      >
        <Animated.View style={[styles.plantTouchArea, animatedStyle]}>
          <View style={styles.plantImageContainer}>

            {/* Plant emoji or image */}
            {(() => {
              const imagePath = getPlantImagePath(plant);
              const imageSource = imagePath ? getImageSource(imagePath) : null;

              if (imageSource) {
                return (
                  <Image
                    source={imageSource}
                    style={[
                      styles.plantImage,
                      plant.isWilted === true && styles.wiltedPlant,
                    ]}
                    resizeMode="contain"
                  />
                );
              } else {
                return (
                  <Text style={[
                    styles.plantEmoji,
                    plant.isWilted === true && styles.wiltedPlant,
                  ]}>
                    {getPlantEmoji(plant)}
                  </Text>
                );
              }
            })()}
          </View>
        </Animated.View>
      </TapGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  plantContainer: {
    position: 'absolute',
  },
  plantTouchArea: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  plantEmoji: {
    fontSize: 14,
    textAlign: 'center',
  },
  plantImage: {
    width: 32,
    height: 32,
  },
  wiltedPlant: {
    opacity: 0.6,
  },
});

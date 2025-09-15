import { Image } from 'expo-image';
import React, { memo, useEffect } from 'react';
import {
  StyleSheet,
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
    distanceRequired?: number;
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


import { getImageSource } from '../utils/plantImageMapping';

const DraggablePlant = memo(function DraggablePlant({
  plant,
  onGridPositionChange,
  onPlantTap,
  unlockedTiles = [],
  animationDelay = 0,
  shouldAnimate = true,
}: DraggablePlantProps) {
  // Base plant size
  const baseSize = 18;
  const HIGH_RES_IMAGE_PX = 100;
  const DISPLAYED_SIZE_PX = 32;
  const initialScale = DISPLAYED_SIZE_PX / HIGH_RES_IMAGE_PX;

  // Animation shared values
  const scale = useSharedValue(shouldAnimate ? 0 : 1);
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
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

      };

      // Apply delay for chained animation effect
      const timeoutId = setTimeout(startAnimation, animationDelay);
      return () => clearTimeout(timeoutId);
    }
  }, [shouldAnimate, animationDelay, scale, opacity, translateY, scaleX, scaleY]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        // Apply a high-res downscale so zooming stays crisp
        { scale: scale.value * initialScale },
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
        { translateY: translateY.value },
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

            {/* Plant image */}
            <Image
              source={getImageSource(plant.plantType?.imagePath, plant.plantType?.distanceRequired)}
              style={[
                styles.plantImage,
                plant.isWilted === true && styles.wiltedPlant,
              ]}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
              priority="high"
              recyclingKey={plant._id}
            />
          </View>
        </Animated.View>
      </TapGestureHandler>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.plant._id === nextProps.plant._id &&
    prevProps.plant.gridPosition?.row === nextProps.plant.gridPosition?.row &&
    prevProps.plant.gridPosition?.col === nextProps.plant.gridPosition?.col &&
    prevProps.plant.isWilted === nextProps.plant.isWilted &&
    prevProps.shouldAnimate === nextProps.shouldAnimate &&
    prevProps.animationDelay === nextProps.animationDelay
  );
});

export default DraggablePlant;

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
    // Render at high resolution and scale down via transform for crisp zooming
    width: 80,
    height: 80,
  },
  wiltedPlant: {
    opacity: 0.6,
  },
});

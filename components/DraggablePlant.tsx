import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  TapGestureHandler
} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
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
  isWilted: boolean;
  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    growthStages: Array<{ stage: number; name: string; emoji: string }>;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  };
}

interface DraggablePlantProps {
  plant: PlantInGarden;
  onGridPositionChange: (plantId: string, gridPosition: GridPosition) => void;
  onPlantTap: (plant: PlantInGarden) => void;
  unlockedTiles?: Array<{ x: number; y: number; unlockedAt: string }>;
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
}: DraggablePlantProps) {
  // Base plant size
  const baseSize = 64;

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

  // Tap gesture handler - shows plant details modal
  const tapGestureHandler = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      onPlantTap(plant);
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
        <Animated.View style={styles.plantTouchArea}>
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
                      plant.isWilted && styles.wiltedPlant,
                    ]}
                    resizeMode="contain"
                  />
                );
              } else {
                return (
                  <Text style={[
                    styles.plantEmoji,
                    plant.isWilted && styles.wiltedPlant,
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
    alignItems: 'center',
    justifyContent: 'center',
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
  plantImage: {
    width: 64,
    height: 64,
  },
  wiltedPlant: {
    opacity: 0.6,
  },
});

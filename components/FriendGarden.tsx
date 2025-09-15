import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_GRID_CONFIG, getAllGridPositions, gridToScreen } from '../utils/isometricGrid';
import { getImageSource } from '../utils/plantImageMapping';

interface PlantInGarden {
  _id: string;
  plantTypeId: string;
  gridPosition?: { row: number; col: number };
  currentStage: number;
  waterLevel?: number;
  isWilted?: boolean;
  plantType: {
    name: string;
    emoji: string;
    imagePath?: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
    distanceRequired?: number;
  };
}

interface FriendGardenProps {
  friendName: string;
  friendId: string;
  plants: PlantInGarden[];
  size?: number;
}

export default function FriendGarden({ friendName, friendId, plants, size = 120 }: FriendGardenProps) {
  // Create a smaller grid config for the mini garden
  const miniGridConfig = {
    ...DEFAULT_GRID_CONFIG,
    gridSize: 12, // Smaller grid
    tileWidth: 12, // Much smaller tiles
    tileHeight: 6,
    offsetX: size / 2, // Center in the container
    offsetY: size / 3,
  };

  // Get grid positions for the mini garden
  const allPositions = getAllGridPositions(miniGridConfig);

  // Render mini platform
  const renderPlatform = () => {
    // Center the platform at the mini grid center
    const centerRow = Math.floor(miniGridConfig.gridSize / 2);
    const centerCol = Math.floor(miniGridConfig.gridSize / 2);
    const centerPosition = gridToScreen({ row: centerRow, col: centerCol }, miniGridConfig);

    // Scale platform for mini garden
    const platformWidth = size * 0.8;
    const platformHeight = size * 0.6;

    // Position the image so its center aligns with the grid center
    const imageX = centerPosition.x - platformWidth / 2;
    const imageY = centerPosition.y - platformHeight / 2;

    return (
      <Image
        source={require('../assets/images/backgrounds/platform2.png')}
        style={[
          styles.platformImage,
          {
            left: imageX,
            top: imageY,
            width: platformWidth,
            height: platformHeight,
          }
        ]}
        resizeMode="contain"
      />
    );
  };

  // Render plants with exact same structure as DraggablePlant (scaled down)
  const renderPlants = () => {
    return plants.map((plant) => {
      if (!plant.gridPosition) return null;

      // Use smaller base size for mini garden thumbnails
      const baseSize = 6; // Even smaller for thumbnail view
      const screenPos = gridToScreen(plant.gridPosition, miniGridConfig);

      // Get grid depth for proper z-index (same as DraggablePlant)
      const gridDepth = plant.gridPosition.row + plant.gridPosition.col;

      return (
        <View
          key={plant._id}
          style={[
            styles.plantContainer,
            {
              left: screenPos.x - baseSize / 2,
              top: screenPos.y - baseSize,
              zIndex: gridDepth,
            },
          ]}
        >
          <View style={styles.plantTouchArea}>
            <View style={styles.plantImageContainer}>
              <Image
                source={getImageSource(plant.plantType?.imagePath, plant.plantType?.distanceRequired)}
                style={[
                  styles.plantImage,
                  plant.isWilted === true && styles.wiltedPlant,
                ]}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      );
    });
  };

  const handleGardenTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: `/friend-garden/[friendId]`,
      params: {
        friendId,
        friendName,
      },
    });
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.gardenContainer, { width: size, height: size }]}
        onPress={handleGardenTap}
        activeOpacity={0.8}
      >
        {renderPlatform()}
        {renderPlants()}
        <Text style={styles.friendName} numberOfLines={1}>
          {friendName}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    margin: 8,
  },
  gardenContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: Theme.colors.text.primary,
  },
  plantContainer: {
    position: 'absolute',
  },
  plantTouchArea: {
    width: 6, // Smaller for thumbnail view
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plantImage: {
    // Much smaller for mini garden thumbnails
    width: 20, // Smaller than quarter size for better fit
    height: 20,
  },
  wiltedPlant: {
    opacity: 0.6,
  },
  friendName: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.text.primary,
    marginTop: 8,
    marginLeft: 10,
    maxWidth: 120,
  },
  platformImage: {
    position: 'absolute',
  },
});

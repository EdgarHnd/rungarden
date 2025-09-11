import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_GRID_CONFIG, getAllGridPositions, getGridTileCorners, gridToScreen } from '../utils/isometricGrid';

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

  // Render grid tiles
  const renderGridTiles = () => {
    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={size}
        height={size}
      >
        {allPositions.map((gridPos, index) => {
          const corners = getGridTileCorners(gridPos, miniGridConfig);

          // Create diamond path
          const pathData = `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;

          return (
            <Path
              key={`${gridPos.row}-${gridPos.col}`}
              d={pathData}
              fill='rgba(34, 197, 94, 0.05)' // Very subtle green
              stroke='rgba(34, 197, 94, 0.2)'
              strokeWidth={0.5}
            />
          );
        })}
      </Svg>
    );
  };

  // Render plants with exact same structure as DraggablePlant (scaled down)
  const renderPlants = () => {
    return plants.map((plant) => {
      if (!plant.gridPosition) return null;

      // Use the same base size ratio as DraggablePlant but scaled for mini garden
      const baseSize = 9; // Half of DraggablePlant's 18px
      const screenPos = gridToScreen(plant.gridPosition, miniGridConfig);
      const emoji = plant.plantType?.emoji || '🌱';

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
              <Text style={[
                styles.plantEmoji,
                plant.isWilted && styles.wiltedPlant,
              ]}>
                {emoji}
              </Text>
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
        {renderGridTiles()}
        {renderPlants()}
      </TouchableOpacity>
      <Text style={styles.friendName} numberOfLines={1}>
        {friendName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    margin: 8,
  },
  gardenContainer: {
    backgroundColor: Theme.colors.background.secondary,
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
    width: 9, // Half of DraggablePlant's 18px
    height: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plantImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plantEmoji: {
    fontSize: 7, // Half of DraggablePlant's 14px
    textAlign: 'center',
  },
  wiltedPlant: {
    opacity: 0.6,
  },
  friendName: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: Theme.colors.text.primary,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: 120,
  },
});

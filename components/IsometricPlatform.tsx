import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { gridToScreen, IsometricGridConfig } from '../utils/isometricGrid';

interface IsometricPlatformProps {
  /** Grid config to match existing isometric projection */
  gridConfig: IsometricGridConfig;
}

/**
 * Renders the platform PNG image positioned exactly at the isometric grid center
 */
export default function IsometricPlatform({
  gridConfig,
}: IsometricPlatformProps) {
  // Center the platform at the grid center (same as plants)
  const centerRow = Math.floor(gridConfig.gridSize / 2);
  const centerCol = Math.floor(gridConfig.gridSize / 2);

  // Get the exact screen position where the grid center is
  const centerPosition = gridToScreen({ row: centerRow, col: centerCol }, gridConfig);

  // Platform image dimensions (adjust as needed)
  const platformWidth = 300;
  const platformHeight = 200;

  // Position the image so its center aligns with the grid center
  const imageX = centerPosition.x - platformWidth / 2;
  const imageY = centerPosition.y - platformHeight / 2;

  return (
    <View pointerEvents="none" style={styles.container}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    left: 5,
    right: 0,
    bottom: 0,
  },
  platformImage: {
    position: 'absolute',
  },
});



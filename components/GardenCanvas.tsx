import React, { ReactNode } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { TapGestureHandler } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import {
  DEFAULT_GRID_CONFIG,
  getAllGridPositions,
  getGridTileCorners,
  GridPosition,
  IsometricGridConfig,
  snapToGrid
} from '../utils/isometricGrid';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface GardenCanvasProps {
  children?: ReactNode;
  backgroundColor?: string;
  onCanvasTap?: (event: any) => void;
  onGridTap?: (gridPos: GridPosition) => void;
  unlockedTiles?: Array<{ x: number; y: number; unlockedAt: string }>;
  gridConfig?: IsometricGridConfig;
  showGrid?: boolean;
}

export default function GardenCanvas({
  children,
  backgroundColor = '#F8F9FA',
  onCanvasTap,
  onGridTap,
  unlockedTiles = [],
  gridConfig = DEFAULT_GRID_CONFIG,
  showGrid = true,
}: GardenCanvasProps) {

  // Canvas size to fit the isometric grid with padding
  const canvasWidth = screenWidth * 2;
  const canvasHeight = screenHeight * 2;

  // Handle tap gestures - convert to grid coordinates
  const handleTap = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      const { x, y } = event.nativeEvent;

      // Call original canvas tap handler if provided
      if (onCanvasTap) {
        onCanvasTap(event);
      }

      // Call grid tap handler if provided
      if (onGridTap) {
        const gridPos = snapToGrid({ x, y }, gridConfig);
        onGridTap(gridPos);
      }
    }
  };

  // Render grid tiles
  const renderGridTiles = () => {
    if (!showGrid) return null;

    const allPositions = getAllGridPositions(gridConfig);

    return (
      <Svg
        style={StyleSheet.absoluteFillObject}
        width={canvasWidth}
        height={canvasHeight}
      >
        {allPositions.map((gridPos, index) => {
          const corners = getGridTileCorners(gridPos, gridConfig);

          // Create diamond path
          const pathData = `M ${corners[0].x} ${corners[0].y} L ${corners[1].x} ${corners[1].y} L ${corners[2].x} ${corners[2].y} L ${corners[3].x} ${corners[3].y} Z`;

          return (
            <Path
              key={`${gridPos.row}-${gridPos.col}`}
              d={pathData}
              fill='rgba(34, 197, 94, 0.1)' // All tiles are available (green)
              stroke='rgba(34, 197, 94, 0.3)'
              strokeWidth={1}
            />
          );
        })}
      </Svg>
    );
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[
        styles.canvas,
        {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor,
        }
      ]}
      maximumZoomScale={3}
      minimumZoomScale={0.4}
      zoomScale={0.5}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bounces={true}
      bouncesZoom={true}
      // Start in center of canvas where the grid is
      contentOffset={{
        x: (canvasWidth - screenWidth) / 2,
        y: (canvasHeight - screenHeight) / 4,
      }}
    >
      <TapGestureHandler onHandlerStateChange={handleTap}>
        <View style={styles.canvasContent}>
          {/* Render the isometric grid */}
          {renderGridTiles()}

          {/* Render children (plants) on top of grid */}
          {children}
        </View>
      </TapGestureHandler>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  canvas: {
    position: 'relative',
    // Light background with subtle pattern
    backgroundColor: '#F8F9FA',
  },
  canvasContent: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

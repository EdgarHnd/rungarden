import Theme from '@/constants/theme';
import React, { ReactNode, useRef } from 'react';
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
  onDoubleTap?: () => void;
  unlockedTiles?: Array<{ x: number; y: number; unlockedAt: string }>;
  gridConfig?: IsometricGridConfig;
  showGrid?: boolean;
  // Optional: allow disabling zoom cleanly
  enableZoom?: boolean;
}

export default function GardenCanvas({
  children,
  backgroundColor = Theme.colors.background.primary, //'#E3D1B9', 
  onCanvasTap,
  onGridTap,
  onDoubleTap,
  unlockedTiles = [],
  gridConfig = DEFAULT_GRID_CONFIG,
  showGrid = true,
  enableZoom = true,
}: GardenCanvasProps) {

  // Canvas size matches screen dimensions
  const canvasWidth = screenWidth;
  const canvasHeight = screenHeight;

  // Double-tap detection
  const lastTapRef = useRef<number>(0);
  const tapCountRef = useRef<number>(0);

  // Handle tap gestures - convert to grid coordinates and detect double-tap
  const handleTap = (event: any) => {
    if (event.nativeEvent.state === 4) { // State.END
      const now = Date.now();
      const { x, y } = event.nativeEvent;

      // Double-tap detection logic
      const timeSinceLastTap = now - lastTapRef.current;

      if (timeSinceLastTap < 300) { // 300ms window for double-tap
        tapCountRef.current += 1;

        if (tapCountRef.current === 2) {
          // Double-tap detected!
          if (onDoubleTap) {
            onDoubleTap();
          }
          tapCountRef.current = 0; // Reset counter
          return; // Don't process as single tap
        }
      } else {
        tapCountRef.current = 1; // First tap or reset
      }

      lastTapRef.current = now;

      // Delay single-tap actions to allow for potential double-tap
      setTimeout(() => {
        if (tapCountRef.current === 1) {
          // Process as single tap after delay
          if (onCanvasTap) {
            onCanvasTap(event);
          }

          if (onGridTap) {
            const gridPos = snapToGrid({ x, y }, gridConfig);
            onGridTap(gridPos);
          }
          tapCountRef.current = 0; // Reset counter
        }
      }, 300);
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
      maximumZoomScale={enableZoom ? 8 : 1}
      minimumZoomScale={1}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      bounces={true}
      bouncesZoom={true}
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
  },
  canvasContent: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100%',
    minWidth: '100%',
  },
});

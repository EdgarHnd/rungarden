import React, { ReactNode } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { TapGestureHandler } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface GardenCanvasProps {
  children?: ReactNode;
  backgroundColor?: string;
  onCanvasTap?: (event: any) => void;
}

export default function GardenCanvas({
  children,
  backgroundColor = '#F8F9FA',
  onCanvasTap,
}: GardenCanvasProps) {

  // Large canvas size for unlimited garden space
  const canvasWidth = screenWidth * 3;
  const canvasHeight = screenHeight * 3;

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
      minimumZoomScale={0.3}
      showsVerticalScrollIndicator={true}
      showsHorizontalScrollIndicator={true}
      bounces={true}
      bouncesZoom={true}
      // Start in center of canvas
      contentOffset={{
        x: (canvasWidth - screenWidth) / 2,
        y: (canvasHeight - screenHeight) / 2,
      }}
    >
      <TapGestureHandler onHandlerStateChange={onCanvasTap}>
        <View style={styles.canvasContent}>
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

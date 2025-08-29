import React, { ReactNode, useState } from 'react';
import {
  PanResponder,
  View,
  ViewStyle
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

interface DiamondTouchableProps {
  style?: ViewStyle;
  onPress: () => void;
  children: ReactNode;
  activeOpacity?: number;
  size: number; // fallback, will be used as width when height not provided
  width?: number;   // diamond width (isometric tile width)
  height?: number;  // diamond height (isometric tile height)
}

export default function DiamondTouchable({
  style,
  onPress,
  children,
  activeOpacity = 0.7,
  size,
  width,
  height,
}: DiamondTouchableProps) {
  const [isPressed, setIsPressed] = useState(false);
  // Check if touch point is inside diamond shape - matches SVG diamond exactly
  const isPointInDiamond = (x: number, y: number, centerX: number, centerY: number, diamondWidth: number, diamondHeight: number) => {
    // Transform to diamond coordinate system
    const dx = Math.abs(x - centerX);
    const dy = Math.abs(y - centerY);

    // Perfect diamond equation: |x|/a + |y|/b <= 1
    // Where a = half width, b = half height
    const radiusX = diamondWidth / 2;
    const radiusY = diamondHeight / 2;
    const isInside = (dx / radiusX + dy / radiusY) <= 1;

    // Debug logging
    console.log('SVG Diamond touch test:', { x, y, dx, dy, radiusX, radiusY, isInside, centerX, centerY, diamondWidth, diamondHeight });

    return isInside;
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const w = width ?? size;
      const h = height ?? size;
      const centerX = w / 2;
      const centerY = h / 2;

      // Only respond if touch is inside diamond
      return isPointInDiamond(locationX, locationY, centerX, centerY, w, h);
    },

    onMoveShouldSetPanResponder: () => false, // Don't capture move events

    onPanResponderGrant: () => {
      // Touch started in diamond - show visual feedback
      setIsPressed(true);
    },

    onPanResponderRelease: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const w = width ?? size;
      const h = height ?? size;
      const centerX = w / 2;
      const centerY = h / 2;

      // Remove visual feedback
      setIsPressed(false);

      // Only trigger onPress if release is still inside diamond
      if (isPointInDiamond(locationX, locationY, centerX, centerY, w, h)) {
        onPress();
      }
    },

    onPanResponderTerminate: () => {
      // Touch was cancelled - remove visual feedback
      setIsPressed(false);
    },
  });

  // Create diamond path points from width/height to match isometric tile
  const w = width ?? size;
  const h = height ?? size;
  const centerX = w / 2;
  const centerY = h / 2;
  const diamondPoints = `${centerX},0 ${w},${centerY} ${centerX},${h} 0,${centerY}`;

  return (
    <View
      style={[
        {
          width: w,
          height: h,
          justifyContent: 'center',
          alignItems: 'center',
          transform: [{ scale: isPressed ? 0.95 : 1.0 }],
        },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      {/* SVG Diamond Shape */}
      <Svg
        width={w}
        height={h}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        <Polygon
          points={diamondPoints}
          fill={isPressed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(34, 197, 94, 0.1)'}
          stroke="rgba(34, 197, 94, 0.5)"
          strokeWidth="1"
        />
      </Svg>

      {/* Children container */}
      <View style={{
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
      }}>
        {children}
      </View>
    </View>
  );
}

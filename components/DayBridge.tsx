import Theme from '@/constants/theme';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface DayBridgeProps {
  selectedDayPosition: number; // X position of selected day card (0-4 for 5 cards)
  isVisible: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export default function DayBridge({ selectedDayPosition, isVisible }: DayBridgeProps) {
  if (!isVisible) return null;

  // Curve configuration parameters
  const BOTTOM_WIDTH_MULTIPLIER = 2;
  const CURVE_CONTROL_DISTANCE = 5;
  const CURVE_STEEPNESS = 1;

  // Match the exact dimensions and spacing from WeekViewHorizontal
  const cardWidth = 80;
  const horizontalPadding = 15;

  // SVG path dimensions
  const bridgeWidth = screenWidth;
  const bridgeHeight = 20;

  // Calculate path data based on current position
  const effectiveWidth = screenWidth - (2 * horizontalPadding);
  const cardCenterX = horizontalPadding + (effectiveWidth / 5) * (selectedDayPosition + 0.5);
  const funnelTopWidth = cardWidth;
  const funnelTopLeft = cardCenterX - (funnelTopWidth / 2);
  const funnelTopRight = cardCenterX + (funnelTopWidth / 2);
  const bottomWidth = cardWidth * BOTTOM_WIDTH_MULTIPLIER;
  const bottomLeft = cardCenterX - (bottomWidth / 2);
  const bottomRight = cardCenterX + (bottomWidth / 2);

  const isLeftSide = selectedDayPosition < 2;
  const isRightSide = selectedDayPosition > 2;

  let pathData;
  if (isLeftSide) {
    pathData = `
      M ${funnelTopLeft} 0
      L ${funnelTopRight} 0
      Q ${funnelTopRight + CURVE_CONTROL_DISTANCE} ${bridgeHeight * CURVE_STEEPNESS} ${bottomRight} ${bridgeHeight}
      L ${bottomLeft} ${bridgeHeight}
      Q ${funnelTopLeft - (CURVE_CONTROL_DISTANCE * 0.5)} ${bridgeHeight * CURVE_STEEPNESS} ${funnelTopLeft} 0
      Z
    `;
  } else if (isRightSide) {
    pathData = `
      M ${funnelTopLeft} 0
      L ${funnelTopRight} 0
      Q ${funnelTopRight + (CURVE_CONTROL_DISTANCE * 0.5)} ${bridgeHeight * CURVE_STEEPNESS} ${bottomRight} ${bridgeHeight}
      L ${bottomLeft} ${bridgeHeight}
      Q ${funnelTopLeft - CURVE_CONTROL_DISTANCE} ${bridgeHeight * CURVE_STEEPNESS} ${funnelTopLeft} 0
      Z
    `;
  } else {
    pathData = `
      M ${funnelTopLeft} 0
      L ${funnelTopRight} 0
      Q ${funnelTopRight + CURVE_CONTROL_DISTANCE} ${bridgeHeight * CURVE_STEEPNESS} ${bottomRight} ${bridgeHeight}
      L ${bottomLeft} ${bridgeHeight}
      Q ${funnelTopLeft - CURVE_CONTROL_DISTANCE} ${bridgeHeight * CURVE_STEEPNESS} ${funnelTopLeft} 0
      Z
    `;
  }

  return (
    <View style={styles.container}>
      <Svg
        width={bridgeWidth}
        height={bridgeHeight}
        style={styles.svg}
      >
        <Path
          d={pathData}
          fill={Theme.colors.background.tertiary}
          stroke="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, // Position below the week view cards
    left: 0,
    right: 0,
    height: 20,
    zIndex: 1,
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
}); 
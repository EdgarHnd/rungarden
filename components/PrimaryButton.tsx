import { Theme } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  hapticFeedback?: 'light' | 'medium' | 'heavy';
  style?: ViewStyle;
  fullWidth?: boolean;
  textWeight?: 'regular' | 'medium' | 'semibold' | 'bold' | 'black';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  gradientReversed?: boolean;
  gradientColors?: [string, string];
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  gap?: number;
}

export default function PrimaryButton({
  title,
  onPress,
  size = 'medium',
  variant = 'primary',
  disabled = false,
  hapticFeedback = 'medium',
  style,
  fullWidth = false,
  textWeight = 'bold',
  textTransform = 'uppercase',
  gradientReversed = true,
  gradientColors,
  icon,
  iconPosition = 'left',
  gap = 8,
}: PrimaryButtonProps) {
  const handlePress = () => {
    if (disabled) return;

    // Trigger haptic feedback
    try {
      const hapticStyle = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      }[hapticFeedback];

      Haptics.impactAsync(hapticStyle);
    } catch (error) {
      console.log('Haptic feedback error:', error);
    }

    onPress();
  };

  const buttonStyle: ViewStyle[] = [
    styles.button,
    styles[`button${size.charAt(0).toUpperCase() + size.slice(1)}` as keyof typeof styles] as ViewStyle,
    styles[`button${variant.charAt(0).toUpperCase() + variant.slice(1)}` as keyof typeof styles] as ViewStyle,
    disabled && styles.buttonDisabled,
    fullWidth && styles.buttonFullWidth,
    style,
  ].filter(Boolean) as ViewStyle[];

  const weightToFont: Record<'regular' | 'medium' | 'semibold' | 'bold' | 'black', string> = {
    regular: Theme.fonts.regular,
    medium: Theme.fonts.medium,
    semibold: Theme.fonts.semibold,
    bold: Theme.fonts.bold,
    black: Theme.fonts.black,
  };

  const textStyle: TextStyle[] = [
    styles.text,
    styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}` as keyof typeof styles] as TextStyle,
    styles[`text${variant.charAt(0).toUpperCase() + variant.slice(1)}` as keyof typeof styles] as TextStyle,
    disabled && styles.textDisabled,
    { fontFamily: weightToFont[textWeight], textTransform },
  ].filter(Boolean) as TextStyle[];

  const getGradientColors = (): [string, string] => {
    if (disabled) return [Theme.colors.background.disabled, Theme.colors.background.disabled];
    if (variant === 'secondary') return [Theme.colors.background.secondary, Theme.colors.background.secondary];

    // Use provided gradient or default to product blue gradient
    const base: [string, string] = gradientColors ?? ['#2B27FF', '#4FA1FF'];
    return gradientReversed ? ([...base].reverse() as [string, string]) : base;
  };

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      activeOpacity={disabled ? 1 : 0.8}
      disabled={disabled}
    >
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.gradientContainer,
          styles[`gradient${size.charAt(0).toUpperCase() + size.slice(1)}` as keyof typeof styles] as ViewStyle,
        ]}
      >
        <View style={[styles.contentRow, { gap }]}>
          {icon && iconPosition === 'left' && icon}
          <Text style={textStyle}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Base button styles
  button: {
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden', // Ensures gradient respects border radius
  },

  gradientContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Gradient size variants (handles padding and height so gradient fills the pill)
  gradientSmall: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  gradientMedium: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },
  gradientLarge: {
    paddingHorizontal: 28,
    paddingVertical: 18,
    minHeight: 60,
  },

  // Size variants
  buttonSmall: {
    minWidth: 80,
    borderRadius: Theme.borderRadius.full,
  },
  buttonMedium: {
    minWidth: 120,
    borderRadius: Theme.borderRadius.full,
  },
  buttonLarge: {
    minWidth: 150,
    borderRadius: Theme.borderRadius.full,
  },

  // Color variants (background removed since gradient handles colors)
  buttonPrimary: {
    // Gradient handles the background
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },

  // States
  buttonDisabled: {
    // Gradient handles the disabled background
  },
  buttonFullWidth: {
    alignSelf: 'stretch',
    minWidth: undefined,
  },

  // Base text styles
  text: {
    fontFamily: Theme.fonts.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
  },

  // Text size variants
  textSmall: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
  },
  textMedium: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
  },
  textLarge: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
  },

  // Text color variants
  textPrimary: {
    color: '#FFFFFF',
  },
  textSecondary: {
    color: Theme.colors.text.primary,
  },
  textDisabled: {
    color: Theme.colors.text.disabled,
  },
});

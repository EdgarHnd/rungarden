import Theme from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';

interface SyncLoadingModalProps {
  visible: boolean;
  source?: 'strava' | 'healthkit';
}

export default function SyncLoadingModal({
  visible,
  source = 'strava',
}: SyncLoadingModalProps) {
  const [dots, setDots] = useState('');

  // Animation values
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const iconRotation = useSharedValue(0);

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { scale: interpolate(opacity.value, [0, 1], [0.9, 1]) }
      ]
    };
  });

  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${iconRotation.value}deg` }
      ]
    };
  });

  // Animate dots
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [visible]);

  // Entrance/exit animations
  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withTiming(1, { duration: 300 });
      iconRotation.value = withRepeat(
        withTiming(360, { duration: 2000 }),
        -1,
        false
      );
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.8, { duration: 200 });
      iconRotation.value = 0;
    }
  }, [visible]);

  if (!visible) return null;

  const getSourceInfo = () => {
    switch (source) {
      case 'strava':
        return {
          title: 'Syncing from Strava',
          subtitle: 'Importing your runs from this year',
          icon: '🏃‍♂️',
          color: Theme.colors.accent.primary
        };
      case 'healthkit':
        return {
          title: 'Syncing from Apple Health',
          subtitle: 'Importing your runs from this year',
          icon: '🏃‍♂️',
          color: Theme.colors.accent.primary
        };
      default:
        return {
          title: 'Syncing Your Runs',
          subtitle: 'Importing your activities',
          icon: '🏃‍♂️',
          color: Theme.colors.accent.primary
        };
    }
  };

  const sourceInfo = getSourceInfo();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={() => { }} // Prevent dismissal
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <Reanimated.View style={[styles.modalContent, modalAnimatedStyle]}>
            <View style={styles.header}>
              <Reanimated.View style={[styles.iconContainer, iconAnimatedStyle]}>
                <Text style={styles.icon}>{sourceInfo.icon}</Text>
              </Reanimated.View>
              <Text style={styles.title}>{sourceInfo.title}</Text>
              <Text style={styles.subtitle}>{sourceInfo.subtitle}</Text>
            </View>

            <View style={styles.loadingSection}>
              <ActivityIndicator
                size="large"
                color={sourceInfo.color}
                style={styles.spinner}
              />
              <Text style={styles.loadingText}>
                Please wait{dots}
              </Text>
              <Text style={styles.loadingSubtext}>
                This may take a moment for large activity histories
              </Text>
            </View>

            <View style={styles.footer}>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Reanimated.View
                    style={[
                      styles.progressFill,
                      { backgroundColor: sourceInfo.color }
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.footerText}>
                Analyzing your running data...
              </Text>
            </View>
          </Reanimated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  modalContent: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xxxl,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },

  // Header Section
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary + '20',
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Loading Section
  loadingSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
  },
  spinner: {
    marginBottom: Theme.spacing.lg,
  },
  loadingText: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.sm,
  },
  loadingSubtext: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Footer Section
  footer: {
    width: '100%',
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: Theme.spacing.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '100%',
    borderRadius: 2,
    opacity: 0.8,
  },
  footerText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
});

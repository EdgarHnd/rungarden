import Theme from '@/constants/theme';
import { useSyncProvider } from '@/provider/SyncProvider';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Dimensions, Image, Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  interpolate,
  default as Reanimated,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => Promise<void>;
}

type SyncOption = 'rungarden' | 'healthkit' | 'strava';
type Step = 'options' | 'setup';

export default function WelcomeModal({ visible, onClose }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState<Step>('options');
  const [selectedOption, setSelectedOption] = useState<SyncOption | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const {
    connectHealthKit,
    connectStrava,
    isHealthKitSyncing,
    isStravaSyncing,
    isConnecting: providerConnecting,
  } = useSyncProvider();

  // Animations
  const stepOpacity = useSharedValue(1);
  const stepScale = useSharedValue(1);

  const stepAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: stepOpacity.value,
      transform: [
        {
          scale: interpolate(
            stepScale.value,
            [0, 1],
            [0.8, 1]
          ),
        },
      ],
    };
  });

  const animateStepTransition = (callback: () => void) => {
    stepOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(callback)();
      stepScale.value = 0;
      stepOpacity.value = withTiming(1, { duration: 300 });
      stepScale.value = withSpring(1, {
        damping: 15,
        stiffness: 100,
      });
    });
  };

  const handleOptionSelect = (option: SyncOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedOption(option);
    animateStepTransition(() => setCurrentStep('setup'));
  };

  const handleSetupComplete = async () => {
    if (!selectedOption) return;

    try {
      setIsConnecting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (selectedOption === 'healthkit') {
        await connectHealthKit();
      } else if (selectedOption === 'strava') {
        await connectStrava();
      }

      await onClose();
    } catch (error: any) {
      console.error('Error during setup:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Setup Error', error?.message || 'Failed to complete setup. You can try again in Settings.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentStep === 'setup') {
      setSelectedOption(null);
      animateStepTransition(() => setCurrentStep('options'));
    }
  };

  const renderOptionsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Choose Your Data Source</Text>

      <Text style={styles.description}>
        How would you like to track your runs? You can change this later in Settings.
      </Text>

      <View style={styles.optionsContainer}>
        {/* Run Garden In-App Recording */}
        <TouchableOpacity
          style={[styles.optionCard, selectedOption === 'rungarden' && styles.selectedOptionCard]}
          onPress={() => handleOptionSelect('rungarden')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <Image source={require('@/assets/images/icon.png')} style={styles.optionIcon} />
            <Text style={styles.optionTitle}>Run Garden Tracker</Text>
          </View>
          <Text style={styles.optionDescription}>
            Record runs directly with our built-in GPS tracker
          </Text>
          <View style={styles.optionBadge}>
            <Text style={styles.optionBadgeText}>Recommended</Text>
          </View>
        </TouchableOpacity>

        {/* Apple HealthKit */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.optionCard, selectedOption === 'healthkit' && styles.selectedOptionCard]}
            onPress={() => handleOptionSelect('healthkit')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <Image source={require('@/assets/images/icons/apple-health.png')} style={styles.optionIcon} />
              <Text style={styles.optionTitle}>Apple HealthKit</Text>
            </View>
            <Text style={styles.optionDescription}>
              Sync running activities from the Health app
            </Text>
          </TouchableOpacity>
        )}

        {/* Strava */}
        <TouchableOpacity
          style={[styles.optionCard, selectedOption === 'strava' && styles.selectedOptionCard]}
          onPress={() => handleOptionSelect('strava')}
          activeOpacity={0.7}
        >
          <View style={styles.optionHeader}>
            <Image source={require('@/assets/images/icons/strava.png')} style={styles.optionIcon} />
            <Text style={styles.optionTitle}>Strava</Text>
          </View>
          <Text style={styles.optionDescription}>
            Import your running activities from Strava
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );

  const renderSetupStep = () => {
    if (!selectedOption) return null;

    const isLoading = isConnecting || providerConnecting || isHealthKitSyncing || isStravaSyncing;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.title}>
          {selectedOption === 'rungarden' && 'Ready to Run! 🏃‍♂️'}
          {selectedOption === 'healthkit' && 'Connect to HealthKit'}
          {selectedOption === 'strava' && 'Connect to Strava'}
        </Text>

        {selectedOption === 'rungarden' && (
          <>
            <Text style={styles.description}>
              You're all set! Use Run Garden's built-in tracker to record your runs and grow your garden.
            </Text>

            <View style={styles.setupInstructions}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>Tap the "Record" button when you're ready to run</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>Complete your run and watch your garden grow</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Start Growing Your Garden</Text>
              <FontAwesome5 name="seedling" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}

        {selectedOption === 'healthkit' && (
          <>
            <Text style={styles.description}>
              We'll sync your running activities from the Health app and award plants for your past runs this year.
            </Text>

            <View style={styles.setupInstructions}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>Grant permission to read your workout data</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>We'll sync your runs and award plants</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleSetupComplete}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <Text style={styles.primaryButtonText}>Connecting...</Text>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Connect HealthKit</Text>
                  <FontAwesome5 name="heart" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {selectedOption === 'strava' && (
          <>
            <Text style={styles.description}>
              We'll sync your running activities from Strava and award plants for your past runs this year.
            </Text>

            <View style={styles.setupInstructions}>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>Sign in to your Strava account</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>We'll sync your runs and award plants</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.disabledButton]}
              onPress={handleSetupComplete}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <Text style={styles.primaryButtonText}>Connecting...</Text>
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Connect Strava</Text>
                  <FontAwesome5 name="running" size={16} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {currentStep === 'setup' && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.secondaryButton, isLoading && styles.disabledButton]}
              onPress={handleBack}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <FontAwesome5 name="chevron-left" size={16} color={Theme.colors.text.primary} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <LinearGradient
        colors={[Theme.colors.background.primary, Theme.colors.background.secondary, Theme.colors.background.primary]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <Reanimated.View style={[styles.content, stepAnimatedStyle]}>
            {currentStep === 'options' && renderOptionsStep()}
            {currentStep === 'setup' && renderSetupStep()}
          </Reanimated.View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  description: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.md,
  },
  optionsContainer: {
    width: '100%',
    marginBottom: Theme.spacing.xl,
  },
  optionCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedOptionCard: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: `${Theme.colors.accent.primary}15`,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
  },
  optionIcon: {
    width: 32,
    height: 32,
    marginRight: Theme.spacing.md,
  },
  optionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
  },
  optionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    marginLeft: 44,
  },
  optionBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
  },
  optionBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: '#FFFFFF',
  },
  setupInstructions: {
    width: '100%',
    marginBottom: Theme.spacing.xl,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  instructionNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Theme.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Theme.spacing.md,
  },
  instructionNumberText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: '#FFFFFF',
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  primaryButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: '#FFFFFF',
    marginRight: Theme.spacing.sm,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Theme.colors.background.tertiary,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginLeft: Theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Theme.spacing.lg,
  },
});

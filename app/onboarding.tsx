import Theme from '@/constants/theme';
import { OnboardingData } from '@/constants/types';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuth from 'expo-apple-authentication';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Reanimated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

const redirectTo = makeRedirectUri();

const TOTAL_STEPS = 9; // Welcome, FirstName, LastName, Gender, Age, Units, Schedule, Notifications, Auth

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const analytics = useAnalytics();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGoingBack, setIsGoingBack] = useState(false);

  // Input refs
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const ageInputRef = useRef<TextInput>(null);

  // Onboarding data
  const [data, setData] = useState<OnboardingData>({
    firstName: null,
    lastName: null,
    mascotName: 'Blaze',
    canRun30Min: null,
    goalDistance: null,
    daysPerWeek: 3,
    preferredDays: [],
    metricSystem: null,
    gender: null,
    age: null,
    pushNotificationsEnabled: null,
    weekStartDay: 1, // Monday
    hasRated: null,
  });

  // Helper functions
  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const getEnterAnimation = () => isGoingBack ? SlideInLeft : SlideInRight;
  const getExitAnimation = () => isGoingBack ? SlideOutRight : SlideOutLeft;

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      analytics.track({
        name: `onboarding_step_${currentStep}_completed`,
        properties: { step_number: currentStep },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsGoingBack(true);
      setCurrentStep(currentStep - 1);

      // Reset direction flag after animation
      setTimeout(() => setIsGoingBack(false), 400);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return (data.firstName?.trim()?.length || 0) > 0; // First name
      case 2: return (data.lastName?.trim()?.length || 0) > 0; // Last name
      case 3: return data.gender !== null; // Gender
      case 4: return data.age !== null && data.age > 0; // Age
      case 5: return data.metricSystem !== null; // Units
      case 6: return data.preferredDays.length >= data.daysPerWeek; // Schedule
      case 7: return data.pushNotificationsEnabled !== null; // Notifications
      case 8: return true; // Auth
      default: return false;
    }
  };

  const saveOnboardingDataToStorage = async () => {
    try {
      const onboardingData = {
        trainingProfile: {
          goalDistance: 'just-run-more' as const,
          currentAbility: 'none' as const,
          longestDistance: 'never' as const,
          daysPerWeek: data.daysPerWeek,
          preferredDays: data.preferredDays,
          hasTreadmill: false,
          preferTimeOverDistance: true,
          pushNotificationsEnabled: data.pushNotificationsEnabled,
        },
        userProfile: {
          firstName: data.firstName,
          lastName: data.lastName,
          mascotName: data.mascotName,
          path: 'run-habit' as const,
          metricSystem: data.metricSystem,
          gender: data.gender,
          age: data.age,
          weekStartDay: data.weekStartDay,
        },
      };

      await AsyncStorage.setItem('pendingOnboardingData', JSON.stringify(onboardingData));
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await saveOnboardingDataToStorage();

      analytics.track({
        name: 'onboarding_google_signin_attempted',
        properties: { step: currentStep },
      });

      const { redirect } = await signIn("google", { redirectTo });
      if (Platform.OS === "web") return;

      const result = await openAuthSessionAsync(redirect!.toString(), redirectTo);
      if (result.type === "success") {
        const { url } = result;
        const code = new URL(url).searchParams.get("code")!;
        const signInResult = await signIn("google", { code });

        if (signInResult) {
          analytics.track({
            name: 'onboarding_signin_completed',
            properties: {
              auth_method: 'google',
              step: currentStep
            },
          });
          router.replace('/(app)');
        }
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await saveOnboardingDataToStorage();

      analytics.track({
        name: 'onboarding_apple_signin_attempted',
        properties: { step: currentStep },
      });

      if (Platform.OS === 'ios' && await AppleAuth.isAvailableAsync()) {
        try {
          const credential = await AppleAuth.signInAsync({
            requestedScopes: [
              AppleAuth.AppleAuthenticationScope.FULL_NAME,
              AppleAuth.AppleAuthenticationScope.EMAIL,
            ],
          });

          const result = await signIn('native-apple', credential);
          if (result) {
            analytics.track({
              name: 'onboarding_signin_completed',
              properties: {
                auth_method: 'apple',
                step: currentStep
              },
            });
            router.replace('/(app)');
          }
        } catch (nativeErr: any) {
          if (nativeErr?.code === 'ERR_CANCELED') {
            return; // User cancelled
          }
          console.warn('Native Apple sign-in failed:', nativeErr);
          Alert.alert('Apple Sign-In Error', 'Apple Sign-In failed. Please try again later.');
        }
      } else {
        Alert.alert('Apple Sign-In Unavailable', 'Apple Sign-In is not available on this device.');
      }
    } catch (error) {
      console.error('Apple sign in error:', error);
      Alert.alert('Apple Sign-In Error', 'Failed to sign in with Apple. Please try again.');
    }
  };

  const handleNotificationChoice = async (enabled: boolean) => {
    updateData({ pushNotificationsEnabled: enabled });

    if (enabled) {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.error('Failed to request notification permissions:', err);
      }
    }

    setTimeout(() => nextStep(), 300);
  };

  // Render functions for each step
  const renderWelcome = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(300)}
    >
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['#4CAF50', '#8BC34A', '#CDDC39']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoContainer}
        >
          <Text style={styles.logoEmoji}>🌱</Text>
        </LinearGradient>

        <Text style={styles.appTitle}>Welcome to Run Garden</Text>
        <Text style={styles.appTagline}>Grow your garden with every run</Text>
      </View>

      <View style={styles.featuresSection}>
        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>🏃‍♂️</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Run & Earn Plants</Text>
            <Text style={styles.featureDescription}>Every run rewards you with plants based on distance</Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>🌳</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Build Your Garden</Text>
            <Text style={styles.featureDescription}>Plant and grow your collection in a beautiful garden</Text>
          </View>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureEmoji}>👥</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Share with Friends</Text>
            <Text style={styles.featureDescription}>Visit friends' gardens and motivate each other</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.continueButton}
        onPress={nextStep}
      >
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );

  const renderFirstName = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Reanimated.View
        style={styles.stepContainer}
        entering={getEnterAnimation()}
        exiting={getExitAnimation()}
      >
        <View style={styles.inputSection}>
          <Text style={styles.stepTitle}>What's your first name?</Text>
          <TextInput
            ref={firstNameInputRef}
            style={styles.textInput}
            placeholder="Edgar"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.firstName || ''}
            onChangeText={(text) => updateData({ firstName: text })}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canProceed() && nextStep()}
          />
        </View>
      </Reanimated.View>
    </TouchableWithoutFeedback>
  );

  const renderLastName = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Reanimated.View
        style={styles.stepContainer}
        entering={getEnterAnimation()}
        exiting={getExitAnimation()}
      >
        <View style={styles.inputSection}>
          <Text style={styles.stepTitle}>What's your last name?</Text>
          <TextInput
            ref={lastNameInputRef}
            style={styles.textInput}
            placeholder="Haond"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.lastName || ''}
            onChangeText={(text) => updateData({ lastName: text })}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canProceed() && nextStep()}
          />
        </View>
      </Reanimated.View>
    </TouchableWithoutFeedback>
  );

  const renderGender = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.optionsSection}>
        <Text style={styles.stepTitle}>What's your gender?</Text>
        <View style={styles.optionsContainer}>
          {[
            { value: 'female', title: 'Female' },
            { value: 'male', title: 'Male' },
            { value: 'other', title: 'Other' },
          ].map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                data.gender === option.value && styles.optionButtonSelected
              ]}
              onPress={() => {
                updateData({ gender: option.value as any });
                setTimeout(() => nextStep(), 300);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                data.gender === option.value && styles.optionButtonTextSelected
              ]}>
                {option.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Reanimated.View>
  );

  const renderAge = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Reanimated.View
        style={styles.stepContainer}
        entering={getEnterAnimation()}
        exiting={getExitAnimation()}
      >
        <View style={styles.inputSection}>
          <Text style={styles.stepTitle}>What's your age?</Text>
          <TextInput
            ref={ageInputRef}
            style={styles.textInput}
            placeholder="35"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.age?.toString() || ''}
            onChangeText={(text) => {
              const age = parseInt(text) || null;
              updateData({ age });
            }}
            keyboardType="numeric"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => canProceed() && nextStep()}
          />
        </View>
      </Reanimated.View>
    </TouchableWithoutFeedback>
  );

  const renderUnits = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.optionsSection}>
        <Text style={styles.stepTitle}>Choose your units</Text>
        <View style={styles.unitsContainer}>
          <TouchableOpacity
            style={[
              styles.unitCard,
              data.metricSystem === 'metric' && styles.unitCardSelected
            ]}
            onPress={() => {
              updateData({ metricSystem: 'metric' });
              setTimeout(() => nextStep(), 300);
            }}
          >
            <Text style={styles.unitTitle}>Metric</Text>
            <Text style={styles.unitSubtitle}>km, kg, °C</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.unitCard,
              data.metricSystem === 'imperial' && styles.unitCardSelected
            ]}
            onPress={() => {
              updateData({ metricSystem: 'imperial' });
              setTimeout(() => nextStep(), 300);
            }}
          >
            <Text style={styles.unitTitle}>Imperial</Text>
            <Text style={styles.unitSubtitle}>miles, lbs, °F</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Reanimated.View>
  );

  const renderSchedule = () => {
    const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <Reanimated.View
        style={styles.stepContainer}
        entering={getEnterAnimation()}
        exiting={getExitAnimation()}
      >
        <View style={styles.scheduleSection}>
          <Text style={styles.stepTitle}>Set your training schedule</Text>

          <View style={styles.daysPerWeekSection}>
            <Text style={styles.sectionSubtitle}>Days per week (1-7)</Text>
            <View style={styles.counterContainer}>
              <TouchableOpacity
                style={[styles.counterButton, data.daysPerWeek <= 1 && styles.counterButtonDisabled]}
                onPress={() => {
                  if (data.daysPerWeek > 1) {
                    updateData({
                      daysPerWeek: data.daysPerWeek - 1,
                      preferredDays: []
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                disabled={data.daysPerWeek <= 1}
              >
                <Ionicons name="remove" size={24} color={Theme.colors.text.primary} />
              </TouchableOpacity>

              <View style={styles.counterDisplay}>
                <Text style={styles.counterNumber}>{data.daysPerWeek}</Text>
              </View>

              <TouchableOpacity
                style={[styles.counterButton, data.daysPerWeek >= 7 && styles.counterButtonDisabled]}
                onPress={() => {
                  if (data.daysPerWeek < 7) {
                    updateData({
                      daysPerWeek: data.daysPerWeek + 1,
                      preferredDays: []
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
                disabled={data.daysPerWeek >= 7}
              >
                <Ionicons name="add" size={24} color={Theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.preferredDaysSection}>
            <Text style={styles.sectionSubtitle}>
              Select {data.daysPerWeek} preferred day{data.daysPerWeek > 1 ? 's' : ''}
            </Text>
            <View style={styles.daysGrid}>
              {allDays.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    data.preferredDays.includes(day) && styles.dayButtonSelected
                  ]}
                  onPress={() => {
                    const newPreferred = data.preferredDays.includes(day)
                      ? data.preferredDays.filter(d => d !== day)
                      : data.preferredDays.length < data.daysPerWeek
                        ? [...data.preferredDays, day]
                        : data.preferredDays;

                    updateData({ preferredDays: newPreferred });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={!data.preferredDays.includes(day) && data.preferredDays.length >= data.daysPerWeek}
                >
                  <Text style={[
                    styles.dayButtonText,
                    data.preferredDays.includes(day) && styles.dayButtonTextSelected
                  ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Reanimated.View>
    );
  };

  const renderNotifications = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.optionsSection}>
        <Text style={styles.stepTitle}>Enable notifications?</Text>
        <Text style={styles.stepDescription}>
          Get reminders for your training sessions and celebrate your progress
        </Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              data.pushNotificationsEnabled === false && styles.optionButtonSelected
            ]}
            onPress={() => handleNotificationChoice(false)}
          >
            <Text style={[
              styles.optionButtonText,
              data.pushNotificationsEnabled === false && styles.optionButtonTextSelected
            ]}>
              No
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.optionButton,
              data.pushNotificationsEnabled === true && styles.optionButtonSelected
            ]}
            onPress={() => handleNotificationChoice(true)}
          >
            <Text style={[
              styles.optionButtonText,
              data.pushNotificationsEnabled === true && styles.optionButtonTextSelected
            ]}>
              Yes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Reanimated.View>
  );

  const renderAuth = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.authSection}>
        <Text style={styles.stepTitle}>Sign up to save your progress</Text>
        <Text style={styles.stepDescription}>
          Keep your garden and running data safe across all your devices
        </Text>

        <View style={styles.authBenefits}>
          <View style={styles.benefit}>
            <View style={styles.benefitCheck}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <Text style={styles.benefitText}>Save your garden progress</Text>
          </View>

          <View style={styles.benefit}>
            <View style={styles.benefitCheck}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <Text style={styles.benefitText}>Sync between devices</Text>
          </View>

          <View style={styles.benefit}>
            <View style={styles.benefitCheck}>
              <Ionicons name="checkmark" size={16} color="white" />
            </View>
            <Text style={styles.benefitText}>Connect with friends</Text>
          </View>
        </View>

        <View style={styles.authButtons}>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
          >
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            >
              <Ionicons name="logo-apple" size={20} color="white" />
              <Text style={styles.appleButtonText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.privacyText}>
          We only use your account for authentication. Your data stays private.
        </Text>
      </View>
    </Reanimated.View>
  );

  const renderProgressBar = () => {
    if (currentStep === 0) return null;

    return (
      <View style={styles.progressBarContainer}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
          </TouchableOpacity>
        )}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentStep / (TOTAL_STEPS - 1)) * 100}%` }
            ]}
          />
        </View>
      </View>
    );
  };

  const renderContinueButton = () => {
    // Show continue button for steps that need manual progression
    const needsContinueButton = [1, 2, 4, 6]; // FirstName, LastName, Age, Schedule

    if (!needsContinueButton.includes(currentStep)) return null;

    return (
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, !canProceed() && styles.continueButtonDisabled]}
          onPress={nextStep}
          disabled={!canProceed()}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderProgressBar()}
      <View style={styles.content}>
        {currentStep === 0 && renderWelcome()}
        {currentStep === 1 && renderFirstName()}
        {currentStep === 2 && renderLastName()}
        {currentStep === 3 && renderGender()}
        {currentStep === 4 && renderAge()}
        {currentStep === 5 && renderUnits()}
        {currentStep === 6 && renderSchedule()}
        {currentStep === 7 && renderNotifications()}
        {currentStep === 8 && renderAuth()}
      </View>
      {renderContinueButton()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  content: {
    flex: 1,
  },

  // Progress bar styles
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 50,
    paddingBottom: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginRight: Theme.spacing.md,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.full,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.full,
  },

  // Step container
  stepContainer: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'center',
  },

  // Welcome screen styles
  heroSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Theme.shadows.large,
  },
  logoEmoji: {
    fontSize: 48,
  },
  appTitle: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  appTagline: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  featuresSection: {
    gap: Theme.spacing.lg,
    marginBottom: 60,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  featureEmoji: {
    fontSize: 32,
    marginRight: Theme.spacing.lg,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },

  // Input section styles
  inputSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  stepTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  stepDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Theme.spacing.xl,
  },
  textInput: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    width: '100%',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },

  // Options section styles
  optionsSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  optionsContainer: {
    gap: Theme.spacing.lg,
    width: '100%',
  },
  optionButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  optionButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  optionButtonTextSelected: {
    color: Theme.colors.accent.primary,
  },

  // Units section styles
  unitsContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.lg,
    width: '100%',
  },
  unitCard: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  unitCardSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  unitTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  unitSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },

  // Schedule section styles
  scheduleSection: {
    gap: Theme.spacing.xxxl,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  daysPerWeekSection: {
    alignItems: 'center',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  counterButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  counterDisplay: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 80,
    alignItems: 'center',
  },
  counterNumber: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },

  preferredDaysSection: {
    alignItems: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'center',
  },
  dayButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    minWidth: 45,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayButtonSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  dayButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  dayButtonTextSelected: {
    color: Theme.colors.accent.primary,
  },

  // Auth section styles
  authSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  authBenefits: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.lg,
    width: '100%',
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Theme.colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  benefitText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },

  authButtons: {
    gap: Theme.spacing.md,
    width: '100%',
  },
  googleButton: {
    backgroundColor: '#DB4437',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: 'white',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    ...Theme.shadows.medium,
  },
  appleButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: 'white',
  },

  privacyText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Footer styles
  footer: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    ...Theme.shadows.accent,
  },
  continueButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: 'white',
  },
}); 

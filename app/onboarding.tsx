import PrimaryButton from '@/components/PrimaryButton';
import Theme from '@/constants/theme';
import { OnboardingData } from '@/constants/types';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { requestRating } from '@/services/RatingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuth from 'expo-apple-authentication';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
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
  Easing,
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';

const redirectTo = makeRedirectUri();

const TOTAL_STEPS = 10; // Welcome, FirstName, LastName, Gender, Age, Units, Schedule, Notifications, Rating, Auth

// Screen size detection for responsive design
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const IS_SMALL_SCREEN = screenHeight < 700; // Detect older iPhones (iPhone SE, etc.)

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const analytics = useAnalytics();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [isSignInMode, setIsSignInMode] = useState(false);

  // Input refs
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const ageInputRef = useRef<TextInput>(null);

  // Onboarding data
  const [data, setData] = useState<OnboardingData>({
    firstName: null,
    lastName: null,
    gender: null,
    age: null,
    metricSystem: null,
    daysPerWeek: 1,
    preferredDays: [],
    pushNotificationsEnabled: null,
    weekStartDay: 1, // Monday
    hasRated: null, // Whether user completed the rating step
  });

  // Helper functions
  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const getEnterAnimation = () => isGoingBack ?
    SlideInLeft.duration(400).easing(Easing.out(Easing.cubic)) :
    SlideInRight.duration(400).easing(Easing.out(Easing.cubic));
  const getExitAnimation = () => isGoingBack ?
    SlideOutRight.duration(300).easing(Easing.in(Easing.cubic)) :
    SlideOutLeft.duration(300).easing(Easing.in(Easing.cubic));

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
      setTimeout(() => setIsGoingBack(false), 450);
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
      case 8: return data.hasRated !== null; // Rating
      case 9: return true; // Auth
      default: return false;
    }
  };

  const saveOnboardingDataToStorage = async () => {
    try {
      // Store the simplified onboarding data that matches what we actually collect
      const onboardingData: OnboardingData = {
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        age: data.age,
        metricSystem: data.metricSystem,
        daysPerWeek: data.daysPerWeek,
        preferredDays: data.preferredDays,
        pushNotificationsEnabled: data.pushNotificationsEnabled,
        weekStartDay: data.weekStartDay,
        hasRated: data.hasRated,
      };

      await AsyncStorage.setItem('pendingOnboardingData', JSON.stringify(onboardingData));
    } catch (error) {
      console.error('Failed to save onboarding data:', error);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Only save onboarding data if we're in onboarding mode (not sign-in only)
      if (!isSignInMode) {
        await saveOnboardingDataToStorage();
      }

      analytics.track({
        name: isSignInMode ? 'signin_google_attempted' : 'onboarding_google_signin_attempted',
        properties: { step: currentStep, mode: isSignInMode ? 'signin' : 'onboarding' },
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
            name: isSignInMode ? 'signin_completed' : 'onboarding_signin_completed',
            properties: {
              auth_method: 'google',
              step: currentStep,
              mode: isSignInMode ? 'signin' : 'onboarding'
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

      // Only save onboarding data if we're in onboarding mode (not sign-in only)
      if (!isSignInMode) {
        await saveOnboardingDataToStorage();
      }

      analytics.track({
        name: isSignInMode ? 'signin_apple_attempted' : 'onboarding_apple_signin_attempted',
        properties: { step: currentStep, mode: isSignInMode ? 'signin' : 'onboarding' },
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
              name: isSignInMode ? 'signin_completed' : 'onboarding_signin_completed',
              properties: {
                auth_method: 'apple',
                step: currentStep,
                mode: isSignInMode ? 'signin' : 'onboarding'
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

  const handleSignInClick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSignInMode(true);
    setCurrentStep(9); // Jump directly to auth step
  };

  // Render functions for each step
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <View style={styles.welcomeContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.appTitle}>RunGarden</Text>
        <Text style={styles.appSubtitle}>Grow your garden, one run at a time</Text>
      </View>

      <View style={styles.welcomeButtons}>
        <PrimaryButton
          title="Get Started"
          onPress={nextStep}
          size="large"
          fullWidth
        />

        <PrimaryButton
          title="Already have an account? Sign in"
          onPress={handleSignInClick}
          variant="secondary"
          size="medium"
          fullWidth
          textWeight="medium"
          textTransform="none"
        />
      </View>
    </View>
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
            placeholder="Forest"
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
            placeholder="Gump"
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
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.optionsSection}>
        <Text style={styles.stepTitle}>What's your age?</Text>
        <View style={styles.optionsContainer}>
          {[
            { value: 20, label: 'Under 25' },
            { value: 30, label: '25-34' },
            { value: 40, label: '35-44' },
            { value: 50, label: '45-54' },
            { value: 60, label: '55-64' },
            { value: 70, label: '65+' },
          ].map((range) => (
            <TouchableOpacity
              key={range.value}
              style={[
                styles.optionButton,
                data.age === range.value && styles.optionButtonSelected
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateData({ age: range.value });
                setTimeout(() => nextStep(), 300);
              }}
            >
              <Text style={[
                styles.optionButtonText,
                data.age === range.value && styles.optionButtonTextSelected
              ]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Reanimated.View>
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateData({ metricSystem: 'metric' });
              setTimeout(() => nextStep(), 300);
            }}
          >
            <Text style={styles.unitTitle}>Metric</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.unitCard,
              data.metricSystem === 'imperial' && styles.unitCardSelected
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              updateData({ metricSystem: 'imperial' });
              setTimeout(() => nextStep(), 300);
            }}
          >
            <Text style={styles.unitTitle}>Imperial</Text>
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
          <Text style={styles.stepTitle}>How many days do you want to run?</Text>

          <View style={styles.daysPerWeekSection}>
            <Text style={styles.sectionSubtitle}>Days per week</Text>
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
                    let newPreferred;

                    if (data.preferredDays.includes(day)) {
                      // If clicking on already selected day
                      if (data.daysPerWeek === 1) {
                        // For 1 day per week, don't allow unselecting - keep it selected
                        newPreferred = data.preferredDays;
                      } else {
                        // For multiple days, allow unselecting
                        newPreferred = data.preferredDays.filter(d => d !== day);
                      }
                    } else {
                      // If clicking on unselected day
                      if (data.preferredDays.length < data.daysPerWeek) {
                        // Have room for more days
                        newPreferred = [...data.preferredDays, day];
                      } else if (data.daysPerWeek === 1) {
                        // For 1 day per week, replace the current selection
                        newPreferred = [day];
                      } else {
                        // At capacity, don't change
                        newPreferred = data.preferredDays;
                      }
                    }

                    updateData({ preferredDays: newPreferred });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={!data.preferredDays.includes(day) && data.preferredDays.length >= data.daysPerWeek && data.daysPerWeek > 1}
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

  const renderRating = () => (
    <Reanimated.View
      style={styles.stepContainer}
      entering={getEnterAnimation()}
      exiting={getExitAnimation()}
    >
      <View style={styles.ratingSection}>
        <Text style={styles.stepTitle}>We're a small team</Text>
        <Text style={styles.stepDescription}>
          So a rating goes a long way 💜
        </Text>

        <View style={styles.ratingContainer}>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name="star"
                size={32}
                color={Theme.colors.accent.primary}
                style={styles.starIcon}
              />
            ))}
          </View>

          <View style={styles.ratingButtons}>
            <PrimaryButton
              title="Leave a rating"
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                updateData({ hasRated: true });

                // Actually request the app store rating and wait for it
                try {
                  await requestRating(true); // true = manual request from onboarding
                  // Rating dialog has been shown, now proceed
                  setTimeout(() => nextStep(), 300);
                } catch (error) {
                  console.error('Failed to request rating:', error);
                  // Even if rating fails, still proceed to next step
                  setTimeout(() => nextStep(), 300);
                }
              }}
              size="large"
              fullWidth
              textTransform="none"
            />

            <PrimaryButton
              title="Maybe later"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                updateData({ hasRated: false });
                setTimeout(() => nextStep(), 300);
              }}
              variant="secondary"
              size="large"
              fullWidth
              textWeight="medium"
              textTransform="none"
            />
          </View>
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
        <Text style={styles.stepTitle}>
          {isSignInMode ? 'Welcome back!' : 'Sign up to save your progress'}
        </Text>
        <Text style={styles.stepDescription}>
          {isSignInMode
            ? 'Sign in to access your garden and continue your running journey'
            : 'Keep your garden and running data safe across all your devices'
          }
        </Text>

        {!isSignInMode && (
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
        )}

        <View style={styles.authButtons}>
          <PrimaryButton
            title={isSignInMode ? 'Sign in with Google' : 'Continue with Google'}
            onPress={handleGoogleSignIn}
            size="large"
            fullWidth
            gradientColors={['#DB4437', '#EA4335']}
            textTransform="none"
          />

          {Platform.OS === 'ios' && (
            <PrimaryButton
              title="Sign in with Apple"
              onPress={handleAppleSignIn}
              size="large"
              fullWidth
              gradientColors={['#000000', '#333333']}
              textTransform="none"
              icon={<Ionicons name="logo-apple" size={20} color="white" />}
              iconPosition="left"
            />
          )}
        </View>

        {isSignInMode && (
          <PrimaryButton
            title="New to RunGarden? Get Started"
            onPress={() => {
              setIsSignInMode(false);
              setCurrentStep(0);
            }}
            variant="secondary"
            size="medium"
            fullWidth
            textWeight="medium"
            textTransform="none"
          />
        )}

        <Text style={styles.privacyText}>
          We only use your account for authentication. Your data stays private.
        </Text>
      </View>
    </Reanimated.View>
  );

  const renderProgressBar = () => {
    if (currentStep === 0 || isSignInMode) return null;

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
    const needsContinueButton = [1, 2, 6]; // FirstName, LastName, Schedule (Age and Rating now auto-advance)

    if (!needsContinueButton.includes(currentStep)) return null;

    return (
      <View style={styles.footer}>
        <PrimaryButton
          title="Continue"
          onPress={nextStep}
          disabled={!canProceed()}
          size="large"
          fullWidth
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderProgressBar()}
      <View style={styles.content}>
        {currentStep === 0 && (
          <Reanimated.View style={{ flex: 1 }} entering={FadeIn.duration(600)} exiting={FadeOut.duration(300)} key="step-0">
            {renderWelcome()}
          </Reanimated.View>
        )}
        {currentStep === 1 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-1">
            {renderFirstName()}
          </Reanimated.View>
        )}
        {currentStep === 2 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-2">
            {renderLastName()}
          </Reanimated.View>
        )}
        {currentStep === 3 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-3">
            {renderGender()}
          </Reanimated.View>
        )}
        {currentStep === 4 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-4">
            {renderAge()}
          </Reanimated.View>
        )}
        {currentStep === 5 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-5">
            {renderUnits()}
          </Reanimated.View>
        )}
        {currentStep === 6 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-6">
            {renderSchedule()}
          </Reanimated.View>
        )}
        {currentStep === 7 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-7">
            {renderNotifications()}
          </Reanimated.View>
        )}
        {currentStep === 8 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-8">
            {renderRating()}
          </Reanimated.View>
        )}
        {currentStep === 9 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-9">
            {renderAuth()}
          </Reanimated.View>
        )}
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
    justifyContent: 'flex-start',
    paddingTop: IS_SMALL_SCREEN ? 60 : 100,
  },

  // Welcome screen styles
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  logoContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  appTitle: {
    fontSize: 36,
    fontFamily: Theme.fonts.black,
    color: Theme.colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },

  // Welcome buttons container
  welcomeButtons: {
    gap: Theme.spacing.md,
    width: '100%',
    paddingHorizontal: Theme.spacing.xl,
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
    gap: IS_SMALL_SCREEN ? Theme.spacing.lg : Theme.spacing.xxl,
    paddingTop: IS_SMALL_SCREEN ? Theme.spacing.md : Theme.spacing.xl,
  },
  optionsContainer: {
    gap: Theme.spacing.md,
    width: '100%',
  },
  optionButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: IS_SMALL_SCREEN ? Theme.spacing.md : Theme.spacing.lg,
    paddingHorizontal: IS_SMALL_SCREEN ? Theme.spacing.lg : Theme.spacing.xl,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: 'white',
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
    borderWidth: 3,
    borderColor: 'transparent',
  },
  unitCardSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: 'white',
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
    borderWidth: 3,
    borderColor: 'transparent',
  },
  dayButtonSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: 'white',
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

  privacyText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Rating section styles
  ratingSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  ratingContainer: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
    width: '100%',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginVertical: Theme.spacing.lg,
  },
  starIcon: {
    // Additional styling can be added here if needed
  },
  ratingButtons: {
    gap: Theme.spacing.lg,
    width: '100%',
  },

  // Footer styles
  footer: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
}); 

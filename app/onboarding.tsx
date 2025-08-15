import Theme from '@/constants/theme';
import {
  OnboardingData
} from '@/constants/types';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useRevenueCat } from '@/provider/RevenueCatProvider';
import { PushNotificationService } from '@/services/PushNotificationService';
import { requestRating as requestStoreRating } from '@/services/RatingService';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useConvex } from 'convex/react';
import * as AppleAuth from 'expo-apple-authentication';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import Reanimated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Stop,
  Circle as SvgCircle,
  Line as SvgLine,
  LinearGradient as SvgLinearGradient,
  Path as SvgPath,
  Rect as SvgRect,
  Text as SvgText,
} from 'react-native-svg';
import Rive, { Alignment, Fit } from 'rive-react-native';

// Reusable TypewriterText component (stable identity)
const TypewriterText: React.FC<{ text: string; style: any; delay?: number }> = React.memo(({ text, style, delay = 0 }) => {
  const [displayText, setDisplayText] = React.useState('');
  const timerRef = React.useRef<any>(null);
  const intervalRef = React.useRef<any>(null);
  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setDisplayText('');
    timerRef.current = setTimeout(() => {
      let idx = 0;
      intervalRef.current = setInterval(() => {
        if (idx <= text.length) {
          setDisplayText(text.slice(0, idx));
          idx++;
        } else {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      }, 25);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, delay]);
  return <Text style={style}>{displayText}</Text>;
}, (prev, next) => prev.text === next.text);

const redirectTo = makeRedirectUri();
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');



// Simplified responsive constants: legacy devices (no notch) vs modern
const LEGACY_DEVICE = screenHeight < 700; // Approximate older, non-notch iPhones

const TOTAL_STEPS = 16;

// Intro Rive configuration (step 0)
//const RIVE_URL_INTRO = "https://curious-badger-131.convex.cloud/api/storage/5059b193-7d3d-4f35-bf17-a07f5a269d78";
const RIVE_URL_INTRO = "https://curious-badger-131.convex.cloud/api/storage/cfc29c39-116e-4901-8889-d557f97528b6";
const RIVE_INTRO_STATE_MACHINE = 'State Machine 1';
const RIVE_INTRO_INPUT_NAME = 'Number 1';

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const convex = useConvex();
  const analytics = useAnalytics();
  const { user: revenueCatUser } = useRevenueCat();
  const [currentStep, setCurrentStep] = useState(0);
  const [isGoingBack, setIsGoingBack] = useState(false);
  const [authFromShortcut, setAuthFromShortcut] = useState(false); // true when jumped to auth from "I already have an account"
  const stepTextRef = useRef<string>('');
  const lastStepRef = useRef<number>(0);

  // Helper function to get animation direction
  const getEnterAnimation = () => isGoingBack ? SlideInLeft : SlideInRight;
  const getExitAnimation = () => isGoingBack ? SlideOutRight : SlideOutLeft;

  // Removed unused single name ref in favor of first/last name inputs
  const firstNameInputRef = useRef<TextInput>(null);
  const lastNameInputRef = useRef<TextInput>(null);
  const [pushService, setPushService] = useState<PushNotificationService | null>(null);

  // Cinematic effect state for welcome step
  const [cinematicPhase, setCinematicPhase] = useState<'zooming' | 'typing' | 'waiting' | 'transition'>('zooming');
  const [typewriterText, setTypewriterText] = useState('');
  const zoomAnim = useSharedValue(1); // Start at normal scale (full screen)
  const textOpacityAnim = useSharedValue(0);
  const textPulseAnim = useSharedValue(1); // For pulsing effect
  const gifOpacityAnim = useSharedValue(1);
  const secondGifOpacityAnim = useSharedValue(0);

  // === Flame introduction animation state (step 1) ===
  const flameIntroOpacity = useSharedValue(0);
  const flameButtonsOpacity = useSharedValue(0);
  const [flameTypewriterText, setFlameTypewriterText] = useState('');
  const flameTypewriterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 0 intro hold state
  const introRiveRef = useRef<any>(null);
  const introHoldIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const introDecayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const introHapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const introProgressRef = useRef<number>(0);
  const isIntroHoldingRef = useRef<boolean>(false);
  const [introComplete, setIntroComplete] = useState(false);
  const [introTapEnabled, setIntroTapEnabled] = useState(false);
  const introTapEnableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [introRiveReady, setIntroRiveReady] = useState(false);
  const introRevealStartedRef = useRef(false);

  // Step 0 intro visuals
  const introRiveOpacity = useSharedValue(0);
  const introRiveScale = useSharedValue(1);
  const introBlackOverlayOpacity = useSharedValue(1);
  const introHintOpacity = useSharedValue(0);
  const introHintScale = useSharedValue(1);
  const introRiveAnimatedStyle = useAnimatedStyle(() => ({
    opacity: introRiveOpacity.value,
    transform: [{ scale: introRiveScale.value }],
  }));
  const introHintAnimatedStyle = useAnimatedStyle(() => ({
    opacity: introHintOpacity.value,
    transform: [{ scale: introHintScale.value }],
  }));
  const introBlackOverlayAnimatedStyle = useAnimatedStyle(() => ({ opacity: introBlackOverlayOpacity.value }));

  // Plan proposal state
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);





  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoomAnim.value }],
  }));

  const textOpacityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacityAnim.value,
  }));

  const textPulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: textPulseAnim.value }],
  }));

  const gifOpacityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: gifOpacityAnim.value,
  }));

  const secondGifOpacityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: secondGifOpacityAnim.value,
  }));

  const flameIntroOpacityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flameIntroOpacity.value,
  }));

  const flameButtonsOpacityAnimatedStyle = useAnimatedStyle(() => ({
    opacity: flameButtonsOpacity.value,
  }));



  const getStepName = (step: number) => {
    switch (step) {
      case 1:
        return 'flame_introduction';

      case 2:
        return 'running_ability_check';
      case 3:
        return 'personalized_encouragement';
      case 4:
        return 'running_goal';
      case 5:
        return 'days_per_week';
      case 6:
        return 'preferred_days';
      case 7:
        return 'units';
      case 8:
        return 'gender';
      case 9:
        return 'age_range';
      case 10:
        return 'name_prompt';
      case 11:
        return 'notifications_prompt';
      case 12:
        return 'rating_prompt';
      case 13:
        return 'plan_proposal';
      case 14:
        return 'starting_today_progress';
      case 15:
        return 'auth_prompt';
      default:
        return `unknown_step_${step}`;
    }
  };

  useEffect(() => {
    analytics.track({
      name: `onboarding_${getStepName(currentStep)}_viewed`,
      properties: {
        step_number: currentStep,
        step_name: getStepName(currentStep),
      },
    });
  }, [currentStep, analytics]);

  // Rive idle animation URL
  const RIVE_URL_IDLE = "https://curious-badger-131.convex.cloud/api/storage/9caf3bc8-1fab-4dab-a8e5-4b6d563ca7d6";

  const [data, setData] = useState<OnboardingData>({
    firstName: null,
    lastName: null,
    mascotName: 'Blaze',
    canRun30Min: null, // Simple true/false for 30min running ability
    goalDistance: null,
    daysPerWeek: 1,
    preferredDays: [],
    metricSystem: null,
    gender: null,
    age: null,
    pushNotificationsEnabled: null,
    weekStartDay: 1, // 0 = Sunday, 1 = Monday (default to Monday)
    hasRated: null, // Whether user completed the rating step
  });


  useEffect(() => {
    if (convex) {
      const pushSvc = new PushNotificationService(convex);
      setPushService(pushSvc);

      // Initialize push notification channels
      pushSvc.configureNotificationChannels();
    }
  }, [convex]);

  // Reset intro step (0)
  useEffect(() => {
    if (currentStep === 0) {
      if (introHoldIntervalRef.current) clearInterval(introHoldIntervalRef.current);
      if (introDecayIntervalRef.current) clearInterval(introDecayIntervalRef.current);
      if (introHapticIntervalRef.current) clearInterval(introHapticIntervalRef.current);
      if (introTapEnableTimeoutRef.current) clearTimeout(introTapEnableTimeoutRef.current);
      introHoldIntervalRef.current = null;
      introDecayIntervalRef.current = null;
      introHapticIntervalRef.current = null;
      introTapEnableTimeoutRef.current = null;
      isIntroHoldingRef.current = false;
      introProgressRef.current = 0;
      setIntroComplete(false);
      setIntroTapEnabled(false);
      setIntroRiveReady(false);
      introRevealStartedRef.current = false;
      // Reset intro visuals
      introRiveOpacity.value = 0;
      introRiveScale.value = 0.98;
      introBlackOverlayOpacity.value = 1;
      introHintOpacity.value = 0;
      introHintScale.value = 1;
      try {
        introRiveRef.current?.setInputState?.(RIVE_INTRO_STATE_MACHINE, RIVE_INTRO_INPUT_NAME, 0);
      } catch { }
    }
  }, [currentStep]);

  // Start reveal sequence only after the Rive file reports loaded
  useEffect(() => {
    if (currentStep !== 0) return;
    if (!introRiveReady) return;
    if (introRevealStartedRef.current) return;
    introRevealStartedRef.current = true;

    introRiveOpacity.value = withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) });
    introRiveScale.value = withTiming(1.03, { duration: 2200, easing: Easing.inOut(Easing.cubic) });
    introBlackOverlayOpacity.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) });
    // Then show hint and start pulse
    setTimeout(() => {
      introHintOpacity.value = withTiming(1, { duration: 500 });
      introHintScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700 }),
          withTiming(1.0, { duration: 700 })
        ),
        -1,
        false
      );
    }, 250);
  }, [currentStep, introRiveReady]);

  useEffect(() => {
    if (currentStep === 1) {
      // Reset animation state whenever we enter the flame intro step
      flameIntroOpacity.value = 0;
      flameButtonsOpacity.value = 0;
      setFlameTypewriterText('');

      flameIntroOpacity.value = withTiming(1, { duration: 1000 }, () => {
        runOnJS(startFlameTypewriter)();
      });
    } else {
      // Clean-up when navigating away from the flame intro step
      if (flameTypewriterIntervalRef.current) {
        clearInterval(flameTypewriterIntervalRef.current);
        flameTypewriterIntervalRef.current = null;
      }
    }
  }, [currentStep]);





  const startPulseAnimation = () => {
    const pulseLoop = () => {
      textPulseAnim.value = withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(1.1, { duration: 1000 }, () => {
          runOnJS(() => pulseLoop())();
        })
      );
    };
    pulseLoop();
  };

  const startTypewriterEffect = () => {
    const text = "Tap to light up";
    let index = 0;

    // Fade in text container
    textOpacityAnim.value = withTiming(1, { duration: 500 });

    const typeInterval = setInterval(() => {
      if (index <= text.length) {
        setTypewriterText(text.slice(0, index));
        // Add subtle haptic feedback for each character
        if (index > 0 && index <= text.length) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        index++;
      } else {
        clearInterval(typeInterval);
        setCinematicPhase('waiting');
        // Final haptic when typing completes
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Start pulsing animation
        startPulseAnimation();
      }
    }, 100);
  };

  const startFlameTypewriter = () => {
    const fullText = "You woke up your \nrunner's flame..";
    let index = 0;

    flameTypewriterIntervalRef.current = setInterval(() => {
      if (index < fullText.length) {
        setFlameTypewriterText(fullText.slice(0, index + 1));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        index++;
      } else {
        if (flameTypewriterIntervalRef.current) {
          clearInterval(flameTypewriterIntervalRef.current);
          flameTypewriterIntervalRef.current = null;
        }
        flameButtonsOpacity.value = withTiming(1, { duration: 500 });
      }
    }, 100);
  };

  const handleCinematicTap = () => {
    if (cinematicPhase === 'waiting') {
      setCinematicPhase('transition');
      // Strong haptic for the tap interaction
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Transition to second gif (parallel animations)
      gifOpacityAnim.value = withTiming(0, { duration: 1000 });
      secondGifOpacityAnim.value = withTiming(1, { duration: 1000 });
      textOpacityAnim.value = withTiming(0, { duration: 300 }, () => {
        runOnJS(() => {
          // Success haptic when second gif appears
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

          // Auto advance to next step after showing second gif
          setTimeout(() => {
            // Final transition haptic before moving to next step
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            nextStep();
          }, 2000);
        })();
      });
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => {
      const newData = { ...prev, ...updates } as OnboardingData;
      if (updates.canRun30Min === false) {
        // Default runs per week for true beginners
        newData.daysPerWeek = 3;
      }
      return newData;
    });
  };

  const handlePushNotificationChoice = async (enabled: boolean) => {
    // Store the preference locally for the onboarding flow only
    handleSelection(() => updateData({ pushNotificationsEnabled: enabled }));

    // Show the system permission prompt immediately, but do NOT store anything on the server yet
    if (enabled) {
      try {
        await Notifications.requestPermissionsAsync();
      } catch (err) {
        console.error('[Onboarding] Failed to request notification permissions:', err);
      }
    }
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      analytics.track({
        name: `onboarding_${getStepName(currentStep)}_completed`,
        properties: {
          step_number: currentStep,
          step_name: getStepName(currentStep),
        },
      });
      // Blur name inputs if we're leaving the name step
      if (currentStep === 10) {
        firstNameInputRef.current?.blur();
        lastNameInputRef.current?.blur();
      }

      let nextStepNumber = currentStep + 1;

      // Skip the "Days per Week" step for true beginners (set to 3 by default)
      if (currentStep === 4 && data.canRun30Min === false) {
        // Set default days per week for true beginners
        updateData({ daysPerWeek: 3 });
        nextStepNumber = 6; // Jump directly to preferred days
      }

      // Skip the progress and plan proposal steps (14 and 15) for non-true beginners
      if (currentStep === 13 && data.canRun30Min !== false) {
        nextStepNumber = 15; // Skip directly to auth
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(nextStepNumber);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) { // Don't go back from welcome step (0) or flame intro (1)
      analytics.track({
        name: `onboarding_${getStepName(currentStep)}_revisited`,
        properties: {
          step_number: currentStep,
          step_name: getStepName(currentStep),
        },
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsGoingBack(true);

      let prevStepNumber = currentStep - 1;

      // When backing out of auth after using the shortcut, return to the initial step of the flow
      if (currentStep === 15 && authFromShortcut) {
        prevStepNumber = 1;
        // Clear the flag so subsequent auth visits behave normally
        setAuthFromShortcut(false);
      }

      // Skip back over the "Days per Week" step for true beginners
      if (currentStep === 6 && data.canRun30Min === false) {
        prevStepNumber = 4; // Jump back to running goal
      }

      setCurrentStep(prevStepNumber);
      // Reset direction flag after animation
      setTimeout(() => setIsGoingBack(false), 400);
    }
  };

  const handleSelection = (updateFn: () => void) => {
    updateFn();
    // Auto-advance for most steps, except encouragement (3), days per week (5), preferred days (6), user name (10), starting today (13), and plan proposal (14)
    if (currentStep !== 3 && currentStep !== 5 && currentStep !== 6 && currentStep !== 10 && currentStep !== 13 && currentStep !== 14) {
      setTimeout(() => {
        nextStep();
      }, 300); // Small delay for visual feedback
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return true; // Flame introduction

      case 2: return data.canRun30Min !== null; // Running ability check
      case 3: return true; // Personalized encouragement
      case 4: return data.goalDistance !== null; // Running goal
      case 5: return data.canRun30Min === false ? true : data.daysPerWeek >= 1; // Days per week (skip for true beginners)
      case 6: return data.preferredDays.length >= data.daysPerWeek; // Preferred days
      case 7: return data.metricSystem !== null; // Units
      case 8: return data.gender !== null; // Gender
      case 9: return data.age !== null; // Age
      case 10: return true; // Name step is skippable
      case 11: return data.pushNotificationsEnabled !== null; // Notifications
      case 12: return data.hasRated !== null; // Rating
      case 13: return true; // Plan proposal
      case 14: return true; // Starting today progress (only for true beginners)
      case 15: return true; // Auth step
      default: return false;
    }
  };

  const saveOnboardingDataToStorage = async () => {
    try {
      const mappedGoalDistance: '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon' = data.goalDistance ?? 'just-run-more';


      // Map the simple 30min check to currentAbility and longestDistance for training profile
      let longestDistance: 'never' | '1to2km' | '2to4km' | '5plusKm' = 'never';
      let currentAbility: string;

      // Use the simple 30min check to determine ability level
      if (data.canRun30Min === true) {
        currentAbility = 'more30min';
        longestDistance = '5plusKm';
      } else {
        currentAbility = 'less1min';
        longestDistance = 'never';
      }

      // Default to time-based workouts for simplicity
      const preferTimeOverDistance = true;

      // Separate training profile data from user profile data
      const trainingProfileData = {
        goalDistance: mappedGoalDistance,
        goalDate: undefined,
        currentAbility: currentAbility,
        longestDistance,
        daysPerWeek: data.daysPerWeek,
        preferredDays: data.preferredDays,
        hasTreadmill: false, // Default value
        preferTimeOverDistance: preferTimeOverDistance,
        pushNotificationsEnabled: data.pushNotificationsEnabled,
      };

      const userProfileData = {
        firstName: data.firstName,
        lastName: data.lastName,
        mascotName: data.mascotName,
        metricSystem: data.metricSystem,
        gender: data.gender,
        age: data.age,
        weekStartDay: data.weekStartDay,
      };

      const onboardingData = {
        trainingProfile: trainingProfileData,
        userProfile: userProfileData,
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
      const { redirect } = await signIn("google", { redirectTo });
      if (Platform.OS === "web") return;
      const result = await openAuthSessionAsync(redirect!.toString(), redirectTo);
      if (result.type === "success") {
        const { url } = result;
        const code = new URL(url).searchParams.get("code")!;
        const signInResult = await signIn("google", { code });
        if (signInResult) {
          analytics.track({
            name: `onboarding_${getStepName(currentStep)}_completed`,
            properties: {
              step_number: currentStep,
              step_name: getStepName(currentStep),
              auth_method: 'google',
            },
          });
          setAuthFromShortcut(false);
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

      // Native flow only
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
              name: `onboarding_${getStepName(currentStep)}_completed`,
              properties: {
                step_number: currentStep,
                step_name: getStepName(currentStep),
                auth_method: 'apple',
              },
            });
            setAuthFromShortcut(false);
            router.replace('/(app)');
          }
        } catch (nativeErr: any) {
          if (nativeErr?.code === 'ERR_CANCELED') {
            // User cancelled; silently ignore
            return;
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

  const renderProgressBar = () => {
    // Don't render anything during the intro step
    if (currentStep === 0) return null;

    return (
      <View style={styles.topRow}>
        {currentStep > 1 ? (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Ionicons name="arrow-back" size={24} color={Theme.colors.text.tertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
        {currentStep >= 1 && (
          <View style={styles.progressBarContainer}>
            {currentStep > 1 && (
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#FF4500', '#FF6500', '#FF8C00', '#FFD700']} // Burning gradient: dark orange to bright gold
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${((currentStep - 1) / (TOTAL_STEPS - 2)) * 100}%` }]}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderFlameIntroduction = () => (
    <Reanimated.View style={[styles.stepContainer, flameIntroOpacityAnimatedStyle]}>
      <View style={styles.introTitleContainer}>
        <Text style={styles.introTitle}>{flameTypewriterText}</Text>
      </View>
      <View style={styles.flameIntroContainer}>
        <View style={styles.blazeContainerIntro}>
          <Rive url={RIVE_URL_IDLE} style={styles.blazeImage} autoplay={true} />
        </View>
      </View>
    </Reanimated.View>
  );

  const renderNamePrompt = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.stepContainer}>
        <View style={styles.nameContent}>
          <Text style={styles.nameDescription}>It helps your friends to find you</Text>
          <TextInput
            ref={firstNameInputRef}
            style={styles.nameInput}
            placeholder="First Name"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.firstName || ''}
            onChangeText={(text) => updateData({ firstName: text })}
            returnKeyType="next"
            onSubmitEditing={() => lastNameInputRef.current?.focus()}
          />
          <TextInput
            ref={lastNameInputRef}
            style={styles.nameInput}
            placeholder="Last Name"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.lastName || ''}
            onChangeText={(text) => updateData({ lastName: text })}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canProceed()) {
                handleSelection(() => { });
              }
            }}
          />
        </View>
      </View>
    </TouchableWithoutFeedback>
  );

  // Simple TypewriterText component with stable animation
  // Removed unused legacy Typewriter component

  // Calculate header text only when step changes
  if (currentStep !== lastStepRef.current) {
    lastStepRef.current = currentStep;

    const getStepInfo = () => {
      switch (currentStep) {
        case 0: return { title: '', subtitle: '' };
        case 1: return { title: '', subtitle: '' };
        case 2: return { title: `Can you run 30 minutes without stopping?`, subtitle: '' };
        case 3: return { title: data.canRun30Min === false ? 'Perfect!' : 'So, at the moment..', subtitle: '' };
        case 4: return { title: "What's your running goal?", subtitle: '' };
        case 5: return { title: 'How many days do you want to run per week?', subtitle: '' };
        case 6: return { title: `What days do you want to run? (pick ${data.daysPerWeek} days)`, subtitle: '' };
        case 7: return { title: 'What units do you want to use?', subtitle: '' };
        case 8: return { title: 'What is your gender?', subtitle: '' };
        case 9: return { title: 'What is your age?', subtitle: '' };
        case 10: return { title: "What's your name?", subtitle: '' };
        case 11: return { title: 'Let me remind you when it\'s time to run!', subtitle: '' };
        case 12: return { title: 'We\'re a small team', subtitle: '' };
        case 13: return { title: 'Here\'s the perfect training plan for you', subtitle: "" };
        case 14: return { title: 'Starting today, you\'ll be able to run 5k', subtitle: '' };
        case 15: return { title: 'Let\'s make sure your progress is saved', subtitle: '' };
        default: return { title: '', subtitle: '' };
      }
    };

    const stepInfo = getStepInfo();
    stepTextRef.current = stepInfo.subtitle
      ? `${stepInfo.title}\n${stepInfo.subtitle}`
      : stepInfo.title;
  }

  const headerText = stepTextRef.current;

  const renderHeader = () => {
    if (currentStep === 0 || currentStep === 1) return null;

    return (
      <View style={styles.header}>
        <View style={styles.headerRiveContainer}>
          <Rive url={RIVE_URL_IDLE} style={styles.headerRiveImage} autoplay={true} />
        </View>
        <Reanimated.View
          key={`bubble-${currentStep}`}
          style={styles.headerTextBubble}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
        >
          {/* Chat bubble pointer with inner white layer */}
          <View style={styles.bubblePointer} />
          <View style={styles.bubblePointerInner} />
          <TypewriterText
            text={headerText}
            style={styles.headerTitle}
            delay={200}
          />
        </Reanimated.View>
      </View>
    );
  };

  const renderWelcome = () => (
    <TouchableOpacity
      style={styles.stepContainer}
      activeOpacity={1}
      onPress={handleCinematicTap}
    >
      <View style={styles.cinematicContainer}>
        <View style={styles.cinematicImageContainer}>
          <Reanimated.View
            style={[
              styles.cinematicImageWrapper,
              zoomAnimatedStyle,
              gifOpacityAnimatedStyle,
            ]}
          >
          </Reanimated.View>

          {(cinematicPhase === 'transition') && (
            <Reanimated.View
              style={[
                styles.cinematicImageWrapper,
                secondGifOpacityAnimatedStyle,
                {
                  transform: [{ scale: 1.6 }], // Start at the same zoom level as first gif ends
                }
              ]}
            >
            </Reanimated.View>
          )}
        </View>

        <Reanimated.View
          style={[
            styles.cinematicTextContainer,
            textOpacityAnimatedStyle,
            textPulseAnimatedStyle
          ]}
        >
          <Text style={styles.cinematicText}>
            {typewriterText}
            {cinematicPhase === 'typing' && <Text style={styles.cursor}>|</Text>}
          </Text>
        </Reanimated.View>
      </View>
    </TouchableOpacity>
  );

  // Intro Light-up step (0)
  const renderIntroLightup = () => (
    <View style={styles.introContainer}>
      <View style={styles.introRiveWrapper}>
        <Reanimated.View style={[styles.introRive, introRiveAnimatedStyle]}>
          <Rive
            ref={introRiveRef}
            url={RIVE_URL_INTRO}
            autoplay
            stateMachineName={RIVE_INTRO_STATE_MACHINE}
            style={styles.introRive}
            fit={Fit.Cover}
            alignment={Alignment.Center}
            onPlay={() => setIntroRiveReady(true)}
          />
        </Reanimated.View>
        <Reanimated.View pointerEvents="none" style={[styles.introBlackOverlay, introBlackOverlayAnimatedStyle]} />
      </View>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={startIntroHold}
        onPressOut={stopIntroHold}
        onPress={introComplete && introTapEnabled ? handleIntroContinueTap : undefined}
        style={styles.introPressLayer}
      >
        <Reanimated.View style={introHintAnimatedStyle}>
          <Text style={styles.introHintText}>
            {introComplete ? (introTapEnabled ? 'Tap to continue' : '') : 'Tap and hold to light it up'}
          </Text>
        </Reanimated.View>
      </TouchableOpacity>
    </View>
  );

  // Intro press-and-hold handlers (step 0)
  const setIntroProgress = (value: number) => {
    const clamped = Math.max(0, Math.min(100, value));
    introProgressRef.current = clamped;
    try {
      introRiveRef.current?.setInputState?.(RIVE_INTRO_STATE_MACHINE, RIVE_INTRO_INPUT_NAME, clamped);
    } catch { }
  };

  const completeIntroIfReady = () => {
    if (introProgressRef.current >= 100) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIntroComplete(true);
      // Enable tap-to-continue after a short delay
      if (introTapEnableTimeoutRef.current) clearTimeout(introTapEnableTimeoutRef.current);
      introTapEnableTimeoutRef.current = setTimeout(() => {
        setIntroTapEnabled(true);
      }, 800);
    }
  };

  const startIntroHold = () => {
    if (isIntroHoldingRef.current) return;
    isIntroHoldingRef.current = true;
    if (introDecayIntervalRef.current) {
      clearInterval(introDecayIntervalRef.current);
      introDecayIntervalRef.current = null;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    introHapticIntervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 120);
    introHoldIntervalRef.current = setInterval(() => {
      setIntroProgress(introProgressRef.current + 2);
      if (introProgressRef.current >= 100) {
        if (introHoldIntervalRef.current) {
          clearInterval(introHoldIntervalRef.current);
          introHoldIntervalRef.current = null;
        }
        if (introHapticIntervalRef.current) {
          clearInterval(introHapticIntervalRef.current);
          introHapticIntervalRef.current = null;
        }
        completeIntroIfReady();
      }
    }, 32);
  };

  const stopIntroHold = () => {
    isIntroHoldingRef.current = false;
    if (introHoldIntervalRef.current) {
      clearInterval(introHoldIntervalRef.current);
      introHoldIntervalRef.current = null;
    }
    if (introHapticIntervalRef.current) {
      clearInterval(introHapticIntervalRef.current);
      introHapticIntervalRef.current = null;
    }
    if (!introComplete && introProgressRef.current < 100 && !introDecayIntervalRef.current) {
      introDecayIntervalRef.current = setInterval(() => {
        setIntroProgress(introProgressRef.current - 3);
        if (introProgressRef.current <= 0) {
          if (introDecayIntervalRef.current) {
            clearInterval(introDecayIntervalRef.current);
            introDecayIntervalRef.current = null;
          }
        }
      }, 24);
    }
  };

  const handleIntroContinueTap = () => {
    if (!(introComplete && introTapEnabled)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    introHintOpacity.value = withTiming(0, { duration: 150 });
    introBlackOverlayOpacity.value = 0; // ensure starts from 0
    introBlackOverlayOpacity.value = withTiming(1, { duration: 200 }, () => {
      runOnJS(nextStep)();
    });
  };

  // (duplicate removed)

  const renderRunningAbilityCheck = () => (
    <View style={styles.stepContainer}>
      <View style={styles.runningAbilitySection}>
        <View style={styles.runningAbilityOptions}>
          <TouchableOpacity
            style={[styles.runningAbilityOption, data.canRun30Min === false && styles.runningAbilityOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ canRun30Min: false }));
            }}
          >
            <Text style={[styles.runningAbilityOptionText, data.canRun30Min === false && styles.runningAbilityOptionTextSelected]}>
              Not yet!
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.runningAbilityOption, data.canRun30Min === true && styles.runningAbilityOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ canRun30Min: true }));
            }}
          >
            <Text style={[styles.runningAbilityOptionText, data.canRun30Min === true && styles.runningAbilityOptionTextSelected]}>
              Yes, I can
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );





  const renderPersonalizedEncouragement = () => (
    <View style={styles.stepContainer}>
      <View style={styles.encouragementSection}>
        {data.canRun30Min === false ? (
          // For true beginners who can't run 30min yet
          <View style={styles.encouragementContent}>
            <Text style={styles.encouragementTitle}>Blaze is made for you</Text>
            <Text style={styles.encouragementSubtitle}>Let's make it even more personalized</Text>
          </View>
        ) : (
          // For non-beginners who can run 30min
          <View style={styles.encouragementContent}>
            <Text style={styles.encouragementTitle}>Blaze is really tailored for TRUE beginners</Text>
            <Text style={styles.encouragementSubtitle}>However, you can already start collecting rewards and challenges by running</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderRunningGoal = () => {
    const beginnerGoals = [
      { value: 'lose-weight', title: 'Lose Weight' },
      { value: 'stay-fit', title: 'Stay Fit' },
      { value: 'run-5k', title: 'Run 5K' },
      { value: 'improve-heart-health', title: 'Improve Heart Health' },
    ];

    const intermediateGoals = [
      { value: 'run-10k', title: 'Run 10K' },
      { value: 'run-half-marathon', title: 'Half / Marathon' },
      { value: 'stay-fit', title: 'Stay Fit' },
      { value: 'lose-weight', title: 'Lose Weight' },
    ];

    const goals = data.canRun30Min ? intermediateGoals : beginnerGoals;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.listContainerWithTopMargin}>
          {goals.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.listOption, data.goalDistance === option.value && styles.listOptionSelected]}
              onPress={() => {
                handleSelection(() => updateData({ goalDistance: option.value as any }));
              }}
            >
              <View style={styles.listOptionContent}>
                <Text style={[styles.listOptionText, data.goalDistance === option.value && styles.listOptionTextSelected]}>{option.title}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };


  const renderStartingTodayProgress = () => {
    // Calculate target date (8 weeks from today)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + (8 * 7));
    const formatDate = (date: Date) => {
      const month = date.toLocaleString('en-US', { month: 'long' });
      const day = date.getDate();
      const suffix = (d: number) => {
        const j = d % 10, k = d % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
      };
      return `${month} ${day}${suffix(day)}`;
    };

    return (
      <View style={styles.stepContainer}>
        <View style={styles.progressSection}>
          <View style={styles.progressMainContent}>
            <Text style={styles.progressDateText}>by {formatDate(targetDate)}</Text>
            <Reanimated.View style={[styles.chartContainer]}>
              <ProgressChart
                width={320}
                height={200}
                goalLabel="5K"
                targetDateLabel={formatDate(targetDate)}
              />
            </Reanimated.View>
          </View>
          {/* Action buttons now live here */}
          <View style={styles.planActions}>
            <TouchableOpacity
              style={[styles.planPrimaryButton, isGeneratingPlan && styles.planPrimaryButtonDisabled]}
              onPress={handleStartPlan}
              disabled={isGeneratingPlan}
            >
              <Text style={styles.planPrimaryButtonText}>
                {isGeneratingPlan ? 'Creating Your Plan...' : 'I\'m ready!'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.planSecondaryButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                nextStep();
              }}
            >
              <Text style={styles.planSecondaryButtonText}>I don't need a plan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderPlanProposal = () => {
    return (
      <View style={styles.stepContainer}>
        <View style={styles.planProposalSection}>
          {/* Hero section with full background image */}
          <LinearGradient
            colors={[Theme.colors.background.secondary + 'AA', Theme.colors.background.tertiary + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planHeroOverlay}
          >
            <View style={styles.planPill}>
              <Text style={styles.planPillText}>Recommended for you</Text>
            </View>
            <View style={styles.planHeroRow}>
              <View style={styles.planHeroContent}>
                <Text style={styles.planHeroTitle}>Couch to 5K in 8 weeks</Text>
                <Text style={styles.planHeroSubtitle}>Gradual, beginner‑friendly plan to hit your first 5K</Text>
              </View>
            </View>
            {/* Quick stats as chips inside card */}
            <View style={styles.planChipsInside}>
              <View style={styles.planChip}>
                <Ionicons name="calendar-outline" size={16} color={Theme.colors.accent.primary} />
                <Text style={styles.planChipText}>8 weeks</Text>
              </View>
              <View style={styles.planChip}>
                <Ionicons name="walk-outline" size={16} color={Theme.colors.accent.primary} />
                <Text style={styles.planChipText}>3 runs/week</Text>
              </View>
              <View style={styles.planChip}>
                <Ionicons name="flag-outline" size={16} color={Theme.colors.accent.primary} />
                <Text style={styles.planChipText}>24 total runs</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Features card */}
          <View style={styles.planFeatureCard}>
            <View style={styles.planFeatureRow}>
              <Ionicons name="trending-up-outline" size={18} color={Theme.colors.text.primary} />
              <Text style={styles.planFeatureText}>Build up safely with walk/run intervals</Text>
            </View>
            <View style={styles.planFeatureRow}>
              <Ionicons name="timer-outline" size={18} color={Theme.colors.text.primary} />
              <Text style={styles.planFeatureText}>Workouts under 40 minutes</Text>
            </View>
            <View style={styles.planFeatureRow}>
              <Ionicons name="star-outline" size={18} color={Theme.colors.text.primary} />
              <Text style={styles.planFeatureText}>Beginner‑friendly, no experience needed</Text>
            </View>
          </View>

          {/* Action buttons moved to Starting Today step */}
        </View>
      </View>
    );
  };

  const renderDaysPerWeek = () => (
    <View style={styles.stepContainer}>
      <View style={styles.daysPerWeekSection}>
        <View style={styles.runsCounter}>
          <TouchableOpacity
            style={[styles.counterButton, data.daysPerWeek <= 1 && styles.counterButtonDisabled]}
            onPress={() => {
              if (data.daysPerWeek > 1) {
                const newDays = data.daysPerWeek - 1;
                updateData({ daysPerWeek: newDays, preferredDays: [] }); // Reset preferred days
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={data.daysPerWeek <= 1}
          >
            <Ionicons
              name="remove"
              size={24}
              color={data.daysPerWeek <= 1 ? Theme.colors.text.tertiary : Theme.colors.text.primary}
            />
          </TouchableOpacity>

          <View style={styles.counterDisplay}>
            <Text style={styles.counterNumber}>{data.daysPerWeek}</Text>
            <Text style={styles.counterLabel}>{data.daysPerWeek === 1 ? 'day' : 'days'}</Text>
          </View>

          <TouchableOpacity
            style={[styles.counterButton, data.daysPerWeek >= 7 && styles.counterButtonDisabled]}
            onPress={() => {
              if (data.daysPerWeek < 7) {
                updateData({ daysPerWeek: data.daysPerWeek + 1, preferredDays: [] }); // Reset preferred days
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            disabled={data.daysPerWeek >= 7}
          >
            <Ionicons
              name="add"
              size={24}
              color={data.daysPerWeek >= 7 ? Theme.colors.text.tertiary : Theme.colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderPreferredDays = () => {
    // Define all days with Monday start and Sunday start orders
    const allDays = [
      { short: 'Mon', full: 'Monday' },
      { short: 'Tue', full: 'Tuesday' },
      { short: 'Wed', full: 'Wednesday' },
      { short: 'Thu', full: 'Thursday' },
      { short: 'Fri', full: 'Friday' },
      { short: 'Sat', full: 'Saturday' },
      { short: 'Sun', full: 'Sunday' },
    ];

    // Reorder days based on week start preference
    const daysOfWeek = data.weekStartDay === 0
      ? [allDays[6], ...allDays.slice(0, 6)] // Sunday first: [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
      : allDays; // Monday first: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]

    return (
      <View style={styles.stepContainer}>
        <View style={styles.preferredDaysSection}>
          {/* Week start toggle */}
          <View style={styles.weekStartToggle}>
            <Text style={styles.weekStartLabel}>Week starts on:</Text>
            <View style={styles.weekStartButtons}>
              <TouchableOpacity
                style={[styles.weekStartButton, data.weekStartDay === 1 && styles.weekStartButtonSelected]}
                onPress={() => {
                  updateData({ weekStartDay: 1 });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.weekStartButtonText, data.weekStartDay === 1 && styles.weekStartButtonTextSelected]}>
                  Monday
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.weekStartButton, data.weekStartDay === 0 && styles.weekStartButtonSelected]}
                onPress={() => {
                  updateData({ weekStartDay: 0 });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.weekStartButtonText, data.weekStartDay === 0 && styles.weekStartButtonTextSelected]}>
                  Sunday
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.listContainer}>
            {daysOfWeek.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.listOption, data.preferredDays.includes(day.short) && styles.listOptionSelected]}
                onPress={() => {
                  const newPreferred = data.preferredDays.includes(day.short)
                    ? data.preferredDays.filter(d => d !== day.short)
                    : [...data.preferredDays, day.short];
                  updateData({ preferredDays: newPreferred });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.listOptionText, data.preferredDays.includes(day.short) && styles.listOptionTextSelected]}>
                  {day.full}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };



  const renderUnits = () => (
    <View style={styles.stepContainer}>
      <View style={styles.unitsGrid}>
        {[
          { value: 'metric', title: 'Metric', subtitle: 'km, kg, °C', icon: 'speedometer-outline' },
          { value: 'imperial', title: 'Imperial', subtitle: 'miles, lbs, °F', icon: 'speedometer-outline' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.unitCard, data.metricSystem === option.value && styles.unitCardSelected]}
            onPress={() => {
              handleSelection(() => updateData({ metricSystem: option.value as any }));
            }}
          >
            <Ionicons name={option.icon as any} size={24} color={data.metricSystem === option.value ? Theme.colors.accent.primary : Theme.colors.text.tertiary} />
            <Text style={[styles.unitCardTitle, data.metricSystem === option.value && styles.unitCardTitleSelected]}>{option.title}</Text>
            <Text style={styles.unitCardSubtitle}>{option.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderGender = () => (
    <View style={styles.stepContainer}>
      <View style={styles.listContainerWithTopMargin}>
        {[
          { value: 'female', title: 'Female', icon: 'person-outline' },
          { value: 'male', title: 'Male', icon: 'person-outline' },
          { value: 'other', title: 'Other', icon: 'person-outline' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.listOption, data.gender === option.value && styles.listOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ gender: option.value as any }));
            }}
          >
            <View style={styles.listOptionContent}>
              <Text style={[styles.listOptionText, data.gender === option.value && styles.listOptionTextSelected]}>{option.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAge = () => (
    <View style={styles.stepContainer}>
      <View style={styles.ageSection}>
        <View style={styles.listContainer}>
          {[
            { value: 15, label: 'Under 18' },
            { value: 20, label: '18-24' },
            { value: 30, label: '25-34' },
            { value: 40, label: '35-44' },
            { value: 50, label: '45-54' },
            { value: 60, label: '55-64' },
            { value: 70, label: '65+' },
            { value: 0, label: 'Prefer not to say' },
          ].map((range) => (
            <TouchableOpacity
              key={range.value}
              style={[styles.listOption, data.age === range.value && styles.listOptionSelected]}
              onPress={() => {
                handleSelection(() => updateData({ age: range.value }));
              }}
            >
              <Text style={[styles.listOptionText, data.age === range.value && styles.listOptionTextSelected]}>{range.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.stepContainer}>
      <View style={styles.notificationsSection}>
        {/* <View style={styles.notificationHeroSection}>
          <Text style={styles.notificationMainDescription}>Get training reminders and celebrate your progress</Text>
        </View> */}
        <View style={styles.mockNotificationContainer}>
          <View style={styles.mockNotificationDialog}>
            <Text style={styles.mockNotificationTitle}>"Blaze" Would Like to Send You Notifications</Text>
            <Text style={styles.mockNotificationBody}>
              Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.
            </Text>
            <View style={styles.mockNotificationButtons}>
              <TouchableOpacity
                style={[styles.mockButtonSecondary, data.pushNotificationsEnabled === false && styles.mockButtonSecondarySelected]}
                onPress={() => {
                  handlePushNotificationChoice(false);
                }}
              >
                <Text style={[styles.mockButtonSecondaryText, data.pushNotificationsEnabled === false && styles.mockButtonSecondaryTextSelected]}>Don't Allow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mockButtonPrimary, data.pushNotificationsEnabled === true && styles.mockButtonPrimarySelected]}
                onPress={() => {
                  handlePushNotificationChoice(true);
                }}
              >
                <Text style={[styles.mockButtonPrimaryText, data.pushNotificationsEnabled === true && styles.mockButtonPrimaryTextSelected]}>Allow</Text>
              </TouchableOpacity>
            </View>
          </View>
          {data.pushNotificationsEnabled === null && (
            <View style={styles.mockNotificationArrow}>
              <Text style={styles.mockNotificationArrowText}>Click "Allow" when this pops up ☝️</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  const requestRating = async (shouldRate: boolean) => {
    if (shouldRate) {
      // Use the RatingService to request a rating
      await requestStoreRating(true); // Manual request from onboarding
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    handleSelection(() => updateData({ hasRated: shouldRate }));
  };

  const handleStartPlan = async () => {
    try {
      setIsGeneratingPlan(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if this is a premium plan (all plans are premium for now)
      const isPremiumPlan = true;

      // If it's a premium plan and user doesn't have premium access, show paywall
      if (isPremiumPlan && !revenueCatUser.pro) {
        try {
          const result = await RevenueCatUI.presentPaywall();

          switch (result) {
            case PAYWALL_RESULT.PURCHASED:
            case PAYWALL_RESULT.RESTORED:
              // User successfully subscribed, continue with plan creation
              console.log('User subscribed, proceeding with premium plan');
              break;
            case PAYWALL_RESULT.CANCELLED:
            case PAYWALL_RESULT.ERROR:
            case PAYWALL_RESULT.NOT_PRESENTED:
            default:
              // User cancelled or error occurred, don't proceed
              setIsGeneratingPlan(false);
              return;
          }
        } catch (error: any) {
          console.log('Paywall interaction:', error);

          // Check if this is a user cancellation (common with RevenueCat)
          if (error?.userCancelled || error?.code === 'userCancelled' ||
            error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
            console.log('User cancelled subscription');
            setIsGeneratingPlan(false);
            return;
          }

          // For actual errors, show error message
          console.error('Paywall error:', error);
          Alert.alert('Error', 'Something went wrong with the subscription. Please try again.');
          setIsGeneratingPlan(false);
          return;
        }
      }

      // Set default training preferences for C25K plan
      updateData({
        daysPerWeek: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
      });

      // Plan generation will happen after auth in the background
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Skip directly to auth step to save the plan generation for post-signup
      setCurrentStep(15);
    } catch (error) {
      console.error('Failed to start plan:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to start your plan. Please try again.");
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const renderRating = () => (
    <View style={styles.stepContainer}>
      <View style={styles.ratingSection}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>
            So a rating goes a long way 💜
          </Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name="star"
                size={40}
                color={Theme.colors.accent.primary}
                style={styles.starIcon}
              />
            ))}
          </View>
          <TouchableOpacity
            style={styles.ratingButton}
            onPress={() => requestRating(true)}
          >
            <Text style={styles.ratingButtonText}>Leave a rating</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipRatingButton}
            onPress={() => requestRating(false)}
          >
            <Text style={styles.skipRatingButtonText}>Ok, I've rated!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderAuth = () => (
    <View style={styles.stepContainer}>
      <View style={styles.authSection}>
        <View style={styles.authHeroSection}>
          <Text style={styles.authMainDescription}>
            Sign in to keep your training progress and achievements synced across devices.
          </Text>
        </View>
        <View style={styles.authBenefitsList}>
          <View style={styles.authBenefitItem}>
            <View style={styles.authBenefitCheck}>
              <Ionicons name="checkmark" size={16} color={Theme.colors.text.primary} />
            </View>
            <Text style={styles.authBenefitText}>Save your training progress</Text>
          </View>
          <View style={styles.authBenefitItem}>
            <View style={styles.authBenefitCheck}>
              <Ionicons name="checkmark" size={16} color={Theme.colors.text.primary} />
            </View>
            <Text style={styles.authBenefitText}>Sync between devices</Text>
          </View>
          <View style={styles.authBenefitItem}>
            <View style={styles.authBenefitCheck}>
              <Ionicons name="checkmark" size={16} color={Theme.colors.text.primary} />
            </View>
            <Text style={styles.authBenefitText}>Keep your streak safe</Text>
          </View>
        </View>

        <View style={styles.authButtonsContainer}>
          <TouchableOpacity style={styles.googleSignInButton} onPress={handleGoogleSignIn}>
            <Text style={styles.googleSignInButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.appleSignInButton} onPress={handleAppleSignIn}>
            <Ionicons name="logo-apple" size={20} color={Theme.colors.text.primary} />
            <Text style={styles.appleSignInButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.authPrivacyText}>
          We only use your account for authentication. Your email and personal details stay private.
        </Text>
      </View>
    </View>
  );



  const isNameStepEmpty = !data.firstName?.trim() && !data.lastName?.trim();

  return (
    <View style={styles.container}>
      {renderProgressBar()}
      {renderHeader()}
      <View style={styles.content}>
        {currentStep === 0 && (
          <Reanimated.View style={{ flex: 1 }} key="step-0">
            {renderIntroLightup()}
          </Reanimated.View>
        )}

        {currentStep === 1 && (
          <Reanimated.View style={{ flex: 1 }} entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} key="step-1">
            {renderFlameIntroduction()}
          </Reanimated.View>
        )}

        {currentStep === 2 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-2">
            {renderRunningAbilityCheck()}
          </Reanimated.View>
        )}
        {currentStep === 3 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-3">
            {renderPersonalizedEncouragement()}
          </Reanimated.View>
        )}
        {currentStep === 4 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-4">
            {renderRunningGoal()}
          </Reanimated.View>
        )}
        {currentStep === 5 && data.canRun30Min !== false && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-5">
            {renderDaysPerWeek()}
          </Reanimated.View>
        )}
        {currentStep === 6 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-6">
            {renderPreferredDays()}
          </Reanimated.View>
        )}
        {currentStep === 7 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-7">
            {renderUnits()}
          </Reanimated.View>
        )}
        {currentStep === 8 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-8">
            {renderGender()}
          </Reanimated.View>
        )}
        {currentStep === 9 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-9">
            {renderAge()}
          </Reanimated.View>
        )}
        {currentStep === 10 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-10">
            {renderNamePrompt()}
          </Reanimated.View>
        )}
        {currentStep === 11 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-11">
            {renderNotifications()}
          </Reanimated.View>
        )}
        {currentStep === 12 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-12">
            {renderRating()}
          </Reanimated.View>
        )}
        {currentStep === 13 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-13">
            {renderPlanProposal()}
          </Reanimated.View>
        )}
        {currentStep === 14 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-14">
            {renderStartingTodayProgress()}
          </Reanimated.View>
        )}
        {currentStep === 15 && (
          <Reanimated.View style={{ flex: 1 }} entering={getEnterAnimation()} exiting={getExitAnimation()} key="step-15">
            {renderAuth()}
          </Reanimated.View>
        )}
      </View>
      {(currentStep === 3 || (currentStep === 5 && data.canRun30Min !== false) || currentStep === 6 || currentStep === 10 || currentStep === 13) && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 3 ? 'Sounds good!' :
                currentStep === 10 && isNameStepEmpty ? 'Skip' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {currentStep === 1 && (
        <Reanimated.View style={[styles.footer, flameButtonsOpacityAnimatedStyle]}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={[styles.nextButtonText]}>
              Let's run!
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Jump directly to the auth step (step 15)
              setAuthFromShortcut(true);
              setCurrentStep(15);
            }}
          >
            <Text style={styles.signInButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </Reanimated.View>
      )}
    </View>
  );
}

type ProgressChartProps = {
  width: number;
  height: number;
  goalLabel: string;
  targetDateLabel: string;
};

const ProgressChart: React.FC<ProgressChartProps> = ({ width, height, goalLabel, targetDateLabel }) => {
  const padding = 30;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  // Bezier-like path that approaches but never goes above the goal line (y >= goalY)
  const goalFrac = 0.40; // higher on grid (closer to top)
  const pathD = `M ${padding},${padding + chartH * 0.95}
    C ${padding + chartW * 0.15},${padding + chartH * 0.95}
      ${padding + chartW * 0.25},${padding + chartH * 0.78}
      ${padding + chartW * 0.35},${padding + chartH * 0.72}
    S ${padding + chartW * 0.55},${padding + chartH * 0.65}
      ${padding + chartW * 0.65},${padding + chartH * 0.62}
    S ${padding + chartW * 0.80},${padding + chartH * 0.58}
      ${padding + chartW * 0.90},${padding + chartH * goalFrac}`;

  // Animate stroke drawing
  const progress = useSharedValue(0);
  const animatedProps = useAnimatedProps<any>(() => ({
    strokeDasharray: `${chartW * 2} ${chartW * 2}`,
    strokeDashoffset: (1 - progress.value) * chartW * 2,
  }));

  React.useEffect(() => {
    progress.value = withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) });
  }, []);

  const AnimatedPath = Reanimated.createAnimatedComponent(SvgPath) as unknown as React.ComponentType<any>;

  const gridLines = [0.2, 0.4, 0.6, 0.8];

  const goalX = padding + chartW * 0.90;
  const goalY = padding + chartH * goalFrac;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="chartGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFD400" />
          <Stop offset="50%" stopColor="#FFA500" />
          <Stop offset="100%" stopColor="#FF0000" />
        </SvgLinearGradient>
      </Defs>

      <SvgRect x={0} y={0} width={width} height={height} rx={16} fill={Theme.colors.background.primary} />

      {gridLines.map((g, i) => (
        <SvgLine
          key={i}
          x1={padding}
          x2={padding + chartW}
          y1={padding + chartH * g}
          y2={padding + chartH * g}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      ))}

      {/* Start dot */}
      <SvgCircle cx={padding} cy={padding + chartH * 0.95} r={6} fill="#FFD400" />

      {/* Animated curve */}
      <AnimatedPath
        d={pathD}
        fill="none"
        stroke="url(#chartGradient)"
        strokeWidth={4}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />

      {/* Goal marker and label */}
      <SvgLine x1={goalX} x2={goalX} y1={goalY} y2={padding + chartH} stroke="rgba(50,173,230,0.5)" strokeDasharray="4 4" />
      <SvgCircle cx={goalX} cy={goalY} r={7} fill="#FFA500" />

      {/* Goal bubble */}
      <SvgRect x={goalX - 18} y={goalY - 40} width={44} height={28} rx={6} fill="#FFA500" />
      <SvgText x={goalX + 4} y={goalY - 21} fill={Theme.colors.background.primary} fontFamily={Theme.fonts.bold} fontSize={12} textAnchor="middle">
        {goalLabel}
      </SvgText>

      {/* Labels */}
      <SvgText x={padding} y={padding + chartH + 18} fill={Theme.colors.text.tertiary} fontFamily={Theme.fonts.medium} fontSize={12}>
        Today
      </SvgText>
      <SvgText x={padding + chartW} y={padding + chartH + 18} fill={Theme.colors.text.tertiary} fontFamily={Theme.fonts.medium} fontSize={12} textAnchor="end">
        Finish Line
      </SvgText>
    </Svg>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  solidBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
    backgroundColor: '#0D0C0F'
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: LEGACY_DEVICE ? 20 : 50,
  },
  backButton: {
    padding: Theme.spacing.sm,
    marginRight: Theme.spacing.md,
  },
  backButtonPlaceholder: {
    width: 24,
    height: 24,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.full,
  },
  progressFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.full,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRiveContainer: {
    width: 100,
    height: 100,
  },
  headerTextBubble: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.background.primary,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    padding: Theme.spacing.lg,
    position: 'relative',
  },
  bubblePointer: {
    position: 'absolute',
    left: -12,
    top: '50%',
    marginTop: -8,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: 'transparent',
    borderRightWidth: 12,
    borderRightColor: Theme.colors.background.tertiary,
    borderBottomWidth: 8,
    borderBottomColor: 'transparent',
  },
  bubblePointerInner: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -6,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderTopColor: 'transparent',
    borderRightWidth: 10,
    borderRightColor: Theme.colors.background.primary,
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
  },
  headerRiveImage: {
    width: '100%',
    height: '100%',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    zIndex: 10,
  },
  headerSubtitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  // Intro step styles
  introContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  introRiveWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  introRive: {
    width: '100%',
    height: '100%',
  },
  introBlackOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  introPressLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: LEGACY_DEVICE ? 60 : 120,
  },
  introHintText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  introContinueButton: {
    marginTop: LEGACY_DEVICE ? 16 : 24,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  introContinueText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    textTransform: 'uppercase',
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
    justifyContent: 'flex-start',
    paddingTop: LEGACY_DEVICE ? Theme.spacing.xs : Theme.spacing.lg,
  },
  blazeContainerIntro: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  blazeContainer: {
    alignItems: 'center',
  },
  blazeImage: {
    width: LEGACY_DEVICE ? 140 : 200,
    height: LEGACY_DEVICE ? 140 : 200,
  },
  welcomeContent: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Theme.spacing.lg,
  },
  pathGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Theme.spacing.lg,
  },
  pathGridOption: {
    width: '47%',
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'relative',
    minHeight: 160,
    paddingBottom: Theme.spacing.lg,
    overflow: 'hidden',
  },
  pathGridOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  pathImageContainer: {
    width: '100%',
    height: LEGACY_DEVICE ? 140 : 200,
    backgroundColor: Theme.colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Theme.spacing.md,
    borderTopLeftRadius: Theme.borderRadius.large,
    borderTopRightRadius: Theme.borderRadius.large,
  },
  pathGridImage: {
    width: '100%',
    height: '100%',
  },
  pathContentContainer: {
    alignItems: 'center',
    width: '100%',
  },
  pathGridTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 18,
  },
  pathGridDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Standardized list styles
  listContainer: {
    gap: LEGACY_DEVICE ? Theme.spacing.sm : Theme.spacing.md,
    width: '100%',
  },
  listContainerWithTopMargin: {
    gap: Theme.spacing.lg,
    marginTop: LEGACY_DEVICE ? 20 : 100,
    width: '100%',
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    paddingHorizontal: LEGACY_DEVICE ? Theme.spacing.lg : Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  listOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  listOptionText: {
    textAlign: 'center',
    fontSize: LEGACY_DEVICE ? 16 : 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  listOptionTextSelected: {
    color: Theme.colors.accent.primary,
  },
  listOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleSection: {
    gap: Theme.spacing.xxxl,
  },
  daysPerWeekSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
    marginTop: LEGACY_DEVICE ? 100 : 200,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    lineHeight: 20,
  },
  runsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xxl,
  },
  counterButton: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterButtonDisabled: {
    opacity: 0.5,
  },
  counterDisplay: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xxl,
    minWidth: 100,
  },
  counterNumber: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  counterLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: 4,
  },
  preferredDaysSection: {
    gap: Theme.spacing.md,
  },
  preferredDaysHeader: {
    alignItems: 'center',
  },
  preferredDaysSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
  },

  workoutStyleGrid: {
    gap: Theme.spacing.xl,
    marginTop: LEGACY_DEVICE ? 100 : 200,
  },
  workoutStyleCard: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  workoutStyleCardSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  workoutStyleCardTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.md,
    marginBottom: 4,
  },
  workoutStyleCardTitleSelected: {
    color: Theme.colors.accent.primary,
  },
  workoutStyleCardSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  unitsGrid: {
    gap: Theme.spacing.xl,
    marginTop: LEGACY_DEVICE ? 50 : 150,
  },
  unitCard: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    position: 'relative',
  },
  unitCardSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  unitCardTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.md,
    marginBottom: 4,
  },
  unitCardTitleSelected: {
    color: Theme.colors.accent.primary,
  },
  unitCardSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  ageSection: {
    alignItems: 'center',
    gap: LEGACY_DEVICE ? Theme.spacing.sm : Theme.spacing.md,
  },
  notificationsSection: {
    gap: Theme.spacing.xl,
  },
  notificationHeroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  notificationMainDescription: {
    fontSize: 18,
    width: '80%',
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  mockNotificationContainer: {
    marginTop: LEGACY_DEVICE ? 20 : 100,
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  mockNotificationDialog: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 1,
    borderColor: Theme.colors.text.tertiary,
    padding: Theme.spacing.xl,
    width: '90%',
    alignItems: 'center',
  },
  mockNotificationTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  mockNotificationBody: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Theme.spacing.lg,
  },
  mockNotificationButtons: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
    width: '100%',
  },
  mockButtonSecondary: {
    flex: 1,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  mockButtonSecondarySelected: {
    backgroundColor: Theme.colors.text.tertiary,
  },
  mockButtonSecondaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  mockButtonSecondaryTextSelected: {
    color: Theme.colors.text.primary,
  },
  mockButtonPrimary: {
    flex: 1,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  mockButtonPrimarySelected: {
    backgroundColor: Theme.colors.accent.secondary,
  },
  mockButtonPrimaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  mockButtonPrimaryTextSelected: {
    color: Theme.colors.background.primary,
  },
  mockNotificationArrow: {
    alignItems: 'center',
  },
  mockNotificationArrowText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.accent.primary,
  },
  notificationChoiceContainer: {
    gap: Theme.spacing.md,
  },
  notificationMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Theme.spacing.md,
  },
  notificationMainButtonSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  notificationMainButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  notificationMainButtonTextSelected: {
    color: Theme.colors.text.primary,
  },
  notificationSkipButton: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: Theme.borderRadius.large,
  },
  notificationSkipButtonSelected: {
    borderColor: Theme.colors.text.tertiary,
  },
  notificationSkipButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  notificationSkipButtonTextSelected: {
    color: Theme.colors.text.primary,
  },
  authSection: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: LEGACY_DEVICE ? 24 : 40,
  },
  authHeroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  authMainDescription: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    width: '90%',
  },
  blazeAuthContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  blazeAuthImage: {
    width: LEGACY_DEVICE ? 140 : 200,
    height: LEGACY_DEVICE ? 140 : 200,
  },
  authBenefitsList: {
    gap: Theme.spacing.lg,
    backgroundColor: Theme.colors.background.secondary,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 1,
    borderColor: Theme.colors.background.tertiary,
  },
  authBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  authBenefitCheck: {
    width: 20,
    height: 20,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 2,
    borderColor: Theme.colors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Theme.spacing.md,
  },
  authBenefitText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  authButtonsContainer: {
    gap: Theme.spacing.md,
    width: '100%',
    marginTop: Theme.spacing.lg,
  },
  appleSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Theme.spacing.sm,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  appleSignInButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  googleSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DB4437',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    width: '100%',
    shadowColor: '#DB4437',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  googleSignInButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: Theme.borderRadius.large,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  authPrivacyText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: Theme.spacing.lg,
  },
  footer: {
    flexDirection: 'column',
    padding: Theme.spacing.xl,
    paddingBottom: 40,
    gap: Theme.spacing.md,
  },
  nextButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  nextButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
    borderBottomColor: Theme.colors.background.secondary,
    opacity: 0.5,
  },
  nextButtonText: {
    textTransform: 'uppercase',
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  nameContainer: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xl,
  },
  nameDescription: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    width: '90%',
  },
  nameContent: {
    alignItems: 'center',
    width: '100%',
    paddingTop: Theme.spacing.xl,
    gap: Theme.spacing.md,
    marginTop: LEGACY_DEVICE ? 25 : 50,
  },
  nameInput: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    backgroundColor: Theme.colors.background.tertiary,
    paddingTop: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    paddingBottom: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    borderWidth: 3,
    borderColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    width: '100%',
    textAlign: 'center',
  },
  // Cinematic effect styles
  cinematicContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
    backgroundColor: Theme.colors.background.primary,
  },
  cinematicImageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cinematicImageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: screenWidth,
    height: screenHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cinematicImage: {
    width: screenWidth,
    height: screenHeight,
  },
  cinematicTextContainer: {
    position: 'absolute',
    top: LEGACY_DEVICE ? 80 : 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    zIndex: 10,
  },
  cinematicText: {
    fontSize: 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  cursor: {
    color: Theme.colors.text.primary,
  },
  // Week start toggle styles
  weekStartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekStartLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginRight: Theme.spacing.md,
  },
  weekStartButtons: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: 4,
  },
  weekStartButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    minWidth: 80,
    alignItems: 'center',
  },
  weekStartButtonSelected: {
    backgroundColor: Theme.colors.accent.primary,
  },
  weekStartButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  weekStartButtonTextSelected: {
    color: Theme.colors.text.primary,
  },
  // Rating styles
  ratingSection: {
    gap: Theme.spacing.xl,
    marginTop: LEGACY_DEVICE ? 50 : 150,
  },
  ratingContainer: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  ratingText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginVertical: Theme.spacing.lg,
  },
  starIcon: {
    // Additional styling can be added here if needed
  },
  ratingButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
    minWidth: 200,
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  ratingButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
  },
  skipRatingButton: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 200,
  },
  skipRatingButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  // Flame introduction styles
  introTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginTop: 50,
  },
  introTitleContainer: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBackground: {
    position: 'absolute',
    top: -150,
    left: 0,
    width: screenWidth,
    height: screenHeight + 50,
    backgroundColor: Theme.colors.background.primary,
  },
  flameIntroContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  flameIntroButtons: {
    position: 'absolute',
    width: '100%',
    gap: Theme.spacing.lg,
  },
  signInButton: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    paddingHorizontal: LEGACY_DEVICE ? Theme.spacing.lg : Theme.spacing.xl,
    borderWidth: 2,
    borderColor: Theme.colors.background.tertiary,
    alignItems: 'center',
    width: '100%',
  },
  signInButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    textTransform: 'uppercase',
    color: Theme.colors.text.primary,
  },
  // Running ability check styles
  runningAbilitySection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
    marginTop: LEGACY_DEVICE ? 100 : 200,
  },
  runningAbilityOptions: {
    gap: Theme.spacing.xl,
    width: '100%',
  },
  runningAbilityOption: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    paddingHorizontal: LEGACY_DEVICE ? Theme.spacing.lg : Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  runningAbilityOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  runningAbilityOptionText: {
    fontSize: LEGACY_DEVICE ? 18 : 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  runningAbilityOptionTextSelected: {
    color: Theme.colors.accent.primary,
  },
  // Personalized encouragement styles
  encouragementSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: LEGACY_DEVICE ? 100 : 200,
  },
  encouragementContent: {
    alignItems: 'center',
  },
  encouragementTitle: {
    fontSize: LEGACY_DEVICE ? 24 : 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
    maxWidth: 320,
  },
  encouragementSubtitle: {
    fontSize: LEGACY_DEVICE ? 16 : 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    maxWidth: 320,
  },
  // Progress step styles
  progressSection: {
    flex: 1,
    paddingTop: LEGACY_DEVICE ? Theme.spacing.lg : Theme.spacing.xl,
    justifyContent: 'space-between',
  },
  progressMainContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  progressMainText: {
    fontSize: LEGACY_DEVICE ? 28 : 36,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xs,
  },
  progressDateText: {
    fontSize: LEGACY_DEVICE ? 20 : 28,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.xl,
  },
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.md,
  },
  chartDateLabel: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  progressChartImage: {
    width: 280,
    height: 180,
  },
  progressChart: {
    flexDirection: 'row',
    height: 180,
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: Theme.spacing.sm,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    height: '100%',
    width: 40,
    paddingRight: Theme.spacing.sm,
  },
  yAxisLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    height: '100%',
    position: 'relative',
  },
  gridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    width: '100%',
  },
  progressPath: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dataPoint: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Theme.colors.text.primary,
  },
  pointActive: {
    backgroundColor: Theme.colors.accent.secondary,
    borderColor: Theme.colors.accent.secondary,
  },
  pointFuture: {
    backgroundColor: Theme.colors.transparent.accent30,
    borderColor: Theme.colors.accent.secondary,
  },
  pointGoal: {
    backgroundColor: Theme.colors.accent.primary,
    borderColor: Theme.colors.accent.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectionLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: Theme.colors.accent.secondary,
  },
  line1: {
    bottom: '27.5%', // Average of 5% and 50%
    left: '15%',
    width: '30%',
    transform: [{ rotate: '45deg' }],
  },
  line2: {
    bottom: '72.5%', // Average of 50% and 95%
    left: '55%',
    width: '30%',
    transform: [{ rotate: '45deg' }],
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginTop: Theme.spacing.sm,
  },
  xAxisLabel: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    flex: 1,
  },
  // Plan proposal styles
  planProposalSection: {
    flex: 1,
    paddingTop: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.lg,
    flexDirection: 'column',
    gap: Theme.spacing.lg,
  },
  planHeroGradient: {
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
    overflow: 'hidden',
  },
  planHeroCard: {
    borderRadius: Theme.borderRadius.large,
    marginBottom: Theme.spacing.xl,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  planHeroCardImageStyle: {
    borderRadius: Theme.borderRadius.large,
  },
  planHeroOverlay: {
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderColor: Theme.colors.accent.primary,
  },
  planHeroBg: {
    position: 'absolute',
    right: -10,
    top: -12,
    opacity: 0.15,
  },
  planHeroBgImage: {
    width: 140,
    height: 140,
  },
  planSocialProof: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: Theme.spacing.md,
  },
  planSocialProofText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  planHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planHeroContent: {
    flex: 1,
  },
  planPill: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.transparent.accent20,
    marginBottom: Theme.spacing.sm,
  },
  planPillText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  planBadge: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  planBadgeText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  planHeroTitle: {
    fontSize: LEGACY_DEVICE ? 28 : 32,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  planHeroSubtitle: {
    fontSize: LEGACY_DEVICE ? 14 : 15,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    lineHeight: 20,
  },
  planHeroImage: {
    width: 80,
    height: 80,
    resizeMode: 'contain',
    marginLeft: Theme.spacing.lg,
  },
  planChips: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    flexWrap: 'wrap',
    marginBottom: Theme.spacing.xl,
  },
  planChipsInside: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    flexWrap: 'wrap',
    marginTop: Theme.spacing.lg,
  },
  planChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Theme.borderRadius.full,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.background.tertiary,
  },
  planChipText: {
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  planFeatureCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    borderWidth: 1,
    borderColor: Theme.colors.background.tertiary,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  planFeatureText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  planActions: {
    marginBottom: Theme.spacing.xl,
  },
  planPrimaryButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  planPrimaryButtonDisabled: {
    opacity: 0.7,
  },
  planPrimaryButtonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
    textTransform: 'uppercase',
  },
  planSecondaryButton: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  planSecondaryButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textDecorationLine: 'underline',
  },
}); 
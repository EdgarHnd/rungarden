import Theme from '@/constants/theme';
import {
  OnboardingData
} from '@/constants/types';
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
import { useVideoPlayer, VideoView } from 'expo-video';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import Rive from 'rive-react-native';

const redirectTo = makeRedirectUri();
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Simplified responsive constants: legacy devices (no notch) vs modern
const LEGACY_DEVICE = screenHeight < 700; // Approximate older, non-notch iPhones

const TOTAL_STEPS = 14;

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const convex = useConvex();
  const [currentStep, setCurrentStep] = useState(1);
  const [slideAnim] = useState(new Animated.Value(1));
  const nameInputRef = useRef<TextInput>(null);
  const [pushService, setPushService] = useState<PushNotificationService | null>(null);

  // Cinematic effect state for welcome step
  const [cinematicPhase, setCinematicPhase] = useState<'zooming' | 'typing' | 'waiting' | 'transition'>('zooming');
  const [typewriterText, setTypewriterText] = useState('');
  const [zoomAnim] = useState(new Animated.Value(1)); // Start at normal scale (full screen)
  const [textOpacityAnim] = useState(new Animated.Value(0));
  const [textPulseAnim] = useState(new Animated.Value(1)); // For pulsing effect
  const [gifOpacityAnim] = useState(new Animated.Value(1));
  const [secondGifOpacityAnim] = useState(new Animated.Value(0));

  // Rive idle animation URL
  const RIVE_URL_IDDLE = "https://curious-badger-131.convex.cloud/api/storage/9caf3bc8-1fab-4dab-a8e5-4b6d563ca7d6";

  const [data, setData] = useState<OnboardingData>({
    mascotName: null,
    path: null,
    currentAbility: null,
    daysPerWeek: 1,
    preferredDays: [],
    preferTimeOverDistance: null,
    metricSystem: null,
    gender: null,
    age: null,
    pushNotificationsEnabled: null,
    weekStartDay: 1, // 0 = Sunday, 1 = Monday (default to Monday)
    hasRated: null, // Whether user completed the rating step
  });

  // --- Video players for cinematic welcome step ---
  const extinctPlayer = useVideoPlayer(
    require('@/assets/images/onboarding/extinct.mp4'),
    player => {
      player.loop = true;
      player.play();
    },
  );

  const appearsPlayer = useVideoPlayer(
    require('@/assets/images/onboarding/appears.mp4'),
    player => {
      player.loop = true;
    },
  );

  useEffect(() => {
    if (convex) {
      const pushSvc = new PushNotificationService(convex);
      setPushService(pushSvc);

      // Initialize push notification channels
      pushSvc.configureNotificationChannels();
    }
  }, [convex]);

  // Cinematic effect for welcome step
  useEffect(() => {
    if (currentStep === 0) {
      // Reset all animations when entering welcome step
      setCinematicPhase('zooming');
      setTypewriterText('');
      zoomAnim.setValue(1.5); // Start at normal scale (image is already full screen)
      textOpacityAnim.setValue(0);
      textPulseAnim.setValue(1);
      gifOpacityAnim.setValue(1);
      secondGifOpacityAnim.setValue(0);

      // Start zoom animation
      setTimeout(() => {
        Animated.timing(zoomAnim, {
          toValue: 1.6, // Subtle zoom in from full screen
          duration: 2000,
          useNativeDriver: true,
        }).start(() => {
          // Start typewriter effect
          setCinematicPhase('typing');
          startTypewriterEffect();
        });
      }, 500);
    }
  }, [currentStep]);

  const startPulseAnimation = () => {
    const pulseLoop = () => {
      Animated.sequence([
        Animated.timing(textPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(textPulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(pulseLoop);
    };
    pulseLoop();
  };

  const startTypewriterEffect = () => {
    const text = "Tap to light up";
    let index = 0;

    // Fade in text container
    Animated.timing(textOpacityAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

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

  const handleCinematicTap = () => {
    if (cinematicPhase === 'waiting') {
      setCinematicPhase('transition');
      // Strong haptic for the tap interaction
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Start playing the second video when transition begins
      if (appearsPlayer) {
        appearsPlayer.play();
      }

      // Transition to second gif
      Animated.parallel([
        Animated.timing(gifOpacityAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(secondGifOpacityAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Success haptic when second gif appears
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Auto advance to next step after showing second gif
        setTimeout(() => {
          // Final transition haptic before moving to next step
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          nextStep();
        }, 2000);
      });
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
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
      // Blur the name input if we're leaving the name step
      if (currentStep === 2 && nameInputRef.current) {
        nameInputRef.current.blur();
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(slideAnim, {
        toValue: currentStep + 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) { // Don't go back from welcome step (0) or flame intro (1)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(slideAnim, {
        toValue: currentStep - 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSelection = (updateFn: () => void) => {
    updateFn();
    // Auto-advance for most steps, except name (2), path (3), days per week (5), and preferred days (6)
    if (currentStep !== 2 && currentStep !== 3 && currentStep !== 5 && currentStep !== 6) {
      setTimeout(() => {
        nextStep();
      }, 300); // Small delay for visual feedback
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return true; // Flame introduction
      case 2: return data.mascotName !== null && data.mascotName.trim() !== ''; // Name
      case 3: return data.path !== null; // Path
      case 4: return data.currentAbility !== null; // Current ability
      case 5: return data.daysPerWeek >= 1; // Days per week
      case 6: return data.preferredDays.length >= data.daysPerWeek; // Preferred days
      case 7: return data.preferTimeOverDistance !== null; // Workout style
      case 8: return data.metricSystem !== null; // Units
      case 9: return data.gender !== null; // Gender
      case 10: return data.age !== null; // Age
      case 11: return data.pushNotificationsEnabled !== null; // Notifications
      case 12: return data.hasRated !== null; // Rating
      case 13: return true; // Auth step
      default: return false;
    }
  };

  const saveOnboardingDataToStorage = async () => {
    try {
      // Map onboarding goalDistance to training profile format
      let mappedGoalDistance: '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon' = '5K'; // Default to 5K

      // Map currentAbility to longestDistance for training profile
      let longestDistance: 'never' | '1to2km' | '2to4km' | '5plusKm' = 'never';
      if (data.currentAbility === 'none') {
        longestDistance = 'never';
      } else if (data.currentAbility === 'less1min' || data.currentAbility === '1to5min') {
        longestDistance = '1to2km';
      } else if (data.currentAbility === '5to15min') {
        longestDistance = '2to4km';
      } else if (data.currentAbility === '15to30min' || data.currentAbility === 'more30min') {
        longestDistance = '5plusKm';
      }

      // Separate training profile data from user profile data
      const trainingProfileData = {
        goalDistance: mappedGoalDistance,
        goalDate: undefined,
        currentAbility: data.currentAbility,
        longestDistance,
        daysPerWeek: data.daysPerWeek,
        preferredDays: data.preferredDays,
        hasTreadmill: false, // Default value
        preferTimeOverDistance: data.preferTimeOverDistance,
        pushNotificationsEnabled: data.pushNotificationsEnabled,
      };

      const userProfileData = {
        mascotName: data.mascotName,
        path: data.path,
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
    // Don't render anything during the cinematic welcome step
    if (currentStep === 0) return null;

    return (
      <View style={styles.topRow}>
        {currentStep > 1 && currentStep < TOTAL_STEPS - 1 ? (
          <TouchableOpacity style={styles.backButton} onPress={prevStep}>
            <Ionicons name="chevron-back" size={24} color={Theme.colors.text.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backButtonPlaceholder} />
        )}
        {currentStep >= 1 && currentStep < TOTAL_STEPS - 1 && (
          <View style={styles.progressBarContainer}>
            {currentStep > 1 && (
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={['#FF4500', '#FF6500', '#FF8C00', '#FFD700']} // Burning gradient: dark orange to bright gold
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${((currentStep - 2) / (TOTAL_STEPS - 4)) * 100}%` }]}
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderFlameIntroduction = () => (
    <View style={styles.stepContainer}>
      <View style={styles.flameIntroContainer}>
        <View style={styles.blazeContainer}>
          <Rive url={RIVE_URL_IDDLE} style={styles.blazeImage} autoplay={true} />
        </View>

        <View style={styles.flameIntroButtons}>
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              nextStep();
            }}
          >
            <Text style={styles.getStartedButtonText}>Adopt it!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              // Jump directly to the auth step (step 13)
              setCurrentStep(13);
              Animated.timing(slideAnim, {
                toValue: 13,
                duration: 300,
                useNativeDriver: true,
              }).start();
            }}
          >
            <Text style={styles.signInButtonText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderName = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.stepContainer}>
        <View style={styles.blazeContainer}>
          <Rive url={RIVE_URL_IDDLE} style={styles.blazeImage} autoplay={true} />
        </View>

        <View style={styles.nameContent}>
          <TextInput
            ref={nameInputRef}
            style={styles.nameInput}
            placeholder="Enter name"
            placeholderTextColor={Theme.colors.text.tertiary}
            value={data.mascotName || ''}
            onChangeText={(text) => updateData({ mascotName: text })}
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

  const renderHeader = () => {
    const getStepInfo = () => {
      switch (currentStep) {
        case 0: return { title: '', subtitle: '' };
        case 1: return { title: 'You found a lost flame', subtitle: '' };
        case 2: return { title: 'What should we call it?', subtitle: '' };
        case 3: return { title: 'Choose your path', subtitle: '' };
        case 4: return { title: 'How long can you run now?', subtitle: '' };
        case 5: return { title: 'How many days per week do you want to run?', subtitle: '' };
        case 6: return { title: 'Preferred training days', subtitle: '' };
        case 7: return { title: 'Workout style', subtitle: '' };
        case 8: return { title: 'Units', subtitle: '' };
        case 9: return { title: 'Gender', subtitle: '' };
        case 10: return { title: 'What is your age range?', subtitle: '' };
        case 11: return { title: 'Blaze works best with notifications', subtitle: '' };
        case 12: return { title: 'We are a small team', subtitle: '' };
        case 13: return { title: 'Save your progress', subtitle: '' };
        default: return { title: '', subtitle: '' };
      }
    };
    const stepInfo = getStepInfo();
    if (currentStep === 0) return null;
    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{stepInfo.title}</Text>
        {stepInfo.subtitle && <Text style={styles.headerSubtitle}>{stepInfo.subtitle}</Text>}
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
          <Animated.View
            style={[
              styles.cinematicImageWrapper,
              {
                transform: [{ scale: zoomAnim }],
                opacity: gifOpacityAnim,
              }
            ]}
          >
            <VideoView
              player={extinctPlayer as any}
              style={styles.cinematicImage}
              nativeControls={false}
            />
          </Animated.View>

          {(cinematicPhase === 'transition') && (
            <Animated.View
              style={[
                styles.cinematicImageWrapper,
                {
                  opacity: secondGifOpacityAnim,
                  transform: [{ scale: 1.6 }], // Start at the same zoom level as first gif ends
                }
              ]}
            >
              <VideoView
                player={appearsPlayer as any}
                style={styles.cinematicImage}
                nativeControls={false}
              />
            </Animated.View>
          )}
        </View>

        <Animated.View
          style={[
            styles.cinematicTextContainer,
            {
              opacity: textOpacityAnim,
              transform: [{ scale: textPulseAnim }]
            }
          ]}
        >
          <Text style={styles.cinematicText}>
            {typewriterText}
            {cinematicPhase === 'typing' && <Text style={styles.cursor}>|</Text>}
          </Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );

  const renderChoosePath = () => (
    <View style={styles.stepContainer}>
      <View style={styles.pathGridContainer}>
        {[
          {
            value: 'true-beginner',
            title: 'Light the Spark',
            description: 'From zero to first runs',
            image: require('@/assets/images/blaze/blazespark.png')
          },
          {
            value: 'run-habit',
            title: 'Keep the Fire',
            description: 'Build a lasting habit',
            image: require('@/assets/images/blaze/blazefriends.png')
          },
          {
            value: 'weight-loss',
            title: 'Run and Melt',
            description: 'Lose weight with running',
            image: require('@/assets/images/blaze/blazemelt.png')
          },
          {
            value: 'race-ready',
            title: 'Blaze the Race',
            description: 'Train for competitions',
            image: require('@/assets/images/blaze/blazerace.png')
          },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.pathGridOption, data.path === option.value && styles.pathGridOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ path: option.value as any }));
            }}
          >
            <View style={styles.pathImageContainer}>
              <Image source={option.image} style={styles.pathGridImage} resizeMode="cover" />
            </View>
            <View style={styles.pathContentContainer}>
              <Text style={styles.pathGridTitle}>{option.title}</Text>
              <Text style={styles.pathGridDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderCurrentAbility = () => (
    <View style={styles.stepContainer}>
      <View style={styles.listContainerWithTopMargin}>
        {[
          { value: 'less1min', title: 'Less than 1 min' },
          { value: '1to5min', title: '5 min without stopping' },
          { value: '5to15min', title: '15 min without stopping' },
          { value: '15to30min', title: '30 min without stopping' },
          { value: 'more30min', title: 'More than 30 min' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.listOption, data.currentAbility === option.value && styles.listOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ currentAbility: option.value as any }));
            }}
          >
            <Text style={[styles.listOptionText, data.currentAbility === option.value && styles.listOptionTextSelected]}>{option.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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

          {/* <Text style={styles.sectionDescription}>
              Select {data.daysPerWeek} or more days for flexibility.
            </Text> */}
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

  const renderWorkoutStyle = () => (
    <View style={styles.stepContainer}>
      <View style={styles.workoutStyleGrid}>
        {[
          { value: true, title: 'Time Based', subtitle: '20 min easy run', icon: 'time-outline' },
          { value: false, title: 'Distance Based', subtitle: '3km easy run', icon: 'location-outline' },
        ].map((option) => (
          <TouchableOpacity
            key={option.title}
            style={[styles.workoutStyleCard, data.preferTimeOverDistance === option.value && styles.workoutStyleCardSelected]}
            onPress={() => {
              handleSelection(() => updateData({ preferTimeOverDistance: option.value }));
            }}
          >
            <Ionicons name={option.icon as any} size={24} color={data.preferTimeOverDistance === option.value ? Theme.colors.accent.primary : Theme.colors.text.tertiary} />
            <Text style={[styles.workoutStyleCardTitle, data.preferTimeOverDistance === option.value && styles.workoutStyleCardTitleSelected]}>{option.title}</Text>
            <Text style={styles.workoutStyleCardSubtitle}>{option.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

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
        <View style={styles.notificationHeroSection}>
          <Text style={styles.notificationMainDescription}>Get training reminders and celebrate your progress</Text>
        </View>
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

        <View style={styles.blazeAuthContainer}>
          <Rive url={RIVE_URL_IDDLE} style={styles.blazeAuthImage} autoplay={true} />
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

  // ===== Lazy step renderer mapping =====
  const stepRenderers = [
    renderWelcome,
    renderFlameIntroduction,
    renderName,
    renderChoosePath,
    renderCurrentAbility,
    renderDaysPerWeek,
    renderPreferredDays,
    renderWorkoutStyle,
    renderUnits,
    renderGender,
    renderAge,
    renderNotifications,
    renderRating,
    renderAuth,
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Theme.colors.background.tertiary, Theme.colors.background.secondary, Theme.colors.background.primary]}
        style={styles.solidBackground}
      />
      {renderProgressBar()}
      {renderHeader()}
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.stepWrapper,
            {
              transform: [{
                translateX: slideAnim.interpolate({
                  inputRange: [0, TOTAL_STEPS - 1],
                  outputRange: [0, -(TOTAL_STEPS - 1) * screenWidth],
                })
              }]
            }
          ]}
        >
          {stepRenderers.map((stepFn, index) => {
            // Render only the current step and its immediate neighbors to save memory
            if (Math.abs(index - currentStep) <= 1) {
              return <React.Fragment key={index}>{stepFn()}</React.Fragment>;
            }
            // Placeholder keeps layout width consistent
            return <View key={index} style={{ width: screenWidth }} />;
          })}
        </Animated.View>
      </View>
      {(currentStep === 2 || currentStep === 3 || currentStep === 5 || currentStep === 6) && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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
    paddingBottom: Theme.spacing.md,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    maxWidth: screenWidth * 0.9,
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
  stepWrapper: {
    flexDirection: 'row',
    width: screenWidth * TOTAL_STEPS,
  },
  stepContainer: {
    width: screenWidth,
    paddingHorizontal: Theme.spacing.xl,
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: LEGACY_DEVICE ? Theme.spacing.xs : Theme.spacing.lg,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingTop: Theme.spacing.xxxl,
  },
  blazeContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
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
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: LEGACY_DEVICE ? Theme.spacing.md : Theme.spacing.xl,
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
    marginTop: LEGACY_DEVICE ? 100 : 200,
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
    color: Theme.colors.text.primary,
  },
  mockButtonPrimaryTextSelected: {
    color: Theme.colors.text.primary,
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
    gap: LEGACY_DEVICE ? Theme.spacing.sm : Theme.spacing.md,
  },
  authHeroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  authMainDescription: {
    fontSize: 18,
    width: '80%',
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
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
  },
  authBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  appleSignInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Theme.spacing.sm,
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
    paddingVertical: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
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
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  footer: {
    padding: Theme.spacing.xl,
    paddingBottom: 40,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
    paddingVertical: Theme.spacing.lg,
  },
  nextButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
    borderBottomColor: Theme.colors.background.secondary,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  nameContainer: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xl,
  },
  nameContent: {
    alignItems: 'center',
    width: '100%',
  },
  nameInput: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    backgroundColor: Theme.colors.background.tertiary,
    padding: Theme.spacing.lg,
    marginTop: Theme.spacing.xl,
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
    marginTop: LEGACY_DEVICE ? 100 : 200,
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
    color: Theme.colors.text.primary,
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
  flameIntroContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: Theme.spacing.xl,
  },
  flameIntroButtons: {
    marginTop: LEGACY_DEVICE ? 20 : 100,
    width: '100%',
    gap: Theme.spacing.lg,
  },
  getStartedButton: {
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    borderColor: Theme.colors.accent.primary,
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.accent.secondary,
    backgroundColor: Theme.colors.accent.primary,
  },
  getStartedButtonText: {
    fontSize: 30,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  signInButton: {
    alignItems: 'center',
    paddingVertical: Theme.spacing.lg,
  },
  signInButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textDecorationLine: 'underline',
  },
}); 
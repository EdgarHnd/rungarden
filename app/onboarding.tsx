import Theme from '@/constants/theme';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const redirectTo = makeRedirectUri();
const { width: screenWidth } = Dimensions.get('window');

interface OnboardingData {
  name: string | null;
  path: 'light-spark' | 'keep-fire' | 'run-melt' | 'race-ready' | null;
  currentAbility: 'none' | 'less1min' | '1to5min' | '5to10min' | 'more10min' | null;
  daysPerWeek: number;
  preferredDays: string[];
  preferTimeOverDistance: boolean | null;
  metricSystem: 'metric' | 'imperial' | null;
  gender: 'female' | 'male' | 'other' | null;
  age: number | null;
  pushNotificationsEnabled: boolean | null;
}

const TOTAL_STEPS = 12;

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [slideAnim] = useState(new Animated.Value(0));
  const nameInputRef = useRef<TextInput>(null);
  const [data, setData] = useState<OnboardingData>({
    name: null,
    path: null,
    currentAbility: null,
    daysPerWeek: 3,
    preferredDays: [],
    preferTimeOverDistance: null,
    metricSystem: null,
    gender: null,
    age: null,
    pushNotificationsEnabled: null,
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      // Blur the name input if we're leaving the name step
      if (currentStep === 1 && nameInputRef.current) {
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

  const handleSelection = (updateFn: () => void) => {
    updateFn();
    // Auto-advance for most steps, except name (1), path (2), days per week (4), and preferred days (5)
    if (currentStep !== 1 && currentStep !== 2 && currentStep !== 4 && currentStep !== 5) {
      setTimeout(() => {
        nextStep();
      }, 300); // Small delay for visual feedback
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // Welcome
      case 1: return data.name !== null && data.name.trim() !== ''; // Name
      case 2: return data.path !== null; // Path
      case 3: return data.currentAbility !== null; // Current ability
      case 4: return data.daysPerWeek >= 1; // Days per week
      case 5: return data.preferredDays.length >= data.daysPerWeek; // Preferred days
      case 6: return data.preferTimeOverDistance !== null; // Workout style
      case 7: return data.metricSystem !== null; // Units
      case 8: return data.gender !== null; // Gender
      case 9: return data.age !== null; // Age
      case 10: return data.pushNotificationsEnabled !== null; // Notifications
      case 11: return true; // Auth step
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
      } else if (data.currentAbility === '5to10min') {
        longestDistance = '2to4km';
      } else if (data.currentAbility === 'more10min') {
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
        name: data.name,
        path: data.path,
        metricSystem: data.metricSystem,
        gender: data.gender,
        age: data.age,
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
        await signIn("google", { code });
        router.replace('/(app)');
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
      await signIn("apple");
      router.replace('/(app)');
    } catch (error) {
      console.error("Apple sign in error:", error);
      Alert.alert("Error", "Failed to sign in with Apple");
    }
  };

  const renderProgressBar = () => (
    <View style={styles.topRow}>
      <View style={styles.backButtonPlaceholder} />
      {currentStep > 0 && currentStep < TOTAL_STEPS - 1 && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(currentStep / (TOTAL_STEPS - 2)) * 100}%` }]} />
          </View>
        </View>
      )}
    </View>
  );

  const renderName = () => (
    <View style={styles.stepContainer}>
      <View style={styles.blazeContainer}>
        <Image source={require('@/assets/images/blaze/blazeidle.png')} style={styles.blazeImage} resizeMode="contain" />
      </View>

      <View style={styles.nameContent}>
        <TextInput
          ref={nameInputRef}
          style={styles.nameInput}
          placeholder="Enter name"
          placeholderTextColor={Theme.colors.text.tertiary}
          value={data.name || ''}
          onChangeText={(text) => updateData({ name: text })}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (canProceed()) {
              handleSelection(() => { });
            }
          }}
        />
      </View>
    </View>
  );

  const renderHeader = () => {
    const getStepInfo = () => {
      switch (currentStep) {
        case 0: return { title: '', subtitle: '' };
        case 1: return { title: 'What should we call your flame?', subtitle: '' };
        case 2: return { title: 'Choose your path', subtitle: '' };
        case 3: return { title: 'How long can you run?', subtitle: '' };
        case 4: return { title: 'How many days per week?', subtitle: '' };
        case 5: return { title: 'Preferred training days', subtitle: '' };
        case 6: return { title: 'Workout style', subtitle: '' };
        case 7: return { title: 'Units', subtitle: '' };
        case 8: return { title: 'Gender', subtitle: '' };
        case 9: return { title: 'Age', subtitle: '' };
        case 10: return { title: 'Notifications', subtitle: '' };
        case 11: return { title: 'Save your progress', subtitle: '' };
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
    <View style={styles.stepContainer}>
      <View style={styles.welcomeContainer}>
        <View style={styles.blazeContainer}>
          <Image source={require('@/assets/images/blaze/blazeruncycle.gif')} style={styles.blazeGif} resizeMode="contain" />
        </View>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Welcome to Blaze</Text>
          <Text style={styles.welcomeSubtitle}>Your personal running companion</Text>
        </View>
      </View>
    </View>
  );

  const renderChoosePath = () => (
    <View style={styles.stepContainer}>
      <View style={styles.pathGridContainer}>
        {[
          {
            value: 'light-spark',
            title: 'Light the Spark',
            description: 'From zero to first runs',
            image: require('@/assets/images/blaze/blazespark.png')
          },
          {
            value: 'keep-fire',
            title: 'Keep the Fire',
            description: 'Build a lasting habit',
            image: require('@/assets/images/blaze/blazefriends.png')
          },
          {
            value: 'run-melt',
            title: 'Run to Melt',
            description: 'Lose weight with running',
            image: require('@/assets/images/blaze/blazemelt.png')
          },
          {
            value: 'race-ready',
            title: 'Race Ready',
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
      <View style={styles.abilityListContainer}>
        {[
          { value: 'less1min', title: 'Less than 1 min' },
          { value: '1to5min', title: '5 min without stopping' },
          { value: '5to15min', title: '15 min without stopping' },
          { value: '15to30min', title: '30 min without stopping' },
          { value: 'more30min', title: 'More than 30 min' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.abilityListOption, data.currentAbility === option.value && styles.abilityListOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ currentAbility: option.value as any }));
            }}
          >
            <Text style={styles.abilityListTitle}>{option.title}</Text>
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
    const daysOfWeek = [
      { short: 'Mon', full: 'Monday' },
      { short: 'Tue', full: 'Tuesday' },
      { short: 'Wed', full: 'Wednesday' },
      { short: 'Thu', full: 'Thursday' },
      { short: 'Fri', full: 'Friday' },
      { short: 'Sat', full: 'Saturday' },
      { short: 'Sun', full: 'Sunday' },
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.preferredDaysSection}>
          <Text style={styles.sectionDescription}>
            Select {data.daysPerWeek} or more days for flexibility.
          </Text>
          <View style={styles.preferredDaysList}>
            {daysOfWeek.map((day, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.preferredDayOption, data.preferredDays.includes(day.short) && styles.preferredDayOptionSelected]}
                onPress={() => {
                  const newPreferred = data.preferredDays.includes(day.short)
                    ? data.preferredDays.filter(d => d !== day.short)
                    : [...data.preferredDays, day.short];
                  updateData({ preferredDays: newPreferred });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[styles.preferredDayText, data.preferredDays.includes(day.short) && styles.preferredDayTextSelected]}>
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
      <View style={styles.genderListContainer}>
        {[
          { value: 'female', title: 'Female', icon: 'person-outline' },
          { value: 'male', title: 'Male', icon: 'person-outline' },
          { value: 'other', title: 'Other', icon: 'person-outline' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.genderListOption, data.gender === option.value && styles.genderListOptionSelected]}
            onPress={() => {
              handleSelection(() => updateData({ gender: option.value as any }));
            }}
          >
            <View style={styles.genderListContent}>
              <Ionicons name={option.icon as any} size={20} color={data.gender === option.value ? Theme.colors.accent.primary : Theme.colors.text.tertiary} />
              <Text style={styles.genderListTitle}>{option.title}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAge = () => (
    <View style={styles.stepContainer}>
      <View style={styles.ageSection}>
        <Text style={styles.sectionTitle}>What's your age range?</Text>
        <Text style={styles.sectionDescription}>This helps us personalize your training plan</Text>

        <View style={styles.ageListContainer}>
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
              style={[styles.ageListOption, data.age === range.value && styles.ageListOptionSelected]}
              onPress={() => {
                handleSelection(() => updateData({ age: range.value }));
              }}
            >
              <Text style={[styles.ageListText, data.age === range.value && styles.ageListTextSelected]}>{range.label}</Text>
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
          <Text style={styles.notificationMainTitle}>Stay motivated with notifications</Text>
          <Text style={styles.notificationMainDescription}>Get training reminders and celebrate your progress</Text>
        </View>
        <View style={styles.mockNotificationContainer}>
          <View style={styles.mockNotificationDialog}>
            <Text style={styles.mockNotificationTitle}>"Koko" Would Like to Send You Notifications</Text>
            <Text style={styles.mockNotificationBody}>
              Notifications may include alerts, sounds, and icon badges. These can be configured in Settings.
            </Text>
            <View style={styles.mockNotificationButtons}>
              <View style={styles.mockButtonSecondary}>
                <Text style={styles.mockButtonSecondaryText}>Don't Allow</Text>
              </View>
              <View style={styles.mockButtonPrimary}>
                <Text style={styles.mockButtonPrimaryText}>Allow</Text>
              </View>
            </View>
          </View>
          <View style={styles.mockNotificationArrow}>
            <Text style={styles.mockNotificationArrowText}>👆 Tap "Allow" when this appears</Text>
          </View>
        </View>
        <View style={styles.notificationChoiceContainer}>
          <TouchableOpacity
            style={[styles.notificationMainButton, data.pushNotificationsEnabled === true && styles.notificationMainButtonSelected]}
            onPress={() => {
              handleSelection(() => updateData({ pushNotificationsEnabled: true }));
            }}
          >
            <Ionicons name="notifications" size={24} color={data.pushNotificationsEnabled === true ? Theme.colors.text.primary : Theme.colors.text.tertiary} />
            <Text style={[styles.notificationMainButtonText, data.pushNotificationsEnabled === true && styles.notificationMainButtonTextSelected]}>
              Enable Notifications
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.notificationSkipButton, data.pushNotificationsEnabled === false && styles.notificationSkipButtonSelected]}
            onPress={() => {
              handleSelection(() => updateData({ pushNotificationsEnabled: false }));
            }}
          >
            <Text style={[styles.notificationSkipButtonText, data.pushNotificationsEnabled === false && styles.notificationSkipButtonTextSelected]}>
              Skip for now
            </Text>
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
          <Image source={require('@/assets/images/blaze/blazelove.png')} style={styles.blazeAuthImage} resizeMode="contain" />
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
          <TouchableOpacity style={styles.appleSignInButton} onPress={handleAppleSignIn}>
            <Ionicons name="logo-apple" size={20} color={Theme.colors.text.primary} />
            <Text style={styles.appleSignInButtonText}>Sign in with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.googleSignInButton} onPress={handleGoogleSignIn}>
            <Text style={styles.googleSignInButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.authPrivacyText}>
          We only use your account for authentication. Your email and personal details stay private.
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
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
          {renderWelcome()}
          {renderName()}
          {renderChoosePath()}
          {renderCurrentAbility()}
          {renderDaysPerWeek()}
          {renderPreferredDays()}
          {renderWorkoutStyle()}
          {renderUnits()}
          {renderGender()}
          {renderAge()}
          {renderNotifications()}
          {renderAuth()}
        </Animated.View>
      </View>
      {(currentStep === 0 || currentStep === 1 || currentStep === 2 || currentStep === 4 || currentStep === 5) && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === 0 ? 'Get Started' : 'Continue'}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.md,
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
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.full,
  },
  header: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.xs,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
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
    paddingTop: Theme.spacing.lg,
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
  blazeGif: {
    width: 350,
    height: 350,
  },
  blazeImage: {
    width: 200,
    height: 200,
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
    height: 200,
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
  abilityListContainer: {
    gap: Theme.spacing.lg,
  },
  abilityListOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  abilityListOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  abilityListTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  scheduleSection: {
    gap: Theme.spacing.xxxl,
  },
  daysPerWeekSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
    marginTop: Theme.spacing.xxxl,
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
    backgroundColor: Theme.colors.background.secondary,
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
    backgroundColor: Theme.colors.background.secondary,
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
    gap: Theme.spacing.lg,
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
  preferredDaysList: {
    gap: Theme.spacing.md,
  },
  preferredDayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  preferredDayOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  preferredDayText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  preferredDayTextSelected: {
    color: Theme.colors.accent.primary,
  },
  workoutStyleGrid: {
    gap: Theme.spacing.xl,
  },
  workoutStyleCard: {
    backgroundColor: Theme.colors.background.secondary,
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
  },
  unitCard: {
    backgroundColor: Theme.colors.background.secondary,
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
  genderListContainer: {
    gap: Theme.spacing.lg,
  },
  genderListOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderListOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  genderListContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  genderListTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginLeft: Theme.spacing.md,
  },
  ageSection: {
    alignItems: 'center',
    gap: Theme.spacing.xl,
  },
  ageListContainer: {
    gap: Theme.spacing.md,
    width: '100%',
  },
  ageListOption: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  ageListOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  ageListText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  ageListTextSelected: {
    color: Theme.colors.accent.primary,
  },
  notificationsSection: {
    gap: Theme.spacing.xl,
  },
  notificationHeroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  notificationMainTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
    textAlign: 'center',
  },
  notificationMainDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  mockNotificationContainer: {
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  mockNotificationDialog: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
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
  mockButtonSecondaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  mockButtonPrimary: {
    flex: 1,
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
  },
  mockButtonPrimaryText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
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
    gap: Theme.spacing.xl,
  },
  authHeroSection: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  authMainTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
    textAlign: 'center',
  },
  authMainDescription: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  blazeAuthContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  blazeAuthImage: {
    width: 200,
    height: 200,
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
    fontSize: 20,
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
}); 
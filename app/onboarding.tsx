import Theme from '@/constants/theme';
import { useAuthActions } from "@convex-dev/auth/react";
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from "expo-auth-session";
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { openAuthSessionAsync } from "expo-web-browser";
import React, { useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const redirectTo = makeRedirectUri();
const { width: screenWidth } = Dimensions.get('window');

interface OnboardingData {
  goalDistance: '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon' | null;
  targetDate: Date | null;
  currentAbility: 'none' | 'less1min' | '1to5min' | '5to10min' | 'more10min' | null;
  longestDistance: 'never' | '1to2km' | '2to4km' | '5plusKm' | null;
  daysPerWeek: number;
  preferredDays: string[];
  hasTreadmill: boolean | null;
  preferTimeOverDistance: boolean | null;
}

const TOTAL_STEPS = 8;

export default function OnboardingScreen() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [slideAnim] = useState(new Animated.Value(0));
  const [data, setData] = useState<OnboardingData>({
    goalDistance: null,
    targetDate: null,
    currentAbility: null,
    longestDistance: null,
    daysPerWeek: 3,
    preferredDays: [],
    hasTreadmill: null,
    preferTimeOverDistance: null,
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS - 1) {
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
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Animated.timing(slideAnim, {
        toValue: currentStep - 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return true; // Welcome step
      case 1: return data.goalDistance !== null;
      case 2: return data.targetDate !== null;
      case 3: return data.currentAbility !== null;
      case 4: return data.longestDistance !== null;
      case 5: return data.daysPerWeek >= 2;
      case 6: return true; // Preferences are optional
      case 7: return true; // Auth step
      default: return false;
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Here you would save the onboarding data to your backend
      console.log('Onboarding data:', data);
      await signIn("anonymous");
      router.replace('/(app)');
    } catch (error) {
      console.error("Sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in anonymously");
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('Onboarding data:', data);
      const { redirect } = await signIn("google", { redirectTo });

      if (Platform.OS === "web") {
        return;
      }

      const result = await openAuthSessionAsync(redirect!.toString(), redirectTo);

      if (result.type === "success") {
        const { url } = result;
        const code = new URL(url).searchParams.get("code")!;
        await signIn("google", { code });
        router.replace('/(app)');
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in with Google");
    }
  };

  const handleAppleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('Onboarding data:', data);
      await signIn("apple");
      router.replace('/(app)');
    } catch (error) {
      console.error("Apple sign in error:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to sign in with Apple");
    }
  };

  const renderProgressBar = () => (
    <View style={styles.topRow}>
      {currentStep > 0 ? (
        <TouchableOpacity onPress={prevStep} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backButtonPlaceholder} />
      )}
      {currentStep > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(currentStep / (TOTAL_STEPS - 1)) * 100}%` }
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );

  const renderHeader = () => {
    const getStepInfo = () => {
      switch (currentStep) {
        case 0: return { title: 'Welcome to Koko', subtitle: 'Your personal running companion' };
        case 1: return { title: '🎯 What\'s your goal?', subtitle: 'Choose the distance you want to work towards' };
        case 2: return { title: '📅 When\'s your target date?', subtitle: 'This helps us pace your training properly' };
        case 3: return { title: '🏃‍♀️ How long can you run now?', subtitle: 'Be honest - this helps us start at the right level' };
        case 4: return { title: '📏 Longest distance recently?', subtitle: 'What\'s the furthest you\'ve run in the past month?' };
        case 5: return { title: '📅 Training schedule', subtitle: 'How many days per week can you train?' };
        case 6: return { title: '⚙️ Training preferences', subtitle: 'These help us customize your workouts (optional)' };
        case 7: return { title: '🎉 Almost there!', subtitle: 'Sign in to save your personalized training plan' };
        default: return { title: 'Welcome to Koko', subtitle: 'Let\'s create your perfect training plan' };
      }
    };

    const stepInfo = getStepInfo();

    return (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{stepInfo.title}</Text>
        <Text style={styles.headerSubtitle}>{stepInfo.subtitle}</Text>
      </View>
    );
  };

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeHero}>
          <Text style={styles.welcomeEmoji}>🏃‍♀️</Text>
          <Text style={styles.welcomeMessage}>
            Ready to start your running journey? We'll create a personalized training plan just for you.
          </Text>
        </View>

        <View style={styles.welcomeFeatures}>
          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🎯</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Personalized Plans</Text>
              <Text style={styles.featureDescription}>Tailored to your current fitness level and goals</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>📈</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Progress Tracking</Text>
              <Text style={styles.featureDescription}>Watch your endurance and speed improve over time</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Text style={styles.featureEmoji}>🏆</Text>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Achieve Your Goals</Text>
              <Text style={styles.featureDescription}>From 5K to 10K and beyond</Text>
            </View>
          </View>
        </View>

        <View style={styles.welcomeFooter}>
          <Text style={styles.welcomeFooterText}>
            Let's get started with a few quick questions
          </Text>
        </View>
      </View>
    </View>
  );

  const renderGoalDistance = () => (
    <View style={styles.stepContainer}>
      <View style={styles.optionsContainer}>
        {[
          { value: 'just-run-more', title: 'Just run more', subtitle: 'Build a consistent habit', emoji: '🌱', fullWidth: true },
          { value: '5K', title: '5K Run', subtitle: 'Perfect for beginners', emoji: '🏃‍♀️' },
          { value: '10K', title: '10K Run', subtitle: 'Ready for a challenge', emoji: '🏃‍♂️' },
          { value: 'half-marathon', title: 'Half Marathon', subtitle: '21.1K - serious goal', emoji: '🏆' },
          { value: 'marathon', title: 'Marathon', subtitle: '42.2K - ultimate challenge', emoji: '👑' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionCard,
              option.fullWidth && styles.optionCardFullWidth,
              data.goalDistance === option.value && styles.optionCardSelected
            ]}
            onPress={() => {
              updateData({ goalDistance: option.value as '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon' });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.optionEmoji}>{option.emoji}</Text>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTargetDate = () => {
    const today = new Date();
    const dates = [];

    // Generate next 12 weeks as options
    for (let i = 4; i <= 16; i += 2) {
      const date = new Date(today);
      date.setDate(date.getDate() + (i * 7));
      dates.push({
        weeks: i,
        date: date,
        label: `${i} weeks`,
        dateText: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }

    const isSameDate = (date1: Date | null, date2: Date) => {
      if (!date1) return false;
      return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
    };

    return (
      <View style={styles.stepContainer}>
        <ScrollView style={styles.dateOptionsContainer} showsVerticalScrollIndicator={false}>
          {dates.map((option) => (
            <TouchableOpacity
              key={option.weeks}
              style={[
                styles.dateOption,
                isSameDate(data.targetDate, option.date) && styles.dateOptionSelected
              ]}
              onPress={() => {
                updateData({ targetDate: option.date });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <View style={styles.dateOptionContent}>
                <Text style={styles.dateOptionWeeks}>{option.label}</Text>
                <Text style={styles.dateOptionDate}>{option.dateText}</Text>
              </View>
              {isSameDate(data.targetDate, option.date) && (
                <Ionicons name="checkmark-circle" size={24} color={Theme.colors.accent.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderCurrentAbility = () => (
    <View style={styles.stepContainer}>
      <View style={styles.abilityContainer}>
        {[
          { value: 'none', title: 'I can\'t run yet', subtitle: 'Let\'s start from walking', emoji: '🚶‍♀️' },
          { value: 'less1min', title: 'Less than 1 minute', subtitle: 'We\'ll build up slowly', emoji: '⏱️' },
          { value: '1to5min', title: '1-5 minutes', subtitle: 'Good starting point', emoji: '🏃‍♀️' },
          { value: '5to10min', title: '5-10 minutes', subtitle: 'Nice foundation', emoji: '💪' },
          { value: 'more10min', title: '10+ minutes', subtitle: 'Strong base to build on', emoji: '🔥' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.abilityOption,
              data.currentAbility === option.value && styles.abilityOptionSelected
            ]}
            onPress={() => {
              updateData({ currentAbility: option.value as any });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.abilityEmoji}>{option.emoji}</Text>
            <View style={styles.abilityContent}>
              <Text style={styles.abilityTitle}>{option.title}</Text>
              <Text style={styles.abilitySubtitle}>{option.subtitle}</Text>
            </View>
            {data.currentAbility === option.value && (
              <Ionicons name="checkmark-circle" size={20} color={Theme.colors.accent.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderLongestDistance = () => (
    <View style={styles.stepContainer}>
      <View style={styles.distanceContainer}>
        {[
          { value: 'never', title: 'Never ran', subtitle: 'Starting fresh', emoji: '🌱' },
          { value: '1to2km', title: '1-2 km', subtitle: 'Building endurance', emoji: '🌿' },
          { value: '2to4km', title: '2-4 km', subtitle: 'Good progress', emoji: '🌳' },
          { value: '5plusKm', title: '5+ km', subtitle: 'Strong runner', emoji: '🌲' },
        ].map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.distanceOption,
              data.longestDistance === option.value && styles.distanceOptionSelected
            ]}
            onPress={() => {
              updateData({ longestDistance: option.value as any });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.distanceEmoji}>{option.emoji}</Text>
            <View style={styles.distanceContent}>
              <Text style={styles.distanceTitle}>{option.title}</Text>
              <Text style={styles.distanceSubtitle}>{option.subtitle}</Text>
            </View>
            {data.longestDistance === option.value && (
              <Ionicons name="checkmark-circle" size={20} color={Theme.colors.accent.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTrainingAvailability = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.daysPerWeekContainer}>
          <Text style={styles.daysLabel}>Days per week</Text>
          <View style={styles.daysSelector}>
            {[2, 3, 4, 5, 6].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.dayButton,
                  data.daysPerWeek === days && styles.dayButtonSelected
                ]}
                onPress={() => {
                  updateData({ daysPerWeek: days });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.dayButtonText,
                  data.daysPerWeek === days && styles.dayButtonTextSelected
                ]}>{days}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.preferredDaysContainer}>
          <Text style={styles.preferredDaysLabel}>Preferred days (optional)</Text>
          <View style={styles.weekDaysContainer}>
            {daysOfWeek.map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.weekDayButton,
                  data.preferredDays.includes(day) && styles.weekDayButtonSelected
                ]}
                onPress={() => {
                  const newPreferred = data.preferredDays.includes(day)
                    ? data.preferredDays.filter(d => d !== day)
                    : [...data.preferredDays, day];
                  updateData({ preferredDays: newPreferred });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.weekDayText,
                  data.preferredDays.includes(day) && styles.weekDayTextSelected
                ]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderPreferences = () => (
    <View style={styles.stepContainer}>
      <View style={styles.preferencesContainer}>
        <View style={styles.preferenceCard}>
          <View style={styles.preferenceHeader}>
            <Text style={styles.preferenceEmoji}>🏃‍♀️</Text>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceTitle}>Treadmill access</Text>
              <Text style={styles.preferenceSubtitle}>Do you have access to a treadmill?</Text>
            </View>
          </View>
          <View style={styles.preferenceOptions}>
            {[
              { value: true, label: 'Yes', color: Theme.colors.status.success },
              { value: false, label: 'No', color: Theme.colors.status.error },
            ].map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.preferenceButton,
                  data.hasTreadmill === option.value && [
                    styles.preferenceButtonSelected,
                    { backgroundColor: option.color }
                  ]
                ]}
                onPress={() => {
                  updateData({ hasTreadmill: option.value });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.preferenceButtonText,
                  data.hasTreadmill === option.value && styles.preferenceButtonTextSelected
                ]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.preferenceCard}>
          <View style={styles.preferenceHeader}>
            <Text style={styles.preferenceEmoji}>⏱️</Text>
            <View style={styles.preferenceContent}>
              <Text style={styles.preferenceTitle}>Workout style</Text>
              <Text style={styles.preferenceSubtitle}>Prefer time-based or distance-based?</Text>
            </View>
          </View>
          <View style={styles.preferenceOptions}>
            {[
              { value: true, label: 'Time-based', subtitle: '20 min easy run' },
              { value: false, label: 'Distance', subtitle: '3km easy run' },
            ].map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.workoutStyleButton,
                  data.preferTimeOverDistance === option.value && styles.workoutStyleButtonSelected
                ]}
                onPress={() => {
                  updateData({ preferTimeOverDistance: option.value });
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.workoutStyleLabel,
                  data.preferTimeOverDistance === option.value && styles.workoutStyleLabelSelected
                ]}>{option.label}</Text>
                <Text style={[
                  styles.workoutStyleSubtitle,
                  data.preferTimeOverDistance === option.value && styles.workoutStyleSubtitleSelected
                ]}>{option.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  const renderAuth = () => (
    <View style={styles.stepContainer}>
      <View style={styles.authPreview}>
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Your Training Plan</Text>
          <View style={styles.previewDetails}>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Goal:</Text>
              <Text style={styles.previewValue}>
                {data.goalDistance === 'just-run-more' ? 'Just run more' :
                  data.goalDistance === 'half-marathon' ? 'Half Marathon' :
                    data.goalDistance === 'marathon' ? 'Marathon' :
                      data.goalDistance}
              </Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Training days:</Text>
              <Text style={styles.previewValue}>{data.daysPerWeek} per week</Text>
            </View>
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>Current level:</Text>
              <Text style={styles.previewValue}>
                {data.currentAbility === 'none' ? 'Beginner' :
                  data.currentAbility === 'less1min' ? 'Getting started' :
                    data.currentAbility === '1to5min' ? 'Building base' :
                      data.currentAbility === '5to10min' ? 'Good foundation' : 'Strong runner'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.authButtons}>
        <TouchableOpacity style={[styles.authButton, styles.googleButton]} onPress={handleGoogleSignIn}>
          <Text style={styles.authButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.authButton, styles.appleButton]} onPress={handleAppleSignIn}>
          <Text style={styles.authButtonText}>Continue with Apple</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.authButton, styles.guestButton]} onPress={handleAnonymousSignIn}>
          <Text style={styles.authButtonText}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderProgressBar()}
      {renderHeader()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
          {renderGoalDistance()}
          {renderTargetDate()}
          {renderCurrentAbility()}
          {renderLongestDistance()}
          {renderTrainingAvailability()}
          {renderPreferences()}
          {renderAuth()}
        </Animated.View>
      </ScrollView>

      {currentStep < TOTAL_STEPS - 1 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
            onPress={nextStep}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>
              {currentStep === TOTAL_STEPS - 2 ? 'Complete Setup' : 'Continue'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={Theme.colors.text.primary} />
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
    paddingBottom: Theme.spacing.xl,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
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
    paddingTop: Theme.spacing.lg,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingTop: Theme.spacing.xxxl,
  },
  welcomeHero: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl * 2,
  },
  welcomeEmoji: {
    fontSize: 80,
    marginBottom: Theme.spacing.xl,
  },
  welcomeMessage: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: Theme.spacing.lg,
  },
  welcomeFeatures: {
    gap: Theme.spacing.xl,
    marginBottom: Theme.spacing.xxxl * 2,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  featureEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.lg,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    lineHeight: 20,
  },
  welcomeFooter: {
    alignItems: 'center',
  },
  welcomeFooterText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.accent.primary,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    justifyContent: 'space-between',
  },
  optionCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    width: '48%',
    minHeight: 100,
  },
  optionCardSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  optionCardFullWidth: {
    width: '100%',
  },
  optionEmoji: {
    fontSize: 24,
    marginBottom: Theme.spacing.xs,
  },
  optionTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
    textAlign: 'center',
  },
  optionSubtitle: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  dateOptionsContainer: {
    maxHeight: 500,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dateOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  dateOptionContent: {
    flex: 1,
  },
  dateOptionWeeks: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  dateOptionDate: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  abilityContainer: {
    gap: Theme.spacing.md,
  },
  abilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  abilityOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  abilityEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.md,
  },
  abilityContent: {
    flex: 1,
  },
  abilityTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  abilitySubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  distanceContainer: {
    gap: Theme.spacing.md,
  },
  distanceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  distanceOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  distanceEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.md,
  },
  distanceContent: {
    flex: 1,
  },
  distanceTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  distanceSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  daysPerWeekContainer: {
    marginBottom: Theme.spacing.xxxl,
  },
  daysLabel: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  daysSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Theme.spacing.md,
  },
  dayButton: {
    width: 50,
    height: 50,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayButtonSelected: {
    backgroundColor: Theme.colors.accent.primary,
    borderColor: Theme.colors.accent.primary,
  },
  dayButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  dayButtonTextSelected: {
    color: Theme.colors.text.primary,
  },
  preferredDaysContainer: {

  },
  preferredDaysLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  weekDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  weekDayButton: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  weekDayButtonSelected: {
    backgroundColor: Theme.colors.transparent.accent20,
    borderColor: Theme.colors.accent.primary,
  },
  weekDayText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  weekDayTextSelected: {
    color: Theme.colors.accent.primary,
  },
  preferencesContainer: {
    gap: Theme.spacing.xl,
  },
  preferenceCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  preferenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  preferenceEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.md,
  },
  preferenceContent: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  preferenceSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  preferenceOptions: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  preferenceButton: {
    flex: 1,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    paddingVertical: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  preferenceButtonSelected: {
    borderColor: Theme.colors.accent.primary,
  },
  preferenceButtonText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
  },
  preferenceButtonTextSelected: {
    color: Theme.colors.text.primary,
  },
  workoutStyleButton: {
    flex: 1,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workoutStyleButtonSelected: {
    backgroundColor: Theme.colors.transparent.accent20,
    borderColor: Theme.colors.accent.primary,
  },
  workoutStyleLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    marginBottom: 4,
  },
  workoutStyleLabelSelected: {
    color: Theme.colors.accent.primary,
  },
  workoutStyleSubtitle: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.muted,
    textAlign: 'center',
  },
  workoutStyleSubtitleSelected: {
    color: Theme.colors.text.tertiary,
  },
  authPreview: {
    marginBottom: Theme.spacing.xxxl,
  },
  previewCard: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  previewTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
    textAlign: 'center',
  },
  previewDetails: {
    gap: Theme.spacing.md,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  previewValue: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  authButtons: {
    gap: Theme.spacing.lg,
  },
  authButton: {
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.large,
    alignItems: 'center',
    ...Theme.shadows.medium,
  },
  googleButton: {
    backgroundColor: '#DB4437',
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  guestButton: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  authButtonText: {
    color: Theme.colors.text.primary,
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
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
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    ...Theme.shadows.medium,
  },
  nextButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
}); 
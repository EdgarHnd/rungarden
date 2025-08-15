import PlanDetailsModal from '@/components/modals/PlanDetailsModal';
import ActivePlanView from '@/components/path/ActivePlanView';
import PlanBrowserView from '@/components/path/PlanBrowserView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useRevenueCat } from '@/provider/RevenueCatProvider';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Animated, Dimensions, ImageSourcePropType, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

interface PlanOption {
  value: string;
  title: string;
  level: string;
  subtitle: string;
  description: string;
  image?: ImageSourcePropType;
  weeks: number;
  totalRuns: number;
  targetDate: string;
  disabled?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.8;
const SPACING = 0;

export default function PathScreen() {
  const router = useRouter();
  const activePlan = useQuery(api.trainingPlan.getActiveTrainingPlan);
  const simpleSchedule = useQuery(api.simpleTrainingSchedule.getSimpleTrainingSchedule);
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const userProfile = useQuery(api.userProfile.getOrCreateProfile);
  const { user: revenueCatUser } = useRevenueCat();

  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Mutations for plan generation
  const updateTrainingProfile = useMutation(api.trainingProfile.updateTrainingProfile);
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Plan options for slideshow
  const planOptions: PlanOption[] = [
    {
      value: '5K',
      title: 'Couch to 5K',
      level: 'Beginner',
      subtitle: 'From 0 to 5K in 8 weeks',
      description: 'Inspired by the famous Couch to 5K program, this plan is perfect for complete beginners. Start with walk-run intervals and build up to running 5K continuously.',
      image: require('@/assets/images/blaze/blazespark.png'),
      weeks: 8,
      totalRuns: 24,
      targetDate: formatDate(new Date(new Date().setDate(new Date().getDate() + 8 * 7))),
    },
    {
      value: '10K',
      title: 'First 10K',
      level: 'Intermediate',
      subtitle: 'Coming soon!',
      image: require('@/assets/images/blaze/blazefriends.png'),
      description: 'Build your endurance and achieve your first 10K milestone with structured training.',
      weeks: 10,
      totalRuns: 40,
      targetDate: formatDate(new Date(new Date().setDate(new Date().getDate() + 10 * 7))),
      disabled: true,
    },
    {
      value: 'half-marathon',
      title: 'Half Marathon',
      image: require('@/assets/images/blaze/blazerace.png'),
      level: 'Expert',
      subtitle: 'Coming Soon!',
      description: 'Train for the ultimate endurance challenge with our comprehensive half marathon program.',
      weeks: 16,
      totalRuns: 48,
      targetDate: formatDate(new Date(new Date().setDate(new Date().getDate() + 16 * 7))),
      disabled: true,
    },
    {
      value: 'marathon',
      title: 'Marathon',
      image: require('@/assets/images/blaze/blazerace.png'),
      level: 'Expert',
      subtitle: 'Coming Soon!',
      description: 'Train for the ultimate endurance challenge with our comprehensive marathon program.',
      weeks: 24,
      totalRuns: 72,
      targetDate: new Date(new Date().setDate(new Date().getDate() + 24 * 7)).toISOString(),
      disabled: true,
    },
  ];

  const handleShowPlanDetails = (plan: PlanOption) => {
    if (plan.disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPlan(plan);
    setShowPlanModal(true);
  };

  const handleStartPlan = async () => {
    if (!selectedPlan) return;

    try {
      setIsGenerating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Check if this is a premium plan (disabled plans are premium-only)
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
              setIsGenerating(false);
              return;
          }
        } catch (error: any) {
          console.log('Paywall interaction:', error);

          // Check if this is a user cancellation (common with RevenueCat)
          if (error?.userCancelled || error?.code === 'userCancelled' ||
            error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
            console.log('User cancelled subscription');
            setIsGenerating(false);
            return;
          }

          // For actual errors, show error message
          console.error('Paywall error:', error);
          Alert.alert('Error', 'Something went wrong with the subscription. Please try again.');
          setIsGenerating(false);
          return;
        }
      }

      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + (selectedPlan.weeks * 7));

      await updateTrainingProfile({
        goalDistance: selectedPlan.value as any,
        goalDate: targetDate.toISOString(),
        daysPerWeek: 3,
        preferredDays: ['Mon', 'Wed', 'Fri'],
      });

      await generateTrainingPlan();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPlanModal(false);
    } catch (error) {
      console.error('Failed to generate plan:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to generate your plan. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const completedMap = useQuery(api.trainingPlan.getPlannedWorkouts, activePlan ? {
    startDate: activePlan.plan[0].days[0].date,
    endDate: activePlan.plan.at(-1)!.days.at(-1)!.date,
  } : "skip");

  if (activePlan === undefined || simpleSchedule === undefined || userProfile === undefined) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading plan…</Text>
      </View>
    );
  }

  if (activePlan) {
    return <ActivePlanView activePlan={activePlan} completedMap={completedMap} userId={userProfile?.userId || ''} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <PlanBrowserView
        simpleSchedule={simpleSchedule}
        planOptions={planOptions}
        onSelectPlan={handleShowPlanDetails}
        setSelectedGoalIndex={setSelectedGoalIndex}
        scrollX={scrollX}
      />

      {/* Plan Details Modal */}
      <PlanDetailsModal
        visible={showPlanModal}
        onClose={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowPlanModal(false);
        }}
        plan={selectedPlan}
        onStart={handleStartPlan}
        isGenerating={isGenerating}
        isPremiumPlan={selectedPlan ? selectedPlan.value !== '5K' : false}
        userHasPremium={revenueCatUser.pro}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background.primary,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: Theme.colors.background.primary,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.semibold,
  },
}); 
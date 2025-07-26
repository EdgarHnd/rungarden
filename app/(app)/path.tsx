import PlanDetailsModal from '@/components/modals/PlanDetailsModal';
import ActivePlanView from '@/components/path/ActivePlanView';
import PlanSelectionView from '@/components/path/PlanSelectionView';
import SkippedView from '@/components/path/SkippedView';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Animated, Dimensions, ImageSourcePropType, SafeAreaView, StyleSheet, Text, View } from 'react-native';

interface PlanOption {
  value: string;
  title: string;
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

  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanOption | null>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Mutations for plan generation
  const updateTrainingProfile = useMutation(api.trainingProfile.updateTrainingProfile);
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);
  const updateProfile = useMutation(api.userProfile.updateProfile);
  const [isGenerating, setIsGenerating] = useState(false);

  // Plan options for slideshow
  const planOptions: PlanOption[] = [
    {
      value: '5K',
      title: 'Couch to 5K',
      subtitle: 'Perfect for beginners',
      description: 'In the 1st week the goal is to get you started with running and test your current level',
      image: require('@/assets/images/blaze/blazespark.png'),
      weeks: 8,
      totalRuns: 24,
      targetDate: '01/08/2025',
    },
    {
      value: 'get fit',
      title: 'Get Fit',
      subtitle: 'Run to get in shape',
      description: 'In the 1st week the goal is to get you started with running and test your current level',
      image: require('@/assets/images/blaze/blazemelt.png'),
      weeks: 8,
      totalRuns: 24,
      targetDate: '01/08/2025',
    },
    {
      value: '10K',
      title: 'First 10K',
      subtitle: 'Ready for a challenge',
      image: require('@/assets/images/blaze/blazefriends.png'),
      description: 'Build your endurance and achieve your first 10K milestone with structured training',
      weeks: 12,
      totalRuns: 36,
      targetDate: '15/09/2025',
    },
    {
      value: 'half-marathon',
      title: 'Half Marathon',
      image: require('@/assets/images/blaze/blazerace.png'),
      subtitle: 'Coming Soon!',
      description: 'Train for the ultimate endurance challenge with our comprehensive half marathon program',
      weeks: 16,
      totalRuns: 48,
      targetDate: '01/12/2025',
      disabled: true,
    },
    {
      value: 'marathon',
      title: 'Marathon',
      image: require('@/assets/images/blaze/blazerace.png'),
      subtitle: 'Coming Soon!',
      description: 'Train for the ultimate endurance challenge with our comprehensive marathon program',
      weeks: 24,
      totalRuns: 72,
      targetDate: '01/01/2026',
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

      if (userProfile?.hasSkippedTrainingPlan) {
        Alert.alert(
          "Plan Created!",
          "Your training plan has been generated successfully.",
          [{ text: "OK" }]
        );
      }
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
    return <ActivePlanView activePlan={activePlan} completedMap={completedMap} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      {userProfile?.hasSkippedTrainingPlan ? (
        <SkippedView
          simpleSchedule={simpleSchedule}
          onBackToPlans={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateProfile({ hasSkippedTrainingPlan: false });
          }}
          planOptions={planOptions}
          onSelectPlan={handleShowPlanDetails}
          setSelectedGoalIndex={setSelectedGoalIndex}
          scrollX={scrollX}
        />
      ) : (
        <PlanSelectionView
          planOptions={planOptions}
          onSelectPlan={handleShowPlanDetails}
          onSkip={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            updateProfile({ hasSkippedTrainingPlan: true });
          }}
          setSelectedGoalIndex={setSelectedGoalIndex}
          scrollX={scrollX}
        />
      )}

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
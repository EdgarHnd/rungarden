import Theme from '@/constants/theme';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlanCarousel from './PlanCarousel';

export default function PlanSelectionView({ planOptions, onSelectPlan, onSkip, setSelectedGoalIndex, scrollX }: { planOptions: any[], onSelectPlan: (plan: any) => void, onSkip: () => void, setSelectedGoalIndex: (index: number) => void, scrollX: any }) {

  return (
    <View style={styles.slideshowContent}>
      <Text style={styles.slideshowTitle}>Pick a training plan</Text>
      <PlanCarousel
        planOptions={planOptions}
        onSelectPlan={onSelectPlan}
        setSelectedGoalIndex={setSelectedGoalIndex}
        scrollX={scrollX}
      />
      <TouchableOpacity
        style={styles.skipButton}
        onPress={onSkip}
        activeOpacity={0.8}
      >
        <Text style={styles.skipButtonText}>Skip and run without a plan</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  skipButton: {
    alignSelf: 'center',
    marginTop: 40,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 20,
  },
  slideshowContent: {
  },
  slideshowTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 30,
    marginBottom: 60,
    textAlign: 'center',
  },
});

import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlanCarousel from './PlanCarousel';

export default function SkippedView({ simpleSchedule, onBackToPlans, planOptions, onSelectPlan, setSelectedGoalIndex, scrollX }: { simpleSchedule: any, onBackToPlans: () => void, planOptions: any[], onSelectPlan: (plan: any) => void, setSelectedGoalIndex: (index: number) => void, scrollX: any }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.skippedContainer}>
      <View style={styles.skippedContent}>
        {simpleSchedule && simpleSchedule.isActive && (
          <View style={styles.simpleScheduleSection}>
            <View style={styles.simpleScheduleCard}>
              <View style={styles.overviewHeader}>
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>Basic Training</Text>
                </View>
                <TouchableOpacity
                  style={styles.inCardButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/manage-schedule');
                  }}
                >
                  <Text style={styles.inCardButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.scheduleStatItem}>
                  <Text style={styles.statLabel}>Runs per week</Text>
                  <Text style={styles.scheduleStatValue}>{simpleSchedule.runsPerWeek}</Text>
                </View>
                <View style={styles.scheduleStatItem}>
                  <Text style={styles.statLabel}>Preferred Days</Text>
                  <Text style={styles.scheduleStatValue}>{simpleSchedule.preferredDays.join(', ')}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        <View style={styles.planOptionsSection}>
          <Text style={styles.planOptionsTitle}>Pick a training plan</Text>
          <Text style={styles.planOptionsSubtitle}>Achieve your goals using one of our structured plans</Text>
          <PlanCarousel
            planOptions={planOptions}
            onSelectPlan={onSelectPlan}
            setSelectedGoalIndex={setSelectedGoalIndex}
            scrollX={scrollX}
            isSkippedView={true}
          />
          <TouchableOpacity
            style={[styles.skipButton, { paddingHorizontal: Theme.spacing.xl }]}
            onPress={onBackToPlans}
          >
            <Text style={styles.skipButtonText}>Back to plans</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  inCardButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inCardButtonText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 14,
  },
  overviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 10,
  },
  planInfo: {
    flex: 1,
  },
  planOptionsSection: {
    marginBottom: 20,
  },
  planOptionsSubtitle: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginBottom: 20,
    paddingHorizontal: Theme.spacing.xl,
  },
  planOptionsTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
    marginBottom: 8,
    paddingHorizontal: Theme.spacing.xl,
  },
  planTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    marginBottom: 4,
  },
  scheduleStatItem: {
    alignItems: 'center',
  },
  scheduleStatValue: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
  },
  simpleScheduleCard: {
  },
  simpleScheduleSection: {
    marginHorizontal: Theme.spacing.xl,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
  },
  skipButton: {
    alignSelf: 'center',
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  skipButtonText: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 20,
  },
  skippedContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  skippedContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statLabel: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
});

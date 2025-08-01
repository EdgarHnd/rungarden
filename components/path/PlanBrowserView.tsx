import Theme from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlanCarousel from './PlanCarousel';

export default function PlanBrowserView({ simpleSchedule, planOptions, onSelectPlan, setSelectedGoalIndex, scrollX }: { simpleSchedule: any, planOptions: any[], onSelectPlan: (plan: any) => void, setSelectedGoalIndex: (index: number) => void, scrollX: any }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.skippedContainer}>
      <View style={styles.skippedContent}>
        {/* Add a header here */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Training</Text>
        </View>
        {simpleSchedule && simpleSchedule.isActive && (
          <View style={styles.simpleScheduleSection}>
            <View style={styles.simpleScheduleCard}>
              <View style={styles.overviewHeader}>
                <View style={styles.simpleScheduleInfo}>
                  <Text style={styles.simpleScheduleTitle}>No Training Plan</Text>
                </View>
                <TouchableOpacity
                  style={styles.inCardButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/manage-schedule');
                  }}
                >
                  <Text style={styles.inCardButtonText}>Manage</Text>
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
          <Text style={styles.planOptionsTitle}>Start your training plan</Text>
          <Text style={styles.planOptionsSubtitle}>Achieve your goals using one of our structured plans</Text>
          <PlanCarousel
            planOptions={planOptions}
            onSelectPlan={onSelectPlan}
            setSelectedGoalIndex={setSelectedGoalIndex}
            scrollX={scrollX}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 10,
    marginBottom: 20,
  },
  headerTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 28,
    marginBottom: 8,
    paddingHorizontal: Theme.spacing.xl,
  },
  inCardButton: {
    backgroundColor: Theme.colors.background.primary,
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
  },
  simpleScheduleInfo: {
    flex: 1,
    flexDirection: 'row',
  },
  planOptionsSection: {
    marginTop: 20,
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
  simpleScheduleTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
    marginTop: 10,
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
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: Theme.spacing.md,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    color: Theme.colors.text.tertiary,
    backgroundColor: Theme.colors.background.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 5,
    borderRadius: Theme.borderRadius.small,
  },
  // Removed skip/back button styles
  skippedContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  skippedContent: {
    flex: 1,
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

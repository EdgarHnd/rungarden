import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import DatePicker from 'react-native-date-picker';

export default function ManagePlanScreen() {
  const router = useRouter();
  const trainingProfile = useQuery(api.trainingProfile.getTrainingProfile);
  const updateTrainingProfile = useMutation(api.trainingProfile.updateTrainingProfile);
  const generateTrainingPlan = useMutation(api.trainingPlan.generateTrainingPlan);
  const deleteTrainingPlan = useMutation(api.trainingPlan.deleteTrainingPlan);

  const [goalDistance, setGoalDistance] = useState(trainingProfile?.goalDistance || '5K');
  const [targetDate, setTargetDate] = useState(trainingProfile?.goalDate ? new Date(trainingProfile.goalDate) : new Date());
  const [daysPerWeek, setDaysPerWeek] = useState(trainingProfile?.daysPerWeek || 3);
  const [preferredDays, setPreferredDays] = useState<string[]>(trainingProfile?.preferredDays || []);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if this is a structured plan that only allows preferred days updates
  const isStructuredPlan = ['5K', '10K', 'just-run-more'].includes(trainingProfile?.goalDistance || '');

  // For structured plans, we need exactly the same number of days as the original plan
  const requiredDaysCount = isStructuredPlan ? (trainingProfile?.daysPerWeek || 3) : daysPerWeek;
  const canSaveChanges = preferredDays.length === requiredDaysCount;

  const handleSaveChanges = async () => {
    if (!canSaveChanges) {
      Alert.alert(
        "Invalid Selection",
        `Please select exactly ${requiredDaysCount} preferred training days. You have selected ${preferredDays.length}.`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isStructuredPlan) {
        // For structured plans, only update preferred days
        await updateTrainingProfile({
          preferredDays,
        });

        // Generate new AI training plan with updated schedule
        setIsGenerating(true);
        await generateTrainingPlan();
      } else {
        // For flexible plans, update all settings
        await updateTrainingProfile({
          goalDistance: goalDistance as any,
          goalDate: targetDate.toISOString(),
          daysPerWeek,
          preferredDays,
        });

        // Generate new AI training plan
        setIsGenerating(true);
        await generateTrainingPlan();
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Plan Updated!",
        isStructuredPlan
          ? "Your training schedule has been updated with the new preferred days."
          : "Your training plan has been updated with the new settings.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to update plan:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update your plan. Please try again.");
    } finally {
      setIsUpdating(false);
      setIsGenerating(false);
    }
  };

  const handleDeletePlan = () => {
    Alert.alert(
      "Delete Training Plan",
      "Are you sure you want to delete your current training plan? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              await deleteTrainingPlan();

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Plan Deleted",
                "Your training plan has been deleted successfully.",
                [{ text: "OK", onPress: () => router.replace('/path') }]
              );
            } catch (error) {
              console.error('Failed to delete plan:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert("Error", "Failed to delete your plan. Please try again.");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 28); // Minimum 4 weeks from now

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isStructuredPlan && (
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={24} color={Theme.colors.accent.primary} />
              <Text style={styles.infoText}>
                This is a structured training plan. You can only adjust your preferred training days.
              </Text>
            </View>
          </View>
        )}

        {/* Goal Distance - Only show for non-structured plans */}
        {!isStructuredPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goal Distance</Text>
            <View style={styles.goalOptions}>
              {[
                { value: 'just-run-more', title: 'Just run more', subtitle: 'Build a consistent habit', emoji: '🌱' },
                { value: '5K', title: 'From 0 to 5K', subtitle: 'Perfect for beginners', emoji: '🏃‍♀️' },
                { value: '10K', title: 'First 10K', subtitle: 'Ready for a challenge', emoji: '🏃‍♂️' },
                { value: 'half-marathon', title: 'Half Marathon', subtitle: 'Coming Soon!', emoji: '🏆', disabled: true },
                { value: 'marathon', title: 'Marathon', subtitle: 'Coming Soon!', emoji: '👑', disabled: true },
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.goalOption,
                    goalDistance === option.value && styles.goalOptionSelected,
                    (option as any).disabled && styles.goalOptionDisabled,
                  ]}
                  onPress={() => {
                    if ((option as any).disabled) return;
                    setGoalDistance(option.value as '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  disabled={(option as any).disabled}
                >
                  <Text style={styles.goalEmoji}>{option.emoji}</Text>
                  <View style={styles.goalContent}>
                    <Text style={styles.goalTitle}>{option.title}</Text>
                    <Text style={styles.goalSubtitle}>{option.subtitle}</Text>
                  </View>
                  {goalDistance === option.value && (
                    <Ionicons name="checkmark-circle" size={20} color={Theme.colors.accent.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Target Date - Only show for non-structured plans */}
        {!isStructuredPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Target Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setDatePickerOpen(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Ionicons name="calendar" size={24} color={Theme.colors.accent.primary} />
              <Text style={styles.dateText}>
                {targetDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Training Frequency - Only show for non-structured plans */}
        {!isStructuredPlan && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Days Per Week</Text>
            <View style={styles.daysSelector}>
              {[2, 3, 4, 5, 6].map((days) => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.dayButton,
                    daysPerWeek === days && styles.dayButtonSelected
                  ]}
                  onPress={() => {
                    setDaysPerWeek(days);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <Text style={[
                    styles.dayButtonText,
                    daysPerWeek === days && styles.dayButtonTextSelected
                  ]}>{days}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Preferred Days */}
        <View style={styles.section}>
          <View style={styles.preferredDaysHeader}>
            <Text style={styles.sectionTitle}>Preferred Training Days</Text>
            <Text style={styles.preferredDaysSubtitle}>Select {requiredDaysCount} days</Text>
          </View>
          <View style={styles.weekDaysContainer}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.weekDayButton,
                  preferredDays.includes(day) && styles.weekDayButtonSelected
                ]}
                onPress={() => {
                  const newPreferred = preferredDays.includes(day)
                    ? preferredDays.filter(d => d !== day)
                    : [...preferredDays, day];
                  setPreferredDays(newPreferred);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.weekDayText,
                  preferredDays.includes(day) && styles.weekDayTextSelected
                ]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (isUpdating || !canSaveChanges) && styles.saveButtonDisabled
          ]}
          onPress={handleSaveChanges}
          disabled={isUpdating || !canSaveChanges}
        >
          <Text style={styles.saveButtonText}>
            {isUpdating || isGenerating ? (isGenerating ? 'Updating Schedule...' : 'Updating...') :
              isStructuredPlan ? 'Update Schedule' : 'Save Changes & Generate Plan'}
          </Text>
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            isDeleting && styles.deleteButtonDisabled
          ]}
          onPress={handleDeletePlan}
          disabled={isDeleting}
        >
          <Ionicons name="trash-outline" size={20} color={Theme.colors.status.error} />
          <Text style={styles.deleteButtonText}>
            {isDeleting ? 'Deleting Plan...' : 'Delete Training Plan'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <DatePicker
        modal
        open={datePickerOpen}
        date={targetDate}
        mode="date"
        minimumDate={minDate}
        title="Select your target date"
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={(selectedDate: Date) => {
          setDatePickerOpen(false);
          setTargetDate(selectedDate);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        onCancel={() => {
          setDatePickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: 60,
    paddingBottom: Theme.spacing.lg,
  },
  backButton: {
    padding: Theme.spacing.sm,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: Theme.spacing.xl,
  },
  infoSection: {
    marginBottom: Theme.spacing.xl,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.transparent.accent20,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Theme.colors.transparent.accent30,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.lg,
  },
  goalOptions: {
    gap: Theme.spacing.md,
  },
  goalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  goalOptionSelected: {
    borderColor: Theme.colors.accent.primary,
    backgroundColor: Theme.colors.transparent.accent20,
  },
  goalOptionDisabled: {
    opacity: 0.6,
    backgroundColor: Theme.colors.background.tertiary,
  },
  goalEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.md,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  goalSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.md,
  },
  dateText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  daysSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Theme.spacing.md,
  },
  dayButton: {
    flex: 1,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
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
  saveButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    borderBottomWidth: 3,
    borderColor: Theme.colors.accent.secondary,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    marginTop: Theme.spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  preferredDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  preferredDaysSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Theme.colors.status.error,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.lg,
    marginBottom: 40,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.status.error,
  },
});
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

export default function ManageScheduleScreen() {
  const router = useRouter();
  const currentSchedule = useQuery(api.simpleTrainingSchedule.getSimpleTrainingSchedule);
  const setSchedule = useMutation(api.simpleTrainingSchedule.setSimpleTrainingSchedule);

  const [runsPerWeek, setRunsPerWeek] = useState(currentSchedule?.runsPerWeek || 1);
  const [preferredDays, setPreferredDays] = useState<string[]>(currentSchedule?.preferredDays || []);
  const [isUpdating, setIsUpdating] = useState(false);

  const canSaveChanges = preferredDays.length >= runsPerWeek;

  const handleSaveChanges = async () => {
    if (!canSaveChanges) {
      Alert.alert(
        "Invalid Selection",
        `Please select at least ${runsPerWeek} preferred training days. You have selected ${preferredDays.length}.`
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    try {
      setIsUpdating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await setSchedule({
        runsPerWeek,
        preferredDays,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Schedule Updated!",
        currentSchedule
          ? "Your training schedule has been updated. Changes apply to remaining days this week."
          : "Your training schedule has been created successfully!",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to update schedule:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update your schedule. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };



  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Schedule</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            • Set your weekly running goal{'\n'}
            • Choose your preferred training days{'\n'}
            • Track your progress automatically{'\n'}
            • Complete your weekly goal to keep your flame alive
          </Text>
        </View>
        {/* Training Frequency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Runs Per Week</Text>
          <Text style={styles.sectionDescription}>
            How many days per week do you want to run?
          </Text>
          <View style={styles.runsCounter}>
            <TouchableOpacity
              style={[styles.counterButton, runsPerWeek <= 1 && styles.counterButtonDisabled]}
              onPress={() => {
                if (runsPerWeek > 1) {
                  const newRuns = runsPerWeek - 1;
                  setRunsPerWeek(newRuns);
                  // Reset preferred days if we have too many selected
                  if (preferredDays.length > newRuns) {
                    setPreferredDays(preferredDays.slice(0, newRuns));
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              disabled={runsPerWeek <= 1}
            >
              <Ionicons
                name="remove"
                size={24}
                color={runsPerWeek <= 1 ? Theme.colors.text.disabled : Theme.colors.text.primary}
              />
            </TouchableOpacity>

            <View style={styles.counterDisplay}>
              <Text style={styles.counterNumber}>{runsPerWeek}</Text>
              <Text style={styles.counterLabel}>days</Text>
            </View>

            <TouchableOpacity
              style={[styles.counterButton, runsPerWeek >= 7 && styles.counterButtonDisabled]}
              onPress={() => {
                if (runsPerWeek < 7) {
                  setRunsPerWeek(runsPerWeek + 1);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              disabled={runsPerWeek >= 7}
            >
              <Ionicons
                name="add"
                size={24}
                color={runsPerWeek >= 7 ? Theme.colors.text.disabled : Theme.colors.text.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferred Days */}
        <View style={styles.section}>
          <View style={styles.preferredDaysHeader}>
            <Text style={styles.sectionTitle}>Preferred Training Days</Text>
            <Text style={styles.preferredDaysSubtitle}>
              Select at least {runsPerWeek} days ({preferredDays.length} selected)
            </Text>
          </View>
          <Text style={styles.sectionDescription}>
            Choose the days you prefer to run. You can select more than {runsPerWeek} days for flexibility.
          </Text>
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
            {isUpdating ? 'Updating Schedule...' : currentSchedule ? 'Update Schedule' : 'Create Schedule'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  section: {
    marginBottom: Theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginBottom: Theme.spacing.lg,
    lineHeight: 20,
  },
  runsCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xl,
  },
  counterButton: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    width: 50,
    height: 50,
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
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minWidth: 80,
  },
  counterNumber: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  counterLabel: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.lg,
    alignItems: 'center',
    marginTop: Theme.spacing.xl,
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  preferredDaysHeader: {
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.sm,
  },
  preferredDaysSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.accent.primary,
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
    paddingVertical: Theme.spacing.lg,
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
  infoSection: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    marginTop: Theme.spacing.xl,
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  infoText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    lineHeight: 22,
  },
}); 
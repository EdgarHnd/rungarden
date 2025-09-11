import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { formatDistance, formatDuration } from '@/utils/formatters';
import { FontAwesome5 } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DeduplicationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete: () => void;
  sourceToKeep: "healthkit" | "strava";
}

export default function DeduplicationModal({ isVisible, onClose, onComplete, sourceToKeep }: DeduplicationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const duplicates = useQuery(api.deduplication.findDuplicateActivities);
  const resolveDuplicates = useMutation(api.deduplication.resolveDuplicates);

  const handleDeduplication = async () => {
    if (!duplicates || duplicates.length === 0) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const duplicatePairs = duplicates.map(duplicate => ({
        healthKitId: duplicate.healthKit!.id,
        stravaId: duplicate.strava!.id,
        keepSource: sourceToKeep,
      }));

      const result = await resolveDuplicates({ duplicates: duplicatePairs });

      if (result.resolved > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Deduplication Complete',
          `Successfully resolved ${result.resolved} duplicate activities.${result.errors > 0 ? `\n\nFailed to resolve ${result.errors} duplicates.` : ''}`,
          [{ text: 'OK', onPress: onComplete }]
        );
      } else {
        Alert.alert('No Changes', 'No duplicate activities were found to resolve.');
      }
    } catch (error) {
      console.error('Error during deduplication:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to resolve duplicate activities. Please try again.');
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  if (!duplicates || duplicates.length === 0) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Duplicate Activities Found</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={isLoading}
            >
              <FontAwesome5 name="times" size={20} color={Theme.colors.text.primary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            The following activities appear to be duplicates between HealthKit and Strava.
            Review the list below and confirm which source you want to keep.
          </Text>

          <ScrollView style={styles.duplicatesList}>
            {duplicates.map((duplicate, index) => (
              <View key={index} style={styles.duplicateItem}>
                <View style={styles.sourceComparison}>
                  <View style={[
                    styles.sourceBox,
                    sourceToKeep === 'healthkit' && styles.selectedSource
                  ]}>
                    <Text style={styles.sourceTitle}>HealthKit</Text>
                    <Text style={styles.activityDetail}>
                      {new Date(duplicate.healthKit!.startDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.activityDetail}>
                      {formatDistance(duplicate.healthKit!.distance)}
                    </Text>
                    <Text style={styles.activityDetail}>
                      {formatDuration(duplicate.healthKit!.duration)}
                    </Text>
                  </View>

                  <View style={styles.similarityIndicator}>
                    <Text style={styles.similarityText}>
                      {Math.round(duplicate.similarity * 100)}% match
                    </Text>
                  </View>

                  <View style={[
                    styles.sourceBox,
                    sourceToKeep === 'strava' && styles.selectedSource
                  ]}>
                    <Text style={styles.sourceTitle}>Strava</Text>
                    <Text style={styles.activityDetail}>
                      {new Date(duplicate.strava!.startDate).toLocaleDateString()}
                    </Text>
                    <Text style={styles.activityDetail}>
                      {formatDistance(duplicate.strava!.distance)}
                    </Text>
                    <Text style={styles.activityDetail}>
                      {formatDuration(duplicate.strava!.duration)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleDeduplication}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Processing...' : `Keep ${sourceToKeep === 'healthkit' ? 'HealthKit' : 'Strava'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    width: '90%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    padding: Theme.spacing.sm,
  },
  description: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.xl,
  },
  duplicatesList: {
    maxHeight: 400,
  },
  duplicateItem: {
    marginBottom: Theme.spacing.lg,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
  },
  sourceComparison: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceBox: {
    flex: 1,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.small,
    backgroundColor: Theme.colors.background.tertiary,
  },
  selectedSource: {
    backgroundColor: Theme.colors.accent.primary + '33', // 20% opacity
    borderColor: Theme.colors.accent.primary,
    borderWidth: 1,
  },
  sourceTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.sm,
  },
  activityDetail: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    marginBottom: 2,
  },
  similarityIndicator: {
    paddingHorizontal: Theme.spacing.md,
  },
  similarityText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Theme.spacing.xl,
  },
  button: {
    flex: 1,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    alignItems: 'center',
    marginHorizontal: Theme.spacing.sm,
  },
  cancelButton: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  confirmButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
});

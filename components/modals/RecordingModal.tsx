import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import DatabaseHealthService from '@/services/DatabaseHealthService';
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { useConvex, useMutation } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecordingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RecordingModal({ visible, onClose }: RecordingModalProps) {
  const convex = useConvex();
  const updateSyncPreferences = useMutation(api.userProfile.updateSyncPreferences);

  const [selected, setSelected] = useState<'strava' | 'healthkit' | 'app' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'options' | 'confirmation'>('options');

  // Reset when modal is reopened
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setStep('options');
    }
  }, [visible]);

  // Handlers
  const handleConnectStrava = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      const stravaService = new DatabaseStravaService(convex);
      const success = await stravaService.authenticate();
      if (success) {
        await updateSyncPreferences({
          stravaSyncEnabled: true,
          healthKitSyncEnabled: false,
          lastStravaSync: undefined,
          lastHealthKitSync: null,
        });
        setSelected('strava');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('confirmation');
      } else {
        Alert.alert('Error', 'Failed to connect to Strava.');
      }
    } catch (error) {
      console.error('[RecordingModal] Strava connect error', error);
      Alert.alert('Error', 'Failed to connect to Strava.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectHealthKit = async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      const healthService = new DatabaseHealthService(convex);
      const permitted = await healthService.initializeHealthKit();
      if (!permitted) {
        Alert.alert('Permission Required', 'Blaze does not have Health access. You will be redirected to Settings to enable it.');
        onClose();
        router.push('/settings');
        return;
      }
      await healthService.setHealthKitSyncEnabled(true);
      // Disable Strava sync to avoid duplicates
      await updateSyncPreferences({
        stravaSyncEnabled: false,
        healthKitSyncEnabled: true,
        lastHealthKitSync: undefined,
        lastStravaSync: null,
      });
      setSelected('healthkit');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('confirmation');
    } catch (error) {
      console.error('[RecordingModal] HealthKit connect error', error);
      Alert.alert('Error', 'Failed to connect to HealthKit');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAppRecording = () => {
    setSelected('app');
    onClose();
    router.push('/run' as any);
  };

  /* Confirmation Modal */
  if (step === 'confirmation' && visible) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.modalContainer} onPress={() => { }}>
            <View style={styles.header}>
              <Text style={styles.title}>{selected === 'strava' ? 'Strava Connected!' : 'HealthKit Connected!'}</Text>
              <Text style={styles.subtitle}>Record a run in Blaze and it will sync automatically.</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => {
                  onClose();
                  router.push('/settings');
                }}
              >
                <Text style={styles.buttonText}>Change Source</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.button} onPress={onClose}>
                <Text style={styles.buttonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={() => { }}>
          <View style={styles.header}>
            <Text style={styles.title}>Record Your Run</Text>
            <Text style={styles.subtitle}>Connect your fitness apps to log activities</Text>
          </View>

          <View style={styles.content}>
            {/* Strava Option */}
            <View style={[styles.integrationItem, selected === 'strava' && styles.selectedIntegration]}>
              <View style={styles.iconContainer}>
                <Image source={require('@/assets/images/icons/strava.png')} style={styles.icon} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.integrationTitle}>Strava Integration</Text>
                <Text style={styles.integrationDescription}>
                  Connect your Strava account to automatically sync your running activities
                </Text>
              </View>
            </View>

            {/* Apple Health Option (iOS only) */}
            {Platform.OS === 'ios' && (
              <View style={[styles.integrationItem, selected === 'healthkit' && styles.selectedIntegration]}>
                <View style={styles.iconContainer}>
                  <Image source={require('@/assets/images/icons/apple-health.png')} style={styles.icon} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={styles.integrationTitle}>Apple Health</Text>
                  <Text style={styles.integrationDescription}>
                    Sync your workouts from Apple Health and other fitness apps
                  </Text>
                </View>
              </View>
            )}

            {/* Blaze Free Run */}
            <View style={[styles.integrationItem, selected === 'app' && styles.selectedIntegration]}>
              <View style={styles.iconContainer}>
                <Image source={require('@/assets/images/blaze/blazeidle.png')} style={styles.icon} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.integrationTitle}>Blaze Free Run</Text>
                <Text style={styles.integrationDescription}>
                  Record your run directly with Blaze's built-in GPS tracker
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            {/* Strava button */}
            <TouchableOpacity
              style={styles.settingsButton}
              disabled={isProcessing}
              onPress={handleConnectStrava}
            >
              <Text style={styles.buttonText}>{selected === 'strava' ? 'Connected ✓' : 'Connect Strava'}</Text>
            </TouchableOpacity>

            {/* Apple Health button (only show on iOS) */}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.settingsButton}
                disabled={isProcessing}
                onPress={handleConnectHealthKit}
              >
                <Text style={styles.buttonText}>{selected === 'healthkit' ? 'Connected ✓' : 'Connect Apple Health'}</Text>
              </TouchableOpacity>
            )}

            {/* Blaze button */}
            <TouchableOpacity
              style={styles.button}
              disabled={isProcessing}
              onPress={handleAppRecording}
            >
              <Text style={styles.buttonText}>{selected === 'app' ? 'Selected ✓' : 'Record with Blaze (Beta)'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  modalContainer: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.spacing.lg,
    padding: Theme.spacing.xl,
    width: width - Theme.spacing.xl * 2,
    maxWidth: 400,
  },
  header: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
  },
  content: {
    marginBottom: Theme.spacing.xl,
  },
  integrationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
    padding: Theme.spacing.md,
  },
  iconContainer: {
    marginRight: Theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 32,
    height: 32,
  },
  stravaIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  integrationTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  integrationDescription: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },
  noteContainer: {
    marginTop: Theme.spacing.md,
    padding: Theme.spacing.md,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.spacing.sm,
  },
  noteText: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.secondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  buttonContainer: {
    marginTop: Theme.spacing.xl,
    flexDirection: 'column',
    gap: Theme.spacing.md,
  },
  settingsButton: {
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: Theme.colors.border.primary,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    alignItems: 'center',
  },
  button: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 3,
    borderColor: Theme.colors.accent.secondary,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  selectedIntegration: {
    backgroundColor: Theme.colors.background.tertiary,
  },
}); 
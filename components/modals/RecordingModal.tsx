import Theme from '@/constants/theme';
import { router } from 'expo-router';
import React from 'react';
import { Dimensions, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecordingModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function RecordingModal({ visible, onClose }: RecordingModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Record Your Run</Text>
            <Text style={styles.subtitle}>Connect your fitness apps to log activities</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.integrationItem}>
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

            <View style={styles.integrationItem}>
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

            <View style={styles.noteContainer}>
              <Text style={styles.noteText}>
                Manual recording is coming soon! For now, use one of the integrations above to track your runs.
              </Text>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.settingsButton} onPress={
              () => {
                onClose();
                router.push('/settings');
              }
            }>
              <Text style={styles.buttonText}>Open Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  settingsButton: {
    borderRadius: Theme.borderRadius.large,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: Theme.colors.border.primary,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    flex: 1,
    alignItems: 'center',
  },
  button: {
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.large,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    borderBottomWidth: 3,
    borderColor: Theme.colors.accent.secondary,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
}); 
import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HealthModalProps {
  visible: boolean;
  mascotHealth: number;
  simpleSchedule?: {
    runsPerWeek: number;
    preferredDays: string[];
    isActive: boolean;
  } | null;
  onClose: () => void;
}

export default function HealthModal({ visible, mascotHealth, simpleSchedule, onClose }: HealthModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Your Flame's Health</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.healthDisplay}>
            <Image source={require('@/assets/images/blaze/blazelove.png')} style={styles.healthMascotIcon} resizeMode="contain" />
            <View style={styles.healthLivesDisplay}>
              {[...Array(4)].map((_, index) => {
                const isAlive = index < mascotHealth;
                return (
                  <Ionicons
                    key={index}
                    name={isAlive ? "heart" : "heart-outline"}
                    size={32}
                    color={isAlive ? Theme.colors.special.primary.coin : Theme.colors.text.muted}
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.healthInfoSection}>
            <View style={styles.healthInfoItem}>
              <Text style={styles.healthInfoIcon}>⚡</Text>
              <Text style={styles.healthInfoText}>
                Your Flame starts with full health
              </Text>
            </View>
            <View style={styles.healthInfoItem}>
              <Text style={styles.healthInfoIcon}>📅</Text>
              <Text style={styles.healthInfoText}>
                Health decreases by 1 for each consecutive week you miss your running goal
              </Text>
            </View>
            <View style={styles.healthInfoItem}>
              <Text style={styles.healthInfoIcon}>🏃‍♂️</Text>
              <Text style={styles.healthInfoText}>
                Hit your weekly goal to keep your flame healthy
              </Text>
            </View>
          </View>

          {simpleSchedule?.isActive && (
            <View style={styles.healthGoalSection}>
              <Text style={styles.healthSectionTitle}>Your Weekly Goal:</Text>
              <Text style={styles.healthGoalText}>
                {simpleSchedule.runsPerWeek} run{simpleSchedule.runsPerWeek !== 1 ? 's' : ''} per week
              </Text>
              <Text style={styles.healthGoalSubtext}>
                Preferred days: {simpleSchedule.preferredDays.join(', ')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  container: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
  healthDisplay: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  healthMascotIcon: {
    width: 100,
    height: 100,
    marginBottom: Theme.spacing.md,
  },
  healthLivesDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    marginBottom: Theme.spacing.md,
  },
  healthCurrentText: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  healthInfoSection: {
    marginBottom: Theme.spacing.xl,
  },
  healthSectionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  healthInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Theme.spacing.md,
    paddingRight: Theme.spacing.md,
  },
  healthInfoIcon: {
    fontSize: 16,
    marginRight: Theme.spacing.sm,
    marginTop: 2,
    minWidth: 20,
  },
  healthInfoText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },
  healthGoalSection: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.lg,
    alignItems: 'center',
  },
  healthGoalText: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
    marginBottom: Theme.spacing.xs,
  },
  healthGoalSubtext: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
}); 
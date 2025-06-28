import Theme from '@/constants/theme';
import LevelingService from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface XPInfoModalProps {
  visible: boolean;
  onClose: () => void;
  levelInfo?: {
    level: number;
    totalXP: number;
    xpForNextLevel: number;
    remainingXPForNextLevel: number;
    progressToNextLevel: number;
  } | null;
  metricSystem?: 'metric' | 'imperial';
}

export default function XPInfoModal({ visible, onClose, levelInfo, metricSystem = 'metric' }: XPInfoModalProps) {
  const isMetric = metricSystem === 'metric';

  const examples = [
    { distance: 1000, label: isMetric ? '1 km run' : '0.6 mi run' },
    { distance: 2000, label: isMetric ? '2 km run' : '1.2 mi run' },
    { distance: 5000, label: isMetric ? '5 km run' : '3.1 mi run' },
    { distance: 10000, label: isMetric ? '10 km run' : '6.2 mi run' },
  ];

  // Mascot evolution images
  const flameStages = [
    require('@/assets/images/flame/age0.png'),
    require('@/assets/images/flame/age3.png'),
    require('@/assets/images/flame/age4.png'),
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Leveling Up your Flame</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Current Level Progress */}
            {levelInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Current Progress</Text>
                <View style={styles.currentLevelCard}>
                  <View style={styles.levelHeader}>
                    <Image source={require('@/assets/images/flame/age0.png')} style={styles.mascotImage} />
                    <View style={styles.levelTextInfo}>
                      <Text style={styles.currentLevelTitle}>{LevelingService.getLevelTitle(levelInfo.level)}</Text>
                      <Text style={styles.currentLevelNumber}>Level {levelInfo.level}</Text>
                    </View>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${levelInfo.progressToNextLevel * 100}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {LevelingService.formatXP(levelInfo.remainingXPForNextLevel, true)} to Level {levelInfo.level + 1}
                    </Text>
                  </View>
                </View>

                {/* Mascot Evolution */}
                <View style={styles.mascotEvolutionContainer}>
                  <Text style={styles.mascotEvolutionTitle}>Run to Level Up!</Text>
                  <View style={styles.mascotEvolutionRow}>
                    {flameStages.map((stage, idx) => (
                      <React.Fragment key={idx}>
                        <Image source={stage} style={styles.mascotImage} />
                        {idx < flameStages.length - 1 && (
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={Theme.colors.text.secondary}
                            style={styles.arrowIcon}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>XP from Running</Text>
              <Text style={styles.description}>
                You gain XP based on the distance you run. The formula is simple:
              </Text>
              <View style={styles.formulaContainer}>
                <Text style={styles.formula}>
                  {isMetric ? '1 kilometer = 100 XP' : '1 mile = 161 XP'}
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Theme.colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  modalContainer: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.xl,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    ...Theme.shadows.large,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.primary,
  },
  title: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  closeButton: {
    padding: Theme.spacing.xs,
  },
  content: {
    padding: Theme.spacing.xl,
  },
  section: {
    marginBottom: Theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  description: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 24,
    marginBottom: Theme.spacing.md,
  },
  formulaContainer: {
    backgroundColor: Theme.colors.background.secondary,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    borderLeftWidth: 4,
    borderLeftColor: Theme.colors.special.primary.exp,
  },
  formula: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
    textAlign: 'center',
  },
  // Level Progress Styles
  currentLevelCard: {
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    backgroundColor: Theme.colors.background.secondary,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  currentLevelEmoji: {
    fontSize: 24,
    marginRight: Theme.spacing.md,
  },
  levelTextInfo: {
    flex: 1,
  },
  currentLevelTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 2,
  },
  currentLevelNumber: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.xs,
    marginBottom: Theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: Theme.borderRadius.xs,
  },
  progressText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.xs,
  },
  mascotEvolutionContainer: {
    marginTop: Theme.spacing.lg,
  },
  mascotEvolutionTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  mascotEvolutionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  mascotImage: {
    width: 60,
    height: 60,
    marginHorizontal: 2,
  },
  arrowIcon: {
    alignSelf: 'center',
    marginHorizontal: Theme.spacing.xs,
  },
  tipSection: {
    backgroundColor: Theme.colors.background.secondary,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: Theme.colors.special.primary.exp,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  tipTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
  },
  tipText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 20,
  },
}); 
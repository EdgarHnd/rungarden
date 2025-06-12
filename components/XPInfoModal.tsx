import Theme from '@/constants/theme';
import LevelingService from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
}

export default function XPInfoModal({ visible, onClose, levelInfo }: XPInfoModalProps) {
  const examples = [
    { distance: 1000, label: '1 km run' },
    { distance: 2000, label: '2 km run' },
    { distance: 5000, label: '5 km run' },
    { distance: 10000, label: '10 km run' },
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
            <Text style={styles.title}>🎯 How to Gain XP</Text>
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
                    <Text style={styles.currentLevelEmoji}>{LevelingService.getLevelEmoji(levelInfo.level)}</Text>
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

                {/* Upcoming Levels */}
                <View style={styles.upcomingLevelsContainer}>
                  <Text style={styles.upcomingLevelsTitle}>Next 3 Levels</Text>
                  <View style={styles.upcomingLevelsRow}>
                    {[1, 2, 3].map((offset) => {
                      const nextLevel = levelInfo.level + offset;
                      const levelRequirements = LevelingService.getLevelRequirements();
                      const levelReq = levelRequirements.find(req => req.level === nextLevel);

                      if (!levelReq) return null;

                      return (
                        <View key={nextLevel} style={styles.upcomingLevelCard}>
                          <Text style={styles.upcomingLevelEmoji}>{levelReq.emoji}</Text>
                          <Text style={styles.upcomingLevelNumber}>Level {nextLevel}</Text>
                          <Text style={styles.upcomingLevelTitle} numberOfLines={2}>{levelReq.title}</Text>
                          <Text style={styles.upcomingLevelDistance}>{LevelingService.formatXP(levelReq.xp)}</Text>
                        </View>
                      );
                    })}
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
                <Text style={styles.formula}>1 kilometer = 100 XP</Text>
                <Text style={styles.subFormula}>or 1 meter = 0.1 XP</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Examples</Text>
              {examples.map((example, index) => (
                <View key={index} style={styles.exampleRow}>
                  <Text style={styles.exampleDistance}>{example.label}</Text>
                  <Text style={styles.exampleXP}>
                    = {LevelingService.formatXP(LevelingService.distanceToXP(example.distance))}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Level Up Rewards</Text>
              <Text style={styles.description}>
                As you level up, you'll unlock:
              </Text>
              <View style={styles.rewardsList}>
                <Text style={styles.rewardItem}>🏆 New achievement titles</Text>
                <Text style={styles.rewardItem}>🎖️ Special badges</Text>
                <Text style={styles.rewardItem}>🔓 New challenges</Text>
                <Text style={styles.rewardItem}>🍃 Bonus leaves</Text>
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
  subFormula: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
    marginTop: Theme.spacing.xs,
  },
  exampleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border.primary,
  },
  exampleDistance: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  exampleXP: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.special.primary.exp,
  },
  rewardsList: {
    gap: Theme.spacing.sm,
  },
  rewardItem: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    lineHeight: 24,
  },
  // Level Progress Styles
  currentLevelCard: {
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.lg,
    marginBottom: Theme.spacing.md,
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
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
  },
  upcomingLevelsContainer: {
    marginTop: Theme.spacing.lg,
  },
  upcomingLevelsTitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.md,
  },
  upcomingLevelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  upcomingLevelCard: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.small,
    padding: Theme.spacing.md,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 2,
  },
  upcomingLevelEmoji: {
    fontSize: 20,
    marginBottom: Theme.spacing.xs,
  },
  upcomingLevelNumber: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: 4,
  },
  upcomingLevelTitle: {
    fontSize: 9,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 4,
    minHeight: 24,
  },
  upcomingLevelDistance: {
    fontSize: 8,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
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
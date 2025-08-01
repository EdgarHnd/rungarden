import Theme from '@/constants/theme';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import LevelingService from '@/services/LevelingService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const analytics = useAnalytics();

  useEffect(() => {
    if (visible) {
      analytics.track({
        name: 'xp_info_modal_viewed',
        properties: {
          level: levelInfo?.level,
        },
      });
    }
  }, [visible]);

  const handleClose = () => {
    analytics.track({ name: 'xp_info_modal_closed' });
    onClose();
  };

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
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.modalContainer} onPress={() => { }}>
          <View style={styles.header}>
            <Text style={styles.title}>Current Progress</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Current Level Progress */}
            {levelInfo && (
              <View style={styles.section}>
                <View style={styles.currentLevelCard}>
                  <View style={styles.levelHeader}>
                    <Image source={require('@/assets/images/flame/age0.png')} style={styles.mascotImage} />
                    <View style={styles.levelTextInfo}>
                      <Text style={styles.currentLevelTitle}>Level {levelInfo.level}</Text>
                      <Text style={styles.currentLevelNumber}>{LevelingService.getLevelTitle(levelInfo.level)}</Text>
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
                  <Text style={styles.mascotEvolutionTitle}>Run to level up your flame</Text>
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

            <View style={styles.formulaContainer}>
              <Text style={styles.formula}>
                Each training session earns you XP!
              </Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
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
    borderRadius: Theme.borderRadius.medium,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Theme.spacing.xl,
    paddingHorizontal: Theme.spacing.xl,
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
  },
  formulaContainer: {
    //backgroundColor: Theme.colors.background.secondary,
    padding: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
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
    padding: 20,
    marginBottom: 10,
    borderWidth: 4,
    borderColor: Theme.colors.background.tertiary,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
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
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: Theme.borderRadius.xs,
    marginBottom: Theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: Theme.borderRadius.xs,
  },
  progressText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    marginTop: Theme.spacing.md,
  },
  mascotEvolutionContainer: {
    marginTop: Theme.spacing.lg,
  },
  mascotEvolutionTitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xl,
    textAlign: 'center',
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
}); 
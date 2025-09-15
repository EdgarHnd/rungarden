import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';

import { RunSummary, useRunTracker } from '@/hooks/useRunTracker';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { useSyncProvider } from '@/provider/SyncProvider';
import { FontAwesome5 } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useNavigation } from 'expo-router';

import { formatDistanceValue, formatPace, getDistanceUnit } from '@/utils/formatters';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: Theme.spacing.xl,
    flex: 1,
  },
  metricsRow: {
    marginTop: Theme.spacing.xxxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.xl,
  },
  metricBox: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.xs,
  },
  metricValue: {
    fontSize: 40,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Theme.spacing.xxxl,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: Theme.spacing.md,
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.large,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: Theme.colors.accent.secondary,
  },
  controlButtonText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: '#FFFFFF', // White text for contrast on colored button
  },

  startButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  startButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: Theme.spacing.lg,
  },
  subtitle: {
    color: Theme.colors.text.secondary,
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: Theme.fonts.medium,
  },
  title: {
    fontSize: 40,
    color: Theme.colors.accent.primary,
    fontFamily: Theme.fonts.bold,
  },
  metricUnit: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },

  readyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: {
    fontSize: 32,
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  readySubtitle: {
    fontSize: 14,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    fontFamily: Theme.fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: Theme.colors.background.primary,
    borderRadius: Theme.borderRadius.large,
    padding: Theme.spacing.xl,
    width: '100%',
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  modalMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Theme.spacing.xl,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepGuidanceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginBottom: Theme.spacing.xs,
  },
  stepEffort: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
  },
  stepCounter: {

  },
  stepCounterText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  stepProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xs,
  },
  stepProgressBar: {
    width: '100%',
    height: 10,
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  stepProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  stepTimeRemaining: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
  },
  stepNotes: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    marginTop: Theme.spacing.xs,
    marginBottom: Theme.spacing.md,
  },
  nextStepPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Theme.spacing.xs,
  },
  nextStepLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    marginRight: Theme.spacing.xs,
  },
  nextStepText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  skipStepText: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginLeft: Theme.spacing.xs,
  },
  workoutCompleteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.small,
    marginTop: Theme.spacing.md,
  },
  workoutCompleteText: {
    fontSize: 14,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginLeft: Theme.spacing.xs,
  },
  gpsText: {
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  speechToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.transparent.white10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Prominent step guidance
  prominentStepTitle: {
    fontSize: 60,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
  },
  prominentTimeContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
  },
  prominentTimeLabel: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginVertical: Theme.spacing.sm,
  },
  prominentTimeValue: {
    fontSize: 80,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.accent.primary,
  },
  prominentNextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Theme.spacing.xl,
    gap: 4,
  },
  prominentNextStepLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
  },
  prominentNextStepText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  prominentNextStepDuration: {
    fontSize: 20,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.tertiary,
    textAlign: 'center',
  },
  prominentStepProgressContainer: {
    width: '100%',
    marginVertical: Theme.spacing.lg,
  },
  // Simplified time displays for structured workout
  simplifiedTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Theme.spacing.xl,
  },
  simplifiedTimeBox: {
    alignItems: 'center',
  },
  simplifiedTimeLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.secondary,
    marginBottom: Theme.spacing.xs,
  },
  simplifiedTimeValue: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  // Enhanced controls for structured workout
  structuredControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Theme.spacing.xxxl,
    paddingHorizontal: Theme.spacing.xl,
  },
  sideControlButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sideControlButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralPauseButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centralPauseButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginHorizontal: Theme.spacing.xxl,
  },
  centralPauseButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButton: {
    width: 60,
    height: 60,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Theme.colors.text.primary,
  },
  finishButtonText: {
    fontSize: 12,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  sideControlText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.md,
  },
  emptySideControl: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function RunRecordingScreen() {
  const analytics = useAnalytics();
  const { triggerCelebrationCheck } = useSyncProvider();
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';



  // Simple run tracker for basic run recording
  const {
    isRunning,
    isPaused,
    accuracy,
    distance,
    elapsed,
    start,
    pause,
    resume,
    stop,
    reset,
  } = useRunTracker();

  const recordRun = useMutation(api.activities.syncActivitiesFromHealthKit);
  const [saving, setSaving] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<RunSummary | null>(null);





  // Disable swipe back / interactive pop
  const navigation = useNavigation();
  React.useEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ gestureEnabled: false });
  }, []);

  // Helpers
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const hh = h > 0 ? `${h}:` : '';
    const mm = `${h > 0 && m < 10 ? '0' : ''}${m}`;
    const ss = s < 10 ? `0${s}` : s.toString();
    return `${hh}${mm}:${ss}`;
  };

  const distKm = distance / 1000;
  const distUnit = isMetric ? distKm : distKm * 0.621371; // miles if imperial
  const paceRaw = distance >= 10 ? (elapsed / 60) / (distKm) : 0; // min per km
  const paceConverted = isMetric ? paceRaw : paceRaw / 0.621371; // min per mile
  const speedRaw = distance >= 10 && elapsed > 0 ? distKm / (elapsed / 3600) : 0; // km/h
  const speedConverted = isMetric ? speedRaw : speedRaw * 0.621371; // mph

  const handleStart = async () => {
    analytics.track({
      name: 'run_started',
      properties: {
        metric_system: isMetric ? 'metric' : 'imperial'
      }
    });

    await start();
  };

  const handleFinish = () => {
    analytics.track({
      name: 'run_finished',
      properties: {
        duration_seconds: elapsed,
        distance_meters: Math.round(distance)
      }
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const summary = stop();
    setFinishedSummary(summary);
  };

  const saveRun = async () => {
    if (!finishedSummary) return;

    // Filter out runs that are essentially empty
    if (finishedSummary.distanceMeters < 50 || finishedSummary.durationSec < 60) {
      Alert.alert('Run too short', 'Activity was not saved because distance or time was too low.');
      discardRun();
      return;
    }
    setSaving(true);
    try {
      analytics.track({
        name: 'run_saved',
        properties: {
          duration_seconds: finishedSummary.durationSec,
          distance_meters: finishedSummary.distanceMeters
        }
      });

      const result = await recordRun({
        activities: [{
          healthKitUuid: `manual-${Date.now()}`,
          startDate: finishedSummary.startDate,
          endDate: finishedSummary.endDate,
          duration: Math.round(finishedSummary.durationSec / 60),
          distance: finishedSummary.distanceMeters,
          calories: Math.round(finishedSummary.distanceMeters * 0.06), // Rough estimate
          workoutName: 'Manual Run',
        }],
        initialSync: false,
      });
      const activityId = result.newRuns[0]?._id;

      // Trigger celebration check after successful run save
      setTimeout(() => {
        triggerCelebrationCheck();
      }, 1000); // Small delay to ensure database operations complete

      setFinishedSummary(null);
      router.replace(`/activity-detail?id=${activityId}`);
    } catch (err) {
      console.error('Failed to save run', err);
    } finally {
      setSaving(false);
    }
  };

  const discardRun = () => {
    analytics.track({
      name: 'run_discarded',
      properties: {
        duration_seconds: elapsed,
        distance_meters: Math.round(distance)
      }
    });

    setFinishedSummary(null);
    reset();
  };

  const renderGpsSignalBars = () => {
    const getSignalStrength = () => {
      if (accuracy == null) return 0;
      if (accuracy <= 10) return 4; // Excellent
      if (accuracy <= 25) return 3; // Good
      if (accuracy <= 50) return 2; // Fair
      return 1; // Weak
    };

    const getSignalColor = () => {
      if (accuracy == null) return '#64748B'; // Grey
      if (accuracy <= 10) return '#10B981'; // Green
      if (accuracy <= 25) return '#84CC16'; // Light green
      if (accuracy <= 50) return '#F59E0B'; // Orange
      return '#EF4444'; // Red
    };

    const strength = getSignalStrength();
    const color = getSignalColor();

    return (
      <View style={styles.gpsContainer}>
        <Text style={styles.gpsText}>GPS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 4 }}>
          {[1, 2, 3, 4].map((bar) => (
            <View
              key={bar}
              style={{
                width: 4,
                height: 4 + (bar * 3),
                backgroundColor: bar <= strength ? color : '#64748B20',
                borderRadius: 1,
              }}
            />
          ))}
        </View>
      </View>
    );
  };



  const canStart = accuracy != null;

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              analytics.track({
                name: 'run_exit_attempted',
                properties: {
                  is_running: isRunning,
                  duration_seconds: elapsed,
                  distance_meters: Math.round(distance)
                }
              });

              Alert.alert('Close Run', 'Are you sure you want to exit? Your current run will be discarded.', [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Discard', style: 'destructive', onPress: () => {
                    discardRun();
                    router.back();
                  }
                },
              ]);
            }}
            style={styles.backButton}
          >
            <FontAwesome5 name="times" size={20} color={Theme.colors.text.primary} />
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {renderGpsSignalBars()}
          </View>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.subtitle}>CURRENT</Text>
            <Text style={styles.title}>Free Run</Text>
          </View>

          {/* Full metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>DISTANCE</Text>
              <Text style={styles.metricValue}>{distUnit.toFixed(2)}</Text>
              <Text style={styles.metricUnit}>{isMetric ? 'KM' : 'MI'}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>TIME</Text>
              <Text style={styles.metricValue}>{formatTime(elapsed)}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>AVG SPEED</Text>
              <Text style={styles.metricValue}>{isFinite(speedConverted) ? speedConverted.toFixed(1) : '0.0'}</Text>
              <Text style={styles.metricUnit}>{isMetric ? 'KPH' : 'MPH'}</Text>
            </View>
          </View>
        </View>

        {/* Ready / Controls */}
        {!isRunning ? (
          <View style={styles.readyContainer}>
            <Text style={styles.readyTitle}>Get ready to start</Text>
            <Text style={styles.readySubtitle}>Make sure to warm up before starting</Text>
          </View>
        ) : null}

        {/* Controls */}
        {!isRunning ? (
          /* Start button */
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.startButton, !canStart && { opacity: 0.5 }]}
              onPress={canStart ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                handleStart();
              } : undefined}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4FA1FF', '#2B27FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Text style={styles.startButtonText}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          /* Simple controls for running */
          <View style={styles.structuredControls}>
            {/* Empty left side for symmetry */}
            <View style={styles.emptySideControl} />

            {/* Central Pause/Resume Button */}
            <TouchableOpacity
              style={styles.centralPauseButton}
              onPress={() => {
                const action = isPaused ? 'resumed' : 'paused';

                analytics.track({
                  name: 'run_action',
                  properties: {
                    action: action,
                    duration_seconds: elapsed,
                    distance_meters: Math.round(distance)
                  }
                });

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isPaused) {
                  resume();
                } else {
                  pause();
                }
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4FA1FF', '#2B27FF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.centralPauseButtonGradient}
              >
                <Text style={styles.startButtonText}>
                  {isPaused ? 'RESUME' : 'PAUSE'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Finish Button */}
            <View style={styles.finishButtonContainer}>
              <TouchableOpacity
                style={styles.finishButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  handleFinish();
                }}
                disabled={saving}
              >
                <Text style={styles.finishButtonText}>FINISH</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>

      <Modal
        visible={!!finishedSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setFinishedSummary(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {finishedSummary && (
              <>
                <Text style={styles.modalTitle}>Run Summary</Text>
                <View style={styles.modalMetricsRow}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>DISTANCE</Text>
                    <Text style={styles.metricValue}>{formatDistanceValue(finishedSummary!.distanceMeters, isMetric ? 'metric' : 'imperial')}</Text>
                    <Text style={styles.metricUnit}>{getDistanceUnit(isMetric ? 'metric' : 'imperial').toUpperCase()}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>TIME</Text>
                    <Text style={styles.metricValue}>{formatTime(finishedSummary!.durationSec)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>PACE</Text>
                    <Text style={styles.metricValue}>{formatPace(finishedSummary!.durationSec / 60, finishedSummary!.distanceMeters, isMetric ? 'metric' : 'imperial')}</Text>
                  </View>
                </View>
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={[styles.controlButton, { backgroundColor: Theme.colors.status.error, borderBottomColor: Theme.colors.status.error }]} onPress={discardRun}>
                    <Text style={styles.controlButtonText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.controlButton} onPress={saveRun} disabled={saving}>
                    <Text style={styles.controlButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
} 
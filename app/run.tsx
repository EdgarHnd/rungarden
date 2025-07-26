import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { RunSummary, useRunTracker, WorkoutStep } from '@/hooks/useRunTracker';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
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
  },
  controlButtonText: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  gpsText: {
    alignSelf: 'center',
    marginTop: Theme.spacing.sm,
    color: Theme.colors.text.secondary,
    fontFamily: Theme.fonts.medium,
  },
  startButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.accent.secondary,
    paddingVertical: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.large,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: Theme.spacing.md,
  },
  startButtonText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.background.primary,
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
  workoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.background.tertiary,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    marginTop: Theme.spacing.lg,
    alignSelf: 'center',
    width: '90%',
    justifyContent: 'center',
  },
  workoutBarText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    textAlign: 'center',
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
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    marginBottom: Theme.spacing.lg,
    marginHorizontal: Theme.spacing.md,
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
    backgroundColor: Theme.colors.accent.primary,
    borderRadius: Theme.borderRadius.small,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: Theme.spacing.xs,
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
    flex: 1,
    height: 8,
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
  skipStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.colors.special.primary.level,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.small,
    marginTop: Theme.spacing.md,
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
});

export default function RunRecordingScreen() {
  const profile = useQuery(api.userProfile.getOrCreateProfile);
  const isMetric = (profile?.metricSystem ?? 'metric') === 'metric';

  // Get parameters for structured workout mode
  const params = useLocalSearchParams();
  const plannedWorkoutId = params.plannedWorkoutId as Id<"plannedWorkouts"> | undefined;
  const executableStepsParam = params.executableSteps as string | undefined;

  // Fetch planned workout data if this is a structured workout
  const plannedWorkout = useQuery(
    api.trainingPlan.getPlannedWorkoutById,
    plannedWorkoutId ? { plannedWorkoutId: plannedWorkoutId } : "skip"
  );

  // Enhanced useRunTracker with structured workout support
  const {
    isRunning,
    isPaused,
    accuracy,
    distance,
    elapsed,
    isStructuredWorkout,
    currentStep,
    workoutSteps,
    start,
    pause,
    resume,
    stop,
    reset,
    skipToNextStep,
  } = useRunTracker();

  const recordRun = useMutation(api.activities.recordManualRun);
  const [saving, setSaving] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<RunSummary | null>(null);

  // Convert planned workout steps to WorkoutStep format
  const convertToWorkoutSteps = (steps: any[]): WorkoutStep[] => {
    return steps.map((step, index) => ({
      order: step.order || index + 1,
      label: step.label || `Step ${index + 1}`,
      duration: step.duration,
      distance: step.distance,
      effort: step.effort || 'moderate',
      notes: step.notes,
    }));
  };

  // Determine workout mode
  const isGuidedWorkout = plannedWorkout && plannedWorkout.workout?.steps?.length > 0;
  const workoutTitle = isGuidedWorkout
    ? (plannedWorkout.workout.name || plannedWorkout.workout.description || 'Guided Workout')
    : 'Free Run';

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
  const formatPace = (val: number) => {
    if (val === 0 || !isFinite(val)) return '--:--';
    const minutes = Math.floor(val);
    const seconds = Math.round((val - minutes) * 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleStart = async () => {
    // If executable steps are passed directly, use them. Otherwise, convert from planned workout.
    if (executableStepsParam) {
      try {
        const steps = JSON.parse(executableStepsParam);
        await start(steps);
      } catch (e) {
        console.error("Failed to parse executable steps:", e);
        await start(); // fallback to free run
      }
    } else if (isGuidedWorkout && plannedWorkout?.workout?.steps) {
      const workoutSteps = convertToWorkoutSteps(plannedWorkout.workout.steps);
      await start(workoutSteps);
    } else {
      await start();
    }
  };

  const handleFinish = () => {
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
      const activityId = await recordRun({
        startDate: finishedSummary.startDate,
        endDate: finishedSummary.endDate,
        duration: Math.round(finishedSummary.durationSec / 60),
        distance: finishedSummary.distanceMeters,
        polyline: JSON.stringify(finishedSummary.polyline),
        plannedWorkoutId: plannedWorkoutId,
      });
      setFinishedSummary(null);
      router.replace(`/activity-detail?id=${activityId}`);
    } catch (err) {
      console.error('Failed to save run', err);
    } finally {
      setSaving(false);
    }
  };

  const discardRun = () => {
    setFinishedSummary(null);
    reset();
  };

  const renderGpsStatus = () => {
    if (accuracy == null) return 'GPS: —';
    if (accuracy <= 10) return `GPS: Excellent (${Math.round(accuracy)} m)`;
    if (accuracy <= 25) return `GPS: Good (${Math.round(accuracy)} m)`;
    if (accuracy <= 50) return `GPS: Fair (${Math.round(accuracy)} m)`;
    return `GPS: Weak (${Math.round(accuracy)} m)`;
  };

  // Get step progress percentage
  const getStepProgress = () => {
    if (!currentStep) return 0;
    return Math.min((currentStep.stepElapsed / currentStep.stepDuration) * 100, 100);
  };

  // Get step time remaining
  const getStepTimeRemaining = () => {
    if (!currentStep) return 0;
    return Math.max(currentStep.stepDuration - currentStep.stepElapsed, 0);
  };

  // Get effort-based color
  const getEffortColor = (effort: string) => {
    switch (effort.toLowerCase()) {
      case 'easy':
      case 'very easy':
        return '#10B981'; // Green
      case 'moderate':
        return '#F59E0B'; // Yellow
      case 'hard':
      case 'very hard':
        return '#EF4444'; // Red
      default:
        return Theme.colors.accent.primary;
    }
  };

  // Render structured workout step guidance
  const renderStepGuidance = () => {
    if (!isStructuredWorkout || !currentStep) return null;

    const progress = getStepProgress();
    const timeRemaining = getStepTimeRemaining();
    const effortColor = getEffortColor(currentStep.step.effort);

    return (
      <View style={styles.stepGuidanceContainer}>
        <View style={styles.stepHeader}>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>{currentStep.step.label}</Text>
            <Text style={[styles.stepEffort, { color: effortColor }]}>
              {currentStep.step.effort.toUpperCase()}
            </Text>
          </View>
          <View style={styles.stepCounter}>
            <Text style={styles.stepCounterText}>
              {currentStep.stepIndex + 1} / {currentStep.totalSteps}
            </Text>
          </View>
        </View>

        <View style={styles.stepProgressContainer}>
          <View style={styles.stepProgressBar}>
            <View
              style={[
                styles.stepProgressFill,
                { width: `${progress}%`, backgroundColor: effortColor }
              ]}
            />
          </View>
          <Text style={styles.stepTimeRemaining}>
            {formatTime(timeRemaining)} remaining
          </Text>
        </View>

        {currentStep.step.notes && (
          <Text style={styles.stepNotes}>{currentStep.step.notes}</Text>
        )}

        {/* Next step preview */}
        {currentStep.stepIndex + 1 < workoutSteps.length && (
          <View style={styles.nextStepPreview}>
            <Text style={styles.nextStepLabel}>NEXT:</Text>
            <Text style={styles.nextStepText}>
              {workoutSteps[currentStep.stepIndex + 1].label}
            </Text>
          </View>
        )}

        {/* Manual step advance button */}
        {!currentStep.isComplete && (
          <TouchableOpacity
            style={styles.skipStepButton}
            onPress={skipToNextStep}
          >
            <Ionicons name="play-skip-forward" size={16} color={Theme.colors.text.primary} />
            <Text style={styles.skipStepText}>Skip Step</Text>
          </TouchableOpacity>
        )}

        {/* Workout complete indicator */}
        {currentStep.isComplete && (
          <View style={styles.workoutCompleteContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.workoutCompleteText}>Workout Complete!</Text>
          </View>
        )}
      </View>
    );
  };

  const canStart = accuracy != null && accuracy <= 25;

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
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
          <Text style={styles.gpsText}>{renderGpsStatus()}</Text>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.subtitle}>
              {isGuidedWorkout ? 'GUIDED WORKOUT' : 'CURRENT'}
            </Text>
            <Text style={styles.title}>{workoutTitle}</Text>
          </View>

          {/* Structured Workout Step Guidance */}
          {renderStepGuidance()}

          {/* Metrics */}
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

          {/* Add Target / Workout (only show for free runs) */}
          {!isGuidedWorkout && (
            <TouchableOpacity style={styles.workoutBar}>
              <FontAwesome5 name="plus" size={14} color={Theme.colors.text.primary} style={{ marginRight: 8 }} />
              <Text style={styles.workoutBarText}>Add Target / Workout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ready / Controls */}
        {!isRunning ? (
          <View style={styles.readyContainer}>
            <Text style={styles.readyTitle}>
              {isGuidedWorkout ? 'Ready for guided workout' : 'Get ready to start'}
            </Text>
            <Text style={styles.readySubtitle}>
              {isGuidedWorkout
                ? 'Follow the step-by-step guidance'
                : 'Make sure to warm up before starting'
              }
            </Text>
          </View>
        ) : null}

        {/* Controls */}
        <View style={styles.controls}>
          {!isRunning ? (
            <TouchableOpacity
              style={[styles.startButton, !canStart && { opacity: 0.5 }]}
              onPress={canStart ? handleStart : undefined}
            >
              <Text style={styles.startButtonText}>START</Text>
            </TouchableOpacity>
          ) : (
            <>
              {isPaused ? (
                <TouchableOpacity style={styles.controlButton} onPress={resume}>
                  <Text style={styles.controlButtonText}>Resume</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.controlButton} onPress={pause}>
                  <Text style={styles.controlButtonText}>Pause</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.controlButton, { backgroundColor: Theme.colors.accent.primary, }]}
                onPress={handleFinish}
                disabled={saving}
              >
                <Text style={styles.controlButtonText}>Finish</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
                    <Text style={styles.metricValue}>{isMetric ? (finishedSummary!.distanceMeters / 1000).toFixed(2) : ((finishedSummary!.distanceMeters / 1000) * 0.621371).toFixed(2)}</Text>
                    <Text style={styles.metricUnit}>{isMetric ? 'KM' : 'MI'}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>TIME</Text>
                    <Text style={styles.metricValue}>{formatTime(finishedSummary!.durationSec)}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>PACE</Text>
                    <Text style={styles.metricValue}>{
                      (() => {
                        const raw = (finishedSummary!.durationSec / 60) / (finishedSummary!.distanceMeters / 1000);
                        const val = isMetric ? raw : raw / 0.621371;
                        return `${formatPace(val)} /${isMetric ? 'km' : 'mi'}`;
                      })()
                    }</Text>
                  </View>
                </View>
                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity style={[styles.controlButton, { backgroundColor: Theme.colors.status.error }]} onPress={discardRun}>
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
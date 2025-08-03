import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { RunSummary, useRunTracker, WorkoutStep } from '@/hooks/useRunTracker';
import { useAnalytics } from '@/provider/AnalyticsProvider';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useState } from 'react';
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
    color: Theme.colors.text.primary,
  },

  startButton: {
    backgroundColor: Theme.colors.accent.primary,
    borderWidth: 5,
    borderColor: Theme.colors.accent.secondary,
    borderRadius: Theme.borderRadius.full,
    alignItems: 'center',
    width: 120,
    height: 120,
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 22,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
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
    backgroundColor: Theme.colors.accent.primary,
    borderWidth: 5,
    borderColor: Theme.colors.accent.secondary,
    justifyContent: 'center',
    marginHorizontal: Theme.spacing.xxl,
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
    skipToPreviousStep,
  } = useRunTracker();

  const recordRun = useMutation(api.activities.recordManualRun);
  const [saving, setSaving] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<RunSummary | null>(null);

  // Speech announcements state
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState<number | null>(null);
  const [lastTimeAnnouncement, setLastTimeAnnouncement] = useState<number | null>(null);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  // Speech announcement functions
  const announceStep = (step: WorkoutStep, stepNumber: number, totalSteps: number) => {
    if (isPaused || !speechEnabled) return; // Don't announce if paused or disabled

    let announcement = '';

    // Format duration for better speech (convert step.duration string to seconds then back to readable format)
    const durationSeconds = step.duration ? parseDurationToSeconds(step.duration) : 300;
    const formattedDuration = formatDurationFromSeconds(durationSeconds);

    if (stepNumber === 1) {
      announcement = `Starting workout. ${step.label} for ${formattedDuration}.`;
    } else {
      announcement = `Step ${stepNumber}. ${step.label} for ${formattedDuration}.`;
    }

    if (step.notes) {
      announcement += ` ${step.notes}`;
    }

    Speech.speak(announcement, {
      rate: 0.9,
      pitch: 1.0,
      language: 'en-US'
    });
  };

  const announceTimeRemaining = (timeRemaining: number) => {
    if (isPaused || !speechEnabled) return; // Don't announce if paused or disabled

    let announcement = '';

    if (timeRemaining === 30) {
      announcement = '30 seconds remaining';
    } else if (timeRemaining === 10) {
      announcement = '10 seconds remaining';
    } else if (timeRemaining === 5) {
      announcement = '5 seconds';
    } else if (timeRemaining === 3) {
      announcement = '3';
    } else if (timeRemaining === 2) {
      announcement = '2';
    } else if (timeRemaining === 1) {
      announcement = '1';
    }

    if (announcement) {
      Speech.speak(announcement, {
        rate: 1.0,
        pitch: 1.1,
        language: 'en-US'
      });
    }
  };

  const announceWorkoutComplete = () => {
    if (!speechEnabled) return; // Don't announce if disabled

    Speech.speak('Workout complete! Great job!', {
      rate: 0.9,
      pitch: 1.2,
      language: 'en-US'
    });
  };

  const announceManualSkip = (direction: 'forward' | 'backward') => {
    if (!speechEnabled) return; // Don't announce if disabled

    const announcement = direction === 'forward' ? 'Skipping ahead' : 'Going back';
    Speech.speak(announcement, {
      rate: 1.1,
      pitch: 1.0,
      language: 'en-US'
    });
  };

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
    ? (plannedWorkout.workout.description || 'Guided Workout')
    : 'Free Run';

  // Disable swipe back / interactive pop
  const navigation = useNavigation();
  React.useEffect(() => {
    // @ts-ignore
    navigation.setOptions?.({ gestureEnabled: false });

    return () => {
      // Cleanup speech on unmount
      Speech.stop();
    };
  }, []);

  // Speech announcements for step changes
  useEffect(() => {
    if (isStructuredWorkout && currentStep && isRunning && !isPaused) {
      const stepNumber = currentStep.stepIndex + 1;

      // Announce new step only if it's different from the last one announced
      if (lastAnnouncedStep !== stepNumber) {
        setLastAnnouncedStep(stepNumber);

        // Track automatic step progression (not manual navigation)
        analytics.track({
          name: 'step_auto_advanced',
          properties: {
            step_index: stepNumber - 1,
            step_label: currentStep.step.label,
            step_effort: currentStep.step.effort,
            total_steps: currentStep.totalSteps,
            workout_type: 'structured'
          }
        });

        announceStep(currentStep.step, stepNumber, currentStep.totalSteps);
      }

      // Announce workout completion
      if (currentStep.isComplete && lastAnnouncedStep !== -1) {
        setLastAnnouncedStep(-1); // Mark as completed
        announceWorkoutComplete();
      }
    }
  }, [currentStep, isRunning, isPaused, speechEnabled]); // Rerunning is OK, the logic prevents re-announcing

  // Speech announcements for time remaining
  useEffect(() => {
    if (isStructuredWorkout && currentStep && isRunning && !isPaused && !currentStep.isComplete) {
      const timeRemaining = getStepTimeRemaining();

      // Announce at specific time intervals
      const shouldAnnounce = [30, 10, 5, 3, 2, 1].includes(timeRemaining);

      if (shouldAnnounce && lastTimeAnnouncement !== timeRemaining) {
        setLastTimeAnnouncement(timeRemaining);
        announceTimeRemaining(timeRemaining);
      }

      // Reset time announcement tracking when step changes
      if (currentStep.stepElapsed === 0) {
        setLastTimeAnnouncement(null);
      }
    }
  }, [isStructuredWorkout, currentStep, isRunning, isPaused]);

  // Stop speech when pausing or stopping
  useEffect(() => {
    if (isPaused || !isRunning) {
      Speech.stop();
    }
  }, [isPaused, isRunning]);

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
    const workoutType = isGuidedWorkout ? 'structured' : 'free_run';

    analytics.track({
      name: 'workout_started',
      properties: {
        workout_type: workoutType,
        planned_workout_id: plannedWorkoutId,
        has_speech_enabled: speechEnabled,
        metric_system: isMetric ? 'metric' : 'imperial'
      }
    });

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

    // Brief welcome announcement for structured workouts
    // if ((executableStepsParam || isGuidedWorkout) && speechEnabled) {
    //   setTimeout(() => {
    //     Speech.speak('Workout started. You will receive voice guidance for each step.', {
    //       rate: 0.9,
    //       pitch: 1.0,
    //       language: 'en-US'
    //     });
    //   }, 2000); // Delay to avoid conflict with step announcement
    // }
  };

  const handleFinish = () => {
    analytics.track({
      name: 'workout_finished',
      properties: {
        workout_type: isStructuredWorkout ? 'structured' : 'free_run',
        duration_seconds: elapsed,
        distance_meters: Math.round(distance),
        planned_workout_id: plannedWorkoutId,
        step_index: currentStep?.stepIndex,
        total_steps: currentStep?.totalSteps
      }
    });

    // Stop any ongoing speech
    Speech.stop();
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
        name: 'workout_saved',
        properties: {
          workout_type: isGuidedWorkout ? 'structured' : 'free_run',
          duration_seconds: finishedSummary.durationSec,
          distance_meters: finishedSummary.distanceMeters,
          planned_workout_id: plannedWorkoutId
        }
      });

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
    analytics.track({
      name: 'workout_discarded',
      properties: {
        workout_type: isGuidedWorkout ? 'structured' : 'free_run',
        duration_seconds: elapsed,
        distance_meters: Math.round(distance),
        planned_workout_id: plannedWorkoutId
      }
    });

    // Stop any ongoing speech
    Speech.stop();
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

  // Calculate total workout remaining time
  const getTotalWorkoutTimeRemaining = () => {
    if (!isStructuredWorkout || !currentStep || !workoutSteps) return 0;

    // Time remaining in current step
    let totalRemaining = getStepTimeRemaining();

    // Add duration of all remaining steps
    for (let i = currentStep.stepIndex + 1; i < workoutSteps.length; i++) {
      const step = workoutSteps[i];
      if (step.duration) {
        const stepDuration = parseDurationToSeconds(step.duration);
        totalRemaining += stepDuration;
      }
    }

    return totalRemaining;
  };

  // Parse duration string to seconds (copied from useRunTracker)
  const parseDurationToSeconds = (duration: string): number => {
    const trimmed = duration.trim().toLowerCase();

    // Match patterns like "5 min", "60 sec", "2.5 min"
    const minMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*min/);
    if (minMatch) {
      return Math.round(parseFloat(minMatch[1]) * 60);
    }

    const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*sec/);
    if (secMatch) {
      return Math.round(parseFloat(secMatch[1]));
    }

    // Default to 5 minutes if can't parse
    return 300;
  };

  // Format seconds into human-readable duration
  const formatDurationFromSeconds = (totalSeconds: number): string => {
    if (totalSeconds < 60) {
      return `${totalSeconds} sec`;
    }

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (seconds === 0) {
      return minutes === 1 ? '1 min' : `${minutes} min`;
    }

    return minutes === 1 ? `1 min ${seconds} sec` : `${minutes} min ${seconds} sec`;
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



  // Render simplified time displays for structured workout
  const renderSimplifiedTimeDisplays = () => {
    const totalWorkoutTimeRemaining = getTotalWorkoutTimeRemaining();

    return (
      <View style={styles.simplifiedTimeRow}>
        <View style={styles.simplifiedTimeBox}>
          <Text style={styles.simplifiedTimeLabel}>SINCE START</Text>
          <Text style={styles.simplifiedTimeValue}>{formatTime(elapsed)}</Text>
        </View>
        <View style={styles.simplifiedTimeBox}>
          <Text style={styles.simplifiedTimeLabel}>TIME LEFT</Text>
          <Text style={styles.simplifiedTimeValue}>{formatTime(totalWorkoutTimeRemaining)}</Text>
        </View>
      </View>
    );
  };

  // Render prominent step guidance for structured workout
  const renderProminentStepGuidance = () => {
    if (!isStructuredWorkout || !currentStep) return null;

    const timeRemaining = getStepTimeRemaining();
    const effortColor = getEffortColor(currentStep.step.effort);
    const progress = getStepProgress();

    return (
      <View style={styles.stepGuidanceContainer}>
        {/* Next step preview */}
        {currentStep.stepIndex + 1 < workoutSteps.length && !currentStep.isComplete && (
          <View style={styles.prominentNextStep}>
            <Text style={styles.prominentNextStepLabel}>NEXT:</Text>
            <Text style={styles.prominentNextStepText}>
              {workoutSteps[currentStep.stepIndex + 1].label}
            </Text>
            {workoutSteps[currentStep.stepIndex + 1].duration && (
              <Text style={styles.prominentNextStepDuration}>
                {(() => {
                  const nextStepDuration = workoutSteps[currentStep.stepIndex + 1].duration;
                  const durationSeconds = nextStepDuration ? parseDurationToSeconds(nextStepDuration) : 300;
                  return formatDurationFromSeconds(durationSeconds);
                })()}
              </Text>
            )}
          </View>
        )}
        {/* Step counter */}
        <View style={styles.stepCounter}>
          <Text style={styles.stepCounterText}>
            {currentStep.stepIndex + 1} / {currentStep.totalSteps}
          </Text>
        </View>

        {/* Prominent step title */}
        <Text style={styles.prominentStepTitle}>{currentStep.step.label}</Text>

        {/* Step progress bar */}
        <View style={styles.prominentStepProgressContainer}>
          <View style={styles.stepProgressBar}>
            <View
              style={[
                styles.stepProgressFill,
                { width: `${progress}%`, backgroundColor: effortColor }
              ]}
            />
          </View>
        </View>

        {/* Workout complete indicator */}
        {currentStep.isComplete ? (
          <View style={styles.prominentTimeContainer}>
            <Ionicons name="checkmark-circle" size={64} color="#10B981" />
            <Text style={[styles.prominentTimeValue, { color: '#10B981', fontSize: 24 }]}>
              Workout Complete!
            </Text>
          </View>
        ) : (
          /* Time remaining - prominent */
          <View style={styles.prominentTimeContainer}>
            <Text style={styles.prominentTimeLabel}>TIME REMAINING</Text>
            <Text style={styles.prominentTimeValue}>{formatTime(timeRemaining)}</Text>
          </View>
        )}

        {/* Step notes */}
        {currentStep.step.notes && (
          <Text style={styles.stepNotes}>{currentStep.step.notes}</Text>
        )}
      </View>
    );
  };

  // Render enhanced controls for structured workout
  const renderStructuredControls = () => {
    if (!isStructuredWorkout || !isRunning) return null;

    return (
      <View style={styles.structuredControls}>
        {/* Back/Previous Step */}
        <View style={styles.sideControlButtonContainer}>
          <TouchableOpacity
            style={[styles.sideControlButton, {
              opacity: currentStep?.stepIndex === 0 ? 0.3 : 1
            }]}
            onPress={() => {
              analytics.track({
                name: 'step_navigation',
                properties: {
                  direction: 'backward',
                  from_step: currentStep?.stepIndex,
                  total_steps: currentStep?.totalSteps,
                  workout_type: 'structured'
                }
              });

              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              announceManualSkip('backward');
              skipToPreviousStep();
            }}
            disabled={!currentStep || currentStep.stepIndex === 0}
          >
            <Ionicons name="play-skip-back" size={30} color={Theme.colors.text.primary} />
            <Text style={styles.sideControlText}>BACK</Text>
          </TouchableOpacity>
        </View>
        {/* Central Pause/Resume/Finish Button */}
        <View style={styles.centralPauseButtonContainer}>
          <TouchableOpacity
            style={styles.centralPauseButton}
            onPress={() => {
              if (currentStep?.isComplete) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                handleFinish();
              } else {
                const action = isPaused ? 'resumed' : 'paused';

                analytics.track({
                  name: 'workout_action',
                  properties: {
                    action: action,
                    workout_type: isStructuredWorkout ? 'structured' : 'free_run',
                    duration_seconds: elapsed,
                    step_index: currentStep?.stepIndex,
                    total_steps: currentStep?.totalSteps
                  }
                });

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (isPaused) {
                  resume();
                } else {
                  pause();
                }
              }
            }}
          >
            <Text style={styles.startButtonText}>
              {currentStep?.isComplete ? 'FINISH' : (isPaused ? 'RESUME' : 'PAUSE')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip/Next Step */}
        {!currentStep?.isComplete ? (
          <View style={styles.sideControlButtonContainer}>
            <TouchableOpacity
              style={styles.sideControlButton}
              onPress={() => {
                analytics.track({
                  name: 'step_navigation',
                  properties: {
                    direction: 'forward',
                    from_step: currentStep?.stepIndex,
                    total_steps: currentStep?.totalSteps,
                    workout_type: 'structured'
                  }
                });

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                announceManualSkip('forward');
                skipToNextStep();
              }}
            >
              <Ionicons name="play-skip-forward" size={30} color={Theme.colors.text.primary} />
              <Text style={styles.sideControlText}>SKIP</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptySideControl} />
        )}
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
                name: 'workout_exit_attempted',
                properties: {
                  workout_type: isStructuredWorkout ? 'structured' : 'free_run',
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
            {/* Speech Toggle (only show for structured workouts) */}
            {isStructuredWorkout && (
              <Pressable
                onPress={() => {
                  const newSpeechState = !speechEnabled;
                  setSpeechEnabled(newSpeechState);

                  analytics.track({
                    name: 'speech_toggled',
                    properties: {
                      enabled: newSpeechState,
                      workout_type: isStructuredWorkout ? 'structured' : 'free_run'
                    }
                  });

                  if (newSpeechState) {
                    // Brief confirmation when enabling
                    Speech.speak('Speech enabled', { rate: 1.0, language: 'en-US' });
                  } else {
                    // Stop speech when disabling
                    Speech.stop();
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[styles.speechToggle, { opacity: speechEnabled ? 1 : 0.5 }]}
              >
                <Ionicons
                  name={speechEnabled ? "volume-high" : "volume-mute"}
                  size={20}
                  color={Theme.colors.text.primary}
                />
              </Pressable>
            )}
            {renderGpsSignalBars()}
          </View>
        </View>

        <View style={styles.content}>
          {/* Conditional Layout based on workout type */}
          {isStructuredWorkout && isRunning ? (
            <>
              {/* Simplified time displays for structured workout */}
              {renderSimplifiedTimeDisplays()}

              {/* Prominent step guidance takes up most space */}
              {renderProminentStepGuidance()}
            </>
          ) : (
            <>
              {/* Title */}
              <View style={styles.titleContainer}>
                <Text style={styles.subtitle}>
                  {isGuidedWorkout ? 'GUIDED WORKOUT' : 'CURRENT'}
                </Text>
                <Text style={styles.title}>{workoutTitle}</Text>
              </View>

              {/* Structured Workout Step Guidance (minimal when not running) */}
              {isStructuredWorkout && renderProminentStepGuidance()}

              {/* Full metrics for free runs or when not running */}
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
                  <Text style={styles.workoutBarText}>Follow a Workout</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Ready / Controls */}
        {!isRunning ? (
          <View style={styles.readyContainer}>
            <Text style={styles.readyTitle}>
              {isGuidedWorkout ? 'Ready for your workout' : 'Get ready to start'}
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
        {isStructuredWorkout && isRunning ? (
          /* Enhanced structured workout controls */
          renderStructuredControls()
        ) : !isRunning ? (
          /* Start button */
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.startButton, !canStart && { opacity: 0.5 }]}
              onPress={canStart ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                handleStart();
              } : undefined}
            >
              <Text style={styles.startButtonText}>START</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Enhanced controls for free runs */
          <View style={styles.structuredControls}>
            {/* Empty left side for symmetry */}
            <View style={styles.emptySideControl} />

            {/* Central Pause/Resume Button */}
            <TouchableOpacity
              style={styles.centralPauseButton}
              onPress={() => {
                const action = isPaused ? 'resumed' : 'paused';

                analytics.track({
                  name: 'workout_action',
                  properties: {
                    action: action,
                    workout_type: 'free_run',
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
            >
              <Text style={styles.startButtonText}>
                {isPaused ? 'RESUME' : 'PAUSE'}
              </Text>
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
                    <Text style={styles.metricValue}>{isMetric ? (finishedSummary!.distanceMeters / 1000).toFixed(2) : ((finishedSummary!.distanceMeters / 1000) * 0.621371).toFixed(2)}</Text>
                    <Text style={styles.metricUnit}>{isMetric ? 'KM' : 'MI'}</Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>TIME</Text>
                    <Text style={styles.metricValue}>{formatTime(finishedSummary!.durationSec)}</Text>
                  </View>
                  {!isGuidedWorkout && (
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
                  )}
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
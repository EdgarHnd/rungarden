import * as Location from 'expo-location';
import { EventEmitter } from 'expo-modules-core';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RunSummary {
  startDate: string;
  endDate: string;
  durationSec: number; // seconds elapsed
  distanceMeters: number;
  polyline: Coordinate[]; // raw coordinate list for now
}

// Enhanced workout step interface for structured workouts
export interface WorkoutStep {
  order: number;
  label: string;
  duration?: string; // "5 min", "60 sec", etc.
  distance?: number; // meters
  effort: string; // "easy", "moderate", "hard", etc.
  notes?: string;
}

// Current step state during guided workout
export interface CurrentStepState {
  step: WorkoutStep;
  stepIndex: number;
  totalSteps: number;
  stepElapsed: number; // seconds elapsed in current step
  stepDuration: number; // total seconds for this step
  isComplete: boolean;
}

// Convert duration string to seconds
function parseDurationToSeconds(duration: string): number {
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
}

/**
 * Enhanced run tracker that supports both simple runs and structured workouts.
 * For simple runs: tracks GPS, distance, and time
 * For structured workouts: adds step-by-step guidance with timers and transitions
 */
export function useRunTracker() {
  // Basic tracking state (existing functionality)
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [distance, setDistance] = useState(0); // metres
  const [elapsed, setElapsed] = useState(0); // seconds
  const [coords, setCoords] = useState<Coordinate[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null); // metres

  // Enhanced structured workout state
  const [workoutSteps, setWorkoutSteps] = useState<WorkoutStep[]>([]);
  const [currentStep, setCurrentStep] = useState<CurrentStepState | null>(null);
  const [isStructuredWorkout, setIsStructuredWorkout] = useState(false);

  const startTimeRef = useRef<Date | null>(null);
  const watchSubRef = useRef<Location.LocationSubscription | null>(null);
  const idleWatchRef = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LOCATION_TASK_NAME = 'run_location_task';

  // Simple event emitter to forward background points to hook
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locationEmitter: any = new EventEmitter({} as any);

  try {
    // Avoid redefining task in Fast Refresh
    // @ts-ignore
    if (!global.__locationTaskDefined) {
      TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
        if (error) {
          console.error('[RunTracker] Background task error', error);
          return;
        }
        const { locations } = data as any;
        if (locations && locations.length > 0) {
          locationEmitter.emit('loc', locations[0]);
        }
      });
      // @ts-ignore
      global.__locationTaskDefined = true;
    }
  } catch (e) {
    console.warn('[RunTracker] Failed to define background task', e);
  }

  /* ───────────────────────── start helpers */
  const haversine = (c1: Coordinate, c2: Coordinate) => {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371e3; // metres
    const φ1 = toRad(c1.latitude);
    const φ2 = toRad(c2.latitude);
    const Δφ = toRad(c2.latitude - c1.latitude);
    const Δλ = toRad(c2.longitude - c1.longitude);

    const a = Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // in metres
  };

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearStepTimer = () => {
    if (stepTimerRef.current !== null) {
      clearInterval(stepTimerRef.current);
      stepTimerRef.current = null;
    }
  };

  // ───────────────────────── permission + idle watch
  const ensurePermissionsAsync = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  };

  const startIdleWatcher = async () => {
    if (idleWatchRef.current) return;
    const granted = await ensurePermissionsAsync();
    if (!granted) return;

    idleWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000,
        distanceInterval: 0,
      },
      (loc) => {
        const acc = (loc.coords as any).accuracy;
        if (typeof acc === 'number') setAccuracy(acc);
      }
    );
  };

  const stopIdleWatcher = () => {
    idleWatchRef.current?.remove();
    idleWatchRef.current = null;
  };

  // ───────────────────────── structured workout helpers
  const initializeStructuredWorkout = (steps: WorkoutStep[]) => {
    if (steps.length === 0) {
      setIsStructuredWorkout(false);
      setWorkoutSteps([]);
      setCurrentStep(null);
      return;
    }

    setIsStructuredWorkout(true);
    setWorkoutSteps(steps);
    
    // Initialize first step
    const firstStep = steps[0];
    setCurrentStep({
      step: firstStep,
      stepIndex: 0,
      totalSteps: steps.length,
      stepElapsed: 0,
      stepDuration: firstStep.duration ? parseDurationToSeconds(firstStep.duration) : 300,
      isComplete: false,
    });
  };

  const advanceToNextStep = () => {
    if (!currentStep || !isStructuredWorkout) return;

    const nextIndex = currentStep.stepIndex + 1;
    
    if (nextIndex >= workoutSteps.length) {
      // Workout complete
      setCurrentStep({
        ...currentStep,
        isComplete: true,
      });
      return;
    }

    const nextStep = workoutSteps[nextIndex];
    setCurrentStep({
      step: nextStep,
      stepIndex: nextIndex,
      totalSteps: workoutSteps.length,
      stepElapsed: 0,
      stepDuration: nextStep.duration ? parseDurationToSeconds(nextStep.duration) : 300,
      isComplete: false,
    });
  };

  const startStepTimer = () => {
    if (!isStructuredWorkout) return;

    clearStepTimer();
    stepTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (!prev) return prev;
        
        const newElapsed = prev.stepElapsed + 1;
        
        // Check if step is complete
        if (newElapsed >= prev.stepDuration) {
          // Auto-advance to next step
          setTimeout(() => advanceToNextStep(), 100);
          return prev;
        }
        
        return {
          ...prev,
          stepElapsed: newElapsed,
        };
      });
    }, 1000);
  };

  // Start idle watcher on mount
  useEffect(() => {
    // Clean up lingering background location updates from previous sessions
    (async () => {
      const active = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (active) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
      }
    })();

    startIdleWatcher();
    return () => stopIdleWatcher();
  }, []);

  // Enhanced start function with optional structured workout support
  const start = useCallback(async (structuredWorkoutSteps?: WorkoutStep[]) => {
    if (isRunning) return;

    // Permissions
    const granted = await ensurePermissionsAsync();
    if (!granted) {
      throw new Error('Location permission not granted');
    }
    stopIdleWatcher();

    // Initialize workout mode
    if (structuredWorkoutSteps && structuredWorkoutSteps.length > 0) {
      initializeStructuredWorkout(structuredWorkoutSteps);
    } else {
      setIsStructuredWorkout(false);
      setWorkoutSteps([]);
      setCurrentStep(null);
    }

    // Init state
    watchSubRef.current?.remove();
    clearTimer();
    clearStepTimer();
    setCoords([]);
    setDistance(0);
    setElapsed(0);

    startTimeRef.current = new Date();
    setIsRunning(true);
    setIsPaused(false);

    // Run timer for elapsed seconds
    timerRef.current = setInterval(() => {
      setElapsed((sec) => sec + 1);
    }, 1000);

    // Start step timer for structured workouts
    if (structuredWorkoutSteps && structuredWorkoutSteps.length > 0) {
      startStepTimer();
    }

    // Watch location
    watchSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000, // ms
        distanceInterval: 5, // metres
        // Additional platform-specific fields can be added later if supported
      },
      (loc) => {
        const { latitude, longitude, accuracy: acc } = loc.coords as any;
        if (typeof acc === 'number') {
          setAccuracy(acc);
        }
        setCoords((prev) => {
          const next: Coordinate = { latitude, longitude };
          if (prev.length > 0) {
            const inc = haversine(prev[prev.length - 1], next);
            setDistance((d) => d + inc);
          }
          return [...prev, next];
        });
      }
    );

    // Start background updates for when app is in background/locked
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 5,
          timeInterval: 1000,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Blaze Running',
            notificationBody: 'Recording run...',
          },
        });
      }
    } catch (e) {
      console.warn('[RunTracker] Could not start background updates', e);
    }
  }, [isRunning]);

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return;
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    clearTimer();
    clearStepTimer();
    setIsPaused(true);
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
  }, [isRunning, isPaused]);

  const resume = useCallback(async () => {
    if (!isPaused) return;
    setIsPaused(false);

    // Resume timer
    timerRef.current = setInterval(() => {
      setElapsed((sec) => sec + 1);
    }, 1000);

    // Resume step timer for structured workouts
    if (isStructuredWorkout) {
      startStepTimer();
    }

    // Re-attach watcher
    watchSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (loc) => {
        const { latitude, longitude, accuracy: acc } = loc.coords as any;
        if (typeof acc === 'number') {
          setAccuracy(acc);
        }
        setCoords((prev) => {
          const next: Coordinate = { latitude, longitude };
          if (prev.length > 0) {
            const inc = haversine(prev[prev.length - 1], next);
            setDistance((d) => d + inc);
          }
          return [...prev, next];
        });
      }
    );

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Highest,
      distanceInterval: 5,
      timeInterval: 1000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Blaze Running',
        notificationBody: 'Recording run...',
      },
    }).catch(() => {});
  }, [isPaused, isStructuredWorkout]);

  const stop = useCallback((): RunSummary => {
    watchSubRef.current?.remove();
    watchSubRef.current = null;
    clearTimer();
    clearStepTimer();
    // resume idle gps watcher for status
    startIdleWatcher();
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});

    setIsRunning(false);
    setIsPaused(false);

    const endDate = new Date();
    const startDate = startTimeRef.current ?? endDate;

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      durationSec: elapsed,
      distanceMeters: Math.round(distance),
      polyline: coords,
    };
  }, [elapsed, distance, coords]);

  const reset = useCallback(() => {
    setCoords([]);
    setDistance(0);
    setElapsed(0);
    startTimeRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setIsStructuredWorkout(false);
    setWorkoutSteps([]);
    setCurrentStep(null);
    clearTimer();
    clearStepTimer();
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
  }, []);

  // Manual step advance for structured workouts (user can skip ahead)
  const skipToNextStep = useCallback(() => {
    if (!isStructuredWorkout || !currentStep) return;
    advanceToNextStep();
  }, [isStructuredWorkout, currentStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      watchSubRef.current?.remove();
      clearTimer();
      clearStepTimer();
      Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
    };
  }, []);

  // Listen for background location events
  useEffect(() => {
    const sub = locationEmitter.addListener('loc', (loc: Location.LocationObject) => {
      const { latitude, longitude, accuracy: acc } = loc.coords as any;
      if (typeof acc === 'number') setAccuracy(acc);
      const next: Coordinate = { latitude, longitude };
      setCoords((prev) => {
        if (prev.length > 0) {
          const inc = haversine(prev[prev.length - 1], next);
          setDistance((d) => d + inc);
        }
        return [...prev, next];
      });
    });
    return () => sub.remove();
  }, []);

  return {
    // Basic tracking (existing functionality)
    isRunning,
    isPaused,
    accuracy,
    distance,
    elapsed,
    coords,
    
    // Enhanced structured workout functionality
    isStructuredWorkout,
    currentStep,
    workoutSteps,
    
    // Control functions
    start, // now accepts optional WorkoutStep[] parameter
    pause,
    resume,
    stop,
    reset,
    skipToNextStep, // new function for structured workouts
  } as const;
} 
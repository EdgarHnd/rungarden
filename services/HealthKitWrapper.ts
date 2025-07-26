import { NativeModules, Platform } from 'react-native';
import type {
    HealthActivity,
    HealthInputOptions,
    HealthKitPermissions,
    HealthObserver,
    HealthPermission
} from 'react-native-health';

const { AppleHealthKit } = NativeModules;

// Define valid workout types according to the documentation
type WorkoutType = 'Walking' | 'StairClimbing' | 'Running' | 'Cycling' | 'Workout';

// Extend HealthInputOptions to include workout specific options
interface WorkoutInputOptions extends Omit<HealthInputOptions, 'type'> {
  type?: WorkoutType;
  anchor?: string;
}

interface HealthKitType {
  initHealthKit: (permissions: HealthKitPermissions, callback: (error: string) => void) => void;
  getAnchoredWorkouts: (options: WorkoutInputOptions, callback: (error: string, results: any) => void) => void;
  getDailyStepCountSamples: (options: HealthInputOptions, callback: (error: string, results: any) => void) => void;
  getDailyDistanceWalkingRunningSamples: (options: HealthInputOptions, callback: (error: string, results: any) => void) => void;
  /**
   * Returns the authorization status for a given permission constant.
   * 0 = NotDetermined, 1 = Denied, 2 = Authorized (matches AppleHealthKit docs)
   */
  getAuthStatus: (permission: HealthPermission, callback: (error: string, status: number) => void) => void;
  saveWorkout: (options: any, callback: (error: string, results: any) => void) => void;
  Constants: {
    Permissions: {
      Steps: HealthPermission;
      DistanceWalkingRunning: HealthPermission;
      ActiveEnergyBurned: HealthPermission;
      HeartRate: HealthPermission;
      Workout: HealthPermission;
    };
    Activities: {
      Running: HealthActivity;
      Walking: HealthActivity;
    };
    Observers: {
      Workout: HealthObserver;
    };
  };
}

// Only export functionality if on iOS platform
export const HealthKit: HealthKitType = Platform.OS !== 'ios' ? {} as HealthKitType : {
  initHealthKit: AppleHealthKit.initHealthKit,
  getAnchoredWorkouts: AppleHealthKit.getAnchoredWorkouts,
  getDailyStepCountSamples: AppleHealthKit.getDailyStepCountSamples,
  getDailyDistanceWalkingRunningSamples: AppleHealthKit.getDailyDistanceWalkingRunningSamples,
  getAuthStatus: AppleHealthKit.getAuthStatus,
  saveWorkout: AppleHealthKit.saveWorkout,
  
  Constants: {
    Permissions: {
      Steps: 'Steps',
      DistanceWalkingRunning: 'DistanceWalkingRunning',
      ActiveEnergyBurned: 'ActiveEnergyBurned',
      HeartRate: 'HeartRate',
      Workout: 'Workout',
    },
    Activities: {
      Running: 'Running',
      Walking: 'Walking'
    },
    Observers: {
      Workout: 'Workout'
    }
  }
} as HealthKitType;

// Re-export types from react-native-health
export type { HealthActivity, HealthInputOptions, HealthKitPermissions, HealthObserver, HealthPermission, WorkoutInputOptions, WorkoutType };


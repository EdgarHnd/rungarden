import { Platform } from 'react-native';
import { HealthInputOptions, HealthKit, HealthKitPermissions, WorkoutInputOptions, WorkoutType } from './HealthKitWrapper';

export interface RunningActivity {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number; // in minutes
  distance: number; // in meters
  calories: number;
  averageHeartRate?: number;
  workoutName?: string;
}

export interface HealthStats {
  totalDistance: number;
  totalWorkouts: number;
  averagePace: number; // min/km
  totalCalories: number;
}

class HealthService {
  private isInitialized = false;

  // Define the permissions we need for a running app
  private permissions: HealthKitPermissions = {
    permissions: {
      read: [
        HealthKit.Constants.Permissions.Steps,
        HealthKit.Constants.Permissions.DistanceWalkingRunning,
        HealthKit.Constants.Permissions.ActiveEnergyBurned,
        HealthKit.Constants.Permissions.HeartRate,
        HealthKit.Constants.Permissions.Workout,
      ],
      write: [
        HealthKit.Constants.Permissions.Steps,
        HealthKit.Constants.Permissions.DistanceWalkingRunning,
        HealthKit.Constants.Permissions.ActiveEnergyBurned,
        HealthKit.Constants.Permissions.Workout,
      ],
    },
  };

  /**
   * Initialize Apple HealthKit with required permissions
   */
  async initializeHealthKit(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // First check if HealthKit is available
      if (Platform.OS !== 'ios') {
        reject(new Error('HealthKit is only available on iOS'));
        return;
      }

      // Initialize HealthKit
      HealthKit.initHealthKit(this.permissions, (error: string) => {
        if (error) {
          console.log('[HealthService] Error initializing HealthKit:', error);
          reject(new Error(error));
          return;
        }

        console.log('[HealthService] HealthKit initialized successfully');
        this.isInitialized = true;
        resolve(true);
      });
    });
  }

  /**
   * Get running workouts from Apple Health using the Workout method
   */
  async getRunningActivities(days: number = 30): Promise<RunningActivity[]> {
    if (!this.isInitialized) {
      await this.initializeHealthKit();
    }

    return new Promise((resolve, reject) => {
      const endDate = new Date();
      const startDate = new Date(2025, 1, 1);
      //startDate.setDate(endDate.getDate() - days);

      // According to docs, we need to specify type as one of: ['Walking', 'StairClimbing', 'Running', 'Cycling', 'Workout']
      const options: WorkoutInputOptions = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        type: 'Workout' as WorkoutType // Explicitly type as WorkoutType
      };
      // Use getAnchoredWorkouts for workout data
      HealthKit.getAnchoredWorkouts(
        options,
        (error: any, results: { anchor: string; data: Array<{
          activityId: number;
          activityName: string;
          calories: number;
          distance: number;
          duration: number;
          start: string;
          end: string;
          sourceName: string;
          metadata?: any;
        }> }) => {
          if (error) {
            console.error('[HealthService] Error fetching workouts:', error);
            reject(new Error(error.message || error));
            return;
          }

          if (!results || !results.data || results.data.length === 0) {
            console.log('[HealthService] No workout data found');
            resolve([]);
            return;
          }

          // Log all activity names we receive
          const activityTypes = [...new Set(results.data.map(w => w.activityName))];

          // Filter for running and walking activities based on activityName
          const runningActivities = results.data
            .filter(
              (workout) => {
                const isMatch = 
                  workout.activityName.toLowerCase().includes('running') ||
                  workout.activityName.toLowerCase().includes('walking');
                if (!isMatch) {
                  console.log('[HealthService] Skipping activity:', workout.activityName);
                }
                return isMatch;
              }
            )
            .map((workout): RunningActivity => {
              const activity = {
                uuid: `${workout.start}_${workout.end}`,
                startDate: workout.start,
                endDate: workout.end,
                duration: Math.round(workout.duration / 60), // Convert seconds to minutes
                distance: Math.round(workout.distance * 1609.34), // Convert miles to meters
                calories: Math.round(workout.calories),
                workoutName: workout.activityName,
                // Note: averageHeartRate might not be available in the basic workout data
                averageHeartRate: undefined
              };
              console.log('[HealthService] Processed activity:', activity);
              return activity;
            });

          resolve(runningActivities);
        }
      );
    });
  }

  /**
   * Get daily step count for the last N days
   */
  async getDailySteps(days: number = 7): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initializeHealthKit();
    }

    return new Promise((resolve, reject) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      };

      HealthKit.getDailyStepCountSamples(
        options,
        (error: string, results: any[]) => {
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Get running distance for the last N days
   */
  async getDailyRunningDistance(days: number = 7): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initializeHealthKit();
    }

    return new Promise((resolve, reject) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const options: HealthInputOptions = {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      };

      HealthKit.getDailyDistanceWalkingRunningSamples(
        options,
        (error: string, results: any[]) => {
          if (error) {
            reject(new Error(error));
            return;
          }
          resolve(results);
        }
      );
    });
  }

  /**
   * Calculate health statistics from running activities
   */
  calculateHealthStats(activities: RunningActivity[]): HealthStats {
    if (activities.length === 0) {
      return {
        totalDistance: 0,
        totalWorkouts: 0,
        averagePace: 0,
        totalCalories: 0,
      };
    }

    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const totalCalories = activities.reduce((sum, activity) => sum + activity.calories, 0);
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0);

    // Calculate average pace in minutes per kilometer
    const averagePace = totalDistance > 0 ? (totalTime / (totalDistance / 1000)) : 0;

    return {
      totalDistance: Math.round(totalDistance),
      totalWorkouts: activities.length,
      averagePace: Math.round(averagePace * 10) / 10,
      totalCalories: Math.round(totalCalories),
    };
  }

  /**
   * Save a new workout to Apple Health
   */
  async saveRunningWorkout(
    startDate: Date,
    endDate: Date,
    distance: number, // in meters
    calories: number
  ): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initializeHealthKit();
    }

    return new Promise((resolve, reject) => {
      const workoutOptions = {
        type: HealthKit.Constants.Activities.Running,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        energyBurned: calories,
        distance: distance / 1000, // Convert meters to km
      };

      HealthKit.saveWorkout(workoutOptions, (error: string, result: any) => {
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve(true);
      });
    });
  }
}

export default new HealthService(); 
import { Doc } from '@/convex/_generated/dataModel';

// Base interface for workout steps
export interface WorkoutStep {
  order: number;
  label?: string;
  duration?: string;
  distance?: number;
  pace?: number;
  effort?: string;
  target?: string;
  notes?: string;
}

// Database type for planned workouts
export type DatabasePlannedWorkout = Doc<"plannedWorkouts"> & {
  // Enriched with workout details
  workout?: Doc<"workoutTemplates">;
};

// Generated activity type for simple schedules and defaults
export interface GeneratedActivity {
  scheduledDate: string;
  type: string;
  duration: string;
  description: string;
  target: string;
  status: 'scheduled' | 'completed' | 'skipped' | 'missed';
  distance: number;
  workoutId: any;
  workout: { type: string; steps?: any[] };
  isDefault?: boolean;
  isSimpleScheduleRun?: boolean;
  isSimpleScheduleRest?: boolean;
}

// Main discriminated union type
export type SuggestedActivity = DatabasePlannedWorkout | GeneratedActivity;

// Type guards
export function isDatabasePlannedWorkout(activity: SuggestedActivity | null | undefined): activity is DatabasePlannedWorkout {
  return activity != null && '_id' in activity;
}

export function isGeneratedActivity(activity: SuggestedActivity | null | undefined): activity is GeneratedActivity {
  return activity != null && !('_id' in activity);
}

// Helper functions for type-safe property access
export function getActivityType(activity: SuggestedActivity | null | undefined): string {
  if (!activity) return 'rest';
  
  if (isDatabasePlannedWorkout(activity)) {
    return activity.workout?.type || activity.workout?.subType || 'run';
  } else {
    return activity.type;
  }
}

export function getActivityDescription(activity: SuggestedActivity | null | undefined): string | undefined {
  if (!activity) return undefined;
  
  if (isDatabasePlannedWorkout(activity)) {
    return activity.workout?.description;
  } else {
    return activity.description;
  }
}

export function getActivityDuration(activity: SuggestedActivity | null | undefined): string | undefined {
  if (!activity) return undefined;
  
  if (isDatabasePlannedWorkout(activity)) {
    // Calculate duration from workout steps
    const steps = activity.workout?.steps;
    if (steps && steps.length > 0) {
      const totalMinutes = steps.reduce((sum: number, step: any) => {
        if (step.duration) {
          const match = step.duration.match(/(\d+)\s*min/);
          return sum + (match ? parseInt(match[1]) : 0);
        }
        return sum;
      }, 0);
      return totalMinutes > 0 ? `${totalMinutes} min` : undefined;
    }
    return undefined;
  } else {
    return activity.duration;
  }
}

export function getActivityDistance(activity: SuggestedActivity | null | undefined): number | undefined {
  if (!activity) return undefined;
  
  if (isDatabasePlannedWorkout(activity)) {
    // Calculate distance from workout steps
    const steps = activity.workout?.steps;
    if (steps && steps.length > 0) {
      const totalDistance = steps.reduce((sum: number, step: any) => {
        return sum + (step.distance || 0);
      }, 0);
      return totalDistance > 0 ? totalDistance : undefined;
    }
    return undefined;
  } else {
    return activity.distance > 0 ? activity.distance : undefined;
  }
}

export function isDefaultActivity(activity: SuggestedActivity | null | undefined): boolean {
  if (!activity) return false;
  
  if (isDatabasePlannedWorkout(activity)) {
    // Check if this is a default/system workout (you might need to add this field to schema)
    return false; // Database planned workouts are not default activities
  } else {
    return activity.isDefault === true;
  }
}

// Onboarding types for type safety between UI and sync hook
export type UserPath = 'true-beginner' | 'run-habit' | 'weight-loss' | 'race-ready';
export type CurrentAbility = 'none' | 'less1min' | '1to5min' | '5to15min' | '15to30min' | 'more30min';
export type MetricSystem = 'metric' | 'imperial';
export type Gender = 'female' | 'male' | 'other';
export type GoalDistance = '5K' | '10K' | 'just-run-more' | 'half-marathon' | 'marathon';
export type LongestDistance = 'never' | '1to2km' | '2to4km' | '5plusKm';

// Main onboarding data interface
export interface OnboardingData {
  firstName: string | null;
  lastName: string | null;
  mascotName: string | null;
  path: UserPath | null;
  currentAbility: CurrentAbility | null;
  daysPerWeek: number;
  preferredDays: string[];
  preferTimeOverDistance: boolean | null;
  metricSystem: MetricSystem | null;
  gender: Gender | null;
  age: number | null;
  pushNotificationsEnabled: boolean | null;
  weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
  hasRated: boolean | null; // Whether user completed the rating step
}

// Training profile data extracted from onboarding
export interface OnboardingTrainingProfileData {
  goalDistance?: GoalDistance;
  goalDate?: string;
  currentAbility: CurrentAbility | null;
  longestDistance: LongestDistance;
  daysPerWeek: number;
  preferredDays: string[];
  hasTreadmill: boolean;
  preferTimeOverDistance: boolean | null;
  pushNotificationsEnabled: boolean | null;
}

// User profile data extracted from onboarding
export interface OnboardingUserProfileData {
  firstName: string | null;
  lastName: string | null;
  mascotName: string | null;
  path: UserPath | null;
  metricSystem: MetricSystem | null;
  gender: Gender | null;
  age: number | null;
  weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
}

// Combined onboarding data structure for storage
export interface StoredOnboardingData {
  trainingProfile: OnboardingTrainingProfileData;
  userProfile: OnboardingUserProfileData;
} 
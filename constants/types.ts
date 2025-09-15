// Onboarding types for type safety between UI and sync hook
export type MetricSystem = 'metric' | 'imperial';
export type Gender = 'female' | 'male' | 'other';

// Simplified onboarding data interface - only what's actually collected from users
export interface OnboardingData {
  firstName: string | null;
  lastName: string | null;
  gender: Gender | null;
  age: number | null;
  metricSystem: MetricSystem | null;
  daysPerWeek: number;
  preferredDays: string[];
  pushNotificationsEnabled: boolean | null;
  weekStartDay: 0 | 1; // 0 = Sunday, 1 = Monday
  hasRated: boolean | null; // Whether user completed the rating step
} 
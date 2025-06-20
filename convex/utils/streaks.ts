// @deprecated This file contains daily streak utilities - Weekly streaks are now used exclusively
// Use convex/utils/streak.ts for weekly streak calculations instead

// Streak utilities - centralized streak calculation and milestone rewards
// DEPRECATED: Daily streaks replaced with weekly streaks

export interface StreakMilestone {
  days: number;
  freezes: number;
  message: string;
}

// @deprecated Daily streak milestones - use weekly milestones instead
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, freezes: 1, message: "7 day streak! Earned 1 streak freeze! 🧊" },
  { days: 14, freezes: 0, message: "14 day streak milestone! Amazing! 🏆" },
  { days: 30, freezes: 2, message: "30 day streak! Earned 2 streak freezes! 🧊🧊" },
  { days: 60, freezes: 0, message: "60 day streak milestone! Amazing! 🏆" },
  { days: 100, freezes: 3, message: "100 day streak! Earned 3 streak freezes! 🧊🧊🧊" },
  { days: 365, freezes: 0, message: "365 day streak milestone! Amazing! 🏆" },
];

// @deprecated Calculate daily streak progression - use weekly streak calculation instead
export function calculateStreakProgression(
  currentStreak: number,
  lastStreakDate: string | undefined,
  workoutDate: string,
  workoutType: string
): {
  newCurrentStreak: number;
  streakIncreased: boolean;
  shouldUpdate: boolean;
} {
  console.warn('Daily streak calculation is deprecated. Use weekly streak system from convex/utils/streak.ts instead.');
  
  // Return no change for backward compatibility
  return {
    newCurrentStreak: currentStreak,
    streakIncreased: false,
    shouldUpdate: false,
  };
}

// @deprecated Check for daily streak milestones - use weekly milestones instead
export function checkStreakMilestones(
  oldStreak: number,
  newStreak: number,
  currentFreezes: number
): {
  newFreezes: number;
  milestoneMessage?: string;
  freezesEarned: number;
} {
  console.warn('Daily streak milestones are deprecated. Use weekly streak system from convex/utils/streak.ts instead.');
  
  // Return no changes for backward compatibility
  return {
    newFreezes: currentFreezes,
    milestoneMessage: undefined,
    freezesEarned: 0,
  };
} 
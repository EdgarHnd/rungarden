// Streak utilities - centralized streak calculation and milestone rewards

export interface StreakMilestone {
  days: number;
  freezes: number;
  message: string;
}

// Streak milestones with rewards
export const STREAK_MILESTONES: StreakMilestone[] = [
  { days: 7, freezes: 1, message: "7 day streak! Earned 1 streak freeze! 🧊" },
  { days: 14, freezes: 0, message: "14 day streak milestone! Amazing! 🏆" },
  { days: 30, freezes: 2, message: "30 day streak! Earned 2 streak freezes! 🧊🧊" },
  { days: 60, freezes: 0, message: "60 day streak milestone! Amazing! 🏆" },
  { days: 100, freezes: 3, message: "100 day streak! Earned 3 streak freezes! 🧊🧊🧊" },
  { days: 365, freezes: 0, message: "365 day streak milestone! Amazing! 🏆" },
];

// Calculate streak progression
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
  // Only training days count toward streak
  if (workoutType === 'rest' || workoutType === 'cross-train') {
    return {
      newCurrentStreak: currentStreak,
      streakIncreased: false,
      shouldUpdate: false,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  
  // Only count workouts completed today or in the past
  if (workoutDate > today) {
    return {
      newCurrentStreak: currentStreak,
      streakIncreased: false,
      shouldUpdate: false,
    };
  }

  if (!lastStreakDate) {
    // First ever training day completed
    return {
      newCurrentStreak: 1,
      streakIncreased: true,
      shouldUpdate: true,
    };
  }

  const lastStreakDateTime = new Date(lastStreakDate).getTime();
  const workoutDateTime = new Date(workoutDate).getTime();
  const daysBetween = Math.floor((workoutDateTime - lastStreakDateTime) / (1000 * 60 * 60 * 24));

  if (daysBetween <= 3) { // Allow some flexibility for training plans
    return {
      newCurrentStreak: currentStreak + 1,
      streakIncreased: true,
      shouldUpdate: true,
    };
  } else {
    // Gap is too large, reset streak
    return {
      newCurrentStreak: 1,
      streakIncreased: false,
      shouldUpdate: true,
    };
  }
}

// Check for milestone rewards
export function checkStreakMilestones(
  oldStreak: number,
  newStreak: number,
  currentFreezes: number
): {
  newFreezes: number;
  milestoneMessage?: string;
  freezesEarned: number;
} {
  let newFreezes = currentFreezes;
  let milestoneMessage: string | undefined;

  for (const milestone of STREAK_MILESTONES) {
    if (newStreak >= milestone.days && oldStreak < milestone.days) {
      newFreezes += milestone.freezes;
      milestoneMessage = milestone.message;
      break;
    }
  }

  return {
    newFreezes,
    milestoneMessage,
    freezesEarned: newFreezes - currentFreezes,
  };
} 
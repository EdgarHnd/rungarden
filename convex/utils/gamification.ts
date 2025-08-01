// Gamification utilities - centralized XP, level, and coin calculations
import { WORKOUT_LIBRARY } from "../workoutLibrary";

// Calculate level from total XP
export function calculateLevelFromXP(totalXP: number): number {
  let level = 1;
  
  // Progressive XP requirements: level^2 * 250 XP
  while (getXPForLevel(level + 1) <= totalXP) {
    level++;
  }
  
  return level;
}

// XP required for each level (cumulative)
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(Math.pow(level - 1, 2) * 250);
}

// Fixed XP for runs (new system)
export const FIXED_RUN_XP = 500;

// Get XP for completing a run activity (fixed amount)
export function getRunXP(): number {
  return FIXED_RUN_XP;
}

// Get XP for completing a planned workout based on workout type
export function getPlannedWorkoutXP(workoutTemplate: any): number {
  // Return base run XP + workout-specific XP
  const baseRunXP = FIXED_RUN_XP; // 500 XP base for all runs
  const workoutBonusXP = workoutTemplate?.xp || 0; // Additional XP from workout library
  
  return baseRunXP + workoutBonusXP;
}

// Get XP from workout library by token
export function getWorkoutLibraryXP(token: string): number {
  const workout = WORKOUT_LIBRARY[token];
  return workout?.xp || 0;
}

// Calculate total XP from activities (new system)
export function calculateTotalXPFromActivities(activities: any[]): number {
  return activities.reduce((total, activity) => {
    return total + (activity.xpEarned || 0);
  }, 0);
}

// Convert distance to XP (legacy - for migration purposes)
export function distanceToXP(distanceMeters: number): number {
  return Math.floor(distanceMeters * 0.1);
}

// Calculate coins from total distance (10 coins per km)
export function calculateCoinsFromDistance(totalDistance: number): number {
  return Math.floor(totalDistance / 100); // 10 coins per kilometer
}

// Get XP progress for current level
export function getLevelProgress(totalXP: number): {
  currentLevel: number;
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercent: number;
} {
  const currentLevel = calculateLevelFromXP(totalXP);
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const progressInLevel = totalXP - currentLevelXP;
  const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
  
  return {
    currentLevel,
    currentLevelXP: progressInLevel,
    nextLevelXP: xpNeededForNextLevel,
    progressPercent: xpNeededForNextLevel > 0 ? (progressInLevel / xpNeededForNextLevel) * 100 : 100,
  };
}

// Check if user leveled up between old and new XP
export function checkLevelUp(oldXP: number, newXP: number): {
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
} {
  const oldLevel = calculateLevelFromXP(oldXP);
  const newLevel = calculateLevelFromXP(newXP);
  
  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
  };
} 
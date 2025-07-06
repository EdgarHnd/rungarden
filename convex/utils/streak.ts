import { DatabaseReader, DatabaseWriter } from "../_generated/server";

// Helper function to get week start date based on user preference  
function getWeekStart(date: Date, weekStartDay: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let diff;
  if (weekStartDay === 1) { // Monday start
    diff = day === 0 ? 6 : day - 1;
  } else { // Sunday start
    diff = day;
  }

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Get the effective schedule for a specific week
function getScheduleForWeek(weekStartDate: string, scheduleHistory: any[]): any | null {
  // Find the most recent schedule entry that was effective for this week
  const effectiveSchedules = scheduleHistory
    .filter(h => h.effectiveFromDate <= weekStartDate)
    .sort((a, b) => b.effectiveFromDate.localeCompare(a.effectiveFromDate));
  
  return effectiveSchedules[0] || null;
}

// Count unique run days in a week
function countRunDaysInWeek(activities: any[], weekStartDate: string): number {
  const weekStart = new Date(weekStartDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const weekStartISO = weekStart.toISOString().split('T')[0];
  const weekEndISO = weekEnd.toISOString().split('T')[0];
  
  const runDays = new Set<string>();
  
  activities.forEach(activity => {
    const activityDate = activity.startDate.split('T')[0];
    if (activityDate >= weekStartISO && activityDate <= weekEndISO) {
      runDays.add(activityDate);
    }
  });
  
  return runDays.size;
}

// Main streak recalculation function - now weekly-based
export async function recalcStreak(db: DatabaseReader & DatabaseWriter, userId: any, todayISO: string) {
  console.log("recalcStreak (weekly)", userId, todayISO);
  
  const profile = await db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (!profile) return;

  // Previously we required an active simple schedule; streak is now based solely on past runs, so this check is no longer needed.

  // Get all activities for this user
  const activities = await db
    .query("activities")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();

  const weekStartDay = profile.weekStartDay ?? 1; // Default to Monday
  const thisWeekStart = getWeekStart(new Date(todayISO), weekStartDay);
  const thisWeekStartISO = thisWeekStart.toISOString().split('T')[0];
  
  let streak = 0;
  let lastStreakWeek: string | undefined;
  let consecutiveMissedWeeks = 0;
  let currentWeekStart = new Date(thisWeekStart);
  let isFirstWeek = true;

  // Go back week by week from current week to calculate streak
  while (true) {
    const weekStartISO = currentWeekStart.toISOString().split('T')[0];
    
    // No schedule start-date restriction — past runs count towards streak

    // Count run days in this week
    const runDaysInWeek = countRunDaysInWeek(activities, weekStartISO);
    // Streak requirement: at least 1 run in the week
    const goalMet = runDaysInWeek >= 1;

    if (goalMet) {
      // Goal met - extend streak
      streak++;
      if (isFirstWeek) {
        consecutiveMissedWeeks = 0; // Current week goal is met, no missed weeks
      }
      if (!lastStreakWeek) {
        lastStreakWeek = weekStartISO;
      }
    } else {
      // Goal missed - only count as missed if it's not the current week
      if (!isFirstWeek) {
        consecutiveMissedWeeks++;
      }
      break; // Streak is broken
    }

    // Move to previous week
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    isFirstWeek = false;
    
    // Safety check to prevent infinite loops
    if (streak > 520) { // More than 10 years seems unreasonable
      break;
    }
  }

  // Calculate mascot health based on consecutive missed weeks from current week
  // Start with full health and reduce by consecutive missed weeks (max reduction of 4)
  const maxHealth = 4;
  const healthPenalty = Math.min(consecutiveMissedWeeks, maxHealth);
  const mascotHealth = Math.max(0, maxHealth - healthPenalty);

  // Update user profile with new streak and health data
  await db.patch(profile._id, {
    currentStreak: streak,
    longestStreak: Math.max(streak, profile.longestStreak ?? 0),
    lastStreakWeek: lastStreakWeek ?? profile.lastStreakWeek,
    mascotHealth: mascotHealth,
  });

  console.log(`Updated streak: ${streak}, health: ${mascotHealth} (${consecutiveMissedWeeks} consecutive missed weeks)`);
}

// Helper function to restore mascot health (when user hits weekly goals)
export async function restoreMascotHealth(db: DatabaseReader & DatabaseWriter, userId: any) {
  const profile = await db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  
  if (!profile) return;

  // Restore 1 health point when weekly goal is met (max 4)
  const newHealth = Math.min(4, (profile.mascotHealth ?? 0) + 1);
  
  await db.patch(profile._id, {
    mascotHealth: newHealth,
  });

  console.log(`Restored mascot health to: ${newHealth}`);
} 
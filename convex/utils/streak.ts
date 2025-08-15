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
    // Ignore rest activities when counting toward weekly streak
    if (activity.type === 'rest') return;
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
  let consecutiveMissedWeeks = 0; // Missed weeks excluding the current one (for health calculations)
  let missedWeeksInRow = 0;       // Tracks consecutive missed weeks starting from the current week
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
      // Goal met – extend streak and reset missed counter
      streak++;
      missedWeeksInRow = 0;
      if (!lastStreakWeek) {
        lastStreakWeek = weekStartISO;
      }
    } else {
      // Goal missed
      missedWeeksInRow++;

      // Only count towards health penalty if it's not the current week
      if (!isFirstWeek) {
        consecutiveMissedWeeks++;
      }

      // Break the streak only after TWO consecutive missed weeks (current week + previous)
      if (missedWeeksInRow >= 2) {
        break;
      }
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
  // ────────────────────────────────────────────────
  // Mascot health calculation
  // Remove 1 HP for each **previous** week in a row where no run was logged.
  // We purposely ignore the *current* week so users get a chance to save Blaze
  // before Sunday night. Health can drop a maximum of 4 → 0.
  const maxHealth = 4;

  // Fetch schedule history (goal requirements) once
  const scheduleHistory = await db
    .query("scheduleHistory")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId))
    .collect();

  // Start health at 4 hearts and iterate over each week (including current)
  let mascotHealth = 4;

  let weekPtr = new Date(thisWeekStart); // current week first

  // Iterate back until we have no more schedule history or the loop is excessive
  for (let w = 0; w < 520; w++) {
    const weekISO = weekPtr.toISOString().split("T")[0];

    const schedule = getScheduleForWeek(weekISO, scheduleHistory);
    if (!schedule) {
      // No schedule yet → stop evaluating older weeks
      break;
    }

    const runDays = countRunDaysInWeek(activities, weekISO);
    const goalMet = runDays >= schedule.runsPerWeek;

    if (goalMet) {
      mascotHealth = Math.min(maxHealth, mascotHealth + 1);
    } else {
      mascotHealth = Math.max(0, mascotHealth - 1);
    }

    // Move one week back
    weekPtr.setDate(weekPtr.getDate() - 7);
  }
   
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
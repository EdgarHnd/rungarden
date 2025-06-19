import { DatabaseReader, DatabaseWriter } from "../_generated/server";

export async function recalcStreak(db: DatabaseReader & DatabaseWriter, userId: any, todayISO: string) {
  console.log("recalcStreak", userId, todayISO);
  const profile = await db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (!profile) return;

  // Get all planned workouts up to today
  const planned = await db
    .query("plannedWorkouts")
    .withIndex("by_user_date", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.lte(q.field("scheduledDate"), todayISO))
    .collect();

  // Get all activities up to today
  const activities = await db
    .query("activities")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .filter((q: any) => q.lte(q.field("startDate"), todayISO))
    .collect();

  // Create a map of dates to activities
  const activityMap = new Map<string, any[]>();
  activities.forEach((activity: any) => {
    const activityDate = activity.startDate.split('T')[0]; // Extract date part
    if (!activityMap.has(activityDate)) {
      activityMap.set(activityDate, []);
    }
    activityMap.get(activityDate)!.push(activity);
  });

  // Create a map of dates to planned workouts
  const plannedMap = new Map<string, any>();
  planned.forEach((pw: any) => {
    plannedMap.set(pw.scheduledDate, pw);
  });

  // Get all unique dates (both planned and activity dates) and sort them newest to oldest
  const allDates = new Set<string>();
  planned.forEach((pw: any) => allDates.add(pw.scheduledDate));
  activities.forEach((activity: any) => {
    const activityDate = activity.startDate.split('T')[0];
    allDates.add(activityDate);
  });

  const sortedDates = Array.from(allDates)
    .filter(date => date <= todayISO)
    .sort((a, b) => b.localeCompare(a)); // newest first

  let streak = 0;
  let lastCompletedDate: string | undefined;

  for (const date of sortedDates) {
    const plannedWorkout = plannedMap.get(date);
    const dayActivities = activityMap.get(date) || [];
    
    // Check if this day should break the streak
    if (plannedWorkout?.status === "missed") {
      break; // Only "missed" planned workouts break the streak
    }

    // Check if this day counts toward the streak
    const hasActivity = dayActivities.length > 0;
    const isCompletedWorkout = plannedWorkout?.status === "completed";
    
    if (hasActivity || isCompletedWorkout) {
      streak += 1;
      if (!lastCompletedDate) {
        lastCompletedDate = date;
      }
    }
    // If no activity and no completed workout, but also no "missed" status, 
    // we don't break the streak but don't extend it either
  }

  await db.patch(profile._id, {
    currentStreak: streak,
    longestStreak: Math.max(streak, profile.longestStreak ?? 0),
    lastStreakDate: lastCompletedDate ?? profile.lastStreakDate,
  });
} 
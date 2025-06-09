import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Official Couch to 5K Weekly Programs (3 workouts per week)
const C25K_WEEKLY_PROGRAMS = [
  // Week 1: Alternate 60s jog, 90s walk for 20 minutes
  { 
    week: 1,
    workouts: [
      {
        totalMinutes: 25,
        description: "5min warmup walk, then alternate 60 seconds jogging and 90 seconds walking for 20 minutes",
        workoutTag: "c25k-week1"
      },
      {
        totalMinutes: 25,
        description: "5min warmup walk, then alternate 60 seconds jogging and 90 seconds walking for 20 minutes",
        workoutTag: "c25k-week1"
      },
      {
        totalMinutes: 25,
        description: "5min warmup walk, then alternate 60 seconds jogging and 90 seconds walking for 20 minutes",
        workoutTag: "c25k-week1"
      }
    ]
  },
  // Week 2: Alternate 90s jog, 2min walk for 20 minutes
  { 
    week: 2,
    workouts: [
      {
        totalMinutes: 26,
        description: "5min warmup walk, then alternate 90 seconds jogging and 2 minutes walking for 20 minutes",
        workoutTag: "c25k-week2"
      },
      {
        totalMinutes: 26,
        description: "5min warmup walk, then alternate 90 seconds jogging and 2 minutes walking for 20 minutes",
        workoutTag: "c25k-week2"
      },
      {
        totalMinutes: 26,
        description: "5min warmup walk, then alternate 90 seconds jogging and 2 minutes walking for 20 minutes",
        workoutTag: "c25k-week2"
      }
    ]
  },
  // Week 3: Two repetitions of (90s jog, 90s walk, 3min jog, 3min walk)
  { 
    week: 3,
    workouts: [
      {
        totalMinutes: 23,
        description: "5min warmup walk, then do two repetitions: 90s jog, 90s walk, 3min jog, 3min walk",
        workoutTag: "c25k-week3"
      },
      {
        totalMinutes: 23,
        description: "5min warmup walk, then do two repetitions: 90s jog, 90s walk, 3min jog, 3min walk",
        workoutTag: "c25k-week3"
      },
      {
        totalMinutes: 23,
        description: "5min warmup walk, then do two repetitions: 90s jog, 90s walk, 3min jog, 3min walk",
        workoutTag: "c25k-week3"
      }
    ]
  },
  // Week 4: Complex interval pattern
  { 
    week: 4,
    workouts: [
      {
        totalMinutes: 27,
        description: "5min warmup walk, then: 3min jog, 90s walk, 5min jog, 2.5min walk, 3min jog, 90s walk, 5min jog",
        workoutTag: "c25k-week4"
      },
      {
        totalMinutes: 27,
        description: "5min warmup walk, then: 3min jog, 90s walk, 5min jog, 2.5min walk, 3min jog, 90s walk, 5min jog",
        workoutTag: "c25k-week4"
      },
      {
        totalMinutes: 27,
        description: "5min warmup walk, then: 3min jog, 90s walk, 5min jog, 2.5min walk, 3min jog, 90s walk, 5min jog",
        workoutTag: "c25k-week4"
      }
    ]
  },
  // Week 5: Three different workout patterns
  { 
    week: 5,
    workouts: [
      {
        totalMinutes: 26,
        description: "5min warmup walk, then: 5min jog, 3min walk, 5min jog, 3min walk, 5min jog",
        workoutTag: "c25k-week5a"
      },
      {
        totalMinutes: 26,
        description: "5min warmup walk, then: 8min jog, 5min walk, 8min jog",
        workoutTag: "c25k-week5b"
      },
      {
        totalMinutes: 25,
        description: "5min warmup walk, then jog for 20 minutes with no walking",
        workoutTag: "c25k-week5c"
      }
    ]
  },
  // Week 6: Three different workout patterns
  { 
    week: 6,
    workouts: [
      {
        totalMinutes: 29,
        description: "5min warmup walk, then: 5min jog, 3min walk, 8min jog, 3min walk, 5min jog",
        workoutTag: "c25k-week6a"
      },
      {
        totalMinutes: 28,
        description: "5min warmup walk, then: 10min jog, 3min walk, 10min jog",
        workoutTag: "c25k-week6b"
      },
      {
        totalMinutes: 30,
        description: "5min warmup walk, then jog 25 minutes with no walking",
        workoutTag: "c25k-week6c"
      }
    ]
  },
  // Week 7: 25 minute continuous runs
  { 
    week: 7,
    workouts: [
      {
        totalMinutes: 30,
        description: "5min warmup walk, then jog 25 minutes continuously",
        workoutTag: "c25k-week7"
      },
      {
        totalMinutes: 30,
        description: "5min warmup walk, then jog 25 minutes continuously",
        workoutTag: "c25k-week7"
      },
      {
        totalMinutes: 30,
        description: "5min warmup walk, then jog 25 minutes continuously",
        workoutTag: "c25k-week7"
      }
    ]
  },
  // Week 8: 28 minute continuous runs
  { 
    week: 8,
    workouts: [
      {
        totalMinutes: 33,
        description: "5min warmup walk, then jog 28 minutes continuously",
        workoutTag: "c25k-week8"
      },
      {
        totalMinutes: 33,
        description: "5min warmup walk, then jog 28 minutes continuously",
        workoutTag: "c25k-week8"
      },
      {
        totalMinutes: 33,
        description: "5min warmup walk, then jog 28 minutes continuously",
        workoutTag: "c25k-week8"
      }
    ]
  },
  // Week 9: 30 minute continuous runs - 5K achieved!
  { 
    week: 9,
    workouts: [
      {
        totalMinutes: 35,
        description: "5min warmup walk, then jog 30 minutes continuously",
        workoutTag: "c25k-week9"
      },
      {
        totalMinutes: 35,
        description: "5min warmup walk, then jog 30 minutes continuously",
        workoutTag: "c25k-week9"
      },
      {
        totalMinutes: 35,
        description: "The final workout! 5min warmup walk, then jog 30 minutes - Congratulations!",
        workoutTag: "c25k-week9-final"
      }
    ]
  }
];

// Minimum weeks for each goal/level combination
const MIN_WEEKS = {
  "5K": { "true-beginner": 8, "novice": 6, "intermediate": 4, "advanced": 4 },
  "10K": { "true-beginner": 12, "novice": 10, "intermediate": 8, "advanced": 6 },
  "half-marathon": { "true-beginner": 16, "novice": 14, "intermediate": 12, "advanced": 10 },
  "marathon": { "true-beginner": 20, "novice": 18, "intermediate": 16, "advanced": 14 },
  "just-run-more": { "true-beginner": 8, "novice": 6, "intermediate": 4, "advanced": 4 }
};

// Base weekly km for each goal/level
const BASE_WEEKLY_KM = {
  "5K": { "true-beginner": 8, "novice": 12, "intermediate": 16, "advanced": 20 },
  "10K": { "true-beginner": 12, "novice": 18, "intermediate": 24, "advanced": 30 },
  "half-marathon": { "true-beginner": 16, "novice": 25, "intermediate": 35, "advanced": 45 },
  "marathon": { "true-beginner": 20, "novice": 32, "intermediate": 48, "advanced": 64 },
  "just-run-more": { "true-beginner": 6, "novice": 10, "intermediate": 15, "advanced": 20 }
};

// Quality days per week based on fitness level
const QUALITY_DAYS = {
  "true-beginner": 0,
  "novice": 1,
  "intermediate": 2,
  "advanced": 3
};

// 10K Training Configurations by Fitness Level
const TEN_K_CONFIGS = {
  "true-beginner": {
    weeks: 8,
    description: "Bridge from 5K to 10K",
    periodization: { base: 0.50, build: 0.35, peak: 0.15, taper: 0.00 }, // No real taper for beginners
    weeklyKmProgression: [10, 12, 14, 16, 18, 16, 20, 18], // Progressive with recovery
    workoutFocus: ["easy", "easy", "10k-threshold", "10k-long-run"], // Build to threshold work
    qualityProgression: [0, 0, 1, 1, 1, 1, 1, 1] // Add quality work gradually
  },
  "novice": {
    weeks: 10,
    description: "10K-focused training with threshold emphasis",
    periodization: { base: 0.40, build: 0.35, peak: 0.20, taper: 0.05 },
    workoutFocus: ["easy", "10k-threshold", "10k-long-run"],
    primaryWorkouts: ["10k-threshold", "10k-1200m-repeats", "10k-fartlek"]
  },
  "intermediate": {
    weeks: 12,
    description: "Advanced 10K training with varied stimulus",
    periodization: { base: 0.35, build: 0.35, peak: 0.25, taper: 0.05 },
    workoutFocus: ["easy", "10k-threshold", "10k-progressive", "10k-long-run"],
    primaryWorkouts: ["10k-threshold", "10k-mile-repeats", "10k-progressive", "10k-1200m-repeats"]
  },
  "advanced": {
    weeks: 12,
    description: "High-intensity 10K training",
    periodization: { base: 0.30, build: 0.35, peak: 0.30, taper: 0.05 },
    workoutFocus: ["easy", "10k-threshold", "10k-mile-repeats", "10k-progressive", "10k-long-run"],
    primaryWorkouts: ["10k-threshold", "10k-mile-repeats", "10k-progressive", "intervals"]
  }
};

// Helper functions
function weeksBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.max(diffWeeks, 1);
}

function calculateWeeksToGoal(startDate: string, goalDate: string, weekStartDay: number): number {
  const start = new Date(startDate);
  const goal = new Date(goalDate);
  
  // Get the start of the training week
  const weekStart = getWeekStart(start, weekStartDay);
  
  // Calculate how many weeks we need so that the goal date falls within a training week
  let weeks = 0;
  let currentWeekStart = new Date(weekStart);
  currentWeekStart.setDate(weekStart.getDate() + 7); // Start from next week
  
  while (true) {
    weeks++;
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(currentWeekStart.getDate() + 6); // End of week (6 days later)
    
    // If the goal date falls within this week, we're done
    if (goal >= currentWeekStart && goal <= weekEnd) {
      break;
    }
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    
    // Safety check to prevent infinite loop
    if (weeks > 52) {
      break;
    }
  }
  
  return Math.max(weeks, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function allocateBlocks(totalWeeks: number, blockPct: Record<string, number>) {
  const base = Math.floor(totalWeeks * blockPct.base);
  const build = Math.floor(totalWeeks * blockPct.build);
  const peak = Math.floor(totalWeeks * blockPct.peak);
  const taper = totalWeeks - base - build - peak; // Remaining weeks go to taper
  
  return [
    Math.max(base, 2),   // At least 2 weeks base
    Math.max(build, 1),  // At least 1 week build
    Math.max(peak, 1),   // At least 1 week peak
    Math.max(taper, 1)   // At least 1 week taper
  ];
}

function getWorkoutPattern(
  microCycle: string, 
  daysPerWeek: number, 
  qualityDays: number,
  fitnessLevel: string
): string[] {
  const patterns: Record<number, string[]> = {
    2: ["E", "LR"],
    3: ["E", "Q", "LR"],
    4: ["E", "Rest", "Q", "LR"],
    5: ["E", "Rest", "Q", "E", "LR"],
    6: ["E", "Rest", "Q", "E", "Rest", "LR"]
  };

  let pattern = patterns[daysPerWeek] || patterns[3];

  // Adjust for beginner levels
  if (fitnessLevel === "true-beginner") {
    pattern = pattern.map(day => {
      if (day === "Q") return "E"; // Replace quality with easy run for beginners
      if (day === "E") return "RW"; // Easy runs become run-walk
      return day;
    });
  } else if (fitnessLevel === "novice" && daysPerWeek === 3) {
    // For novice 3-day plans, replace quality with easy run
    pattern = pattern.map(day => day === "Q" ? "E" : day);
  }

  // Add cross-training for higher volumes
  if (daysPerWeek >= 5 && microCycle !== "taper") {
    const restIndex = pattern.indexOf("Rest");
    if (restIndex > 0) {
      pattern[restIndex] = "X"; // Replace one rest with cross-training
    }
  }

  return pattern;
}

function distributeWeeklyDistance(
  weeklyKm: number, 
  pattern: string[]
): number[] {
  const longRunPct = 0.3; // 30% of weekly distance
  const qualityPct = 0.2; // 20% for quality days
  const easyPct = 0.5; // 50% for easy days

  const longRunKm = weeklyKm * longRunPct;
  const runningDays = pattern.filter(p => p !== "Rest" && p !== "X").length;
  const qualityDays = pattern.filter(p => p === "Q").length;
  const easyDays = pattern.filter(p => p === "E" || p === "RW").length;

  const qualityKm = qualityDays > 0 ? (weeklyKm * qualityPct) / qualityDays : 0;
  const easyKm = easyDays > 0 ? (weeklyKm * easyPct) / easyDays : 0;

  return pattern.map(day => {
    switch (day) {
      case "LR": return longRunKm;
      case "Q": return qualityKm;
      case "E":
      case "RW": return easyKm;
      case "X": return easyKm * 0.8; // Cross-training slightly less
      default: return 0; // Rest days
    }
  });
}

async function selectWorkout(
  ctx: any,
  workoutType: string,
  fitnessLevel: string,
  goalDistance: string
) {
  const levelMap = {
    "true-beginner": 0,
    "novice": 1,
    "intermediate": 2,
    "advanced": 3
  };

  const userLevel = levelMap[fitnessLevel as keyof typeof levelMap];
  
  const workouts = await ctx.db
    .query("workouts")
    .withIndex("by_tag", (q: any) => q.eq("tag", workoutType))
    .filter((q: any) => q.lte(q.field("levelMin"), userLevel))
    .filter((q: any) => q.or(
      q.eq(q.field("levelMax"), undefined),
      q.gte(q.field("levelMax"), userLevel)
    ))
    .collect();

  // Return the first suitable workout, or null if none found
  return workouts.length > 0 ? workouts[0] : null;
}

function buildDayWorkout(
  workoutType: string,
  distanceKm: number,
  preferTimeOverDistance: boolean,
  date: string,
  workout: any
) {
  const baseDescriptions: Record<string, string> = {
    "E": "Easy run at conversational pace",
    "RW": "Run-walk intervals to build endurance",
    "Q": "Quality workout to improve speed/strength",
    "LR": "Long run to build endurance",
    "X": "Cross-training for active recovery",
    "Rest": "Rest day - gentle stretching or complete rest"
  };

  let duration: string | undefined;
  let distance: number | undefined;
  let description = workout?.description || baseDescriptions[workoutType] || "Training workout";

  if (workoutType === "Rest") {
    return {
      date,
      type: "rest",
      description: "Rest or gentle mobility work",
      duration: "As needed",
    };
  }

  if (preferTimeOverDistance) {
    // Convert km to approximate minutes (assuming 6-7 min/km pace for easy runs)
    const minutesPerKm = workoutType === "Q" ? 5 : workoutType === "LR" ? 7 : 6;
    duration = `${Math.round(distanceKm * minutesPerKm)} min`;
  } else {
    distance = Math.round(distanceKm * 1000); // Convert to meters
  }

  return {
    date,
    type: workoutType.toLowerCase(),
    duration,
    distance,
    description,
    workoutId: workout?._id,
    target: getTargetPace(workoutType)
  };
}

function getTargetPace(workoutType: string): string | undefined {
  const paceTargets: Record<string, string> = {
    "E": "Conversational pace",
    "RW": "Comfortable effort with walk breaks",
    "Q": "Comfortably hard to hard effort",
    "LR": "Easy to moderate effort",
    "X": "Moderate effort"
  };
  return paceTargets[workoutType];
}

// Helper function to get week start based on user preference
function getWeekStart(date: Date, weekStartDay: number) {
  // Create a new date in local timezone
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let diff;
  if (weekStartDay === 1) { // Monday start
    // For Monday start: Sunday=6 days back, Monday=0 days back, Tuesday=1 day back, etc.
    diff = day === 0 ? 6 : day - 1;
  } else { // Sunday start
    // For Sunday start: Sunday=0 days back, Monday=1 day back, Tuesday=2 days back, etc.
    diff = day;
  }

  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() - diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// 10K-specific helper functions
function get10KWorkoutPattern(
  microCycle: string, 
  daysPerWeek: number, 
  fitnessLevel: string, 
  weekNumber: number
): string[] {
  const basePatterns: Record<number, string[]> = {
    3: ["E", "Q", "LR"],           // Easy, Quality, Long Run
    4: ["E", "Q", "E", "LR"],      // Add recovery run
    5: ["E", "Q", "E", "Rest", "LR"], // Add rest day
    6: ["E", "Q", "E", "Q", "Rest", "LR"] // Two quality days for advanced
  };

  let pattern = basePatterns[daysPerWeek] || basePatterns[3];

  // Adjust pattern based on fitness level and training phase
  if (fitnessLevel === "true-beginner") {
    // True beginners: build aerobic base first, then add threshold work
    if (weekNumber <= 3) {
      pattern = pattern.map(day => day === "Q" ? "E" : day); // No quality work first 3 weeks
    } else {
      pattern = pattern.map(day => day === "Q" ? "10K-T" : day); // Add threshold work
    }
  } else if (fitnessLevel === "novice") {
    pattern = pattern.map(day => day === "Q" ? "10K-T" : day); // Focus on threshold
  } else if (fitnessLevel === "intermediate") {
    // Mix threshold and intervals
    pattern = pattern.map((day, index) => {
      if (day === "Q") {
        return microCycle === "peak" ? "10K-I" : "10K-T"; // Intervals in peak phase
      }
      return day;
    });
  } else { // advanced
    // Sophisticated periodization with varied quality work
    const qualityDays = pattern.filter(day => day === "Q");
    let qualityIndex = 0;
    pattern = pattern.map(day => {
      if (day === "Q") {
        qualityIndex++;
        if (microCycle === "base") return "10K-T";      // Threshold base
        if (microCycle === "build") return qualityIndex === 1 ? "10K-T" : "10K-P"; // Threshold + Progressive
        if (microCycle === "peak") return qualityIndex === 1 ? "10K-I" : "10K-T";  // Intervals + Threshold
        return "10K-T"; // Default to threshold
      }
      return day;
    });
  }

  return pattern;
}

function get10KWorkoutTag(workoutType: string, microCycle: string, fitnessLevel: string): string {
  // Map abstract workout types to specific 10K workout tags
  const workoutMap: Record<string, string> = {
    "E": "easy",
    "LR": "10k-long-run",
    "10K-T": "10k-threshold",       // Threshold/Tempo
    "10K-I": "10k-1200m-repeats",  // Intervals
    "10K-P": "10k-progressive",     // Progressive tempo
    "10K-F": "10k-fartlek",         // Fartlek
    "10K-M": "10k-mile-repeats",    // Mile repeats
    "Rest": "rest",
    "X": "cross-train"
  };

  return workoutMap[workoutType] || "easy";
}

// Helper function to schedule workouts on user's preferred days
async function scheduleWorkoutsOnPreferredDays(
  ctx: any,
  pattern: string[],
  weeklyDistances: number[],
  weekStartDate: Date,
  profile: any,
  dayNameToNumber: Record<string, number>
) {
  const dayWorkouts = [];
  
  // Map user's preferred days to day numbers and sort them
  const preferredDayNumbers = profile.preferredDays
    .map((day: string) => dayNameToNumber[day])
    .sort((a: number, b: number) => a - b); // Sort to maintain weekly order
  
  // Filter out rest days from the pattern and only schedule actual workouts
  const workoutTypes = pattern.filter(type => type !== "Rest");
  const workoutDistances = weeklyDistances.filter((_, index) => pattern[index] !== "Rest");
  
  for (let workoutIndex = 0; workoutIndex < workoutTypes.length; workoutIndex++) {
    const workoutType = workoutTypes[workoutIndex];
    const distanceKm = workoutDistances[workoutIndex];
    
    // Get the preferred day for this workout (cycle through preferred days)
    const preferredDayNumber = preferredDayNumbers[workoutIndex % preferredDayNumbers.length];
    
    // Calculate the specific date for this workout based on preferred day
    const workoutDate = new Date(weekStartDate);
    // Find the correct day in this week
    const daysFromMonday = (preferredDayNumber - 1 + 7) % 7; // Convert to days from Monday (Monday = 0)
    workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
    
    // If we have multiple workouts and they would fall on the same day, spread them out
    if (workoutIndex > 0 && preferredDayNumbers.length < workoutTypes.length) {
      // If we have more workouts than preferred days, distribute them evenly
      const daySpacing = Math.floor(7 / workoutTypes.length);
      const adjustedDay = (preferredDayNumber + (workoutIndex * daySpacing)) % 7;
      const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
      workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
    }
    
    const dateString = workoutDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Map to actual workout type for database lookup
    const workoutTag = {
      "E": "easy",
      "RW": "run-walk", 
      "Q": "tempo", // Could be intervals or tempo based on block
      "LR": "long",
      "X": "cross-train",
      "Rest": "rest"
    }[workoutType] || "easy";

    // Get workout from library
    const workout = await selectWorkout(
      ctx, workoutTag, profile.fitnessLevel, profile.goalDistance
    );

    const dayWorkout = buildDayWorkout(
      workoutType,
      distanceKm,
      profile.preferTimeOverDistance,
      dateString,
      workout
    );

    dayWorkouts.push(dayWorkout);
  }
  
  return dayWorkouts;
}

// Generate a complete training plan
export const generateTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get user's training profile
    const profile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Training profile not found. Complete onboarding first.");
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1; // Default to Monday if not set

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Calculate plan parameters - ensure race day falls within the last week
    const weeksToGoal = calculateWeeksToGoal(today, profile.goalDate, weekStartDay);
    const minWeeks = MIN_WEEKS[profile.goalDistance as keyof typeof MIN_WEEKS][profile.fitnessLevel];
    // Respect user's timeline, but ensure at least 2 weeks for any meaningful plan
    const weeks = Math.max(weeksToGoal, 2);
    const days = clamp(profile.daysPerWeek, 2, 6);

    // Deactivate any existing plans
    const existingPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }


    // Special case: Use Couch to 5 K for true-beginner 5K goals
    if (profile.goalDistance === "5K" && profile.fitnessLevel === "true-beginner") {
      const planWeeks = [];
      
      // Calculate start date 
      const startDate = new Date();
      const thisWeekStart = getWeekStart(startDate, weekStartDay);
      const nextWeekStart = new Date(thisWeekStart);
      nextWeekStart.setDate(thisWeekStart.getDate() + 7);

      // Use the user's available weeks, but cap at 9 for C25K (since that's how long the program is)
      const c25kWeeks = Math.min(weeks, 9);

      // Generate C25K weeks
      for (let weekNum = 1; weekNum <= c25kWeeks; weekNum++) {
        const c25kWeek = C25K_WEEKLY_PROGRAMS[weekNum - 1];
        const dayWorkouts: any[] = [];
        
        // 3 running days per week (use user's preferred days, default to Mon/Wed/Fri)
        const preferredDays = profile.preferredDays?.slice(0, 3) || ['Mon', 'Wed', 'Fri'];
        const dayNameToNumber: Record<string, number> = {
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
        };
        
        // Calculate this week's start date
        const weekStartDate = new Date(nextWeekStart);
        weekStartDate.setDate(nextWeekStart.getDate() + ((weekNum - 1) * 7));
        
        // Schedule C25K workouts on preferred days
        for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
          const preferredDay = preferredDays[dayIndex] || ['Mon', 'Wed', 'Fri'][dayIndex];
          const dayNumber = dayNameToNumber[preferredDay];
          const daysFromStart = (dayNumber - 1 + 7) % 7; // Days from Monday
          
          const workoutDate = new Date(weekStartDate);
          workoutDate.setDate(weekStartDate.getDate() + daysFromStart);
          
          // Get the specific workout for this day from the 3 workouts
          const c25kWorkout = c25kWeek.workouts[dayIndex];
          
          // Get the appropriate C25K workout from library
          const workout = await selectWorkout(ctx, c25kWorkout.workoutTag, "true-beginner", "5K");
          
          dayWorkouts.push({
            date: workoutDate.toISOString().split('T')[0],
            type: "run-walk",
            duration: `${c25kWorkout.totalMinutes} min`,
            description: workout?.description || c25kWorkout.description,
            target: "Follow C25K pace - don't go faster than comfortable",
            workoutId: workout?._id
          });
        }
        
        // Add optional easy walk/rest days if user wants more than 3 days per week
        if (profile.daysPerWeek > 3) {
          const additionalDays = Math.min(profile.daysPerWeek - 3, 2);
          const remainingDays = ['Tue', 'Thu', 'Sat', 'Sun'].filter(day => !preferredDays.includes(day));
          
          for (let i = 0; i < additionalDays && i < remainingDays.length; i++) {
            const restDay = remainingDays[i];
            const dayNumber = dayNameToNumber[restDay];
            const daysFromStart = (dayNumber - 1 + 7) % 7;
            
            const restDate = new Date(weekStartDate);
            restDate.setDate(weekStartDate.getDate() + daysFromStart);
            
            dayWorkouts.push({
              date: restDate.toISOString().split('T')[0],
              type: "rest",
              duration: "20-30 min",
              description: "Easy walk or gentle stretching",
              target: "Active recovery"
            });
          }
        }
        
        planWeeks.push({
          week: weekNum,
          microCycle: weekNum <= 3 ? "base" : weekNum <= 6 ? "build" : weekNum <= 8 ? "peak" : "taper" as any,
          days: dayWorkouts
        });
      }

      // Add race day to the last week if it's not already included
      if (c25kWeeks > 0) {
        const lastWeek = planWeeks[planWeeks.length - 1];
        const goalDate = new Date(profile.goalDate);
        const goalDateString = goalDate.toISOString().split('T')[0];
        
        // Check if race day already has a workout
        const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
        
        if (!hasRaceDay) {
          // Add race day workout
          lastWeek.days.push({
            date: goalDateString,
            type: "race",
            duration: "30 min",
            distance: 5000, // 5K race
            description: "5K Race Day - You've got this!",
            target: "Race pace - trust your training",
            workoutId: null
          });
        }
        
        // Ensure last week is set as taper
        lastWeek.microCycle = "taper";
      }

      // Create the C25K training plan
      const planId = await ctx.db.insert("trainingPlans", {
        userId,
        meta: {
          goal: profile.goalDistance,
          weeks: c25kWeeks,
          level: profile.fitnessLevel,
          daysPerWeek: profile.daysPerWeek,
          createdAt: now,
        },
        isActive: true,
        plan: planWeeks,
        createdAt: now,
        updatedAt: now,
      });

      // Generate planned workouts for the first 4 weeks
      await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

      return { planId, weeks: c25kWeeks, message: "C25K training plan generated successfully" };
    }

    // Special case: Use 10K-optimized training for 10K goals
    if (profile.goalDistance === "10K") {
      const tenKConfig = TEN_K_CONFIGS[profile.fitnessLevel as keyof typeof TEN_K_CONFIGS];
      const planWeeks = [];
      
      // Calculate start date 
      const startDate = new Date();
      const thisWeekStart = getWeekStart(startDate, weekStartDay);
      const nextWeekStart = new Date(thisWeekStart);
      nextWeekStart.setDate(thisWeekStart.getDate() + 7);

      // Use the user's available weeks (don't enforce config minimums)
      const tenKWeeks = weeks;

      // Use goal-specific periodization
      const blocks = allocateBlocks(tenKWeeks, tenKConfig.periodization);
      let currentWeek = 1;
      let weeklyKm = BASE_WEEKLY_KM["10K"][profile.fitnessLevel];
      
      const microCycles = ["base", "build", "peak", "taper"];
      const dayNameToNumber: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const blockLength = blocks[blockIndex];
        const microCycle = microCycles[blockIndex];

        for (let weekInBlock = 0; weekInBlock < blockLength; weekInBlock++) {
          const dayWorkouts: any[] = [];
          
          // Calculate this week's start date
          const weekStartDate = new Date(nextWeekStart);
          weekStartDate.setDate(nextWeekStart.getDate() + ((currentWeek - 1) * 7));
          
          // Get 10K-specific workout pattern
          let pattern = get10KWorkoutPattern(microCycle, profile.daysPerWeek, profile.fitnessLevel, currentWeek);
          const weeklyDistances = distributeWeeklyDistance(weeklyKm, pattern);
          
          // Schedule workouts on preferred days
          const workoutTypes = pattern.filter(type => type !== "Rest");
          const workoutDistances = weeklyDistances.filter((_, index) => pattern[index] !== "Rest");
          
          for (let workoutIndex = 0; workoutIndex < workoutTypes.length; workoutIndex++) {
            const workoutType = workoutTypes[workoutIndex];
            const distanceKm = workoutDistances[workoutIndex];
            
            // Calculate workout date
            const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
            const preferredDayNumbers = preferredDays.map((day: string) => dayNameToNumber[day]);
            const preferredDayNumber = preferredDayNumbers[workoutIndex % preferredDayNumbers.length];
            
            const workoutDate = new Date(weekStartDate);
            const daysFromMonday = (preferredDayNumber - 1 + 7) % 7;
            workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
            
            // Spread workouts if needed
            if (workoutIndex > 0 && preferredDayNumbers.length < workoutTypes.length) {
              const daySpacing = Math.floor(7 / workoutTypes.length);
              const adjustedDay = (preferredDayNumber + (workoutIndex * daySpacing)) % 7;
              const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
              workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
            }
            
            const dateString = workoutDate.toISOString().split('T')[0];
            
            // Select 10K-specific workout
            const workoutTag = get10KWorkoutTag(workoutType, microCycle, profile.fitnessLevel);
            const workout = await selectWorkout(ctx, workoutTag, profile.fitnessLevel, "10K");
            
            const dayWorkout = buildDayWorkout(
              workoutType,
              distanceKm,
              profile.preferTimeOverDistance,
              dateString,
              workout
            );

            dayWorkouts.push(dayWorkout);
          }
          
          planWeeks.push({
            week: currentWeek,
            microCycle: microCycle as "base" | "build" | "peak" | "taper",
            days: dayWorkouts
          });

          currentWeek++;

          // 10K-specific volume progression
          if (microCycle !== "taper") {
            weeklyKm *= (currentWeek % 4 === 0) ? 0.90 : 1.06; // More conservative progression for 10K
          } else {
            weeklyKm *= 0.80; // Sharper taper for 10K
          }
        }
      }

      // Add race day to the last week if it's not already included
      if (tenKWeeks > 0) {
        const lastWeek = planWeeks[planWeeks.length - 1];
        const goalDate = new Date(profile.goalDate);
        const goalDateString = goalDate.toISOString().split('T')[0];
        
        // Check if race day already has a workout
        const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
        
        if (!hasRaceDay) {
          // Add race day workout
          lastWeek.days.push({
            date: goalDateString,
            type: "race",
            duration: "45-50 min",
            distance: 10000, // 10K race
            description: "10K Race Day - Go for it!",
            target: "Race pace - trust your training",
            workoutId: null
          });
        }
        
        // Ensure last week is set as taper
        lastWeek.microCycle = "taper";
      }

      // Create the 10K training plan
      const planId = await ctx.db.insert("trainingPlans", {
        userId,
        meta: {
          goal: profile.goalDistance,
          weeks: tenKWeeks,
          level: profile.fitnessLevel,
          daysPerWeek: profile.daysPerWeek,
          createdAt: now,
        },
        isActive: true,
        plan: planWeeks,
        createdAt: now,
        updatedAt: now,
      });

      // Generate planned workouts for the first 4 weeks
      await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

      return { planId, weeks: tenKWeeks, message: "10K training plan generated successfully" };
    }

    // Calculate macrocycle blocks
    const blockPct = { base: 0.40, build: 0.30, peak: 0.20, taper: 0.10 };
    const blocks = allocateBlocks(weeks, blockPct);

    // Generate weekly plan
    let weeklyKm = BASE_WEEKLY_KM[profile.goalDistance as keyof typeof BASE_WEEKLY_KM][profile.fitnessLevel];
    const qualityDays = QUALITY_DAYS[profile.fitnessLevel];
    
    const planWeeks = [];
    let currentWeek = 1;

    // Calculate start date based on user's preferred days
    const startDate = new Date();
    // Find the next occurrence of the user's first preferred day
    const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
    const dayNameToNumber: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    
    // Start from the next week based on user's week start preference
    const thisWeekStart = getWeekStart(startDate, weekStartDay);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);

    const microCycles = ["base", "build", "peak", "taper"];
    
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const blockLength = blocks[blockIndex];
      const microCycle = microCycles[blockIndex];

      for (let weekInBlock = 0; weekInBlock < blockLength; weekInBlock++) {
        const pattern = getWorkoutPattern(microCycle, days, qualityDays, profile.fitnessLevel);
        const weeklyDistances = distributeWeeklyDistance(weeklyKm, pattern);

        // Calculate the start date for this week
        const weekStartDate = new Date(nextWeekStart);
        weekStartDate.setDate(nextWeekStart.getDate() + ((currentWeek - 1) * 7));

        // Schedule workouts on user's preferred days
        const dayWorkouts = await scheduleWorkoutsOnPreferredDays(
          ctx,
          pattern,
          weeklyDistances,
          weekStartDate,
          profile,
          dayNameToNumber
        );

        planWeeks.push({
          week: currentWeek,
          microCycle: microCycle as "base" | "build" | "peak" | "taper",
          days: dayWorkouts
        });

        currentWeek++;

        // Progressive overload (except taper)
        if (microCycle !== "taper") {
          weeklyKm *= (currentWeek % 4 === 0) ? 0.92 : 1.08; // Recovery every 4th week
        } else {
          weeklyKm *= 0.85; // Reduce volume in taper
        }
      }
    }

    // Add race day to the last week if it's not already included
    if (weeks > 0) {
      const lastWeek = planWeeks[planWeeks.length - 1];
      const goalDate = new Date(profile.goalDate);
      const goalDateString = goalDate.toISOString().split('T')[0];
      
      // Check if race day already has a workout
      const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
      
      if (!hasRaceDay) {
        // Add race day workout based on goal distance
        const raceDistance = profile.goalDistance;
        let raceDuration = "30 min";
        let raceDescription = "Race Day - You've got this!";
        
        if (raceDistance === "half-marathon") {
          raceDuration = "1:30-2:00 hrs";
          raceDescription = "Half Marathon Race Day - Trust your training!";
        } else if (raceDistance === "marathon") {
          raceDuration = "3:00-4:30 hrs";
          raceDescription = "Marathon Race Day - This is your moment!";
        } else if (raceDistance === "just-run-more") {
          raceDuration = "30-45 min";
          raceDescription = "Goal Run - Celebrate your progress!";
        }
        
        lastWeek.days.push({
          date: goalDateString,
          type: "race",
          duration: raceDuration,
          distance: raceDistance === "half-marathon" ? 21097 : 
                   raceDistance === "marathon" ? 42195 : 
                   raceDistance === "just-run-more" ? 5000 : 5000, // Default to 5K
          description: raceDescription,
          target: "Race pace - trust your training",
          workoutId: null
        });
      }
      
      // Ensure last week is set as taper
      lastWeek.microCycle = "taper";
    }

    // Create the training plan
    const planId = await ctx.db.insert("trainingPlans", {
      userId,
      meta: {
        goal: profile.goalDistance,
        weeks,
        level: profile.fitnessLevel,
        daysPerWeek: days,
        createdAt: now,
      },
      isActive: true,
      plan: planWeeks,
      createdAt: now,
      updatedAt: now,
    });

    // Generate planned workouts for the first 4 weeks
    await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

    return { planId, weeks, message: "Training plan generated successfully" };
  },
});

// Helper function to generate planned workouts
async function generatePlannedWorkouts(
  ctx: any,
  planId: any,
  userId: any,
  planWeeks: any[]
) {
  for (let weekIndex = 0; weekIndex < planWeeks.length; weekIndex++) {
    const planWeek = planWeeks[weekIndex];
    
    for (let dayIndex = 0; dayIndex < planWeek.days.length; dayIndex++) {
      const day = planWeek.days[dayIndex];

      await ctx.db.insert("plannedWorkouts", {
        userId,
        trainingPlanId: planId,
        planWeek: planWeek.week,
        planDay: dayIndex,
        scheduledDate: day.date, // Use the date directly from the plan
        type: day.type,
        workoutId: day.workoutId,
        duration: day.duration,
        distance: day.distance,
        description: day.description,
        target: day.target,
        status: "scheduled",
        createdAt: new Date().toISOString(),
      });
    }
  }
}

// Get user's active training plan
export const getActiveTrainingPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("trainingPlans")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
      .first();
  },
});

// Get planned workouts for a date range
export const getPlannedWorkouts = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => 
        q.eq("userId", userId)
         .gte("scheduledDate", args.startDate)
         .lte("scheduledDate", args.endDate)
      )
      .collect();
  },
});

// Get today's planned workout
export const getTodaysWorkout = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const today = new Date().toISOString().split('T')[0];

    return await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user_date", (q: any) => q.eq("userId", userId).eq("scheduledDate", today))
      .first();
  },
});

// Mark workout as completed
export const completeWorkout = mutation({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
    actualDuration: v.optional(v.number()),
    actualDistance: v.optional(v.number()),
    averagePace: v.optional(v.number()),
    averageHeartRate: v.optional(v.number()),
    calories: v.optional(v.number()),
    perceivedEffort: v.optional(v.number()),
    feeling: v.optional(v.union(
      v.literal("amazing"),
      v.literal("good"),
      v.literal("okay"),
      v.literal("tough"),
      v.literal("struggled")
    )),
    notes: v.optional(v.string()),
    activityId: v.optional(v.id("activities")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = new Date().toISOString();

    // Create workout completion record
    const completionId = await ctx.db.insert("workoutCompletions", {
      userId,
      plannedWorkoutId: args.plannedWorkoutId,
      activityId: args.activityId,
      completedAt: now,
      actualDuration: args.actualDuration,
      actualDistance: args.actualDistance,
      averagePace: args.averagePace,
      averageHeartRate: args.averageHeartRate,
      calories: args.calories,
      perceivedEffort: args.perceivedEffort,
      feeling: args.feeling,
      notes: args.notes,
      createdAt: now,
    });

    // Update planned workout status
    await ctx.db.patch(args.plannedWorkoutId, {
      status: "completed",
      completedAt: now,
      completionId,
    });

    return completionId;
  },
});

// Skip a workout
export const skipWorkout = mutation({
  args: {
    plannedWorkoutId: v.id("plannedWorkouts"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.plannedWorkoutId, {
      status: "skipped",
    });

    return { message: "Workout skipped" };
  },
});

// Get workout completion history
export const getWorkoutHistory = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 20;

    return await ctx.db
      .query("workoutCompletions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Regenerate training plan (useful for testing or if user wants a new plan)
export const regenerateTrainingPlan = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Delete existing planned workouts for this user
    const existingWorkouts = await ctx.db
      .query("plannedWorkouts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const workout of existingWorkouts) {
      await ctx.db.delete(workout._id);
    }

    // Generate a new training plan by calling the same logic as generateTrainingPlan
    // Get user's training profile
    const profile = await ctx.db
      .query("trainingProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      throw new Error("Training profile not found. Complete onboarding first.");
    }

    // Get user's week start preference
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const weekStartDay = userProfile?.weekStartDay ?? 1; // Default to Monday if not set

    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    // Calculate plan parameters - ensure race day falls within the last week
    const weeksToGoal = calculateWeeksToGoal(today, profile.goalDate, weekStartDay);
    const minWeeks = MIN_WEEKS[profile.goalDistance as keyof typeof MIN_WEEKS][profile.fitnessLevel];
    // Respect user's timeline, but ensure at least 2 weeks for any meaningful plan
    const weeks = Math.max(weeksToGoal, 2);
    const days = clamp(profile.daysPerWeek, 2, 6);

    // Deactivate any existing plans
    const existingPlans = await ctx.db
      .query("trainingPlans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const plan of existingPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }

    // Special case: Use Couch to 5K for true-beginner 5K goals
    if (profile.goalDistance === "5K" && profile.fitnessLevel === "true-beginner") {
      const planWeeks = [];
      
      // Calculate start date 
      const startDate = new Date();
      const thisWeekStart = getWeekStart(startDate, weekStartDay);
      const nextWeekStart = new Date(thisWeekStart);
      nextWeekStart.setDate(thisWeekStart.getDate() + 7);

      // Use the user's available weeks, but cap at 9 for C25K (since that's how long the program is)
      const c25kWeeks = Math.min(weeks, 9);

      // Generate C25K weeks
      for (let weekNum = 1; weekNum <= c25kWeeks; weekNum++) {
        const c25kWeek = C25K_WEEKLY_PROGRAMS[weekNum - 1];
        const dayWorkouts: any[] = [];
        
        // 3 running days per week (use user's preferred days, default to Mon/Wed/Fri)
        const preferredDays = profile.preferredDays?.slice(0, 3) || ['Mon', 'Wed', 'Fri'];
        const dayNameToNumber: Record<string, number> = {
          'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
        };
        
        // Calculate this week's start date
        const weekStartDate = new Date(nextWeekStart);
        weekStartDate.setDate(nextWeekStart.getDate() + ((weekNum - 1) * 7));
        
        // Schedule C25K workouts on preferred days
        for (let dayIndex = 0; dayIndex < 3; dayIndex++) {
          const preferredDay = preferredDays[dayIndex] || ['Mon', 'Wed', 'Fri'][dayIndex];
          const dayNumber = dayNameToNumber[preferredDay];
          const daysFromStart = (dayNumber - 1 + 7) % 7; // Days from Monday
          
          const workoutDate = new Date(weekStartDate);
          workoutDate.setDate(weekStartDate.getDate() + daysFromStart);
          
          // Get the specific workout for this day from the 3 workouts
          const c25kWorkout = c25kWeek.workouts[dayIndex];
          
          // Get the appropriate C25K workout from library
          const workout = await selectWorkout(ctx, c25kWorkout.workoutTag, "true-beginner", "5K");
          
          dayWorkouts.push({
            date: workoutDate.toISOString().split('T')[0],
            type: "run-walk",
            duration: `${c25kWorkout.totalMinutes} min`,
            description: workout?.description || c25kWorkout.description,
            target: "Follow C25K pace - don't go faster than comfortable",
            workoutId: workout?._id
          });
        }
        
        // Add optional easy walk/rest days if user wants more than 3 days per week
        if (profile.daysPerWeek > 3) {
          const additionalDays = Math.min(profile.daysPerWeek - 3, 2);
          const remainingDays = ['Tue', 'Thu', 'Sat', 'Sun'].filter(day => !preferredDays.includes(day));
          
          for (let i = 0; i < additionalDays && i < remainingDays.length; i++) {
            const restDay = remainingDays[i];
            const dayNumber = dayNameToNumber[restDay];
            const daysFromStart = (dayNumber - 1 + 7) % 7;
            
            const restDate = new Date(weekStartDate);
            restDate.setDate(weekStartDate.getDate() + daysFromStart);
            
            dayWorkouts.push({
              date: restDate.toISOString().split('T')[0],
              type: "rest",
              duration: "20-30 min",
              description: "Easy walk or gentle stretching",
              target: "Active recovery"
            });
          }
        }
        
        planWeeks.push({
          week: weekNum,
          microCycle: weekNum <= 3 ? "base" : weekNum <= 6 ? "build" : weekNum <= 8 ? "peak" : "taper" as any,
          days: dayWorkouts
        });
      }

      // Add race day to the last week if it's not already included
      if (c25kWeeks > 0) {
        const lastWeek = planWeeks[planWeeks.length - 1];
        const goalDate = new Date(profile.goalDate);
        const goalDateString = goalDate.toISOString().split('T')[0];
        
        // Check if race day already has a workout
        const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
        
        if (!hasRaceDay) {
          // Add race day workout
          lastWeek.days.push({
            date: goalDateString,
            type: "race",
            duration: "30 min",
            distance: 5000, // 5K race
            description: "5K Race Day - You've got this!",
            target: "Race pace - trust your training",
            workoutId: null
          });
        }
        
        // Ensure last week is set as taper
        lastWeek.microCycle = "taper";
      }

      // Create the C25K training plan
      const planId = await ctx.db.insert("trainingPlans", {
        userId,
        meta: {
          goal: profile.goalDistance,
          weeks: c25kWeeks,
          level: profile.fitnessLevel,
          daysPerWeek: profile.daysPerWeek,
          createdAt: now,
        },
        isActive: true,
        plan: planWeeks,
        createdAt: now,
        updatedAt: now,
      });

      // Generate planned workouts for the first 4 weeks
      await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

      return { planId, weeks: c25kWeeks, message: "C25K training plan regenerated successfully" };
    }

    // Special case: Use 10K-optimized training for 10K goals
    if (profile.goalDistance === "10K") {
      const tenKConfig = TEN_K_CONFIGS[profile.fitnessLevel as keyof typeof TEN_K_CONFIGS];
      const planWeeks = [];
      
      // Calculate start date 
      const startDate = new Date();
      const thisWeekStart = getWeekStart(startDate, weekStartDay);
      const nextWeekStart = new Date(thisWeekStart);
      nextWeekStart.setDate(thisWeekStart.getDate() + 7);

      // Use the user's available weeks (don't enforce config minimums)
      const tenKWeeks = weeks;

      // Use goal-specific periodization
      const blocks = allocateBlocks(tenKWeeks, tenKConfig.periodization);
      let currentWeek = 1;
      let weeklyKm = BASE_WEEKLY_KM["10K"][profile.fitnessLevel];
      
      const microCycles = ["base", "build", "peak", "taper"];
      const dayNameToNumber: Record<string, number> = {
        'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
      };

      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const blockLength = blocks[blockIndex];
        const microCycle = microCycles[blockIndex];

        for (let weekInBlock = 0; weekInBlock < blockLength; weekInBlock++) {
          const dayWorkouts: any[] = [];
          
          // Calculate this week's start date
          const weekStartDate = new Date(nextWeekStart);
          weekStartDate.setDate(nextWeekStart.getDate() + ((currentWeek - 1) * 7));
          
          // Get 10K-specific workout pattern
          let pattern = get10KWorkoutPattern(microCycle, profile.daysPerWeek, profile.fitnessLevel, currentWeek);
          const weeklyDistances = distributeWeeklyDistance(weeklyKm, pattern);
          
          // Schedule workouts on preferred days
          const workoutTypes = pattern.filter(type => type !== "Rest");
          const workoutDistances = weeklyDistances.filter((_, index) => pattern[index] !== "Rest");
          
          for (let workoutIndex = 0; workoutIndex < workoutTypes.length; workoutIndex++) {
            const workoutType = workoutTypes[workoutIndex];
            const distanceKm = workoutDistances[workoutIndex];
            
            // Calculate workout date
            const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
            const preferredDayNumbers = preferredDays.map((day: string) => dayNameToNumber[day]);
            const preferredDayNumber = preferredDayNumbers[workoutIndex % preferredDayNumbers.length];
            
            const workoutDate = new Date(weekStartDate);
            const daysFromMonday = (preferredDayNumber - 1 + 7) % 7;
            workoutDate.setDate(weekStartDate.getDate() + daysFromMonday);
            
            // Spread workouts if needed
            if (workoutIndex > 0 && preferredDayNumbers.length < workoutTypes.length) {
              const daySpacing = Math.floor(7 / workoutTypes.length);
              const adjustedDay = (preferredDayNumber + (workoutIndex * daySpacing)) % 7;
              const adjustedDaysFromMonday = (adjustedDay - 1 + 7) % 7;
              workoutDate.setDate(weekStartDate.getDate() + adjustedDaysFromMonday);
            }
            
            const dateString = workoutDate.toISOString().split('T')[0];
            
            // Select 10K-specific workout
            const workoutTag = get10KWorkoutTag(workoutType, microCycle, profile.fitnessLevel);
            const workout = await selectWorkout(ctx, workoutTag, profile.fitnessLevel, "10K");
            
            const dayWorkout = buildDayWorkout(
              workoutType,
              distanceKm,
              profile.preferTimeOverDistance,
              dateString,
              workout
            );

            dayWorkouts.push(dayWorkout);
          }
          
          planWeeks.push({
            week: currentWeek,
            microCycle: microCycle as "base" | "build" | "peak" | "taper",
            days: dayWorkouts
          });

          currentWeek++;

          // 10K-specific volume progression
          if (microCycle !== "taper") {
            weeklyKm *= (currentWeek % 4 === 0) ? 0.90 : 1.06; // More conservative progression for 10K
          } else {
            weeklyKm *= 0.80; // Sharper taper for 10K
          }
        }
      }

      // Add race day to the last week if it's not already included
      if (tenKWeeks > 0) {
        const lastWeek = planWeeks[planWeeks.length - 1];
        const goalDate = new Date(profile.goalDate);
        const goalDateString = goalDate.toISOString().split('T')[0];
        
        // Check if race day already has a workout
        const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
        
        if (!hasRaceDay) {
          // Add race day workout
          lastWeek.days.push({
            date: goalDateString,
            type: "race",
            duration: "45-50 min",
            distance: 10000, // 10K race
            description: "10K Race Day - Go for it!",
            target: "Race pace - trust your training",
            workoutId: null
          });
        }
        
        // Ensure last week is set as taper
        lastWeek.microCycle = "taper";
      }

      // Create the 10K training plan
      const planId = await ctx.db.insert("trainingPlans", {
        userId,
        meta: {
          goal: profile.goalDistance,
          weeks: tenKWeeks,
          level: profile.fitnessLevel,
          daysPerWeek: profile.daysPerWeek,
          createdAt: now,
        },
        isActive: true,
        plan: planWeeks,
        createdAt: now,
        updatedAt: now,
      });

      // Generate planned workouts for the first 4 weeks
      await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

      return { planId, weeks: tenKWeeks, message: "10K training plan regenerated successfully" };
    }

    // Calculate macrocycle blocks
    const blockPct = { base: 0.40, build: 0.30, peak: 0.20, taper: 0.10 };
    const blocks = allocateBlocks(weeks, blockPct);

    // Generate weekly plan
    let weeklyKm = BASE_WEEKLY_KM[profile.goalDistance as keyof typeof BASE_WEEKLY_KM][profile.fitnessLevel];
    const qualityDays = QUALITY_DAYS[profile.fitnessLevel];
    
    const planWeeks = [];
    let currentWeek = 1;

    // Calculate start date based on user's preferred days
    const startDate = new Date();
    // Find the next occurrence of the user's first preferred day
    const preferredDays = profile.preferredDays || ['Mon', 'Wed', 'Fri'];
    const dayNameToNumber: Record<string, number> = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    
    // Start from the next week based on user's week start preference
    const thisWeekStart = getWeekStart(startDate, weekStartDay);
    const nextWeekStart = new Date(thisWeekStart);
    nextWeekStart.setDate(thisWeekStart.getDate() + 7);

    const microCycles = ["base", "build", "peak", "taper"];
    
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const blockLength = blocks[blockIndex];
      const microCycle = microCycles[blockIndex];

      for (let weekInBlock = 0; weekInBlock < blockLength; weekInBlock++) {
        const pattern = getWorkoutPattern(microCycle, days, qualityDays, profile.fitnessLevel);
        const weeklyDistances = distributeWeeklyDistance(weeklyKm, pattern);

        // Calculate the start date for this week
        const weekStartDate = new Date(nextWeekStart);
        weekStartDate.setDate(nextWeekStart.getDate() + ((currentWeek - 1) * 7));

        // Schedule workouts on user's preferred days
        const dayWorkouts = await scheduleWorkoutsOnPreferredDays(
          ctx,
          pattern,
          weeklyDistances,
          weekStartDate,
          profile,
          dayNameToNumber
        );

        planWeeks.push({
          week: currentWeek,
          microCycle: microCycle as "base" | "build" | "peak" | "taper",
          days: dayWorkouts
        });

        currentWeek++;

        // Progressive overload (except taper)
        if (microCycle !== "taper") {
          weeklyKm *= (currentWeek % 4 === 0) ? 0.92 : 1.08; // Recovery every 4th week
        } else {
          weeklyKm *= 0.85; // Reduce volume in taper
        }
      }
    }

    // Add race day to the last week if it's not already included
    if (weeks > 0) {
      const lastWeek = planWeeks[planWeeks.length - 1];
      const goalDate = new Date(profile.goalDate);
      const goalDateString = goalDate.toISOString().split('T')[0];
      
      // Check if race day already has a workout
      const hasRaceDay = lastWeek.days.some((day: any) => day.date === goalDateString);
      
      if (!hasRaceDay) {
        // Add race day workout based on goal distance
        const raceDistance = profile.goalDistance;
        let raceDuration = "30 min";
        let raceDescription = "Race Day - You've got this!";
        
        if (raceDistance === "half-marathon") {
          raceDuration = "1:30-2:00 hrs";
          raceDescription = "Half Marathon Race Day - Trust your training!";
        } else if (raceDistance === "marathon") {
          raceDuration = "3:00-4:30 hrs";
          raceDescription = "Marathon Race Day - This is your moment!";
        } else if (raceDistance === "just-run-more") {
          raceDuration = "30-45 min";
          raceDescription = "Goal Run - Celebrate your progress!";
        }
        
        lastWeek.days.push({
          date: goalDateString,
          type: "race",
          duration: raceDuration,
          distance: raceDistance === "half-marathon" ? 21097 : 
                   raceDistance === "marathon" ? 42195 : 
                   raceDistance === "just-run-more" ? 5000 : 5000, // Default to 5K
          description: raceDescription,
          target: "Race pace - trust your training",
          workoutId: null
        });
      }
      
      // Ensure last week is set as taper
      lastWeek.microCycle = "taper";
    }

    // Create the training plan
    const planId = await ctx.db.insert("trainingPlans", {
      userId,
      meta: {
        goal: profile.goalDistance,
        weeks,
        level: profile.fitnessLevel,
        daysPerWeek: days,
        createdAt: now,
      },
      isActive: true,
      plan: planWeeks,
      createdAt: now,
      updatedAt: now,
    });

    // Generate planned workouts for the first 4 weeks
    await generatePlannedWorkouts(ctx, planId, userId, planWeeks.slice(0, 4));

    return { planId, weeks, message: "Training plan regenerated successfully" };
  },
}); 
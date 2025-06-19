// import { getAuthUserId } from "@convex-dev/auth/server";
// import { v } from "convex/values";
// import { Id } from "./_generated/dataModel";
// import { mutation, query } from "./_generated/server";
// import { calculateChallengeProgress, Challenge, getChallenges } from "./utils/challenges";

// // Challenge utilities moved to ./utils/challenges.ts

// // Get all available challenges
// export const getAllChallenges = query({
//   args: { isMetric: v.optional(v.boolean()) },
//   handler: async (ctx, args) => {
//     const isMetric = args.isMetric ?? true;
//     return getChallenges(isMetric);
//   },
// });

// // Get user's achievement progress
// export const getUserAchievements = query({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const achievements = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     return achievements;
//   },
// });

// // Get achievement with progress for challenges screen
// export const getChallengesWithProgress = query({
//   args: { isMetric: v.optional(v.boolean()) },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const isMetric = args.isMetric ?? true;
//     const allChallenges = getChallenges(isMetric);
    
//     const userAchievements = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     // Create a map for quick lookup
//     const achievementMap = new Map(
//       userAchievements.map(a => [a.challengeId, a])
//     );

//     return allChallenges.map(challenge => {
//       const userAchievement = achievementMap.get(challenge.id);
      
//       return {
//         ...challenge,
//         progress: userAchievement?.progress ?? 0,
//         isCompleted: userAchievement?.isCompleted ?? false,
//         isNew: userAchievement?.isNew ?? false,
//         unlockedAt: userAchievement?.unlockedAt,
//         rewardClaimed: userAchievement?.rewardClaimed ?? false,
//       };
//     });
//   },
// });

// // Update achievement progress
// export const updateAchievementProgress = mutation({
//   args: {
//     challengeId: v.string(),
//     newProgress: v.number(),
//     activityData: v.optional(v.object({
//       distance: v.number(),
//       duration: v.number(),
//       startDate: v.string(),
//     })),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const now = new Date().toISOString();
//     const challenge = getChallenges(true).find(c => c.id === args.challengeId);
    
//     if (!challenge) {
//       throw new Error("Challenge not found");
//     }

//     // Check if achievement already exists
//     const existingAchievement = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user_challenge", (q) => 
//         q.eq("userId", userId).eq("challengeId", args.challengeId)
//       )
//       .first();

//     const isCompleted = args.newProgress >= challenge.maxProgress;
//     const wasJustCompleted = existingAchievement && !existingAchievement.isCompleted && isCompleted;

//     if (existingAchievement) {
//       // Update existing achievement
//       await ctx.db.patch(existingAchievement._id, {
//         progress: args.newProgress,
//         isCompleted: isCompleted,
//         isNew: wasJustCompleted || undefined, // Mark as new if just completed
//         updatedAt: now,
//       });
//     } else {
//       // Create new achievement tracking
//       await ctx.db.insert("userAchievements", {
//         userId,
//         challengeId: args.challengeId,
//         unlockedAt: now,
//         progress: args.newProgress,
//         maxProgress: challenge.maxProgress,
//         isCompleted: isCompleted,
//         rewardClaimed: false,
//         isNew: isCompleted, // Mark as new if completed on first try
//         updatedAt: now,
//       });
//     }

//     return {
//       challengeId: args.challengeId,
//       newProgress: args.newProgress,
//       isCompleted: isCompleted,
//       wasJustCompleted: wasJustCompleted,
//       challenge: challenge,
//     };
//   },
// });

// // Claim achievement reward
// export const claimAchievementReward = mutation({
//   args: {
//     challengeId: v.string(),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const achievement = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user_challenge", (q) => 
//         q.eq("userId", userId).eq("challengeId", args.challengeId)
//       )
//       .first();

//     if (!achievement || !achievement.isCompleted) {
//       throw new Error("Achievement not completed");
//     }

//     if (achievement.rewardClaimed) {
//       throw new Error("Reward already claimed");
//     }

//     // Mark reward as claimed and remove "new" flag
//     await ctx.db.patch(achievement._id, {
//       rewardClaimed: true,
//       isNew: false,
//       updatedAt: new Date().toISOString(),
//     });

//     return { success: true };
//   },
// });

// // Check and update achievements based on activity
// export const checkAchievementsForActivity = mutation({
//   args: {
//     activityData: v.object({
//       distance: v.number(),
//       duration: v.number(),
//       startDate: v.string(),
//       calories: v.number(),
//     }),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const { activityData } = args;
//     const newlyCompleted: Challenge[] = [];

//     // Get user's current achievements
//     const userAchievements = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     // Get all user activities for cumulative calculations
//     const allActivities = await ctx.db
//       .query("activities")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     const achievementMap = new Map(
//       userAchievements.map(a => [a.challengeId, a])
//     );

//     // Calculate various metrics
//     const totalRuns = allActivities.length;
//     const totalDistance = allActivities.reduce((sum, a) => sum + a.distance, 0);
//     const runDate = new Date(activityData.startDate);
//     const runDistanceKm = activityData.distance / 1000;
//     const isEarlyBird = runDate.getHours() < 9; // Before 9 AM

//     // Check each challenge
//     const challenges = getChallenges(true);
    
//     for (const challenge of challenges) {
//       const existingAchievement = achievementMap.get(challenge.id);
      
//       // Skip if already completed
//       if (existingAchievement?.isCompleted) {
//         continue;
//       }

//       let newProgress = existingAchievement?.progress ?? 0;

//       // Calculate progress based on challenge type
//       switch (challenge.id) {
//         case 'first_run':
//           newProgress = totalRuns >= 1 ? 1 : 0;
//           break;
//         case 'early_riser':
//           if (isEarlyBird) {
//             newProgress = (existingAchievement?.progress ?? 0) + 1;
//           }
//           break;
//         case 'distance_5k':
//           newProgress = runDistanceKm >= 5 ? 1 : 0;
//           break;
//         case 'distance_10k':
//           newProgress = runDistanceKm >= 10 ? 1 : 0;
//           break;
//         case 'weekly_warrior':
//           // This would need more complex logic to check consecutive days
//           break;
//         case 'total_distance_100k':
//           newProgress = Math.floor(totalDistance / 1000); // Progress in km
//           break;
//         default:
//           continue;
//       }

//       // Update if progress changed
//       if (newProgress !== (existingAchievement?.progress ?? 0)) {
//         // Call the handler directly since we're already in a mutation context
//         const now = new Date().toISOString();
//         const isCompleted = newProgress >= challenge.maxProgress;
//         const wasJustCompleted = existingAchievement && !existingAchievement.isCompleted && isCompleted;

//         if (existingAchievement) {
//           // Update existing achievement
//           await ctx.db.patch(existingAchievement._id, {
//             progress: newProgress,
//             isCompleted: isCompleted,
//             isNew: wasJustCompleted || undefined,
//             updatedAt: now,
//           });
//         } else {
//           // Create new achievement tracking
//           await ctx.db.insert("userAchievements", {
//             userId,
//             challengeId: challenge.id,
//             unlockedAt: now,
//             progress: newProgress,
//             maxProgress: challenge.maxProgress,
//             isCompleted: isCompleted,
//             rewardClaimed: false,
//             isNew: isCompleted || undefined,
//             updatedAt: now,
//           });
//         }

//         if (wasJustCompleted) {
//           newlyCompleted.push(challenge);
//         }
//       }
//     }

//     return { newlyCompleted };
//   },
// });

// // Process achievements for a completed activity (called from RunCelebrationModal)
// export const processAchievementsForActivity = mutation({
//   args: {
//     activityId: v.id("activities"),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     // Get the activity data
//     const activity = await ctx.db.get(args.activityId);
//     if (!activity || activity.userId !== userId) {
//       throw new Error("Activity not found or not owned by user");
//     }

//     // Get user profile for metric preference
//     const profile = await ctx.db
//       .query("userProfiles")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .first();

//     const isMetric = (profile?.metricSystem ?? "metric") === "metric";
//     const newlyUnlocked: (Challenge & { achievementId: string })[] = [];

//     // Get user's current achievements
//     const userAchievements = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     // Get all user activities for cumulative calculations
//     const allActivities = await ctx.db
//       .query("activities")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     const achievementMap = new Map(
//       userAchievements.map(a => [a.challengeId, a])
//     );

//     // Calculate various metrics
//     const totalRuns = allActivities.length;
//     const totalDistance = allActivities.reduce((sum, a) => sum + a.distance, 0);
//     const runDate = new Date(activity.startDate);
//     const runDistanceKm = activity.distance / 1000;
//     const runDistanceMi = activity.distance * 0.000621371;
//     const isEarlyBird = runDate.getHours() < 9; // Before 9 AM
//     const runPace = activity.distance > 0 ? (activity.duration / runDistanceKm) : 0; // minutes per km

//     // Check each challenge
//     const challenges = getChallenges(isMetric);
//     const now = new Date().toISOString();
    
//     for (const challenge of challenges) {
//       const existingAchievement = achievementMap.get(challenge._id);
      
//       // Skip if already completed
//       if (existingAchievement?.isCompleted) {
//         continue;
//       }

//       let newProgress = existingAchievement?.progress ?? 0;
//       let shouldUpdate = false;

//       // Use centralized challenge progress calculation
//       const activityData = {
//         distance: activity.distance,
//         duration: activity.duration,
//         startDate: activity.startDate,
//         calories: activity.calories,
//       };

//       const progressContribution = calculateChallengeProgress(
//         challenge.id,
//         activityData,
//         allActivities,
//         isMetric
//       );

//       if (progressContribution === null) {
//         continue; // Challenge not implemented or not applicable
//       }

//       // Handle different progress types
//       if (challenge.id === 'early_riser') {
//         // Accumulative challenge - add to existing progress
//         if (progressContribution > 0) {
//           newProgress = (existingAchievement?.progress ?? 0) + progressContribution;
//           shouldUpdate = true;
//         }
//       } else if (challenge.id === 'total_distance_100k' || challenge.id === 'total_distance_500k') {
//         // Cumulative distance - use total progress
//         newProgress = progressContribution;
//         shouldUpdate = newProgress !== (existingAchievement?.progress ?? 0);
//       } else {
//         // One-time achievements - set to progress contribution
//         if (progressContribution > 0) {
//           newProgress = progressContribution;
//           shouldUpdate = true;
//         }
//       }

//       // Update if progress changed
//       if (shouldUpdate) {
//         const isCompleted = newProgress >= challenge.maxProgress;
//         const wasJustCompleted = !existingAchievement?.isCompleted && isCompleted;

//         let achievementId: Id<"userAchievements">;

//         if (existingAchievement) {
//           // Update existing achievement
//           await ctx.db.patch(existingAchievement._id, {
//             progress: newProgress,
//             isCompleted: isCompleted,
//             isNew: wasJustCompleted || undefined,
//             updatedAt: now,
//           });
//           achievementId = existingAchievement._id;
//         } else {
//           // Create new achievement tracking
//           achievementId = await ctx.db.insert("userAchievements", {
//             userId,
//             challengeId: challenge._id,
//             unlockedAt: now,
//             progress: newProgress,
//             maxProgress: challenge.maxProgress,
//             isCompleted: isCompleted,
//             rewardClaimed: false,
//             isNew: isCompleted || undefined,
//             updatedAt: now,
//           });
//         }

//         // Link this achievement to the activity if it was unlocked/progressed by this run
//         if (shouldUpdate) {
//           await ctx.db.insert("activityAchievements", {
//             userId,
//             activityId: args.activityId,
//             challengeId: challenge.id,
//             achievementId: achievementId,
//             unlockedAt: now,
//           });

//           // If this was just completed, add to newly unlocked list
//           if (wasJustCompleted) {
//             newlyUnlocked.push({
//               ...challenge,
//               achievementId: achievementId,
//             });
//           }
//         }
//       }
//     }

//     return { 
//       newlyUnlocked,
//       totalProcessed: challenges.length,
//     };
//   },
// });

// // Get achievements unlocked by a specific activity
// export const getAchievementsForActivity = query({
//   args: {
//     activityId: v.id("activities"),
//     isMetric: v.optional(v.boolean()),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const isMetric = args.isMetric ?? true;

//     // Get activity achievements for this specific activity
//     const activityAchievements = await ctx.db
//       .query("activityAchievements")
//       .withIndex("by_user_activity", (q) => 
//         q.eq("userId", userId).eq("activityId", args.activityId)
//       )
//       .collect();

//     // Get the full challenge data for each achievement
//     const challenges = getChallenges(isMetric);
//     const challengeMap = new Map(challenges.map(c => [c.id, c]));

//     const achievementsWithDetails = activityAchievements.map(activityAchievement => {
//       const challenge = challengeMap.get(activityAchievement.challengeId);
//       return challenge ? {
//         ...challenge,
//         unlockedAt: activityAchievement.unlockedAt,
//       } : null;
//     }).filter(Boolean);

//     return achievementsWithDetails;
//   },
// });

// // Get latest completed challenges for profile display, fill with incomplete ones if needed
// export const getLatestCompletedChallenges = query({
//   args: { 
//     limit: v.optional(v.number()),
//     isMetric: v.optional(v.boolean()) 
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const limit = args.limit ?? 3; // Default to 3 for profile display
//     const isMetric = args.isMetric ?? true;

//     // Get all user achievements
//     const userAchievements = await ctx.db
//       .query("userAchievements")
//       .withIndex("by_user", (q) => q.eq("userId", userId))
//       .collect();

//     // Get the full challenge data
//     const challenges = getChallenges(isMetric);
//     const challengeMap = new Map(challenges.map(c => [c.id, c]));
//     const achievementMap = new Map(userAchievements.map(a => [a.challengeId, a]));

//     // Separate completed and incomplete challenges
//     const completedChallenges: any[] = [];
//     const incompleteChallenges: any[] = [];

//     challenges.forEach(challenge => {
//       const userAchievement = achievementMap.get(challenge.id);
      
//       const challengeWithProgress = {
//         ...challenge,
//         progress: userAchievement?.progress ?? 0,
//         isCompleted: userAchievement?.isCompleted ?? false,
//         isNew: userAchievement?.isNew ?? false,
//         unlockedAt: userAchievement?.unlockedAt,
//         rewardClaimed: userAchievement?.rewardClaimed ?? false,
//         updatedAt: userAchievement?.updatedAt,
//       };

//       if (challengeWithProgress.isCompleted) {
//         completedChallenges.push(challengeWithProgress);
//       } else {
//         incompleteChallenges.push(challengeWithProgress);
//       }
//     });

//     // Sort completed challenges by completion date (newest first)
//     completedChallenges.sort((a, b) => {
//       if (!a.updatedAt || !b.updatedAt) return 0;
//       return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
//     });

//     // Sort incomplete challenges by progress (highest progress first)
//     incompleteChallenges.sort((a, b) => {
//       const progressA = a.progress / a.maxProgress;
//       const progressB = b.progress / b.maxProgress;
//       return progressB - progressA;
//     });

//     // Combine: completed first, then incomplete to fill up to limit
//     const result = [];
    
//     // Add completed challenges first
//     result.push(...completedChallenges.slice(0, limit));
    
//     // Fill remaining slots with incomplete challenges
//     const remainingSlots = limit - result.length;
//     if (remainingSlots > 0) {
//       result.push(...incompleteChallenges.slice(0, remainingSlots));
//     }

//     return result.slice(0, limit);
//   },
// });

// // Get achievements unlocked by a specific activity using HealthKit UUID
// export const getAchievementsForActivityByUuid = query({
//   args: {
//     healthKitUuid: v.string(),
//     isMetric: v.optional(v.boolean()),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) {
//       throw new Error("Not authenticated");
//     }

//     const isMetric = args.isMetric ?? true;

//     // First, find the database activity by HealthKit UUID
//     const activity = await ctx.db
//       .query("activities")
//       .withIndex("by_healthkit_uuid", (q) => q.eq("healthKitUuid", args.healthKitUuid))
//       .filter((q) => q.eq(q.field("userId"), userId))
//       .first();

//     if (!activity) {
//       // Activity not found in database, return empty array
//       return [];
//     }

//     // Get activity achievements for this specific activity
//     const activityAchievements = await ctx.db
//       .query("activityAchievements")
//       .withIndex("by_user_activity", (q) => 
//         q.eq("userId", userId).eq("activityId", activity._id)
//       )
//       .collect();

//     // Get the full challenge data for each achievement
//     const challenges = getChallenges(isMetric);
//     const challengeMap = new Map(challenges.map(c => [c.id, c]));

//     const achievementsWithDetails = activityAchievements.map(activityAchievement => {
//       const challenge = challengeMap.get(activityAchievement.challengeId);
//       return challenge ? {
//         ...challenge,
//         unlockedAt: activityAchievement.unlockedAt,
//       } : null;
//     }).filter(Boolean);

//     return achievementsWithDetails;
//   },
// }); 
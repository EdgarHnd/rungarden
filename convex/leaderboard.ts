import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalDistance: number;
  level: number;
  totalWorkouts: number;
}

export interface UserRankInfo {
  rank: number | null;
  totalUsers: number;
  userStats: LeaderboardEntry | null;
}

// Get leaderboard for different time periods
export const getLeaderboard = query({
  args: {
    period: v.union(v.literal("all"), v.literal("week"), v.literal("month")),
    scope: v.optional(v.union(v.literal("world"), v.literal("friends"))), // default "world"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = args.scope || "world";
    const limit = args.limit ?? 10;
    
    // When friends scope: build list of friend userIds (plus self)
    let friendIds: Id<"users">[] | null = null;
    if (scope === "friends") {
      const userId = await getAuthUserId(ctx);
      if (!userId) throw new Error("Not authenticated");

      // Fetch accepted friendships
      const sent = await ctx.db
        .query("friendRequests")
        .withIndex("by_from", q => q.eq("fromUserId", userId))
        .filter(q => q.eq(q.field("status"), "accepted"))
        .collect();

      const received = await ctx.db
        .query("friendRequests")
        .withIndex("by_to", q => q.eq("toUserId", userId))
        .filter(q => q.eq(q.field("status"), "accepted"))
        .collect();

      const friendSet = new Set<Id<"users">>([userId]);
      sent.forEach(fr => friendSet.add(fr.toUserId as Id<"users">));
      received.forEach(fr => friendSet.add(fr.fromUserId as Id<"users">));

      friendIds = Array.from(friendSet);
      if (friendIds.length === 0) {
        return [];
      }
    }
    
    if (args.period === "all") {
      // All-time leaderboard based on total distance from user profiles
      const profilesRaw = await ctx.db.query("userProfiles").collect();
      let profiles = friendIds ? profilesRaw.filter(p => friendIds!.includes(p.userId as Id<"users">)) : profilesRaw;
      
      // Ensure all friends are included for "all" time, even if they have no profile yet (edge case)
      if (friendIds) {
        const profileUserIds = new Set(profiles.map((p) => p.userId as Id<"users">));
        for (const friendId of friendIds) {
          if (!profileUserIds.has(friendId)) {
            // Add a placeholder profile for friends who might not have one yet
            const user = await ctx.db.get(friendId);
            if (user) {
              profiles.push({
                _id: user._id as any,
                _creationTime: user._creationTime,
                userId: user._id,
                name: user.name ?? 'Anonymous Runner',
                totalDistance: 0,
                totalWorkouts: 0,
                level: 1,
              } as Doc<"userProfiles"> & { name: string });
            }
          }
        }
      }
      
      // Sort by total distance and take limit
      const sortedProfiles = profiles
        .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
        .slice(0, limit);
      
      // Get user names from the users table
      const leaderboard: LeaderboardEntry[] = [];
      
      for (let i = 0; i < sortedProfiles.length; i++) {
        const profile = sortedProfiles[i];
        const user = await ctx.db.get(profile.userId as any);
        
        leaderboard.push({
          rank: i + 1,
          userId: profile.userId,
          name: (profile as any).name || profile.mascotName || "Anonymous Runner",
          totalDistance: profile.totalDistance || 0,
          level: profile.level || 1,
          totalWorkouts: profile.totalWorkouts || 0,
        });
      }
      
      return leaderboard;
    }
    
    // For week/month, calculate from activities
    const now = new Date();
    let startDate: Date;
    
    if (args.period === "week") {
      // Start of current week (Monday)
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - daysToMonday);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Start of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    const startDateISO = startDate.toISOString();
    
    // Get all activities for the period
    const activitiesRaw = await ctx.db
      .query("activities")
      .filter((q) => q.gte(q.field("startDate"), startDateISO))
      .collect();

    const activities = friendIds
      ? activitiesRaw.filter((a) => friendIds!.includes(a.userId as Id<"users">))
      : activitiesRaw;

    // Group by user and calculate totals
    const userStats = new Map<string, {
      userId: string;
      totalDistance: number;
      totalWorkouts: number;
    }>();
    
    activities.forEach((activity) => {
      const existing = userStats.get(activity.userId) || {
        userId: activity.userId,
        totalDistance: 0,
        totalWorkouts: 0,
      };
      
      existing.totalDistance += activity.distance;
      existing.totalWorkouts += 1;
      
      userStats.set(activity.userId, existing);
    });
    
    // For friends scope, ensure all friends are in the list
    if (friendIds) {
      for (const friendId of friendIds) {
        if (!userStats.has(friendId)) {
          userStats.set(friendId, {
            userId: friendId,
            totalDistance: 0,
            totalWorkouts: 0,
          });
        }
      }
    }

    // Convert to array and sort by distance (active users first)
    const sortedStats = Array.from(userStats.values()).sort((a, b) => {
      if (a.totalDistance > 0 && b.totalDistance === 0) return -1;
      if (b.totalDistance > 0 && a.totalDistance === 0) return 1;
      return b.totalDistance - a.totalDistance;
    });

    // Get user details and profiles
    const leaderboard: LeaderboardEntry[] = [];
    let rankCounter = 1;

    for (let i = 0; i < sortedStats.length; i++) {
      const stats = sortedStats[i];
      const user = await ctx.db.get(stats.userId as any);
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", stats.userId as any))
        .first();

      leaderboard.push({
        rank: stats.totalDistance > 0 ? rankCounter++ : 0, // Assign rank only if active
        userId: stats.userId,
        name: profile?.firstName || (user as any)?.name || "Anonymous Runner",
        totalDistance: stats.totalDistance,
        level: profile?.level || 1,
        totalWorkouts: stats.totalWorkouts,
      });
    }

    return leaderboard.slice(0, limit);
  },
});

// Get current user's rank in leaderboard
export const getUserRank = query({
  args: {
    period: v.union(v.literal("all"), v.literal("week"), v.literal("month")),
    scope: v.optional(v.union(v.literal("world"), v.literal("friends"))),
  },
  handler: async (ctx, args) => {
    const scope = args.scope || "world";
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    let friendIds: string[] | null = null;
    if (scope === "friends") {
      // Build friendIds array similar to getLeaderboard
      const sent = await ctx.db
        .query("friendRequests")
        .withIndex("by_from", q => q.eq("fromUserId", userId))
        .filter(q => q.eq(q.field("status"), "accepted"))
        .collect();

      const received = await ctx.db
        .query("friendRequests")
        .withIndex("by_to", q => q.eq("toUserId", userId))
        .filter(q => q.eq(q.field("status"), "accepted"))
        .collect();

      const friendSet = new Set<string>([userId]);
      sent.forEach(fr => friendSet.add(fr.toUserId as string));
      received.forEach(fr => friendSet.add(fr.fromUserId as string));
      friendIds = Array.from(friendSet);
      if (friendIds.length === 0) {
        return {
          rank: null,
          totalUsers: 0,
          userStats: null,
        };
      }
    }
    
    if (args.period === "all") {
      const allProfiles = await ctx.db
        .query("userProfiles")
        .collect();
      
      const profiles = friendIds ? allProfiles.filter(p => friendIds!.includes(p.userId as string)) : allProfiles;
      
      const sortedProfiles = profiles
        .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
        .slice(0, 100);
      
      const leaderboard: LeaderboardEntry[] = [];
      
      for (let i = 0; i < sortedProfiles.length; i++) {
        const profile = sortedProfiles[i];
        const user = await ctx.db.get(profile.userId);
        
        leaderboard.push({
          rank: i + 1,
          userId: profile.userId,
          name: (user as any)?.name || "Unknown User",
          totalDistance: profile.totalDistance || 0,
          level: profile.level || 1,
          totalWorkouts: profile.totalWorkouts || 0,
        });
      }
      
      const userRank = leaderboard.findIndex((entry: LeaderboardEntry) => entry.userId === userId);
      
      if (userRank === -1) {
        return {
          rank: null,
          totalUsers: leaderboard.length,
          userStats: null,
        };
      }
      
      return {
        rank: userRank + 1,
        totalUsers: leaderboard.length,
        userStats: leaderboard[userRank],
      };
    } else {
      // For week/month periods
      const now = new Date();
      let startDate: Date;
      
      if (args.period === "week") {
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysToMonday);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      const startDateISO = startDate.toISOString();
      
      const allActivities = await ctx.db
        .query("activities")
        .filter((q) => q.gte(q.field("startDate"), startDateISO))
        .collect();

      const activities = friendIds ? allActivities.filter(a => friendIds!.includes(a.userId as string)) : allActivities;
      
      const userStats = new Map<string, {
        userId: string;
        totalDistance: number;
        totalWorkouts: number;
      }>();
      
      activities.forEach(activity => {
        const existing = userStats.get(activity.userId) || {
          userId: activity.userId,
          totalDistance: 0,
          totalWorkouts: 0,
        };
        
        existing.totalDistance += activity.distance;
        existing.totalWorkouts += 1;
        
        userStats.set(activity.userId, existing);
      });
      
      const sortedStats = Array.from(userStats.values())
        .sort((a, b) => b.totalDistance - a.totalDistance)
        .slice(0, 100);
      
      const leaderboard: LeaderboardEntry[] = [];
      
      for (let i = 0; i < sortedStats.length; i++) {
        const stats = sortedStats[i];
        const user = await ctx.db.get(stats.userId as any);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", stats.userId as any))
          .first();
        
        leaderboard.push({
          rank: i + 1,
          userId: stats.userId,
          name: profile?.mascotName || (user as any)?.name || "Unknown User",
          totalDistance: stats.totalDistance,
          level: profile?.level || 1,
          totalWorkouts: stats.totalWorkouts,
        });
      }
      
      const userRank = leaderboard.findIndex((entry: LeaderboardEntry) => entry.userId === userId);
      
      if (userRank === -1) {
        return {
          rank: null,
          totalUsers: leaderboard.length,
          userStats: null,
        };
      }
      
      return {
        rank: userRank + 1,
        totalUsers: leaderboard.length,
        userStats: leaderboard[userRank],
      };
    }
  },
}); 
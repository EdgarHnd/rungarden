import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    
    if (args.period === "all") {
      // All-time leaderboard based on total distance from user profiles
      const profiles = await ctx.db
        .query("userProfiles")
        .collect();
      
      // Sort by total distance and take limit
      const sortedProfiles = profiles
        .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
        .slice(0, limit);
      
      // Get user names from the users table
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
    const activities = await ctx.db
      .query("activities")
      .filter((q) => q.gte(q.field("startDate"), startDateISO))
      .collect();
    
    // Group by user and calculate totals
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
    
    // Convert to array and sort by distance
    const sortedStats = Array.from(userStats.values())
      .sort((a, b) => b.totalDistance - a.totalDistance)
      .slice(0, limit);
    
    // Get user details and profiles
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
        name: (user as any)?.name || "Unknown User",
        totalDistance: stats.totalDistance,
        level: profile?.level || 1,
        totalWorkouts: stats.totalWorkouts,
      });
    }
    
    return leaderboard;
  },
});

// Get current user's rank in leaderboard
export const getUserRank = query({
  args: {
    period: v.union(v.literal("all"), v.literal("week"), v.literal("month")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get the full leaderboard directly instead of calling another query
    // This avoids the circular dependency issue
    const limit = 100;
    
    if (args.period === "all") {
      const profiles = await ctx.db
        .query("userProfiles")
        .collect();
      
      const sortedProfiles = profiles
        .sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0))
        .slice(0, limit);
      
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
      
      const activities = await ctx.db
        .query("activities")
        .filter((q) => q.gte(q.field("startDate"), startDateISO))
        .collect();
      
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
        .slice(0, limit);
      
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
          name: (user as any)?.name || "Unknown User",
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
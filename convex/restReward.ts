import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

const COINS_REST = 5;
const XP_REST = 10;

export const rewardRest = mutation({
  args: { dateISO: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // insert zero-distance "rest" activity
    await ctx.db.insert("activities", {
      userId,
      startDate: args.dateISO,
      endDate: args.dateISO,
      duration: 0,
      distance: 0,
      calories: 0,
      source: "app",
      workoutName: "Rest",
      type: "rest",
      isNewActivity: true,
      syncedAt: new Date().toISOString()
    });

    // reward user
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (!profile) {
      throw new Error("User profile not found");
    }

    await ctx.db.patch(profile._id, {
      coins: (profile.coins ?? 0) + COINS_REST,
      totalXP: (profile.totalXP ?? 0) + XP_REST
    });

    return { success: true, coinsEarned: COINS_REST, xpEarned: XP_REST };
  }
}); 
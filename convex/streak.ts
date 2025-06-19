import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation } from "./_generated/server";
import { recalcStreak } from "./utils/streak";

// Recalculate the user's streak. Should be invoked on first app load of the day
// and whenever a new activity is uploaded.
export const refreshStreak = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const todayISO = new Date().toISOString().split("T")[0];
    await recalcStreak(ctx.db, userId, todayISO);

    return { success: true };
  },
}); 
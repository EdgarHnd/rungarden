import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

/**
 * Friend system utilities and APIs
 */

// Types
export type FriendRequestStatus = "pending" | "accepted" | "rejected" | "blocked";

export interface FriendRequest {
  _id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/*──────────────────────── send friend request */
export const sendFriendRequest = mutation({
  args: {
    toUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const fromUserId = await getAuthUserId(ctx);
    if (!fromUserId) throw new Error("Not authenticated");
    if (fromUserId === args.toUserId) throw new Error("Cannot add yourself as a friend");

    // Check if there is an existing request or friendship
    const existing = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", q => q.eq("fromUserId", fromUserId).eq("toUserId", args.toUserId))
      .unique();

    const reverseExisting = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", q => q.eq("fromUserId", args.toUserId).eq("toUserId", fromUserId))
      .unique();

    if (existing || reverseExisting) {
      const req = (existing || reverseExisting)!;
      if (req.status === "pending") {
        throw new Error("Friend request already pending");
      }
      if (req.status === "accepted") {
        throw new Error("You are already friends");
      }
      // If previously rejected/blocked we allow new request
    }

    const now = new Date().toISOString();
    const id = await ctx.db.insert("friendRequests", {
      fromUserId,
      toUserId: args.toUserId,
      status: "pending" as FriendRequestStatus,
      createdAt: now,
      updatedAt: now,
    });

    // Fetch sender name for notification (optional)
    const senderProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", q => q.eq("userId", fromUserId))
      .first();

    const senderName = senderProfile?.mascotName ?? undefined;

    // Fire push notification to recipient (non-blocking)
    try {
      await ctx.scheduler.runAfter(0, api.pushNotifications.sendFriendRequestNotification, {
        toUserId: args.toUserId,
        fromName: senderName,
      });
      console.log(`[Friends] Sent friend request push to ${args.toUserId}`);
    } catch (e) {
      console.error("Failed to send friend request push", e);
    }

    return id;
  },
});

/*──────────────────────── respond to friend request */
export const respondToFriendRequest = mutation({
  args: {
    requestId: v.id("friendRequests"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.toUserId !== userId) throw new Error("Not authorized to respond to this request");
    if (request.status !== "pending") throw new Error("Request already processed");

    const newStatus: FriendRequestStatus = args.accept ? "accepted" : "rejected";
    await ctx.db.patch(args.requestId, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    if (newStatus === "accepted") {
      // Notify original sender
      const recipientProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", q => q.eq("userId", userId))
        .first();

      const recipientName = recipientProfile?.mascotName ?? undefined;

      try {
        await ctx.scheduler.runAfter(0, api.pushNotifications.sendFriendAcceptNotification, {
          toUserId: request.fromUserId,
          friendName: recipientName,
        });
      } catch (e) {
        console.error("Failed to send friend accept push", e);
      }
    }

    return { success: true, status: newStatus };
  },
});

/*──────────────────────── get list of accepted friend userIds */
export const getFriendIds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Friends where current user is sender
    const sent = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", q => q.eq("fromUserId", userId))
      .filter(q => q.eq(q.field("status"), "accepted"))
      .collect();

    // Friends where current user is receiver
    const received = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", q => q.eq("toUserId", userId))
      .filter(q => q.eq(q.field("status"), "accepted"))
      .collect();

    const ids = new Set<string>();
    sent.forEach(fr => ids.add(fr.toUserId as string));
    received.forEach(fr => ids.add(fr.fromUserId as string));

    return Array.from(ids);
  },
});

/*──────────────────────── get pending friend requests for current user */
export const getPendingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const incomingRaw = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", q => q.eq("toUserId", userId))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();

    // Attach sender name
    const incoming = await Promise.all(
      incomingRaw.map(async (req) => {
        const sender = await ctx.db.get(req.fromUserId);
        return {
          _id: req._id,
          userId: req.fromUserId,
          name: (sender as any)?.name ?? "Unknown",
          createdAt: req.createdAt,
        };
      })
    );

    return incoming;
  },
});

/*──────────────────────── get sent friend requests for current user */
export const getSentFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const outgoingRaw = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", q => q.eq("fromUserId", userId))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();

    const outgoing = await Promise.all(
      outgoingRaw.map(async (req) => {
        const recipient = await ctx.db.get(req.toUserId);
        return {
          _id: req._id,
          userId: req.toUserId,
          name: (recipient as any)?.name ?? "Unknown",
          createdAt: req.createdAt,
        };
      })
    );

    return outgoing;
  },
}); 
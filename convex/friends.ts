import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { api } from "./_generated/api";
import { mutation, query } from "./_generated/server";

/*──────────────────────── send friend request */
export const sendFriendRequest = mutation({
  args: {
    toUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const fromUserId = await getAuthUserId(ctx);
    if (!fromUserId) {
      throw new ConvexError("Not authenticated");
    }

    if (fromUserId === args.toUserId) {
      throw new ConvexError("Cannot send friend request to yourself");
    }

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
      if (existing?.status === "accepted" || reverseExisting?.status === "accepted") {
        throw new ConvexError("Already friends");
      }
      if (existing?.status === "pending" || reverseExisting?.status === "pending") {
        throw new ConvexError("Friend request already sent");
      }
    }

    const now = new Date().toISOString();
    const id = await ctx.db.insert("friendRequests", {
      fromUserId,
      toUserId: args.toUserId,
      status: "pending",
      createdAt: now,
    });

    // Get sender's profile to include name in notification
    const fromUser = await ctx.db.get(fromUserId as any);
    const fromName = (fromUser as any)?.name || (fromUser as any)?.firstName || "Someone";

    // Send push notification to recipient
    try {
      await ctx.scheduler.runAfter(0, api.pushNotifications.sendFriendRequestNotification, {
        toUserId: args.toUserId,
        fromName: fromName,
      });
    } catch (error) {
      console.error("Failed to send friend request notification:", error);
      // Don't fail the request if notification fails
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
    if (!userId) {
      throw new ConvexError("Not authenticated");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new ConvexError("Friend request not found");
    }

    if (request.toUserId !== userId) {
      throw new ConvexError("Not authorized to respond to this request");
    }

    if (request.status !== "pending") {
      throw new ConvexError("Request already responded to");
    }

    const status = args.accept ? "accepted" : "declined";
    await ctx.db.patch(args.requestId, {
      status,
      respondedAt: new Date().toISOString(),
    });

    // Send push notification if request was accepted
    if (args.accept) {
      try {
        // Get current user's profile to include name in notification
        const currentUser = await ctx.db.get(userId as any);
        const currentUserName = (currentUser as any)?.name || (currentUser as any)?.firstName || "Someone";

        await ctx.scheduler.runAfter(0, api.pushNotifications.sendFriendAcceptNotification, {
          toUserId: request.fromUserId,
          friendName: currentUserName,
        });
      } catch (error) {
        console.error("Failed to send friend accept notification:", error);
        // Don't fail the request if notification fails
      }
    }

    return { success: true };
  },
});

/*──────────────────────── get friends */
export const getFriends = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

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

    const friendUserIds = [
      ...sent.map(r => r.toUserId),
      ...received.map(r => r.fromUserId)
    ];

    const friends = await Promise.all(
      friendUserIds.map(id => ctx.db.get(id as any))
    );

    return friends.filter(Boolean);
  },
});

/*──────────────────────── get pending friend requests (incoming) */
export const getIncomingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const incomingRaw = await ctx.db
      .query("friendRequests")
      .withIndex("by_to", q => q.eq("toUserId", userId))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();

    const incoming = await Promise.all(
      incomingRaw.map(async (request) => {
        const fromUser = await ctx.db.get(request.fromUserId as any);
        return {
          ...request,
          fromUser,
        };
      })
    );

    return incoming.filter(r => r.fromUser);
  },
});

/*──────────────────────── get pending friend requests (outgoing) */
export const getOutgoingFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const outgoingRaw = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", q => q.eq("fromUserId", userId))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();

    const outgoing = await Promise.all(
      outgoingRaw.map(async (request) => {
        const toUser = await ctx.db.get(request.toUserId as any);
        return {
          ...request,
          toUser,
        };
      })
    );

    return outgoing.filter(r => r.toUser);
  },
});

/*──────────────────────── get sent friend requests (alias for compatibility) */
export const getSentFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const outgoingRaw = await ctx.db
      .query("friendRequests")
      .withIndex("by_from", q => q.eq("fromUserId", userId))
      .filter(q => q.eq(q.field("status"), "pending"))
      .collect();

    return outgoingRaw.map(request => ({
      userId: request.toUserId,
      status: request.status,
    }));
  },
});

/*──────────────────────── get friends with their gardens */
export const getFriendsWithGardens = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get friends list
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

    const friendUserIds = [
      ...sent.map(r => r.toUserId),
      ...received.map(r => r.fromUserId)
    ];

    // Get friends with their garden data
    const friendsWithGardens = await Promise.all(
      friendUserIds.map(async (friendId) => {
        const friend = await ctx.db.get(friendId as any);
        if (!friend) return null;

        // Get friend's planted plants
        const plants = await ctx.db
          .query("plants")
          .withIndex("by_user_planted", (q) => q.eq("userId", friendId as any).eq("isPlanted", true))
          .collect();

        // Fetch plant type details for each plant
        const plantsWithTypes = await Promise.all(
          plants.map(async (plant) => {
            const plantType = await ctx.db.get(plant.plantTypeId);
            return {
              ...plant,
              plantType,
            };
          })
        );

        return {
          user: friend,
          plants: plantsWithTypes,
        };
      })
    );

    return friendsWithGardens.filter(Boolean);
  },
});

/*──────────────────────── get specific friend's garden */
export const getFriendGarden = query({
  args: {
    friendId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify friendship exists
    const friendshipExists = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", q => q.eq("fromUserId", userId).eq("toUserId", args.friendId))
      .filter(q => q.eq(q.field("status"), "accepted"))
      .first();

    const reverseFriendshipExists = await ctx.db
      .query("friendRequests")
      .withIndex("by_users", q => q.eq("fromUserId", args.friendId).eq("toUserId", userId))
      .filter(q => q.eq(q.field("status"), "accepted"))
      .first();

    if (!friendshipExists && !reverseFriendshipExists) {
      return null;
    }

    // Get friend's user data
    const friend = await ctx.db.get(args.friendId);
    if (!friend) {
      return null;
    }

    // Get friend's planted plants
    const plants = await ctx.db
      .query("plants")
      .withIndex("by_user_planted", (q) => q.eq("userId", args.friendId as any).eq("isPlanted", true))
      .collect();

    // Fetch plant type details for each plant
    const plantsWithTypes = await Promise.all(
      plants.map(async (plant) => {
        const plantType = await ctx.db.get(plant.plantTypeId);
        return {
          ...plant,
          plantType,
        };
      })
    );

    return {
      user: friend,
      plants: plantsWithTypes,
    };
  },
});

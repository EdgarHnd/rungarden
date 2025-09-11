import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all support messages for the current user
export const getUserSupportMessages = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Send a support message from the user
export const sendSupportMessage = mutation({
  args: {
    message: v.string(),
  },
  handler: async (ctx, { message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const now = new Date().toISOString();

    const messageId = await ctx.db.insert("supportMessages", {
      userId,
      message: message.trim(),
      isFromSupport: false,
      createdAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

// Admin function to send a support reply (for future use by support team)
export const sendSupportReply = mutation({
  args: {
    userId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, { userId, message }) => {
    // Note: In a real app, you'd want to add admin authentication here
    // For now, this is just a placeholder for support team functionality
    
    if (!message.trim()) {
      throw new Error("Message cannot be empty");
    }

    const now = new Date().toISOString();

    const messageId = await ctx.db.insert("supportMessages", {
      userId,
      message: message.trim(),
      isFromSupport: true,
      createdAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

// Get all support conversations (for admin/support team use)
export const getAllSupportConversations = query({
  args: {},
  handler: async (ctx) => {
    // Note: In a real app, you'd want to add admin authentication here
    
    const messages = await ctx.db
      .query("supportMessages")
      .order("desc")
      .collect();

    // Group messages by user
    const conversations = new Map<string, typeof messages>();
    
    for (const message of messages) {
      if (!conversations.has(message.userId)) {
        conversations.set(message.userId, []);
      }
      conversations.get(message.userId)!.push(message);
    }

    // Convert to array and sort by latest message
    const conversationArray = Array.from(conversations.entries()).map(([userId, msgs]) => ({
      userId,
      messages: msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      lastMessage: msgs[0], // Most recent message (since we ordered desc)
    }));

    // Sort conversations by most recent message
    conversationArray.sort((a, b) => 
      new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
    );

    return conversationArray;
  },
});

// Get support conversation for a specific user (for admin/support team use)
export const getUserSupportConversation = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Note: In a real app, you'd want to add admin authentication here
    
    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    // Get user profile for context
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return {
      userId,
      userProfile,
      messages,
    };
  },
});

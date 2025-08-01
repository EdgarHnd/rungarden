import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

/**
 * Initialize coach cards with running tips
 */
export const initializeCoachCards = mutation({
  handler: async (ctx) => {
    // Check if cards already exist
    const existingCards = await ctx.db.query('coachCards').collect();
    if (existingCards.length > 0) {
      return { message: 'Coach cards already initialized' };
    }

    const coachCards = [
      {
        title: 'Perfect Running Form',
        content: 'Keep your posture tall and relaxed. Land with your foot under your body, not in front. Aim for a slight forward lean from your ankles, not your waist. Quick, light steps beat long strides every time!',
        category: 'technique' as const,
        iconEmoji: '🏃‍♂️',
        orderIndex: 1,
        createdAt: new Date().toISOString(),
      },
      {
        title: 'Fuel Your Runs',
        content: 'Eat a light snack 30-60 minutes before running. Bananas, dates, or a small energy bar work great. After long runs (60+ minutes), refuel within 30 minutes with carbs and protein to help recovery.',
        category: 'nutrition' as const,
        iconEmoji: '🍌',
        orderIndex: 2,
        createdAt: new Date().toISOString(),
      },
      {
        title: 'Mental Strength',
        content: 'When it gets tough, break your run into smaller chunks. Focus on reaching the next landmark, not the finish. Remember: your mind gives up before your body does. You\'re stronger than you think!',
        category: 'mindset' as const,
        iconEmoji: '🧠',
        orderIndex: 3,
        createdAt: new Date().toISOString(),
      },
    ];

    const insertedCards = await Promise.all(
      coachCards.map(card => ctx.db.insert('coachCards', card))
    );

    return { 
      message: 'Coach cards initialized successfully',
      cardIds: insertedCards 
    };
  },
});

/**
 * Get all coach cards
 */
export const getCoachCards = query({
  handler: async (ctx) => {
    return await ctx.db.query('coachCards')
      .order('asc')
      .collect();
  },
});

/**
 * Get coach card by ID
 */
export const getCoachCard = query({
  args: { cardId: v.id('coachCards') },
  handler: async (ctx, { cardId }) => {
    return await ctx.db.get(cardId);
  },
});

/**
 * Get week rewards for a user's training plan
 */
export const getWeekRewards = query({
  args: { 
    userId: v.id('users'),
    planId: v.id('trainingPlans')
  },
  handler: async (ctx, { userId, planId }) => {
    return await ctx.db.query('weekRewards')
      .withIndex('by_user_plan', q => q.eq('userId', userId).eq('planId', planId))
      .collect();
  },
});

/**
 * Get week rewards with populated card data for a user's training plan
 */
export const getWeekRewardsWithCards = query({
  args: { 
    userId: v.id('users'),
    planId: v.id('trainingPlans')
  },
  handler: async (ctx, { userId, planId }) => {
    const weekRewards = await ctx.db.query('weekRewards')
      .withIndex('by_user_plan', q => q.eq('userId', userId).eq('planId', planId))
      .collect();

    // Populate cards
    const weekRewardsWithCards = await Promise.all(
      weekRewards.map(async (reward) => {
        const card = await ctx.db.get(reward.cardId);
        return {
          ...reward,
          card,
        };
      })
    );

    return weekRewardsWithCards;
  },
});

/**
 * Check if a specific week reward has been claimed
 */
export const isWeekRewardClaimed = query({
  args: {
    userId: v.id('users'),
    planId: v.id('trainingPlans'),
    weekNumber: v.number()
  },
  handler: async (ctx, { userId, planId, weekNumber }) => {
    const reward = await ctx.db.query('weekRewards')
      .withIndex('by_user_week', q => 
        q.eq('userId', userId).eq('planId', planId).eq('weekNumber', weekNumber)
      )
      .first();
    
    return reward !== null;
  },
});

/**
 * Preview what card would be assigned to a week (without claiming)
 */
export const previewWeekRewardCard = query({
  args: {
    weekNumber: v.number()
  },
  handler: async (ctx, { weekNumber }) => {
    // Get available coach cards
    const coachCards = await ctx.db.query('coachCards')
      .order('asc')
      .collect();
    
    if (coachCards.length === 0) {
      return null;
    }

    // Pick a card based on week number (same logic as claiming)
    const cardIndex = (weekNumber - 1) % coachCards.length;
    return coachCards[cardIndex];
  },
});

/**
 * Claim a week reward
 */
export const claimWeekReward = mutation({
  args: {
    userId: v.id('users'),
    planId: v.id('trainingPlans'),
    weekNumber: v.number()
  },
  handler: async (ctx, { userId, planId, weekNumber }) => {
    // Check if already claimed
    const existingReward = await ctx.db.query('weekRewards')
      .withIndex('by_user_week', q => 
        q.eq('userId', userId).eq('planId', planId).eq('weekNumber', weekNumber)
      )
      .first();
    
    if (existingReward) {
      throw new Error('Week reward already claimed');
    }

    // Get available coach cards
    const coachCards = await ctx.db.query('coachCards')
      .order('asc')
      .collect();
    
    if (coachCards.length === 0) {
      throw new Error('No coach cards available');
    }

    // Pick a card based on week number (cycling through available cards)
    const cardIndex = (weekNumber - 1) % coachCards.length;
    const selectedCard = coachCards[cardIndex];

    // Create the reward record
    const rewardId = await ctx.db.insert('weekRewards', {
      userId,
      planId,
      weekNumber,
      cardId: selectedCard._id,
      claimedAt: new Date().toISOString(),
    });

    return {
      rewardId,
      card: selectedCard,
    };
  },
});

/**
 * Get the card for a claimed week reward
 */
export const getClaimedWeekReward = query({
  args: {
    userId: v.id('users'),
    planId: v.id('trainingPlans'),
    weekNumber: v.number()
  },
  handler: async (ctx, { userId, planId, weekNumber }) => {
    const reward = await ctx.db.query('weekRewards')
      .withIndex('by_user_week', q => 
        q.eq('userId', userId).eq('planId', planId).eq('weekNumber', weekNumber)
      )
      .first();

    if (!reward) {
      return null;
    }

    const card = await ctx.db.get(reward.cardId);
    
    return {
      ...reward,
      card,
    };
  },
});
/*
 * Centralised coin helpers – all mutations that earn or spend embers should
 * go through these helpers so we keep balance changes consistent and get an
 * audit trail in coinTransactions.
 */

// Types are loose to avoid importing every server type here.
export async function addCoins(
  ctx: any,
  userId: string,
  amount: number,
  source: string,
  referenceId?: any
): Promise<void> {
  if (amount <= 0) return;

  // Fetch the profile to patch balance afterwards
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    throw new Error("Profile not found");
  }

  // Insert ledger entry
  await ctx.db.insert("coinTransactions", {
    userId,
    type: "earn",
    amount,
    source,
    referenceId,
    createdAt: new Date().toISOString(),
  });

  // Update balance
  await ctx.db.patch(profile._id, {
    coins: (profile.coins ?? 0) + amount,
    updatedAt: new Date().toISOString(),
  });
}

export async function spendCoinsInternal(
  ctx: any,
  userId: string,
  amount: number,
  source: string,
  referenceId?: any
): Promise<number> /* returns remaining balance */ {
  if (amount <= 0) throw new Error("Amount must be positive");

  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();

  if (!profile) {
    throw new Error("Profile not found");
  }

  const currentCoins = profile.coins ?? 0;
  if (currentCoins < amount) {
    throw new Error("Insufficient coins");
  }

  // Insert ledger entry
  await ctx.db.insert("coinTransactions", {
    userId,
    type: "spend",
    amount,
    source,
    referenceId,
    createdAt: new Date().toISOString(),
  });

  const remainingCoins = currentCoins - amount;
  await ctx.db.patch(profile._id, {
    coins: remainingCoins,
    updatedAt: new Date().toISOString(),
  });

  return remainingCoins;
} 
import Apple from "@auth/core/providers/apple";
import Google from "@auth/core/providers/google";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { convexAuth, createAccount, retrieveAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Apple,
    ConvexCredentials({
      id: "native-apple",
      authorize: async (credentials: Record<string, any>, ctx: any) => {
        const { identityToken, user: clientAppleUserId } = credentials as any;

        if (!identityToken || !clientAppleUserId) {
          throw new Error("Invalid Apple credentials");
        }

        const verifyTokenAction = (internal as any)["internal/verifyAppleToken"].verifyAppleToken;
        const validated = await ctx.runAction(verifyTokenAction, {
          identityToken,
        });

        if (validated.appleUserId !== clientAppleUserId) {
          throw new Error("User ID mismatch");
        }

        // Try to find existing account
        let existing: any = null;
        try {
          existing = await retrieveAccount(ctx, {
            provider: "native-apple",
            account: { id: validated.email ?? validated.appleUserId },
          });
        } catch (err: any) {
          // This error string is returned when the account doesn't exist yet. Treat as new account.
          if (err?.message !== "InvalidAccountId") {
            throw err;
          }
        }

        if (existing) {
          return { userId: existing.user._id };
        }

        const account = await createAccount(ctx, {
          provider: "native-apple",
          account: { id: validated.email ?? validated.appleUserId },
          profile: {
            email: validated.email,
            name: validated.name ?? "Apple user",
            emailVerificationTime: Date.now(),
          },
          shouldLinkViaEmail: true,
        });
        return { userId: account.user._id };
      },
    }),
  ],
});

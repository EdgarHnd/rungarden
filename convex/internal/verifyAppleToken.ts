import { v } from "convex/values";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { action } from "../_generated/server";

/**
 * Verify Apple identity token and return the Apple user id and email.
 * Uses Apple public JWKS, so no secret is required.
 */
export const verifyAppleToken = action({
  args: {
    identityToken: v.string(),
  },
  handler: async (_ctx: any, args: { identityToken: string }) => {
    const JWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

    const { payload } = await jwtVerify(args.identityToken, JWKS, {
      issuer: "https://appleid.apple.com",
    });

    // Payload docs: https://developer.apple.com/documentation/sign_in_with_apple/token_response/
    const email = (payload as any).email as string | undefined;
    const appleUserId = payload.sub as string;

    return {
      email,
      appleUserId,
      name: (payload as any).name as string | undefined,
    };
  },
}); 
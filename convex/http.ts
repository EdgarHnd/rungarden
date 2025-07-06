import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// Strava Webhook Validation (GET request)
http.route({
  path: "/strava/webhooks",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const hubMode = url.searchParams.get("hub.mode");
    const hubChallenge = url.searchParams.get("hub.challenge");
    const hubVerifyToken = url.searchParams.get("hub.verify_token");

    console.log("[Strava Webhook] Validation request:", {
      hubMode,
      hubChallenge,
      hubVerifyToken,
      fullUrl: request.url
    });

    // Accept production token from env and a "test" token for local debugging
    const validTokens = [process.env.STRAVA_WEBHOOK_VERIFY_TOKEN, "blaze-webhook-token", "test"].filter(Boolean) as string[];
    const isValidToken = validTokens.includes(hubVerifyToken || "");

    // Validate the subscription request
    if (hubMode === "subscribe" && hubChallenge && isValidToken) {
      console.log("[Strava Webhook] Validation successful, returning challenge");
      
      // Return the challenge exactly as Strava expects
      const response = {
        "hub.challenge": hubChallenge
      };
      
      console.log("[Strava Webhook] Sending response:", response);
      
      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("[Strava Webhook] Validation failed - missing hubMode, hubChallenge, or incorrect verify_token");
    console.log("[Strava Webhook] Expected verify_token: blaze-webhook-token or test, received:", hubVerifyToken);
    return new Response("Validation failed", { status: 400 });
  }),
});

// Strava Webhook Events (POST request)
http.route({
  path: "/strava/webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const event = await request.json();
      
      console.log("[Strava Webhook] Received event:", event);

      // Process the webhook event
      await ctx.runMutation(api.stravaWebhooks.processWebhookEvent, { event });

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("[Strava Webhook] Error processing webhook:", error);
      return new Response("Error", { status: 500 });
    }
  }),
});

export default http;

# Strava Webhooks Setup Guide

This guide explains how to set up Strava webhooks for real-time activity updates in your Koko app.

## Prerequisites

1. **Strava API Credentials**: You need your Strava app's `client_id` and `client_secret`
2. **Environment Variables**: Set these in your environment:

   ```
   STRAVA_CLIENT_ID=your_client_id
   STRAVA_CLIENT_SECRET=your_client_secret
   ```

3. **Public Webhook URL**: Your Convex deployment must be publicly accessible

## Webhook URL

Your webhook endpoint will be:

```
https://your-convex-deployment.convex.cloud/strava/webhooks
https://fast-dragon-309.convex.site
```

## Setup Steps

### 1. Deploy Your Changes

First, ensure all webhook code is deployed to Convex:

```bash
npx convex dev  # or npx convex deploy
```

### 2. Test Webhook Endpoint

Test that your webhook endpoint responds to validation requests:

```bash
curl -X GET 'https://fast-dragon-309.convex.site/strava/webhooks?hub.verify_token=test&hub.challenge=15f7d1a91c1f40f8a748fd134752feb3&hub.mode=subscribe'
```

Expected response:

```json
{"hub.challenge":"15f7d1a91c1f40f8a748fd134752feb3"}
```

### 3. Create Webhook Subscription

#### Option A: Using DatabaseStravaService (Recommended)

```javascript
// In your app or a script
import DatabaseStravaService from '@/services/DatabaseStravaService';
import { ConvexReactClient } from 'convex/react';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
const stravaService = new DatabaseStravaService(convex);

const result = await stravaService.createWebhookSubscription(
  'https://your-convex-deployment.convex.cloud/strava/webhooks',
  'your-verify-token'  // Choose any string
);

console.log('Subscription created:', result);
```

#### Option B: Using cURL

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_CLIENT_ID \
  -F client_secret=YOUR_CLIENT_SECRET \
  -F callback_url=https://your-convex-deployment.convex.cloud/strava/webhooks \
  -F verify_token=YOUR_VERIFY_TOKEN
```

### 4. Verify Subscription

Check if your subscription was created:

```javascript
const subscriptions = await stravaService.viewWebhookSubscription();
console.log('Active subscriptions:', subscriptions);
```

## How It Works

### 1. **Webhook Validation**

- Strava sends a GET request to validate your endpoint
- Your endpoint responds with the challenge token
- Subscription is activated

### 2. **Event Processing**

- When users create/update/delete activities, Strava sends POST requests
- Your webhook processes these events and queues syncs
- Users get real-time updates without polling

### 3. **Event Types**

The webhook handles these events:

- **Activity Created**: Triggers sync for new activities
- **Activity Updated**: Re-syncs modified activities  
- **Activity Deleted**: Removes activities from your database
- **Athlete Deauthorized**: Disables Strava sync for that user

### 4. **Sync Queue**

- Events are queued in the `stravaSyncQueue` table
- Your app can process these queues to sync activities
- Prevents duplicate processing and allows retry logic

## Testing

### 1. Test with Fake Event

```bash
curl -X POST https://fast-dragon-309.convex.site/strava/webhooks \
  -H 'Content-Type: application/json' \
  -d '{
    "aspect_type": "create",
    "event_time": 1549560669,
    "object_id": 1234567890,
    "object_type": "activity",
    "owner_id": 999999,
    "subscription_id": 12345
  }'
```

### 2. Monitor Logs

Check your Convex logs for webhook processing:

```bash
npx convex logs
```

## Troubleshooting

### Subscription Creation Fails

1. **Check credentials**: Ensure `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct
2. **Test endpoint**: Verify your webhook URL responds to GET requests
3. **Response time**: Endpoint must respond within 2 seconds
4. **Delete existing**: You can only have one subscription per app

### Not Receiving Events

1. **Check scopes**: Users must authorize with `activity:read` or `activity:read_all`
2. **Verify athlete ID**: Ensure `stravaAthleteId` is stored in user profiles
3. **Monitor logs**: Check webhook processing logs
4. **Test manually**: Send test events to verify processing

### Delete Subscription

If you need to start over:

```javascript
await stravaService.deleteWebhookSubscription(subscriptionId);
```

## Integration with Your App

### 1. Auto-Store Athlete ID

The app automatically stores Strava athlete IDs when users connect:

```javascript
// This happens automatically in settings when connecting
await stravaService.storeStravaAthleteId(userId);
```

### 2. Process Sync Queue

You can add background processing to handle the sync queue:

```javascript
// Check for pending syncs
const pendingSyncs = await convex.query(api.stravaWebhooks.getAllPendingSyncs);

// Process each sync
for (const sync of pendingSyncs) {
  await stravaService.forceSyncFromStrava(30);
  await convex.mutation(api.stravaWebhooks.markSyncCompleted, { 
    syncId: sync._id 
  });
}
```

## Benefits

- ✅ **Real-time updates**: Activities appear immediately
- ✅ **Reduced API calls**: No more polling Strava
- ✅ **Better UX**: Users see new activities instantly
- ✅ **Reliable**: Webhook retries ensure delivery
- ✅ **Scalable**: Handles multiple users efficiently

## Security Notes

- Webhook endpoint is public but validates events
- Consider adding signature verification for production
- Athlete IDs are used to match events to users
- Revoked access is handled automatically

# DocuSynth Slack App Setup Guide

This guide walks you through setting up the DocuSynth Slack bot for your workspace.

## Prerequisites

- A Slack workspace where you have admin permissions
- A deployed DocuSynth instance with the Convex backend running
- Access to the Slack API at https://api.slack.com/apps

## Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From an app manifest**
4. Select your workspace
5. Paste the contents of `manifest.json` from this directory
6. Click **Create**

## Step 2: Configure Environment Variables

Add these environment variables to your Convex deployment:

```bash
# In your Convex dashboard under Settings > Environment Variables
SLACK_SIGNING_SECRET=your_signing_secret_here
```

To find your signing secret:
1. Go to your app's **Basic Information** page
2. Scroll to **App Credentials**
3. Copy the **Signing Secret**

## Step 3: Install the App to Your Workspace

1. Go to your app's **Install App** page
2. Click **Install to Workspace**
3. Review and authorize the requested permissions
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## Step 4: Configure the Bot in DocuSynth

1. Log into your DocuSynth dashboard
2. Go to **Settings > Integrations > Slack**
3. Enter:
   - **Bot Token**: The `xoxb-` token from Step 3
   - **Team ID**: Your Slack workspace ID (found in your Slack URL)
4. Click **Save Configuration**

## Step 5: Set Up Request URLs

Update your Slack app's request URLs:

### Events API
1. Go to **Event Subscriptions**
2. Enable Events
3. Set Request URL to: `https://YOUR_CONVEX_URL/api/slack/events`
4. Subscribe to bot events:
   - `app_mention`
   - `message.im` (optional, for DMs)

### Slash Commands
1. Go to **Slash Commands**
2. Create a new command: `/docusynth`
3. Set Request URL to: `https://YOUR_CONVEX_URL/api/slack/commands`
4. Add description: "Access DocuSynth documentation tools"
5. Add usage hint: `[search|generate|list|share|help] [args]`

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/docusynth help` | Show available commands | `/docusynth help` |
| `/docusynth search <query>` | Search your documents | `/docusynth search react hooks` |
| `/docusynth generate <topic>` | Generate new documentation | `/docusynth generate Next.js 14 app router` |
| `/docusynth list` | List your recent documents | `/docusynth list` |
| `/docusynth share <doc-id>` | Share a document in channel | `/docusynth share abc123` |
| `/docusynth link` | Link your DocuSynth account | `/docusynth link` |

## Mentions

You can also interact with the bot by mentioning it:

```
@DocuSynth search typescript generics
@DocuSynth generate Python FastAPI best practices
```

## Required OAuth Scopes

The app manifest includes these scopes:

**Bot Token Scopes:**
- `app_mentions:read` - Read mentions of the bot
- `chat:write` - Send messages
- `commands` - Handle slash commands
- `im:history` - Read DM history (optional)
- `im:read` - Read DM metadata
- `im:write` - Send DMs
- `users:read` - Read user info for linking

## Troubleshooting

### "Invalid signature" errors
- Verify your `SLACK_SIGNING_SECRET` environment variable is correct
- Check that the timestamp header is being sent correctly

### Bot not responding
- Ensure the bot is invited to the channel: `/invite @DocuSynth`
- Check that Event Subscriptions are enabled and verified
- Verify the Request URL is correct and returns 200 OK

### "Please link your account" message
- Users need to run `/docusynth link` first
- This connects their Slack user to their DocuSynth account

### Rate limiting
- Slack has a 1 request per second rate limit for posting messages
- DocuSynth automatically handles rate limiting

## Security Considerations

1. **Never share your Signing Secret or Bot Token**
2. All requests are verified using Slack's signature verification
3. Bot tokens are stored encrypted in the database
4. Users must explicitly link their accounts

## Support

For issues with the Slack integration:
- Check the bot command logs in your DocuSynth dashboard
- Review Convex function logs for errors
- Contact support@docusynth.ai

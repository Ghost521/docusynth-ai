# DocuSynth Discord Bot Setup Guide

This guide walks you through setting up the DocuSynth Discord bot for your server.

## Prerequisites

- A Discord server where you have administrator permissions
- A deployed DocuSynth instance with the Convex backend running
- Access to the Discord Developer Portal at https://discord.com/developers/applications

## Step 1: Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter a name (e.g., "DocuSynth") and click **Create**
4. Go to **General Information** and note the **Application ID**

## Step 2: Configure the Bot

1. Go to the **Bot** section in your application
2. Click **Add Bot** if you haven't already
3. Under **Privileged Gateway Intents**, enable:
   - **Message Content Intent** (if you want mention support)
4. Copy the **Token** (click "Reset Token" if needed)

## Step 3: Configure Environment Variables

Add these environment variables to your Convex deployment:

```bash
# In your Convex dashboard under Settings > Environment Variables
DISCORD_PUBLIC_KEY=your_public_key_here
```

To find your public key:
1. Go to your application's **General Information** page
2. Copy the **Public Key**

## Step 4: Set Up Interactions Endpoint

1. Go to **General Information**
2. Set **Interactions Endpoint URL** to: `https://YOUR_CONVEX_URL/api/discord/interactions`
3. Click **Save Changes**
4. Discord will verify the endpoint (ensure your Convex backend is running)

## Step 5: Register Slash Commands

Run the following script to register the slash commands with Discord. You can use the `commands.json` file in this directory.

```bash
# Using curl
curl -X PUT \
  "https://discord.com/api/v10/applications/YOUR_APP_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @commands.json

# Or for a specific guild (faster updates during development)
curl -X PUT \
  "https://discord.com/api/v10/applications/YOUR_APP_ID/guilds/YOUR_GUILD_ID/commands" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @commands.json
```

## Step 6: Invite the Bot to Your Server

1. Go to **OAuth2 > URL Generator**
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - `Send Messages`
   - `Embed Links`
   - `Read Message History`
   - `Use Slash Commands`
4. Copy the generated URL and open it in your browser
5. Select your server and authorize

## Step 7: Configure the Bot in DocuSynth

1. Log into your DocuSynth dashboard
2. Go to **Settings > Integrations > Discord**
3. Enter:
   - **Bot Token**: The token from Step 2
   - **Guild ID**: Your Discord server ID (enable Developer Mode in Discord settings, right-click server > Copy ID)
4. Click **Save Configuration**

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/docusynth help` | Show available commands | `/docusynth help` |
| `/docusynth search <query>` | Search your documents | `/docusynth search react hooks` |
| `/docusynth generate <topic>` | Generate new documentation | `/docusynth generate Next.js 14 app router` |
| `/docusynth list` | List your recent documents | `/docusynth list` |
| `/docusynth share <doc-id>` | Share a document in channel | `/docusynth share abc123` |
| `/docusynth link` | Link your DocuSynth account | `/docusynth link` |

## Command Registration Details

The `commands.json` file in this directory contains the full command structure:

```json
{
  "name": "docusynth",
  "description": "DocuSynth documentation tools",
  "options": [
    {
      "name": "search",
      "type": 1,
      "description": "Search documents",
      "options": [...]
    },
    ...
  ]
}
```

Global commands can take up to 1 hour to propagate. For development, use guild-specific commands which update instantly.

## Required Bot Permissions

- **Send Messages** - To respond to commands
- **Embed Links** - For rich message formatting
- **Read Message History** - To support mentions
- **Use Slash Commands** - For slash command functionality

Permission Integer: `274877991936`

## Troubleshooting

### "Invalid signature" errors
- Verify your `DISCORD_PUBLIC_KEY` environment variable is correct
- Ensure the Interactions Endpoint URL is accessible

### Commands not appearing
- Wait up to 1 hour for global commands to propagate
- For instant updates, use guild-specific command registration
- Ensure you've authorized `applications.commands` scope

### Bot not responding
- Check that the bot has been invited with correct permissions
- Verify the bot is online in the server member list
- Check Convex function logs for errors

### "Please link your account" message
- Users need to run `/docusynth link` first
- This connects their Discord user to their DocuSynth account

### Embeds not displaying correctly
- Ensure the bot has "Embed Links" permission
- Check that the channel allows embeds

## Security Considerations

1. **Never share your Bot Token**
2. All interactions are verified using Discord's Ed25519 signature
3. Bot tokens are stored encrypted in the database
4. Users must explicitly link their accounts

## Rate Limits

Discord has rate limits for interactions:
- Global: 50 requests per second
- Per-route limits vary

DocuSynth handles rate limiting automatically and uses deferred responses for long-running commands.

## Support

For issues with the Discord integration:
- Check the bot command logs in your DocuSynth dashboard
- Review Convex function logs for errors
- Contact support@docusynth.ai

# DocuSynth AI Chrome Extension

A Chrome extension for capturing web content and generating token-optimized documentation for LLMs directly from any webpage.

## Features

- **Quick Capture**: Right-click on any page to add it as a source for documentation
- **Selection Capture**: Capture selected text snippets from web pages
- **Generate Context**: Generate AI-optimized documentation from the current page
- **Popup UI**: Quick access to recent documents and captured sources
- **Options Page**: Configure API key, server URL, and preferences
- **Badge Counter**: See how many sources you've captured at a glance
- **Keyboard Shortcuts**: Fast capture with Alt+Shift+P (page) and Alt+Shift+C (selection)
- **Dark Mode**: Automatic dark mode support based on system preferences

## Installation

### Development Installation

1. **Clone or download** this extension folder

2. **Create extension icons** (see `icons/README.md` for instructions)

3. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode" (toggle in top right)

4. **Load the extension**:
   - Click "Load unpacked"
   - Select the `chrome-extension` directory

5. **Configure the extension**:
   - Click the extension icon and go to Settings
   - Enter your DocuSynth AI API key
   - Verify the server URL is correct

### Production Installation

Once published to the Chrome Web Store:

1. Visit the Chrome Web Store listing
2. Click "Add to Chrome"
3. Configure your API key in the extension options

## Usage

### Capturing Sources

**Method 1: Context Menu**
1. Right-click anywhere on a webpage
2. Select "Capture page as source" or "Capture selection as source"

**Method 2: Popup**
1. Click the extension icon
2. Click "Capture Page" or select text first and click "Capture Selection"

**Method 3: Keyboard Shortcuts**
- `Alt + Shift + P` - Capture current page
- `Alt + Shift + C` - Capture selected text

### Generating Documentation

**From Current Page:**
1. Click the extension icon
2. Click "Generate Docs"
3. Wait for the AI to process the page

**From Captured Sources:**
1. Capture multiple sources as described above
2. Click the extension icon
3. Click "Generate from Sources"
4. The app will open with your sources pre-loaded

### Managing Sources

- View captured sources in the popup
- Remove individual sources by clicking the X button
- Clear all sources using "Clear All" in the popup
- Sources are stored locally and persist across browser sessions

## Configuration

### API Settings

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Your DocuSynth AI API key | Required |
| Server URL | DocuSynth AI server address | `http://localhost:3000` |

### Advanced Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Auto-capture | Automatically add pages when using context menu | On |
| Show notifications | Display browser notifications for events | On |
| Badge counter | Show source count on extension icon | On |

## File Structure

```
chrome-extension/
├── manifest.json           # Extension manifest (v3)
├── README.md              # This file
├── popup/
│   ├── popup.html         # Popup UI markup
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── options/
│   ├── options.html       # Options page markup
│   ├── options.css        # Options styles
│   └── options.js         # Options logic
├── background/
│   └── service-worker.js  # Background service worker
├── content/
│   └── content.js         # Content script for page interaction
├── lib/
│   └── api.js             # Shared API client
└── icons/
    ├── README.md          # Icon creation instructions
    ├── icon16.png         # 16x16 icon
    ├── icon32.png         # 32x32 icon
    ├── icon48.png         # 48x48 icon
    └── icon128.png        # 128x128 icon
```

## API Endpoints Used

The extension communicates with the DocuSynth AI server using these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Check server connectivity |
| `/api/documents` | GET | List recent documents |
| `/api/documents` | POST | Create a new document |
| `/api/generate` | POST | Generate documentation from sources |

All requests include the `X-API-Key` header for authentication.

## Development

### Prerequisites

- Chrome browser (version 88 or higher for Manifest V3)
- DocuSynth AI server running locally or accessible remotely

### Making Changes

1. Edit the source files
2. Go to `chrome://extensions`
3. Click the refresh icon on the extension card
4. Test your changes

### Debugging

- **Popup**: Right-click the extension icon > "Inspect popup"
- **Background**: Click "Service worker" link on the extension card
- **Content Script**: Open DevTools on any page and check the console
- **Options Page**: Open options and use DevTools normally

### Testing

1. Load the extension in developer mode
2. Open various web pages to test content capture
3. Verify the popup displays correctly
4. Test keyboard shortcuts
5. Ensure API communication works with your server

## Troubleshooting

### "API key not configured"
- Open extension options and enter your API key
- Make sure to save the settings

### "Not connected" status
- Verify the server URL is correct
- Ensure the DocuSynth AI server is running
- Check that your API key is valid

### Context menu not appearing
- Refresh the page after installing the extension
- Reload the extension from chrome://extensions

### Badge not updating
- Check that "Badge counter" is enabled in settings
- Reload the extension

## Security

- API keys are stored securely using Chrome's `chrome.storage.sync`
- The extension only requests necessary permissions
- Content scripts have minimal page access
- All API requests go through the background service worker

## Permissions

| Permission | Purpose |
|------------|---------|
| `storage` | Store settings and captured sources |
| `contextMenus` | Add right-click capture options |
| `activeTab` | Access current tab for capture |
| `notifications` | Show capture/generation notifications |
| `alarms` | Periodic badge updates |
| `<all_urls>` | Capture content from any website |

## License

This extension is part of the DocuSynth AI project.

## Support

For issues or feature requests, please open an issue in the main DocuSynth AI repository.

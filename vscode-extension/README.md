# DocuSynth AI - VS Code Extension

Access DocuSynth AI documentation context directly within VS Code. Browse, search, and insert AI-optimized documentation into your code.

## Features

### Document Browser
A dedicated sidebar view showing all your DocuSynth projects and documents organized in a tree structure.

- View projects and their documents
- Quick access to document content
- Expand/collapse project folders
- See document tags and metadata

### Insert Context
Insert documentation context directly at your cursor position.

- Select a document from the tree view and click "Insert"
- Use the command palette: `DocuSynth: Insert Document Context`
- Keyboard shortcut: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Shift+I` (Mac)

### Generate Documentation from Selection
Select code in your editor and generate documentation for it.

1. Select the code you want to document
2. Right-click and choose "Generate Documentation from Selection"
3. Provide context about what documentation you need
4. Choose to insert, copy, or view the generated docs

### Search Documents
Quickly search across all your documents.

- Use the command palette: `DocuSynth: Search Documents`
- Keyboard shortcut: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
- Search by title, content, or tags

## Installation

### From VSIX File

1. Build the extension:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   npx vsce package
   ```

2. Install in VS Code:
   - Open VS Code
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Click the `...` menu and select "Install from VSIX..."
   - Select the generated `.vsix` file

### From Source (Development)

1. Clone the repository and navigate to the extension folder:
   ```bash
   cd vscode-extension
   npm install
   npm run compile
   ```

2. Open VS Code in the extension folder and press `F5` to launch the Extension Development Host.

## Configuration

Configure the extension in VS Code settings (`Ctrl+,`):

| Setting | Description | Default |
|---------|-------------|---------|
| `docusynth.serverUrl` | URL of the DocuSynth AI server | `http://localhost:3000` |
| `docusynth.apiKey` | Your DocuSynth API key | (empty) |
| `docusynth.autoRefresh` | Automatically refresh documents on startup | `true` |
| `docusynth.insertFormat` | Format for inserted content (`markdown`, `plain`, `xml`) | `markdown` |
| `docusynth.maxSearchResults` | Maximum search results to display | `20` |

### Setting Your API Key

1. Use the command palette: `DocuSynth: Configure API Key`
2. Or add to your VS Code settings:
   ```json
   {
     "docusynth.apiKey": "your-api-key-here"
   }
   ```

## Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `DocuSynth: Refresh Documents` | Refresh the document list | - |
| `DocuSynth: Search Documents` | Search across all documents | `Ctrl+Shift+D` |
| `DocuSynth: Insert Document Context` | Insert selected document at cursor | `Ctrl+Shift+I` |
| `DocuSynth: Generate Documentation from Selection` | Generate docs for selected code | - |
| `DocuSynth: Configure API Key` | Set your API key | - |
| `DocuSynth: Open Document` | View document in editor | - |
| `DocuSynth: Copy Document Content` | Copy document to clipboard | - |

## Insert Formats

Choose how document content is formatted when inserted:

### Markdown (default)
```markdown
# Document Title

Document content here...

## Sources
- https://source1.com
- https://source2.com

---
Tags: tag1, tag2
```

### Plain Text
```
Document Title
==============

Document content here...

Sources:
- https://source1.com
- https://source2.com
```

### XML
```xml
<document id="doc-id" title="Document Title">
<content>
Document content here...
</content>
<sources>
  <source>https://source1.com</source>
  <source>https://source2.com</source>
</sources>
<tags>
  <tag>tag1</tag>
  <tag>tag2</tag>
</tags>
</document>
```

## API Requirements

This extension requires a running DocuSynth AI server with the REST API enabled. The API should support:

- `GET /api/documents` - List all documents
- `GET /api/projects` - List all projects
- `POST /api/generate` - Generate documentation

Authentication is done via the `X-API-Key` header.

## Troubleshooting

### "Could not connect to DocuSynth server"
- Verify the server URL in settings
- Ensure the DocuSynth server is running
- Check if a firewall is blocking the connection

### "Invalid API key"
- Verify your API key is correct
- Use `DocuSynth: Configure API Key` to update it

### Documents not loading
- Click the refresh button in the Documents view
- Check the Output panel for errors (View > Output, select "DocuSynth AI")

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension
npx vsce package

# Lint code
npm run lint
```

## License

MIT License - see LICENSE file for details.

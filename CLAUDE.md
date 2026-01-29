# CLAUDE.md

## Project Overview

DocuSynth AI is a React/TypeScript SPA that generates token-optimized documentation context for LLMs. It synthesizes docs from web search, website crawling, and GitHub repositories into structured documents optimized for AI consumption.

## Tech Stack

- **Framework:** React 19 with TypeScript 5.8
- **Build:** Vite 6.2 (dev server on port 3000)
- **Styling:** Tailwind CSS 4.x (loaded via CDN in index.html)
- **AI:** Google Gemini via `@google/genai`
- **Other:** react-markdown, react-syntax-highlighter, jszip, uuid

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run preview  # Preview production build
```

## Project Structure

```
├── App.tsx              # Main component - all core state and logic (1073 lines)
├── index.tsx            # React entry point
├── index.html           # HTML template with Tailwind CDN + import maps
├── types.ts             # All TypeScript interfaces
├── components/          # React components (18 files)
├── services/            # Business logic modules (5 files)
├── data/                # Static data (presets.ts)
├── vite.config.ts       # Vite config with path aliases
└── .env.local           # GEMINI_API_KEY
```

## Architecture

- **No backend** - entirely client-side SPA
- **State:** React hooks + localStorage persistence (keys prefixed `docu_synth_`)
- **No global state library** - prop drilling from App.tsx
- **No router** - view switching managed in App.tsx state
- **No testing framework** configured
- **No linter/formatter** configured

## Key Services

| File | Purpose |
|------|---------|
| `services/geminiService.ts` | AI content generation (search, crawl, GitHub, MCP) |
| `services/cryptoService.ts` | AES-GCM encryption for stored API keys |
| `services/githubService.ts` | GitHub API (token validation, repo creation, file push) |
| `services/localAiService.ts` | Integration snippets for local AI providers |
| `services/langextract.ts` | Document format conversion (MD, JSON, YAML, XML, TXT) |

## Key Components

| File | Purpose |
|------|---------|
| `components/MarkdownViewer.tsx` | Document viewing with syntax highlighting |
| `components/HistorySidebar.tsx` | Project/document navigation sidebar |
| `components/SettingsModal.tsx` | Integration and crawler settings |
| `components/GitHubPushModal.tsx` | Push documents to GitHub repos |
| `components/ProjectModal.tsx` | Project creation/editing |
| `components/TaskProgressManager.tsx` | Background crawl task monitoring |

## Code Conventions

- **Components:** PascalCase, functional with hooks, one per file (.tsx)
- **Services:** camelCase, export pure async functions (.ts)
- **State setters:** `set` prefix (e.g., `setHistory`)
- **Event handlers:** `handle` or `on` prefix (e.g., `handleSubmit`)
- **Booleans:** `is`/`show` prefix (e.g., `isLoading`, `showModal`)
- **Props:** Interface defined above component, named `ComponentNameProps`
- **Types:** Centralized in `types.ts`, exported individually
- **Styling:** Tailwind utility classes inline, dark mode via `dark:` prefix

## Environment

- `GEMINI_API_KEY` in `.env.local` - injected via Vite's `define` in vite.config.ts as `process.env.GEMINI_API_KEY`

## Path Aliases

- `@/*` resolves to project root (configured in both tsconfig.json and vite.config.ts)

## Important Patterns

- Rate limiting: 50 requests/hour, tracked in localStorage
- Encryption: Web Crypto API (AES-GCM) for API key storage
- Documents support versioning via `DocVersion` snapshots
- Projects organize documents with public/private visibility
- Background crawling uses a queue with configurable delays
- Keyboard shortcuts: Ctrl+H (history), Ctrl+S (settings), Ctrl+R (refresh), Ctrl+C (copy), Ctrl+D (dark mode)

## localStorage Keys

```
docu_synth_theme, docu_synth_projects, docu_synth_active_project,
docu_synth_history, docu_synth_recent_searches, docu_synth_crawl_options,
docu_synth_integrations, docu_synth_usage, docu_synth_master_key
```

## Key Types (types.ts)

- `Project` - folder-like organization container
- `GeneratedDoc` - document with versions, sources, visibility
- `DocVersion` - historical snapshot with timestamp
- `CrawlTask` - background task with status tracking
- `CrawlOptions` - maxPages, depth, delay, excludePatterns
- `IntegrationSettings` - API keys for 10+ providers

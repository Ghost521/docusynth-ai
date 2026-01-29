import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getUserId } from "./users";

// System templates - pre-built documentation patterns
const SYSTEM_TEMPLATES = [
  {
    name: "API Reference",
    description: "Generate comprehensive API documentation with endpoints, parameters, and examples",
    category: "api",
    content: `# API Reference: {TOPIC}

## Overview
Brief description of the API and its purpose.

## Authentication
Describe authentication methods (API keys, OAuth, etc.)

## Base URL
\`\`\`
https://api.example.com/v1
\`\`\`

## Endpoints

### GET /resource
Description of the endpoint.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | string | Yes | Resource identifier |

**Response:**
\`\`\`json
{
  "data": {}
}
\`\`\`

## Error Codes
| Code | Description |
|------|-------------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |

## Rate Limits
Describe rate limiting policies.

## SDKs
List available SDKs and installation instructions.
`,
  },
  {
    name: "Framework Guide",
    description: "Document a framework with setup, core concepts, and best practices",
    category: "framework",
    content: `# {TOPIC} - LLM Context File

<breaking_changes>
## Breaking Changes (Latest Version)
- List any breaking changes from recent versions
- Migration steps if applicable
</breaking_changes>

<concepts_architecture>
## Core Concepts
### Architecture Overview
Describe the framework's architecture and key patterns.

### Key Components
1. **Component A** - Description
2. **Component B** - Description
</concepts_architecture>

<directory_structure>
## Directory Structure
\`\`\`
project/
├── src/
│   ├── components/
│   ├── services/
│   └── utils/
├── config/
└── tests/
\`\`\`
</directory_structure>

<best_practices>
## Best Practices
### Security
- Always validate input
- Use environment variables for secrets

### Performance
- Implement caching
- Use lazy loading
</best_practices>

<common_pitfalls>
## Common Pitfalls
1. **Pitfall A** - Description and solution
2. **Pitfall B** - Description and solution
</common_pitfalls>

<api_reference>
## Quick API Reference
\`\`\`typescript
// Most common methods
method1(arg: Type): ReturnType
method2(options: Options): Promise<Result>
\`\`\`
</api_reference>
`,
  },
  {
    name: "Library Documentation",
    description: "Document a library with installation, usage, and API reference",
    category: "library",
    content: `# {TOPIC}

## Installation

\`\`\`bash
npm install {package-name}
# or
yarn add {package-name}
\`\`\`

## Quick Start

\`\`\`typescript
import { feature } from '{package-name}';

// Basic usage example
const result = feature.doSomething();
\`\`\`

## Configuration

\`\`\`typescript
const config = {
  option1: 'value',
  option2: true,
};
\`\`\`

## API Reference

### Main Functions

#### \`functionName(params)\`
Description of the function.

**Parameters:**
- \`param1\` (Type) - Description
- \`param2\` (Type, optional) - Description

**Returns:** ReturnType

**Example:**
\`\`\`typescript
const result = functionName({ param1: 'value' });
\`\`\`

## TypeScript Support
The library includes TypeScript definitions.

## Changelog
See CHANGELOG.md for version history.
`,
  },
  {
    name: "GitHub Repository Analysis",
    description: "Template for analyzing and documenting GitHub repositories",
    category: "github",
    content: `# Repository: {TOPIC}

## Project Overview
Brief description of what this repository does.

## Tech Stack
- **Language:**
- **Framework:**
- **Database:**
- **Deployment:**

<directory_structure>
## File Structure
\`\`\`
{repo}/
├── src/           # Source code
├── tests/         # Test files
├── docs/          # Documentation
├── .github/       # GitHub workflows
└── README.md
\`\`\`
</directory_structure>

## Getting Started

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation
\`\`\`bash
git clone {repo-url}
cd {repo-name}
npm install
\`\`\`

### Development
\`\`\`bash
npm run dev
\`\`\`

## Key Files
| File | Purpose |
|------|---------|
| src/index.ts | Entry point |
| src/config.ts | Configuration |

## Architecture Decisions
Describe key architectural decisions and patterns used.

## Contributing
See CONTRIBUTING.md for guidelines.
`,
  },
  {
    name: "Cursor Rules Format",
    description: "Generate .cursorrules file optimized for Cursor AI",
    category: "ide",
    content: `# {TOPIC} - Cursor Rules

## Project Context
You are working on a project using {TOPIC}.

## Code Style
- Use TypeScript with strict mode
- Prefer functional components
- Use async/await over Promises

## File Conventions
- Components: PascalCase.tsx
- Utilities: camelCase.ts
- Tests: *.test.ts

## Common Patterns

### Pattern 1: [Name]
\`\`\`typescript
// Example implementation
\`\`\`

### Pattern 2: [Name]
\`\`\`typescript
// Example implementation
\`\`\`

## Do NOT
- Do not use deprecated APIs
- Do not expose secrets in code
- Do not skip error handling

## Always
- Always validate user input
- Always handle edge cases
- Always include TypeScript types

## Testing
- Write unit tests for utilities
- Write integration tests for APIs
- Aim for 80% coverage

## Dependencies
Prefer these libraries:
- {library1} for {purpose}
- {library2} for {purpose}
`,
  },
  {
    name: "MCP Server Context",
    description: "Template for Model Context Protocol server documentation",
    category: "mcp",
    content: `# MCP Server: {TOPIC}

## Overview
This MCP server provides context about {TOPIC}.

## Resources
Available resources exposed by this server:

### \`doc://{topic}\`
Main documentation resource.

### \`api://{endpoint}\`
API reference resource.

## Tools

### \`search_docs\`
Search through documentation.

**Parameters:**
- \`query\` (string) - Search query

**Returns:** Matching documentation excerpts

### \`get_example\`
Get code examples.

**Parameters:**
- \`topic\` (string) - Topic to get examples for

**Returns:** Code examples with explanations

## Installation

\`\`\`bash
npm install @{scope}/mcp-server-{name}
\`\`\`

## Configuration

Add to your MCP config:
\`\`\`json
{
  "servers": {
    "{name}": {
      "command": "npx",
      "args": ["@{scope}/mcp-server-{name}"]
    }
  }
}
\`\`\`

## Usage Examples
Describe common usage patterns with your MCP server.
`,
  },
];

// List all templates (system + user)
export const list = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, { category }) => {
    const userId = await getUserId(ctx);

    // Get user templates
    let userTemplatesQuery = ctx.db
      .query("templates")
      .withIndex("byUser", (q) => q.eq("userId", userId));

    const userTemplates = await userTemplatesQuery.collect();

    // Get system templates
    const systemTemplates = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("isSystemTemplate"), true))
      .collect();

    // Combine and filter by category if specified
    let allTemplates = [...systemTemplates, ...userTemplates];

    if (category) {
      allTemplates = allTemplates.filter((t) => t.category === category);
    }

    // Add virtual system templates if they don't exist in DB
    const existingNames = new Set(allTemplates.map((t) => t.name));
    const virtualSystemTemplates = SYSTEM_TEMPLATES.filter(
      (st) => !existingNames.has(st.name)
    ).map((st) => ({
      ...st,
      _id: `system_${st.name.toLowerCase().replace(/\s+/g, '_')}` as any,
      userId: undefined,
      isSystemTemplate: true,
      createdAt: 0,
    }));

    if (category) {
      return [
        ...allTemplates,
        ...virtualSystemTemplates.filter((t) => t.category === category),
      ];
    }

    return [...allTemplates, ...virtualSystemTemplates];
  },
});

// Get a single template
export const get = query({
  args: {
    templateId: v.string(),
  },
  handler: async (ctx, { templateId }) => {
    const userId = await getUserId(ctx);

    // Check if it's a virtual system template
    if (templateId.startsWith('system_')) {
      const templateName = templateId
        .replace('system_', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const systemTemplate = SYSTEM_TEMPLATES.find(
        (st) => st.name.toLowerCase() === templateName.toLowerCase()
      );

      if (systemTemplate) {
        return {
          ...systemTemplate,
          _id: templateId,
          userId: undefined,
          isSystemTemplate: true,
          createdAt: 0,
        };
      }
    }

    // Try to get from database
    const template = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("_id"), templateId as any))
      .first();
    if (!template) return null;

    // Check access
    if (!template.isSystemTemplate && template.userId !== userId) {
      return null;
    }

    return template;
  },
});

// Create a user template
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    category: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    return await ctx.db.insert("templates", {
      userId,
      name: args.name,
      description: args.description,
      category: args.category,
      content: args.content,
      isSystemTemplate: false,
      createdAt: Date.now(),
    });
  },
});

// Update a user template
export const update = mutation({
  args: {
    templateId: v.id("templates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, { templateId, ...updates }) => {
    const userId = await getUserId(ctx);
    const template = await ctx.db.get(templateId);

    if (!template || template.userId !== userId || template.isSystemTemplate) {
      throw new Error("Cannot modify this template");
    }

    const filteredUpdates: Record<string, string> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });

    await ctx.db.patch(templateId, filteredUpdates);
  },
});

// Delete a user template
export const remove = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, { templateId }) => {
    const userId = await getUserId(ctx);
    const template = await ctx.db.get(templateId);

    if (!template || template.userId !== userId || template.isSystemTemplate) {
      throw new Error("Cannot delete this template");
    }

    await ctx.db.delete(templateId);
  },
});

// Get template categories
export const getCategories = query({
  args: {},
  handler: async () => {
    return [
      { id: "api", name: "API Documentation", icon: "Globe" },
      { id: "framework", name: "Framework Guides", icon: "Cpu" },
      { id: "library", name: "Library Docs", icon: "Folder" },
      { id: "github", name: "GitHub Analysis", icon: "GitHub" },
      { id: "ide", name: "IDE Integration", icon: "Terminal" },
      { id: "mcp", name: "MCP Servers", icon: "Sparkles" },
      { id: "custom", name: "Custom", icon: "Plus" },
    ];
  },
});

// Initialize system templates in the database
export const initializeSystemTemplates = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if system templates already exist
    const existing = await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("isSystemTemplate"), true))
      .first();

    if (existing) {
      return { message: "System templates already initialized" };
    }

    // Insert system templates
    for (const template of SYSTEM_TEMPLATES) {
      await ctx.db.insert("templates", {
        userId: undefined,
        name: template.name,
        description: template.description,
        category: template.category,
        content: template.content,
        isSystemTemplate: true,
        createdAt: Date.now(),
      });
    }

    return { message: `Initialized ${SYSTEM_TEMPLATES.length} system templates` };
  },
});

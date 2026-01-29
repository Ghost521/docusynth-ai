
import { Icons } from '../components/Icon';

export interface Preset {
  id: string;
  title: string;
  description: string;
  mode: 'search' | 'crawl' | 'github';
  value: string;
  icon: keyof typeof Icons;
  category: 'popular' | 'trending' | 'skills' | 'recent';
  sourceDisplay: string;
  tokens: string;
  snippets: string;
  updateTime: string;
}

export const PRESETS: Preset[] = [
  // Popular
  {
    id: 'p1',
    title: 'Next.js',
    description: 'The React Framework for the Web.',
    mode: 'github',
    value: 'https://github.com/vercel/next.js',
    icon: 'GitHub',
    category: 'popular',
    sourceDisplay: '/vercel/next.js',
    tokens: '572K',
    snippets: '2.1K',
    updateTime: '13 hours'
  },
  {
    id: 'p2',
    title: 'Claude Code',
    description: 'Agentic coding assistant from Anthropic.',
    mode: 'github',
    value: 'https://github.com/anthropics/claude-code',
    icon: 'GitHub',
    category: 'popular',
    sourceDisplay: '/anthropics/claude-code',
    tokens: '214K',
    snippets: '790',
    updateTime: '4 days'
  },
  {
    id: 'p3',
    title: 'Better Auth',
    description: 'Modern authentication for the web.',
    mode: 'github',
    value: 'https://github.com/better-auth/better-auth',
    icon: 'GitHub',
    category: 'popular',
    sourceDisplay: '/better-auth/better-auth',
    tokens: '432K',
    snippets: '2.3K',
    updateTime: '6 days'
  },
  {
    id: 'p4',
    title: 'AI SDK',
    description: 'Build AI apps with React and Next.js.',
    mode: 'search',
    value: 'Vercel AI SDK documentation',
    icon: 'Globe',
    category: 'popular',
    sourceDisplay: 'ai-sdk.dev',
    tokens: '902K',
    snippets: '5.7K',
    updateTime: '2 days'
  },
  {
    id: 'p5',
    title: 'shadcn/ui',
    description: 'Beautifully designed components built with Radix UI and Tailwind.',
    mode: 'search',
    value: 'shadcn/ui component documentation',
    icon: 'Globe',
    category: 'popular',
    sourceDisplay: 'ui.shadcn.com/docs',
    tokens: '257K',
    snippets: '1K',
    updateTime: '2 days'
  },
  {
    id: 'p6',
    title: 'React',
    description: 'The library for web and native user interfaces.',
    mode: 'search',
    value: 'React 19 latest documentation',
    icon: 'Globe',
    category: 'popular',
    sourceDisplay: 'react.dev',
    tokens: '569K',
    snippets: '2.2K',
    updateTime: '3 days'
  },
  // Trending
  {
    id: 't1',
    title: 'Tailwind CSS',
    description: 'A utility-first CSS framework.',
    mode: 'search',
    value: 'Tailwind CSS v4 engine',
    icon: 'Globe',
    category: 'trending',
    sourceDisplay: 'tailwindcss.com/docs',
    tokens: '324K',
    snippets: '2.3K',
    updateTime: '5 days'
  },
  {
    id: 't2',
    title: 'Better Auth (TXT)',
    description: 'LLM optimized authentication documentation.',
    mode: 'search',
    value: 'https://better-auth.com/llms.txt',
    icon: 'FileText',
    category: 'trending',
    sourceDisplay: 'better-auth.com/llms.txt',
    tokens: '416K',
    snippets: '3K',
    updateTime: '1 week'
  },
  {
    id: 't3',
    title: 'Prisma',
    description: 'Next-generation Node.js and TypeScript ORM.',
    mode: 'github',
    value: 'https://github.com/prisma/docs',
    icon: 'GitHub',
    category: 'trending',
    sourceDisplay: '/prisma/docs',
    tokens: '953K',
    snippets: '4.7K',
    updateTime: '1 month'
  },
  // Skills
  {
    id: 's1',
    title: 'Cursor Rules',
    description: 'Master .cursorrules files.',
    mode: 'search',
    value: 'Best practices for writing .cursorrules context files',
    icon: 'Terminal',
    category: 'skills',
    sourceDisplay: 'cursor.com/rules',
    tokens: '45K',
    snippets: '120',
    updateTime: '2 hours'
  },
  {
    id: 's2',
    title: 'MCP Protocol',
    description: 'Model Context Protocol architecture.',
    mode: 'search',
    value: 'Model Context Protocol specification',
    icon: 'Server',
    category: 'skills',
    sourceDisplay: 'mcp.run',
    tokens: '112K',
    snippets: '450',
    updateTime: '1 day'
  }
];

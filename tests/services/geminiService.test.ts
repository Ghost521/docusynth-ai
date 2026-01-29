import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @google/genai module
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent };
    constructor() {}
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING'
    }
  };
});

import { discoverLinks, generateDocumentation, generateMCPServer, summarizeContent } from '../../services/geminiService';

describe('discoverLinks', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('parses links from response', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        links: [
          { title: 'Getting Started', url: 'https://example.com/start' },
          { title: 'API Reference', url: 'https://example.com/api' }
        ]
      })
    });

    const result = await discoverLinks('https://example.com/docs');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Getting Started');
    expect(result[0].url).toBe('https://example.com/start');
  });

  it('throws when generation fails', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API Error'));
    await expect(
      discoverLinks('https://example.com/docs', undefined, 'test-key')
    ).rejects.toThrow('API Error');
  });

  it('returns empty array on empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });
    const result = await discoverLinks('https://example.com/docs', undefined, 'test-key');
    expect(result).toEqual([]);
  });

  it('returns empty array when links field is missing', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ data: [] })
    });
    const result = await discoverLinks('https://example.com/docs', undefined, 'test-key');
    expect(result).toEqual([]);
  });

  it('passes crawl options to prompt', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ links: [] })
    });
    await discoverLinks('https://example.com/docs', {
      maxPages: 5,
      depth: 2,
      delay: 1000,
      excludePatterns: 'admin, settings'
    }, 'test-key');

    // Verify the model was called (options are baked into prompt)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

describe('generateDocumentation', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  const onStatusChange = vi.fn();

  it('returns doc shape with topic, content, sources', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '# React Hooks\n\nContent here',
      candidates: [{
        groundingMetadata: {
          groundingChunks: [
            { web: { title: 'React Docs', uri: 'https://react.dev' } },
            { web: { title: 'MDN', uri: 'https://mdn.io' } }
          ]
        }
      }]
    });

    const result = await generateDocumentation('React Hooks', 'search', onStatusChange);
    expect(result.topic).toBe('React Hooks');
    expect(result.content).toContain('# React Hooks');
    expect(result.sources).toHaveLength(2);
    expect(result.visibility).toBe('private');
  });

  it('calls onStatusChange during generation', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'content',
      candidates: [{ groundingMetadata: { groundingChunks: [] } }]
    });

    await generateDocumentation('test', 'search', onStatusChange);
    expect(onStatusChange).toHaveBeenCalledWith('Initializing AI agent...');
    expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('test'));
  });

  it('deduplicates sources by URL', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'content',
      candidates: [{
        groundingMetadata: {
          groundingChunks: [
            { web: { title: 'React', uri: 'https://react.dev' } },
            { web: { title: 'React Docs', uri: 'https://react.dev' } },
            { web: { title: 'Other', uri: 'https://other.com' } }
          ]
        }
      }]
    });

    const result = await generateDocumentation('React', 'search', onStatusChange);
    expect(result.sources).toHaveLength(2);
  });

  it('handles github mode', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '# Repo Analysis',
      candidates: [{ groundingMetadata: { groundingChunks: [] } }]
    });

    const result = await generateDocumentation('https://github.com/user/repo', 'github', onStatusChange);
    expect(result.content).toContain('# Repo Analysis');
    expect(onStatusChange).toHaveBeenCalledWith(expect.stringContaining('GitHub'));
  });

  it('handles crawl mode', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '# Crawl Result',
      candidates: [{ groundingMetadata: { groundingChunks: [] } }]
    });

    const result = await generateDocumentation('https://docs.example.com', 'crawl', onStatusChange);
    expect(result.content).toBe('# Crawl Result');
  });

  it('throws on empty response', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '',
      candidates: []
    });

    await expect(
      generateDocumentation('test', 'search', onStatusChange)
    ).rejects.toThrow('No content generated');
  });

  it('throws on generation error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Network Error'));
    await expect(
      generateDocumentation('test', 'search', onStatusChange)
    ).rejects.toThrow('Network Error');
  });

  it('handles null groundingChunks gracefully', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'content',
      candidates: [{ groundingMetadata: {} }]
    });

    const result = await generateDocumentation('test', 'search', onStatusChange);
    expect(result.sources).toEqual([]);
  });
});

describe('generateMCPServer', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  const onStatusChange = vi.fn();

  it('returns TypeScript code', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'import { Server } from "@modelcontextprotocol/sdk";\n// MCP Server'
    });

    const result = await generateMCPServer('my-project', [{
      id: '1',
      topic: 'React',
      content: 'React docs content here',
      visibility: 'private',
      sources: [],
      createdAt: Date.now()
    }], onStatusChange);

    expect(result).toContain('import');
  });

  it('truncates doc content at 1000 chars', async () => {
    const longContent = 'x'.repeat(2000);
    mockGenerateContent.mockResolvedValue({ text: 'code' });

    await generateMCPServer('project', [{
      id: '1',
      topic: 'Test',
      content: longContent,
      visibility: 'private',
      sources: [],
      createdAt: Date.now()
    }], onStatusChange);

    const callArgs = mockGenerateContent.mock.calls[0][0];
    // The prompt should contain truncated content (1000 chars + "...")
    expect(callArgs.contents).toContain('...');
  });

  it('returns fallback on empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    const result = await generateMCPServer('project', [], onStatusChange);
    expect(result).toContain('Failed to generate');
  });

  it('calls onStatusChange', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'code' });
    await generateMCPServer('project', [], onStatusChange);
    expect(onStatusChange).toHaveBeenCalledWith('Architecting MCP Server...');
  });
});

describe('summarizeContent', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns summary text', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '**Core Purpose**: A testing framework.'
    });

    const result = await summarizeContent('Long documentation content here');
    expect(result).toContain('Core Purpose');
  });

  it('truncates input at 50000 chars', async () => {
    const longContent = 'y'.repeat(60000);
    mockGenerateContent.mockResolvedValue({ text: 'summary' });

    await summarizeContent(longContent);
    const callArgs = mockGenerateContent.mock.calls[0][0];
    // The prompt includes substring(0, 50000) of the content
    expect(callArgs.contents.length).toBeLessThan(60000);
  });

  it('returns fallback on empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });
    const result = await summarizeContent('content');
    expect(result).toBe('No summary generated.');
  });

  it('throws on summarization error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Summarization failed'));
    await expect(
      summarizeContent('content')
    ).rejects.toThrow('Summarization failed');
  });
});

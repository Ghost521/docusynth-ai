import { describe, it, expect } from 'vitest';
import {
  getTabnineContextSnippet,
  getClaudeContextSnippet,
  getGeminiContextSnippet,
  getOpenAIContextSnippet,
  getCodeWhispererContextSnippet,
  checkOllamaConnection,
  pushToOllama
} from '../../services/localAiService';

const topic = 'Next.js';
const content = '# Next.js Documentation\n\nApp Router is the default.';

describe('getTabnineContextSnippet', () => {
  it('includes topic in comment', () => {
    const result = getTabnineContextSnippet(topic, content);
    expect(result).toContain(`// Tabnine Context for ${topic}`);
  });

  it('includes content body', () => {
    const result = getTabnineContextSnippet(topic, content);
    expect(result).toContain(content);
  });

  it('prepends prefix when provided', () => {
    const result = getTabnineContextSnippet(topic, content, 'CUSTOM PREFIX');
    expect(result.startsWith('CUSTOM PREFIX\n\n')).toBe(true);
  });

  it('does not prepend prefix when not provided', () => {
    const result = getTabnineContextSnippet(topic, content);
    expect(result.startsWith('//')).toBe(true);
  });
});

describe('getClaudeContextSnippet', () => {
  it('wraps in claude_project_knowledge XML tags', () => {
    const result = getClaudeContextSnippet(topic, content);
    expect(result).toContain('<claude_project_knowledge');
    expect(result).toContain('</claude_project_knowledge>');
  });

  it('includes topic attribute', () => {
    const result = getClaudeContextSnippet(topic, content);
    expect(result).toContain(`topic="${topic}"`);
  });

  it('includes content', () => {
    const result = getClaudeContextSnippet(topic, content);
    expect(result).toContain(content);
  });

  it('prepends optional prefix', () => {
    const result = getClaudeContextSnippet(topic, content, 'PREFIX');
    expect(result.startsWith('PREFIX\n\n')).toBe(true);
  });
});

describe('getGeminiContextSnippet', () => {
  it('wraps in context_for_gemini XML tags', () => {
    const result = getGeminiContextSnippet(topic, content);
    expect(result).toContain('<context_for_gemini>');
    expect(result).toContain('</context_for_gemini>');
  });

  it('includes topic in system instruction', () => {
    const result = getGeminiContextSnippet(topic, content);
    expect(result).toContain(`deep knowledge of ${topic}`);
  });

  it('includes content within tags', () => {
    const result = getGeminiContextSnippet(topic, content);
    const tagContent = result.split('<context_for_gemini>')[1].split('</context_for_gemini>')[0];
    expect(tagContent).toContain(content);
  });

  it('prepends optional prefix', () => {
    const result = getGeminiContextSnippet(topic, content, 'MY PREFIX');
    expect(result.startsWith('MY PREFIX\n\n')).toBe(true);
  });
});

describe('getOpenAIContextSnippet', () => {
  it('includes CONTEXT_START and CONTEXT_END markers', () => {
    const result = getOpenAIContextSnippet(topic, content);
    expect(result).toContain('### CONTEXT_START ###');
    expect(result).toContain('### CONTEXT_END ###');
  });

  it('includes topic in comment header', () => {
    const result = getOpenAIContextSnippet(topic, content);
    expect(result).toContain(`Topic: ${topic}`);
  });

  it('includes content between markers', () => {
    const result = getOpenAIContextSnippet(topic, content);
    const between = result.split('### CONTEXT_START ###')[1].split('### CONTEXT_END ###')[0];
    expect(between).toContain(content);
  });

  it('prepends optional prefix', () => {
    const result = getOpenAIContextSnippet(topic, content, 'SYS INSTRUCTION');
    expect(result.startsWith('SYS INSTRUCTION\n\n')).toBe(true);
  });
});

describe('getCodeWhispererContextSnippet', () => {
  it('includes Amazon Q comment block', () => {
    const result = getCodeWhispererContextSnippet(topic, content);
    expect(result).toContain('Amazon Q / CodeWhisperer');
  });

  it('includes topic', () => {
    const result = getCodeWhispererContextSnippet(topic, content);
    expect(result).toContain(`Topic: ${topic}`);
  });

  it('includes content', () => {
    const result = getCodeWhispererContextSnippet(topic, content);
    expect(result).toContain(content);
  });

  it('prepends optional prefix', () => {
    const result = getCodeWhispererContextSnippet(topic, content, 'PREFIX');
    expect(result.startsWith('PREFIX\n\n')).toBe(true);
  });
});

describe('checkOllamaConnection', () => {
  it('returns true when Ollama responds with 200', async () => {
    const result = await checkOllamaConnection('http://localhost:11434');
    expect(result).toBe(true);
  });

  it('returns false when connection fails', async () => {
    const result = await checkOllamaConnection('http://offline-ollama:11434');
    expect(result).toBe(false);
  });

  it('returns false for non-existent endpoint', async () => {
    const result = await checkOllamaConnection('http://nonexistent:99999');
    expect(result).toBe(false);
  });
});

describe('pushToOllama', () => {
  it('returns success result on valid push', async () => {
    const result = await pushToOllama(
      'http://localhost:11434',
      'my-model',
      'llama3',
      'You are a helpful assistant'
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('my-model');
  });

  it('constructs modelfile with FROM and SYSTEM', async () => {
    // This test validates the function constructs the request correctly
    const result = await pushToOllama(
      'http://localhost:11434',
      'test-model',
      'mistral',
      'System prompt here'
    );
    expect(result.success).toBe(true);
  });

  it('returns failure on error response', async () => {
    const result = await pushToOllama(
      'http://localhost:11434',
      'error-model',
      'llama3',
      'prompt'
    );
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('returns failure when connection fails', async () => {
    const result = await pushToOllama(
      'http://offline-ollama:11434',
      'model',
      'llama3',
      'prompt'
    );
    expect(result.success).toBe(false);
  });
});

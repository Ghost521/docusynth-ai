import { describe, it, expect } from 'vitest';
import { convertToFormat } from '../../services/langextract';

const metadata = {
  topic: 'React Hooks',
  createdAt: 1700000000000,
  sources: [
    { title: 'React Docs', url: 'https://react.dev/hooks' },
    { title: 'Blog Post', url: 'https://example.com/hooks' }
  ],
  visibility: 'public'
};

const sampleContent = '# React Hooks\n\nHooks let you use state in function components.\n\n## useState\n\n```js\nconst [count, setCount] = useState(0);\n```';

describe('convertToFormat', () => {
  describe('markdown', () => {
    it('returns raw content unchanged', () => {
      const result = convertToFormat(sampleContent, 'markdown', metadata);
      expect(result).toBe(sampleContent);
    });
  });

  describe('json', () => {
    it('produces valid JSON output', () => {
      const result = convertToFormat(sampleContent, 'json', metadata);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('includes metadata fields', () => {
      const result = convertToFormat(sampleContent, 'json', metadata);
      const parsed = JSON.parse(result);
      expect(parsed.meta.topic).toBe('React Hooks');
      expect(parsed.meta.visibility).toBe('public');
      expect(parsed.meta.sources).toHaveLength(2);
      expect(parsed.meta.note).toBe('Generated for LLM Context Ingestion');
    });

    it('includes ISO date string', () => {
      const result = convertToFormat(sampleContent, 'json', metadata);
      const parsed = JSON.parse(result);
      expect(parsed.meta.created).toBe(new Date(1700000000000).toISOString());
    });

    it('preserves body content', () => {
      const result = convertToFormat(sampleContent, 'json', metadata);
      const parsed = JSON.parse(result);
      expect(parsed.body).toBe(sampleContent);
    });
  });

  describe('yaml', () => {
    it('includes topic header comment', () => {
      const result = convertToFormat(sampleContent, 'yaml', metadata);
      expect(result).toContain('# LLM Context File for React Hooks');
    });

    it('includes topic and created fields', () => {
      const result = convertToFormat(sampleContent, 'yaml', metadata);
      expect(result).toContain('topic: "React Hooks"');
      expect(result).toContain('created:');
    });

    it('contains 2-space indented body', () => {
      const result = convertToFormat(sampleContent, 'yaml', metadata);
      expect(result).toContain('body: |');
      // Each line of body should be indented with 2 spaces
      const bodySection = result.split('body: |\n')[1];
      const lines = bodySection.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          expect(line.startsWith('  ')).toBe(true);
        }
      });
    });

    it('includes sources list', () => {
      const result = convertToFormat(sampleContent, 'yaml', metadata);
      expect(result).toContain('sources:');
      expect(result).toContain('title: "React Docs"');
      expect(result).toContain('url: "https://react.dev/hooks"');
    });
  });

  describe('xml', () => {
    it('wraps body in CDATA', () => {
      const result = convertToFormat(sampleContent, 'xml', metadata);
      expect(result).toContain('<![CDATA[');
      expect(result).toContain(']]>');
    });

    it('escapes XML special characters in metadata', () => {
      const metaWithSpecial = {
        ...metadata,
        topic: 'React <Hooks> & "Stuff" \'quoted\''
      };
      const result = convertToFormat(sampleContent, 'xml', metaWithSpecial);
      expect(result).toContain('&lt;Hooks&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;Stuff&quot;');
      expect(result).toContain('&apos;quoted&apos;');
    });

    it('includes source elements', () => {
      const result = convertToFormat(sampleContent, 'xml', metadata);
      expect(result).toContain('<source>');
      expect(result).toContain('<title>React Docs</title>');
      expect(result).toContain('<url>https://react.dev/hooks</url>');
    });

    it('starts with <document> root element', () => {
      const result = convertToFormat(sampleContent, 'xml', metadata);
      expect(result.trim().startsWith('<document>')).toBe(true);
      expect(result.trim().endsWith('</document>')).toBe(true);
    });
  });

  describe('txt', () => {
    it('includes TOPIC header', () => {
      const result = convertToFormat(sampleContent, 'txt', metadata);
      expect(result).toContain('TOPIC: React Hooks');
    });

    it('includes CREATED date', () => {
      const result = convertToFormat(sampleContent, 'txt', metadata);
      expect(result).toContain('CREATED:');
    });

    it('includes sources list', () => {
      const result = convertToFormat(sampleContent, 'txt', metadata);
      expect(result).toContain('SOURCES:');
      expect(result).toContain('- React Docs (https://react.dev/hooks)');
    });

    it('includes separator line', () => {
      const result = convertToFormat(sampleContent, 'txt', metadata);
      expect(result).toContain('='.repeat(40));
    });

    it('appends raw body after separator', () => {
      const result = convertToFormat(sampleContent, 'txt', metadata);
      const afterSeparator = result.split('='.repeat(40))[1];
      expect(afterSeparator.trim()).toContain('# React Hooks');
    });
  });

  describe('preprocessing - JSON input', () => {
    it('extracts body from JSON-formatted input', () => {
      const jsonInput = JSON.stringify({ body: 'extracted content', meta: {} });
      const result = convertToFormat(jsonInput, 'markdown', metadata);
      expect(result).toBe('extracted content');
    });

    it('uses raw content if JSON has no body field', () => {
      const jsonInput = JSON.stringify({ data: 'something' });
      const result = convertToFormat(jsonInput, 'markdown', metadata);
      expect(result).toBe(jsonInput);
    });
  });

  describe('preprocessing - XML input', () => {
    it('extracts body from CDATA in XML input', () => {
      const xmlInput = '<document><body><![CDATA[inner content here]]></body></document>';
      const result = convertToFormat(xmlInput, 'markdown', metadata);
      expect(result).toBe('inner content here');
    });
  });

  describe('preprocessing - YAML input', () => {
    it('extracts body from YAML body: | section', () => {
      const yamlInput = 'topic: "test"\nbody: |\n  line one\n  line two';
      const result = convertToFormat(yamlInput, 'markdown', metadata);
      expect(result).toContain('line one');
      expect(result).toContain('line two');
    });
  });

  describe('edge cases', () => {
    it('handles empty content', () => {
      const result = convertToFormat('', 'json', metadata);
      const parsed = JSON.parse(result);
      expect(parsed.body).toBe('');
    });

    it('handles empty sources', () => {
      const emptySourceMeta = { ...metadata, sources: [] };
      const result = convertToFormat(sampleContent, 'json', emptySourceMeta);
      const parsed = JSON.parse(result);
      expect(parsed.meta.sources).toEqual([]);
    });

    it('handles special characters in content for JSON', () => {
      const special = 'Content with "quotes" and \\ backslashes and\nnewlines';
      const result = convertToFormat(special, 'json', metadata);
      const parsed = JSON.parse(result);
      expect(parsed.body).toBe(special);
    });
  });
});

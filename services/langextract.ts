
import { GeneratedDoc } from '../types';

export type DocFormat = 'markdown' | 'json' | 'yaml' | 'xml' | 'txt';

interface DocMetadata {
  topic: string;
  createdAt: number;
  sources: Array<{ title: string; url: string }>;
  visibility: string;
}

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

export const convertToFormat = (
  content: string, 
  targetFormat: DocFormat, 
  metadata: DocMetadata
): string => {
  // 1. Attempt to extract raw body if input is already converted. 
  // This logic is preserved for cases where the input might be a saved file in a non-markdown format.
  let rawBody = content;
  
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.body) rawBody = parsed.body;
    } catch (e) { /* ignore */ }
  } else if (trimmed.startsWith('<document>')) {
    const match = content.match(/CDATA\[([\s\S]*?)\]\]/);
    if (match) rawBody = match[1];
  } else if (trimmed.includes('body: |')) {
     const split = content.split('body: |');
     if (split[1]) {
       rawBody = split[1].split('\n').map(l => l.replace(/^  /, '')).join('\n').trim();
     }
  }

  const dateStr = new Date(metadata.createdAt).toISOString();

  switch (targetFormat) {
    case 'json':
      return JSON.stringify({
        meta: {
          topic: metadata.topic,
          created: dateStr,
          visibility: metadata.visibility,
          sources: metadata.sources,
          note: "Generated for LLM Context Ingestion"
        },
        body: rawBody
      }, null, 2);

    case 'yaml':
      const sourceList = metadata.sources.map(s => `  - title: "${s.title}"\n    url: "${s.url}"`).join('\n');
      const indentedBody = rawBody.split('\n').map(line => `  ${line}`).join('\n');
      return `# LLM Context File for ${metadata.topic}
topic: "${metadata.topic}"
created: "${dateStr}"
visibility: "${metadata.visibility}"
sources:
${sourceList}
body: |
${indentedBody}`;

    case 'xml':
      const xmlSources = metadata.sources.map(s => `    <source>\n      <title>${escapeXml(s.title)}</title>\n      <url>${escapeXml(s.url)}</url>\n    </source>`).join('\n');
      return `<document>
  <meta>
    <topic>${escapeXml(metadata.topic)}</topic>
    <created>${dateStr}</created>
    <visibility>${metadata.visibility}</visibility>
    <sources>
${xmlSources}
    </sources>
  </meta>
  <body><![CDATA[${rawBody}]]></body>
</document>`;

    case 'txt':
      // For plain text, we keep the markdown structure as it's often the best representation for LLMs,
      // but wrap it with clear headers.
      const txtHeader = `TOPIC: ${metadata.topic}\nCREATED: ${dateStr}\nSOURCES:\n${metadata.sources.map(s => `- ${s.title} (${s.url})`).join('\n')}\n${'='.repeat(40)}\n\n`;
      return txtHeader + rawBody;

    case 'markdown':
    default:
      return rawBody;
  }
};

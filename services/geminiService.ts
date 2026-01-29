// Gemini service for client-side operations

/**
 * Summarize content using the Gemini API via Convex backend
 */
export async function summarizeContent(content: string, _apiKey?: string): Promise<string> {
  // This function is called client-side but should use the Convex backend
  // For now, provide a simple client-side summary
  // In production, this would call a Convex action

  const words = content.split(/\s+/);
  const wordCount = words.length;

  // Extract first few sentences as a preview
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const previewSentences = sentences.slice(0, 3).join('. ').trim();

  // Count code blocks
  const codeBlocks = (content.match(/```/g) || []).length / 2;

  // Count headers
  const headers = (content.match(/^#+\s/gm) || []).length;

  return `## Summary

**Document Statistics:**
- Word Count: ${wordCount.toLocaleString()} words
- Code Blocks: ${Math.floor(codeBlocks)}
- Sections: ${headers}

**Preview:**
${previewSentences}...

*For AI-powered summaries, use the chat feature with your documents.*`;
}

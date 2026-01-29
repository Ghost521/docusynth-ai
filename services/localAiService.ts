
export const checkOllamaConnection = async (endpoint: string): Promise<boolean> => {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export const pushToOllama = async (
  endpoint: string, 
  modelName: string, 
  baseModel: string, 
  systemPrompt: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const modelfile = `FROM ${baseModel}\nSYSTEM """\n${systemPrompt}\n"""`;
    
    const response = await fetch(`${endpoint}/api/create`, {
      method: 'POST',
      body: JSON.stringify({
        name: modelName,
        modelfile: modelfile,
        stream: false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create model');
    }

    return { success: true, message: `Successfully created model "${modelName}" in Ollama.` };
  } catch (error: any) {
    console.error("Ollama Push Error:", error);
    return { success: false, message: error.message || 'Failed to connect to Ollama. Ensure it is running with OLLAMA_ORIGINS="*".' };
  }
};

export const getTabnineContextSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}// Tabnine Context for ${topic}
// Save this as a .tabnine-context file or paste into your Tabnine chat configuration
${content}`;
};

export const getCodeWhispererContextSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}/* 
   Amazon Q / CodeWhisperer Customization Context
   Topic: ${topic}
   Instructions: Copy this context into your Amazon Q Customization settings 
   or project-level custom instructions to refine AI suggestions.
*/

${content}`;
};

export const getClaudeContextSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}<claude_project_knowledge topic="${topic}">
This document provides up-to-date context and API references for ${topic}.
Include this in your Claude Project Knowledge or paste it into a Project-level instruction.

${content}
</claude_project_knowledge>`;
};

export const getGeminiContextSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}You are a developer assistant with deep knowledge of ${topic}.
Use the following documentation context to provide accurate, up-to-date code and architectural advice.

<context_for_gemini>
${content}
</context_for_gemini>

When answering questions about ${topic}, strictly adhere to the patterns and best practices defined above.`;
};

export const getOpenAIContextSnippet = (topic: string, content: string, prefix?: string) => {
  const finalPrefix = prefix ? `${prefix}\n\n` : '';
  return `${finalPrefix}/* 
   OpenAI / Codex Optimization Context
   Target: gpt-4-turbo / gpt-3.5-turbo / codex
   Topic: ${topic}
*/

### CONTEXT_START ###
${content}
### CONTEXT_END ###

Instruction: When generating code for ${topic}, reference the definitions and patterns provided in the context blocks above to ensure compatibility with the latest API versions and security standards.`;
};

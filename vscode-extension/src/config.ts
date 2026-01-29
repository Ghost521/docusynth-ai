import * as vscode from 'vscode';

/**
 * Configuration keys for DocuSynth extension
 */
export const CONFIG_SECTION = 'docusynth';

export interface DocuSynthConfig {
  serverUrl: string;
  apiKey: string;
  autoRefresh: boolean;
  insertFormat: 'markdown' | 'plain' | 'xml';
  maxSearchResults: number;
}

/**
 * Get the full configuration object
 */
export function getConfig(): DocuSynthConfig {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    serverUrl: config.get<string>('serverUrl', 'http://localhost:3000'),
    apiKey: config.get<string>('apiKey', ''),
    autoRefresh: config.get<boolean>('autoRefresh', true),
    insertFormat: config.get<'markdown' | 'plain' | 'xml'>('insertFormat', 'markdown'),
    maxSearchResults: config.get<number>('maxSearchResults', 20),
  };
}

/**
 * Get server URL from configuration
 */
export function getServerUrl(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  let url = config.get<string>('serverUrl', 'http://localhost:3000');
  // Remove trailing slash if present
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}

/**
 * Get API key from configuration
 */
export function getApiKey(): string {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<string>('apiKey', '');
}

/**
 * Check if API key is configured
 */
export function isApiKeyConfigured(): boolean {
  const apiKey = getApiKey();
  return apiKey !== null && apiKey !== undefined && apiKey.trim() !== '';
}

/**
 * Set the API key in configuration
 */
export async function setApiKey(apiKey: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
}

/**
 * Set the server URL in configuration
 */
export async function setServerUrl(serverUrl: string): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  await config.update('serverUrl', serverUrl, vscode.ConfigurationTarget.Global);
}

/**
 * Get insert format preference
 */
export function getInsertFormat(): 'markdown' | 'plain' | 'xml' {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return config.get<'markdown' | 'plain' | 'xml'>('insertFormat', 'markdown');
}

/**
 * Open extension settings in VS Code
 */
export function openSettings(): void {
  vscode.commands.executeCommand('workbench.action.openSettings', `@ext:docusynth.docusynth-ai`);
}

/**
 * Prompt user to configure API key
 */
export async function promptForApiKey(): Promise<string | undefined> {
  const result = await vscode.window.showInputBox({
    prompt: 'Enter your DocuSynth AI API Key',
    password: true,
    placeHolder: 'Your API key',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'API key cannot be empty';
      }
      return null;
    },
  });

  if (result) {
    await setApiKey(result);
    vscode.window.showInformationMessage('DocuSynth API key configured successfully');
  }

  return result;
}

/**
 * Prompt user to configure server URL
 */
export async function promptForServerUrl(): Promise<string | undefined> {
  const currentUrl = getServerUrl();
  const result = await vscode.window.showInputBox({
    prompt: 'Enter the DocuSynth AI server URL',
    value: currentUrl,
    placeHolder: 'http://localhost:3000',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return 'Server URL cannot be empty';
      }
      try {
        new URL(value);
        return null;
      } catch {
        return 'Please enter a valid URL';
      }
    },
  });

  if (result) {
    await setServerUrl(result);
    vscode.window.showInformationMessage('DocuSynth server URL configured successfully');
  }

  return result;
}

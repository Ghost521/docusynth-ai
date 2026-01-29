import * as vscode from 'vscode';
import { createTreeView, DocuSynthTreeProvider } from './treeView';
import { registerCommands } from './commands';
import { getConfig, isApiKeyConfigured, promptForApiKey } from './config';

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('DocuSynth AI extension is activating...');

  // Create the tree view and provider
  const { treeView, treeProvider } = createTreeView(context);

  // Register all commands
  registerCommands(context, treeProvider);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('docusynth')) {
        // Refresh when configuration changes
        treeProvider.refresh();
      }
    })
  );

  // Check if API key is configured
  if (!isApiKeyConfigured()) {
    const action = await vscode.window.showInformationMessage(
      'DocuSynth AI: API key not configured. Would you like to set it up now?',
      'Configure',
      'Later'
    );

    if (action === 'Configure') {
      await promptForApiKey();
    }
  }

  // Auto-refresh on startup if enabled
  const config = getConfig();
  if (config.autoRefresh && isApiKeyConfigured()) {
    // Small delay to let VS Code finish loading
    setTimeout(() => {
      treeProvider.refresh();
    }, 1000);
  }

  // Show welcome message
  vscode.window.setStatusBarMessage('DocuSynth AI extension activated', 3000);

  console.log('DocuSynth AI extension activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('DocuSynth AI extension deactivated');
}

import * as vscode from 'vscode';
import { getApi, Document, handleApiError, GenerateRequest } from './api';
import { DocuSynthTreeProvider, DocuSynthTreeItem } from './treeView';
import {
  getInsertFormat,
  promptForApiKey,
  getConfig,
  isApiKeyConfigured,
  openSettings,
} from './config';

/**
 * Format document content based on user preference
 */
function formatDocumentContent(doc: Document, format: 'markdown' | 'plain' | 'xml'): string {
  switch (format) {
    case 'xml':
      return `<document id="${doc._id}" title="${escapeXml(doc.title)}">
<content>
${escapeXml(doc.content)}
</content>
${doc.sources ? `<sources>\n${doc.sources.map((s) => `  <source>${escapeXml(s)}</source>`).join('\n')}\n</sources>` : ''}
${doc.tags ? `<tags>\n${doc.tags.map((t) => `  <tag>${escapeXml(t)}</tag>`).join('\n')}\n</tags>` : ''}
</document>`;

    case 'plain':
      let plain = `${doc.title}\n${'='.repeat(doc.title.length)}\n\n${doc.content}`;
      if (doc.sources && doc.sources.length > 0) {
        plain += `\n\nSources:\n${doc.sources.map((s) => `- ${s}`).join('\n')}`;
      }
      return plain;

    case 'markdown':
    default:
      let md = `# ${doc.title}\n\n${doc.content}`;
      if (doc.sources && doc.sources.length > 0) {
        md += `\n\n## Sources\n${doc.sources.map((s) => `- ${s}`).join('\n')}`;
      }
      if (doc.tags && doc.tags.length > 0) {
        md += `\n\n---\nTags: ${doc.tags.join(', ')}`;
      }
      return md;
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Register all commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeProvider: DocuSynthTreeProvider
): void {
  // Refresh documents command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.refresh', async () => {
      await treeProvider.refresh();
    })
  );

  // Configure API key command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.configureApiKey', async () => {
      const choice = await vscode.window.showQuickPick(
        [
          { label: 'Enter API Key', description: 'Set your DocuSynth API key' },
          { label: 'Open Settings', description: 'Configure all DocuSynth settings' },
        ],
        { placeHolder: 'Choose configuration option' }
      );

      if (choice?.label === 'Enter API Key') {
        await promptForApiKey();
        await treeProvider.refresh();
      } else if (choice?.label === 'Open Settings') {
        openSettings();
      }
    })
  );

  // Open document command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.openDocument', async (item: DocuSynthTreeItem) => {
      const doc = item?.getDocument();
      if (!doc) {
        vscode.window.showErrorMessage('No document selected');
        return;
      }

      // Create a virtual document to show the content
      const uri = vscode.Uri.parse(`docusynth:${doc._id}.md`);
      const content = formatDocumentContent(doc, 'markdown');

      // Use a text document provider
      const provider = new (class implements vscode.TextDocumentContentProvider {
        provideTextDocumentContent(): string {
          return content;
        }
      })();

      const registration = vscode.workspace.registerTextDocumentContentProvider('docusynth', provider);
      context.subscriptions.push(registration);

      const textDoc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(textDoc, { preview: true });
    })
  );

  // Insert context command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.insertContext', async (item?: DocuSynthTreeItem) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor. Please open a file first.');
        return;
      }

      let doc: Document | undefined;

      if (item) {
        doc = item.getDocument();
      } else {
        // Show quick pick to select document
        const documents = treeProvider.getDocuments();
        if (documents.length === 0) {
          const action = await vscode.window.showInformationMessage(
            'No documents loaded. Would you like to refresh?',
            'Refresh'
          );
          if (action === 'Refresh') {
            await treeProvider.refresh();
          }
          return;
        }

        const quickPickItems = documents.map((d) => ({
          label: d.title,
          description: d.tags?.join(', '),
          document: d,
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
          placeHolder: 'Select a document to insert',
          matchOnDescription: true,
        });

        if (!selected) {
          return;
        }

        doc = selected.document;
      }

      if (!doc) {
        vscode.window.showErrorMessage('No document selected');
        return;
      }

      const format = getInsertFormat();
      const content = formatDocumentContent(doc, format);

      await editor.edit((editBuilder) => {
        editBuilder.insert(editor.selection.active, content);
      });

      vscode.window.showInformationMessage(`Inserted: ${doc.title}`);
    })
  );

  // Copy document content command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.copyDocumentContent', async (item: DocuSynthTreeItem) => {
      const doc = item?.getDocument();
      if (!doc) {
        vscode.window.showErrorMessage('No document selected');
        return;
      }

      const format = getInsertFormat();
      const content = formatDocumentContent(doc, format);

      await vscode.env.clipboard.writeText(content);
      vscode.window.showInformationMessage(`Copied to clipboard: ${doc.title}`);
    })
  );

  // Search documents command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.searchDocuments', async () => {
      const config = getConfig();

      // First try local search
      const documents = treeProvider.getDocuments();

      if (documents.length === 0) {
        // Try to fetch from API
        if (!isApiKeyConfigured()) {
          const action = await vscode.window.showWarningMessage(
            'DocuSynth API key not configured',
            'Configure API Key'
          );
          if (action === 'Configure API Key') {
            await promptForApiKey();
          }
          return;
        }

        await treeProvider.refresh();
      }

      // Create quick pick with search
      const quickPick = vscode.window.createQuickPick();
      quickPick.placeholder = 'Search documents by title, content, or tags...';
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;

      const updateItems = (query: string) => {
        let results: Document[];
        if (query.trim() === '') {
          results = treeProvider.getDocuments().slice(0, config.maxSearchResults);
        } else {
          results = treeProvider.searchDocuments(query).slice(0, config.maxSearchResults);
        }

        quickPick.items = results.map((doc) => ({
          label: doc.title,
          description: doc.tags?.join(', '),
          detail: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : ''),
          document: doc,
        }));
      };

      // Initial items
      updateItems('');

      quickPick.onDidChangeValue((value) => {
        updateItems(value);
      });

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0] as { document?: Document } | undefined;
        if (selected?.document) {
          quickPick.hide();

          const actions = ['Insert at Cursor', 'Copy to Clipboard', 'Open Document'];
          const action = await vscode.window.showQuickPick(actions, {
            placeHolder: `Selected: ${selected.document.title}`,
          });

          if (action === 'Insert at Cursor') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              const format = getInsertFormat();
              const content = formatDocumentContent(selected.document, format);
              await editor.edit((editBuilder) => {
                editBuilder.insert(editor.selection.active, content);
              });
            } else {
              vscode.window.showErrorMessage('No active editor');
            }
          } else if (action === 'Copy to Clipboard') {
            const format = getInsertFormat();
            const content = formatDocumentContent(selected.document, format);
            await vscode.env.clipboard.writeText(content);
            vscode.window.showInformationMessage('Copied to clipboard');
          } else if (action === 'Open Document') {
            const uri = vscode.Uri.parse(`docusynth:${selected.document._id}.md`);
            const content = formatDocumentContent(selected.document, 'markdown');

            const provider = new (class implements vscode.TextDocumentContentProvider {
              provideTextDocumentContent(): string {
                return content;
              }
            })();

            vscode.workspace.registerTextDocumentContentProvider('docusynth', provider);
            const textDoc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(textDoc, { preview: true });
          }
        }
      });

      quickPick.show();
    })
  );

  // Generate from selection command
  context.subscriptions.push(
    vscode.commands.registerCommand('docusynth.generateFromSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage('No text selected. Please select code to generate documentation for.');
        return;
      }

      const selectedText = editor.document.getText(selection);

      // Get the language of the file for context
      const language = editor.document.languageId;

      // Ask for additional context
      const query = await vscode.window.showInputBox({
        prompt: 'What kind of documentation would you like to generate?',
        placeHolder: 'e.g., "API reference", "usage examples", "explain this code"',
        value: `Generate documentation for this ${language} code`,
      });

      if (!query) {
        return;
      }

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'DocuSynth: Generating documentation...',
          cancellable: false,
        },
        async () => {
          try {
            const api = getApi();
            const request: GenerateRequest = {
              query: `${query}\n\nCode:\n\`\`\`${language}\n${selectedText}\n\`\`\``,
              options: {
                includeCode: true,
              },
            };

            const doc = await api.generateDocumentation(request);

            // Show the generated documentation
            const format = getInsertFormat();
            const content = formatDocumentContent(doc, format);

            const action = await vscode.window.showInformationMessage(
              `Documentation generated: ${doc.title}`,
              'Insert at Cursor',
              'Copy to Clipboard',
              'Open Document'
            );

            if (action === 'Insert at Cursor') {
              await editor.edit((editBuilder) => {
                // Insert after the selection
                editBuilder.insert(selection.end, '\n\n' + content);
              });
            } else if (action === 'Copy to Clipboard') {
              await vscode.env.clipboard.writeText(content);
              vscode.window.showInformationMessage('Documentation copied to clipboard');
            } else if (action === 'Open Document') {
              const uri = vscode.Uri.parse(`docusynth:${doc._id}.md`);

              const provider = new (class implements vscode.TextDocumentContentProvider {
                provideTextDocumentContent(): string {
                  return content;
                }
              })();

              vscode.workspace.registerTextDocumentContentProvider('docusynth', provider);
              const textDoc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(textDoc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
            }

            // Refresh the tree to show the new document
            await treeProvider.refresh();
          } catch (error) {
            await handleApiError(error, 'Failed to generate documentation');
          }
        }
      );
    })
  );
}

import * as vscode from 'vscode';
import { getApi, Document, Project, handleApiError } from './api';

/**
 * Tree item types
 */
type TreeItemType = 'project' | 'document' | 'loading' | 'error' | 'noDocuments';

/**
 * Tree item representing a project or document
 */
export class DocuSynthTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: TreeItemType,
    public readonly data?: Project | Document,
    public readonly projectId?: string | null
  ) {
    super(label, collapsibleState);
    this.contextValue = itemType;
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.itemType) {
      case 'project':
        this.iconPath = new vscode.ThemeIcon('folder');
        this.tooltip = (this.data as Project)?.description || this.label;
        break;
      case 'document':
        this.iconPath = new vscode.ThemeIcon('file-text');
        const doc = this.data as Document;
        this.tooltip = this.createDocumentTooltip(doc);
        this.command = {
          command: 'docusynth.openDocument',
          title: 'Open Document',
          arguments: [this],
        };
        break;
      case 'loading':
        this.iconPath = new vscode.ThemeIcon('loading~spin');
        break;
      case 'error':
        this.iconPath = new vscode.ThemeIcon('error');
        break;
      case 'noDocuments':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }

  private createDocumentTooltip(doc: Document): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${doc.title}**\n\n`);

    if (doc.tags && doc.tags.length > 0) {
      tooltip.appendMarkdown(`Tags: ${doc.tags.join(', ')}\n\n`);
    }

    const updatedDate = new Date(doc.updatedAt).toLocaleDateString();
    tooltip.appendMarkdown(`Last updated: ${updatedDate}`);

    return tooltip;
  }

  /**
   * Get the document data if this is a document item
   */
  getDocument(): Document | undefined {
    if (this.itemType === 'document') {
      return this.data as Document;
    }
    return undefined;
  }

  /**
   * Get the project data if this is a project item
   */
  getProject(): Project | undefined {
    if (this.itemType === 'project') {
      return this.data as Project;
    }
    return undefined;
  }
}

/**
 * Tree data provider for DocuSynth documents
 */
export class DocuSynthTreeProvider implements vscode.TreeDataProvider<DocuSynthTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DocuSynthTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DocuSynthTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DocuSynthTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private projects: Project[] = [];
  private documents: Document[] = [];
  private isLoading: boolean = false;
  private error: string | null = null;

  constructor() {}

  /**
   * Refresh the tree view
   */
  async refresh(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this._onDidChangeTreeData.fire();

    try {
      const api = getApi();
      const [projects, documents] = await Promise.all([
        api.getProjects(),
        api.getDocuments(),
      ]);

      this.projects = projects;
      this.documents = documents;
      this.isLoading = false;
      this._onDidChangeTreeData.fire();

      const docCount = documents.length;
      const projectCount = projects.length;
      vscode.window.setStatusBarMessage(
        `DocuSynth: Loaded ${docCount} document${docCount !== 1 ? 's' : ''} in ${projectCount} project${projectCount !== 1 ? 's' : ''}`,
        3000
      );
    } catch (error) {
      this.isLoading = false;
      this.error = error instanceof Error ? error.message : 'Failed to load documents';
      this._onDidChangeTreeData.fire();
      await handleApiError(error, 'Failed to load documents');
    }
  }

  getTreeItem(element: DocuSynthTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DocuSynthTreeItem): Promise<DocuSynthTreeItem[]> {
    // Root level
    if (!element) {
      if (this.isLoading) {
        return [new DocuSynthTreeItem('Loading...', vscode.TreeItemCollapsibleState.None, 'loading')];
      }

      if (this.error) {
        return [new DocuSynthTreeItem(this.error, vscode.TreeItemCollapsibleState.None, 'error')];
      }

      // Group documents by project
      const items: DocuSynthTreeItem[] = [];

      // Add projects
      for (const project of this.projects) {
        const projectDocs = this.documents.filter((d) => d.projectId === project._id);
        const hasChildren = projectDocs.length > 0;
        items.push(
          new DocuSynthTreeItem(
            `${project.name} (${projectDocs.length})`,
            hasChildren
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.None,
            'project',
            project
          )
        );
      }

      // Add documents without a project
      const orphanDocs = this.documents.filter((d) => !d.projectId);
      if (orphanDocs.length > 0) {
        items.push(
          new DocuSynthTreeItem(
            `Uncategorized (${orphanDocs.length})`,
            vscode.TreeItemCollapsibleState.Expanded,
            'project',
            { _id: '', name: 'Uncategorized', createdAt: 0, updatedAt: 0 } as Project
          )
        );
      }

      if (items.length === 0) {
        return [
          new DocuSynthTreeItem(
            'No documents found',
            vscode.TreeItemCollapsibleState.None,
            'noDocuments'
          ),
        ];
      }

      return items;
    }

    // Children of a project
    if (element.itemType === 'project') {
      const project = element.getProject();
      const projectId = project?._id || null;

      let projectDocs: Document[];
      if (projectId === '' || projectId === null) {
        // Uncategorized documents
        projectDocs = this.documents.filter((d) => !d.projectId);
      } else {
        projectDocs = this.documents.filter((d) => d.projectId === projectId);
      }

      return projectDocs.map(
        (doc) =>
          new DocuSynthTreeItem(
            doc.title,
            vscode.TreeItemCollapsibleState.None,
            'document',
            doc,
            projectId
          )
      );
    }

    return [];
  }

  /**
   * Get all documents
   */
  getDocuments(): Document[] {
    return this.documents;
  }

  /**
   * Get all projects
   */
  getProjects(): Project[] {
    return this.projects;
  }

  /**
   * Find a document by ID
   */
  findDocument(id: string): Document | undefined {
    return this.documents.find((d) => d._id === id);
  }

  /**
   * Find documents matching a search query
   */
  searchDocuments(query: string): Document[] {
    const lowerQuery = query.toLowerCase();
    return this.documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
  }
}

/**
 * Create and register the tree view
 */
export function createTreeView(context: vscode.ExtensionContext): {
  treeView: vscode.TreeView<DocuSynthTreeItem>;
  treeProvider: DocuSynthTreeProvider;
} {
  const treeProvider = new DocuSynthTreeProvider();

  const treeView = vscode.window.createTreeView('docusynthDocuments', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  return { treeView, treeProvider };
}

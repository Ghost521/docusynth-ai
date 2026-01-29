import * as vscode from 'vscode';
import { getServerUrl, getApiKey, isApiKeyConfigured, promptForApiKey } from './config';

/**
 * Document interface matching DocuSynth API
 */
export interface Document {
  _id: string;
  title: string;
  content: string;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  sources?: string[];
  tags?: string[];
  isPublic?: boolean;
}

/**
 * Project interface matching DocuSynth API
 */
export interface Project {
  _id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  isPublic?: boolean;
}

/**
 * Generate request interface
 */
export interface GenerateRequest {
  query: string;
  sources?: string[];
  projectId?: string;
  options?: {
    maxTokens?: number;
    includeCode?: boolean;
  };
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * API Error class
 */
export class DocuSynthApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'DocuSynthApiError';
  }
}

/**
 * DocuSynth API Client
 */
export class DocuSynthApi {
  private static instance: DocuSynthApi;

  private constructor() {}

  public static getInstance(): DocuSynthApi {
    if (!DocuSynthApi.instance) {
      DocuSynthApi.instance = new DocuSynthApi();
    }
    return DocuSynthApi.instance;
  }

  /**
   * Make an authenticated request to the API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Check if API key is configured
    if (!isApiKeyConfigured()) {
      const apiKey = await promptForApiKey();
      if (!apiKey) {
        throw new DocuSynthApiError('API key is required. Please configure it in settings.');
      }
    }

    const serverUrl = getServerUrl();
    const apiKey = getApiKey();
    const url = `${serverUrl}/api${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
        try {
          const errorBody = await response.json();
          if (errorBody.error) {
            errorMessage = errorBody.error;
          }
        } catch {
          // Ignore JSON parse errors
        }

        if (response.status === 401) {
          throw new DocuSynthApiError('Invalid API key. Please check your configuration.', 401);
        }

        throw new DocuSynthApiError(errorMessage, response.status);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof DocuSynthApiError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new DocuSynthApiError(
          `Could not connect to DocuSynth server at ${serverUrl}. Please check the server URL and ensure the server is running.`
        );
      }
      throw new DocuSynthApiError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  /**
   * Get all documents
   */
  async getDocuments(): Promise<Document[]> {
    const response = await this.request<{ documents: Document[] }>('/documents');
    return response.documents || [];
  }

  /**
   * Get a single document by ID
   */
  async getDocument(id: string): Promise<Document> {
    const response = await this.request<{ document: Document }>(`/documents/${id}`);
    return response.document;
  }

  /**
   * Create a new document
   */
  async createDocument(document: Omit<Document, '_id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
    const response = await this.request<{ document: Document }>('/documents', {
      method: 'POST',
      body: JSON.stringify(document),
    });
    return response.document;
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    const response = await this.request<{ projects: Project[] }>('/projects');
    return response.projects || [];
  }

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<Project> {
    const response = await this.request<{ project: Project }>(`/projects/${id}`);
    return response.project;
  }

  /**
   * Create a new project
   */
  async createProject(project: Omit<Project, '_id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    const response = await this.request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(project),
    });
    return response.project;
  }

  /**
   * Generate documentation
   */
  async generateDocumentation(request: GenerateRequest): Promise<Document> {
    const response = await this.request<{ document: Document }>('/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.document;
  }

  /**
   * Search documents
   */
  async searchDocuments(query: string, limit: number = 20): Promise<Document[]> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
    });
    const response = await this.request<{ documents: Document[] }>(`/documents?${params}`);
    return response.documents || [];
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getProjects();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the singleton API instance
 */
export function getApi(): DocuSynthApi {
  return DocuSynthApi.getInstance();
}

/**
 * Handle API errors with user notifications
 */
export async function handleApiError(error: unknown, context: string): Promise<void> {
  let message = `DocuSynth: ${context}`;

  if (error instanceof DocuSynthApiError) {
    message = `DocuSynth: ${error.message}`;

    if (error.statusCode === 401) {
      const action = await vscode.window.showErrorMessage(
        message,
        'Configure API Key',
        'Open Settings'
      );

      if (action === 'Configure API Key') {
        await promptForApiKey();
      } else if (action === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'docusynth');
      }
      return;
    }
  } else if (error instanceof Error) {
    message = `DocuSynth: ${error.message}`;
  }

  vscode.window.showErrorMessage(message);
}

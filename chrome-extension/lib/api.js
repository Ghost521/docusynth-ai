/**
 * DocuSynth AI API Client
 * Shared API client for the Chrome extension
 */

const DEFAULT_SERVER_URL = 'http://localhost:3000';

/**
 * Get stored settings
 * @returns {Promise<{apiKey: string, serverUrl: string}>}
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['apiKey', 'serverUrl'], (result) => {
      resolve({
        apiKey: result.apiKey || '',
        serverUrl: result.serverUrl || DEFAULT_SERVER_URL
      });
    });
  });
}

/**
 * Save settings
 * @param {Object} settings
 * @param {string} settings.apiKey
 * @param {string} settings.serverUrl
 */
export async function saveSettings({ apiKey, serverUrl }) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ apiKey, serverUrl }, resolve);
  });
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., '/api/documents')
 * @param {Object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
  const { apiKey, serverUrl } = await getSettings();

  if (!apiKey) {
    throw new Error('API key not configured. Please set your API key in the extension options.');
  }

  const url = `${serverUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Get list of documents
 * @param {Object} params - Query parameters
 * @param {number} params.limit - Max number of documents
 * @param {number} params.offset - Pagination offset
 * @returns {Promise<Array>}
 */
export async function getDocuments({ limit = 10, offset = 0 } = {}) {
  return apiRequest(`/api/documents?limit=${limit}&offset=${offset}`);
}

/**
 * Get a single document by ID
 * @param {string} id - Document ID
 * @returns {Promise<Object>}
 */
export async function getDocument(id) {
  return apiRequest(`/api/documents/${id}`);
}

/**
 * Create a new document
 * @param {Object} document
 * @param {string} document.title - Document title
 * @param {string} document.content - Document content
 * @param {Array} document.sources - Array of source URLs
 * @returns {Promise<Object>}
 */
export async function createDocument(document) {
  return apiRequest('/api/documents', {
    method: 'POST',
    body: JSON.stringify(document)
  });
}

/**
 * Generate documentation from sources
 * @param {Object} params
 * @param {string} params.url - URL to generate docs from
 * @param {string} params.content - Page content
 * @param {string} params.title - Page title
 * @param {string} params.type - Generation type ('page', 'selection')
 * @returns {Promise<Object>}
 */
export async function generateDocumentation({ url, content, title, type = 'page' }) {
  return apiRequest('/api/generate', {
    method: 'POST',
    body: JSON.stringify({
      sources: [{ url, content, title }],
      type,
      options: {
        optimizeForTokens: true,
        includeExamples: true
      }
    })
  });
}

/**
 * Add a source to the capture queue
 * @param {Object} source
 * @param {string} source.url - Source URL
 * @param {string} source.title - Page title
 * @param {string} source.content - Page content or selection
 */
export async function addCapturedSource(source) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['capturedSources'], (result) => {
      const sources = result.capturedSources || [];
      sources.unshift({
        ...source,
        capturedAt: new Date().toISOString(),
        id: crypto.randomUUID()
      });
      // Keep only last 50 sources
      const trimmedSources = sources.slice(0, 50);
      chrome.storage.local.set({ capturedSources: trimmedSources }, () => {
        resolve(trimmedSources);
      });
    });
  });
}

/**
 * Get captured sources
 * @returns {Promise<Array>}
 */
export async function getCapturedSources() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['capturedSources'], (result) => {
      resolve(result.capturedSources || []);
    });
  });
}

/**
 * Remove a captured source
 * @param {string} id - Source ID
 */
export async function removeCapturedSource(id) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['capturedSources'], (result) => {
      const sources = (result.capturedSources || []).filter(s => s.id !== id);
      chrome.storage.local.set({ capturedSources: sources }, () => {
        resolve(sources);
      });
    });
  });
}

/**
 * Clear all captured sources
 */
export async function clearCapturedSources() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ capturedSources: [] }, resolve);
  });
}

/**
 * Update badge count
 * @param {number} count
 */
export function updateBadge(count) {
  const text = count > 0 ? String(count) : '';
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: count > 0 ? '#3b82f6' : '#6b7280' });
}

/**
 * Check if API connection is valid
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateConnection() {
  try {
    const { apiKey, serverUrl } = await getSettings();

    if (!apiKey) {
      return { valid: false, error: 'API key not configured' };
    }

    const response = await fetch(`${serverUrl}/api/health`, {
      headers: { 'X-API-Key': apiKey }
    });

    if (response.ok) {
      return { valid: true };
    }

    return { valid: false, error: `Server returned ${response.status}` };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

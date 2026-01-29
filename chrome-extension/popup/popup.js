/**
 * DocuSynth AI Popup Script
 * Handles popup UI interactions and state management
 */

import {
  getSettings,
  getCapturedSources,
  removeCapturedSource,
  clearCapturedSources,
  getDocuments,
  validateConnection,
  updateBadge
} from '../lib/api.js';

// DOM Elements
const elements = {
  statusBar: document.getElementById('status-bar'),
  statusText: document.getElementById('status-text'),
  settingsBtn: document.getElementById('settings-btn'),
  capturePageBtn: document.getElementById('capture-page-btn'),
  captureSelectionBtn: document.getElementById('capture-selection-btn'),
  generateBtn: document.getElementById('generate-btn'),
  openAppBtn: document.getElementById('open-app-btn'),
  sourcesList: document.getElementById('sources-list'),
  sourcesCount: document.getElementById('sources-count'),
  sourcesActions: document.getElementById('sources-actions'),
  generateFromSourcesBtn: document.getElementById('generate-from-sources-btn'),
  clearSourcesBtn: document.getElementById('clear-sources-btn'),
  documentsList: document.getElementById('documents-list'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  shortcutsLink: document.getElementById('shortcuts-link'),
  helpLink: document.getElementById('help-link')
};

/**
 * Initialize the popup
 */
async function init() {
  // Check connection status
  await checkConnection();

  // Load captured sources
  await loadCapturedSources();

  // Load recent documents
  await loadRecentDocuments();

  // Set up event listeners
  setupEventListeners();
}

/**
 * Check API connection status
 */
async function checkConnection() {
  const { valid, error } = await validateConnection();

  elements.statusBar.classList.remove('status-checking', 'status-connected', 'status-disconnected');

  if (valid) {
    elements.statusBar.classList.add('status-connected');
    elements.statusText.textContent = 'Connected to DocuSynth AI';
  } else {
    elements.statusBar.classList.add('status-disconnected');
    elements.statusText.textContent = error || 'Not connected';
  }
}

/**
 * Load and display captured sources
 */
async function loadCapturedSources() {
  const sources = await getCapturedSources();

  elements.sourcesCount.textContent = sources.length;
  updateBadge(sources.length);

  if (sources.length === 0) {
    elements.sourcesList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17,8 12,3 7,8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>No sources captured yet</p>
        <span>Right-click on any page or select text to capture</span>
      </div>
    `;
    elements.sourcesActions.classList.add('hidden');
    return;
  }

  elements.sourcesActions.classList.remove('hidden');
  elements.sourcesList.innerHTML = sources.map(source => `
    <div class="source-item" data-id="${source.id}">
      <div class="source-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${source.type === 'selection'
            ? '<path d="M4 7V4h3"/><path d="M20 7V4h-3"/><path d="M4 17v3h3"/><path d="M20 17v3h-3"/><rect x="7" y="7" width="10" height="10"/>'
            : '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>'}
        </svg>
      </div>
      <div class="source-info">
        <div class="source-title" title="${escapeHtml(source.title)}">${escapeHtml(source.title)}</div>
        <div class="source-meta">${formatRelativeTime(source.capturedAt)}</div>
      </div>
      <button class="source-remove" data-id="${source.id}" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Add remove handlers
  elements.sourcesList.querySelectorAll('.source-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await removeCapturedSource(id);
      await loadCapturedSources();
    });
  });
}

/**
 * Load and display recent documents
 */
async function loadRecentDocuments() {
  try {
    const { apiKey } = await getSettings();

    if (!apiKey) {
      elements.documentsList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p>API key required</p>
          <span>Configure your API key in settings</span>
        </div>
      `;
      return;
    }

    const documents = await getDocuments({ limit: 5 });

    if (!documents || documents.length === 0) {
      elements.documentsList.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>No documents yet</p>
          <span>Generate your first documentation</span>
        </div>
      `;
      return;
    }

    elements.documentsList.innerHTML = documents.map(doc => `
      <div class="document-item" data-id="${doc.id}">
        <div class="document-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div class="document-info">
          <div class="document-title" title="${escapeHtml(doc.title)}">${escapeHtml(doc.title)}</div>
          <div class="document-meta">
            <span>${formatRelativeTime(doc.createdAt)}</span>
            <span>${doc.sources?.length || 0} sources</span>
          </div>
        </div>
      </div>
    `).join('');

    // Add click handlers to open documents
    elements.documentsList.querySelectorAll('.document-item').forEach(item => {
      item.addEventListener('click', async () => {
        const { serverUrl } = await getSettings();
        const docId = item.dataset.id;
        chrome.tabs.create({ url: `${serverUrl}/?doc=${docId}` });
      });
    });

  } catch (error) {
    console.error('Failed to load documents:', error);
    elements.documentsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p>Failed to load documents</p>
        <span>${error.message}</span>
      </div>
    `;
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Settings button
  elements.settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Capture page button
  elements.capturePageBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.runtime.sendMessage({ action: 'capturePage', tabId: tab.id }, async (response) => {
      if (response?.success) {
        await loadCapturedSources();
        showButtonFeedback(elements.capturePageBtn, 'success');
      } else {
        showButtonFeedback(elements.capturePageBtn, 'error');
      }
    });
  });

  // Capture selection button
  elements.captureSelectionBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          return selection ? selection.toString().trim() : '';
        }
      });

      const selectedText = result.result;

      if (!selectedText) {
        showButtonFeedback(elements.captureSelectionBtn, 'error');
        return;
      }

      chrome.runtime.sendMessage({
        action: 'captureSelection',
        url: tab.url,
        title: `Selection from: ${tab.title}`,
        content: selectedText
      }, async (response) => {
        if (response?.success) {
          await loadCapturedSources();
          showButtonFeedback(elements.captureSelectionBtn, 'success');
        } else {
          showButtonFeedback(elements.captureSelectionBtn, 'error');
        }
      });
    } catch (error) {
      console.error('Failed to capture selection:', error);
      showButtonFeedback(elements.captureSelectionBtn, 'error');
    }
  });

  // Generate docs button
  elements.generateBtn.addEventListener('click', async () => {
    const { apiKey } = await getSettings();

    if (!apiKey) {
      chrome.runtime.openOptionsPage();
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    elements.generateBtn.disabled = true;
    elements.generateBtn.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px;"></div>
      <span>Generating...</span>
    `;

    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText
      });

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'generateDocs',
          data: {
            url: tab.url,
            title: tab.title,
            content: result.result,
            type: 'page'
          }
        }, resolve);
      });

      if (response?.success) {
        showButtonFeedback(elements.generateBtn, 'success');
        // Reload documents list
        await loadRecentDocuments();
      } else {
        throw new Error(response?.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Failed to generate docs:', error);
      showButtonFeedback(elements.generateBtn, 'error');
    } finally {
      elements.generateBtn.disabled = false;
      elements.generateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
        </svg>
        <span>Generate Docs</span>
      `;
    }
  });

  // Open app button
  elements.openAppBtn.addEventListener('click', async () => {
    const { serverUrl } = await getSettings();
    chrome.tabs.create({ url: serverUrl });
  });

  // Generate from sources button
  elements.generateFromSourcesBtn.addEventListener('click', async () => {
    const { apiKey, serverUrl } = await getSettings();

    if (!apiKey) {
      chrome.runtime.openOptionsPage();
      return;
    }

    // Open the app with sources pre-loaded
    const sources = await getCapturedSources();
    const sourcesParam = encodeURIComponent(JSON.stringify(sources.map(s => ({
      url: s.url,
      title: s.title
    }))));

    chrome.tabs.create({ url: `${serverUrl}/?sources=${sourcesParam}` });
  });

  // Clear sources button
  elements.clearSourcesBtn.addEventListener('click', async () => {
    if (confirm('Clear all captured sources?')) {
      await clearCapturedSources();
      await loadCapturedSources();
    }
  });

  // Shortcuts link
  elements.shortcutsLink.addEventListener('click', (e) => {
    e.preventDefault();
    elements.shortcutsModal.classList.remove('hidden');
  });

  // Modal close
  elements.shortcutsModal.querySelector('.modal-close').addEventListener('click', () => {
    elements.shortcutsModal.classList.add('hidden');
  });

  elements.shortcutsModal.addEventListener('click', (e) => {
    if (e.target === elements.shortcutsModal) {
      elements.shortcutsModal.classList.add('hidden');
    }
  });

  // Help link
  elements.helpLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { serverUrl } = await getSettings();
    chrome.tabs.create({ url: `${serverUrl}/help` });
  });
}

/**
 * Show visual feedback on a button
 */
function showButtonFeedback(button, type) {
  const originalBg = button.style.backgroundColor;
  const color = type === 'success' ? '#10b981' : '#ef4444';

  button.style.backgroundColor = color;
  button.style.borderColor = color;

  setTimeout(() => {
    button.style.backgroundColor = originalBg;
    button.style.borderColor = '';
  }, 500);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format a date as relative time
 */
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

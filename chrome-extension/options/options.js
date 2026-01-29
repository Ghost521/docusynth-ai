/**
 * DocuSynth AI Options Page Script
 * Handles settings management and configuration
 */

import { getSettings, saveSettings, validateConnection, clearCapturedSources } from '../lib/api.js';

// DOM Elements
const elements = {
  connectionStatus: document.getElementById('connection-status'),
  statusDetail: document.getElementById('status-detail'),
  testConnectionBtn: document.getElementById('test-connection-btn'),
  apiKeyInput: document.getElementById('api-key'),
  toggleApiKeyBtn: document.getElementById('toggle-api-key'),
  eyeIcon: document.getElementById('eye-icon'),
  eyeOffIcon: document.getElementById('eye-off-icon'),
  serverUrlInput: document.getElementById('server-url'),
  saveBtn: document.getElementById('save-btn'),
  resetBtn: document.getElementById('reset-btn'),
  autoCaptureToggle: document.getElementById('auto-capture'),
  showNotificationsToggle: document.getElementById('show-notifications'),
  showBadgeToggle: document.getElementById('show-badge'),
  exportDataBtn: document.getElementById('export-data-btn'),
  clearDataBtn: document.getElementById('clear-data-btn'),
  websiteLink: document.getElementById('website-link'),
  docsLink: document.getElementById('docs-link'),
  toastContainer: document.getElementById('toast-container')
};

// Default settings
const DEFAULT_SETTINGS = {
  serverUrl: 'http://localhost:3000',
  autoCapture: true,
  showNotifications: true,
  showBadge: true
};

/**
 * Initialize the options page
 */
async function init() {
  // Load current settings
  await loadSettings();

  // Check connection status
  await checkConnection();

  // Set up event listeners
  setupEventListeners();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const { apiKey, serverUrl } = await getSettings();

  elements.apiKeyInput.value = apiKey || '';
  elements.serverUrlInput.value = serverUrl || DEFAULT_SETTINGS.serverUrl;

  // Load advanced settings
  chrome.storage.sync.get(['autoCapture', 'showNotifications', 'showBadge'], (result) => {
    elements.autoCaptureToggle.checked = result.autoCapture !== false;
    elements.showNotificationsToggle.checked = result.showNotifications !== false;
    elements.showBadgeToggle.checked = result.showBadge !== false;
  });

  // Update links
  elements.websiteLink.href = serverUrl || DEFAULT_SETTINGS.serverUrl;
  elements.docsLink.href = `${serverUrl || DEFAULT_SETTINGS.serverUrl}/docs`;
}

/**
 * Check API connection status
 */
async function checkConnection() {
  const statusIcon = elements.connectionStatus.querySelector('.status-icon');
  const statusLabel = elements.connectionStatus.querySelector('.status-label');

  // Reset to checking state
  statusIcon.className = 'status-icon checking';
  statusIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  `;
  statusLabel.textContent = 'Checking connection...';
  elements.statusDetail.textContent = '';

  const { valid, error } = await validateConnection();

  if (valid) {
    statusIcon.className = 'status-icon connected';
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    `;
    statusLabel.textContent = 'Connected';
    elements.statusDetail.textContent = 'API connection is working properly';
  } else {
    statusIcon.className = 'status-icon disconnected';
    statusIcon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
    statusLabel.textContent = 'Not Connected';
    elements.statusDetail.textContent = error || 'Unable to connect to the server';
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Toggle API key visibility
  elements.toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = elements.apiKeyInput.type === 'password';
    elements.apiKeyInput.type = isPassword ? 'text' : 'password';
    elements.eyeIcon.classList.toggle('hidden', !isPassword);
    elements.eyeOffIcon.classList.toggle('hidden', isPassword);
  });

  // Test connection
  elements.testConnectionBtn.addEventListener('click', async () => {
    elements.testConnectionBtn.disabled = true;
    elements.testConnectionBtn.textContent = 'Testing...';

    // Save current settings first
    await saveCurrentSettings();

    // Then check connection
    await checkConnection();

    elements.testConnectionBtn.disabled = false;
    elements.testConnectionBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      Test Connection
    `;
  });

  // Save settings
  elements.saveBtn.addEventListener('click', async () => {
    elements.saveBtn.disabled = true;
    elements.saveBtn.textContent = 'Saving...';

    try {
      await saveCurrentSettings();
      showToast('Settings saved successfully', 'success');
      await checkConnection();
    } catch (error) {
      showToast(`Failed to save settings: ${error.message}`, 'error');
    } finally {
      elements.saveBtn.disabled = false;
      elements.saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Save Settings
      `;
    }
  });

  // Reset settings
  elements.resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? Your API key will be cleared.')) {
      return;
    }

    elements.apiKeyInput.value = '';
    elements.serverUrlInput.value = DEFAULT_SETTINGS.serverUrl;
    elements.autoCaptureToggle.checked = DEFAULT_SETTINGS.autoCapture;
    elements.showNotificationsToggle.checked = DEFAULT_SETTINGS.showNotifications;
    elements.showBadgeToggle.checked = DEFAULT_SETTINGS.showBadge;

    await saveCurrentSettings();
    showToast('Settings reset to defaults', 'info');
    await checkConnection();
  });

  // Auto-save toggle changes
  elements.autoCaptureToggle.addEventListener('change', saveAdvancedSettings);
  elements.showNotificationsToggle.addEventListener('change', saveAdvancedSettings);
  elements.showBadgeToggle.addEventListener('change', async () => {
    await saveAdvancedSettings();

    // Update badge visibility
    if (!elements.showBadgeToggle.checked) {
      chrome.action.setBadgeText({ text: '' });
    } else {
      chrome.runtime.sendMessage({ action: 'updateBadge' });
    }
  });

  // Export data
  elements.exportDataBtn.addEventListener('click', async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `docusynth-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
      showToast('Data exported successfully', 'success');
    } catch (error) {
      showToast(`Export failed: ${error.message}`, 'error');
    }
  });

  // Clear data
  elements.clearDataBtn.addEventListener('click', async () => {
    if (!confirm('Clear all local data? This cannot be undone.')) {
      return;
    }

    try {
      await clearCapturedSources();
      chrome.storage.local.clear();
      chrome.action.setBadgeText({ text: '' });
      showToast('All local data cleared', 'success');
    } catch (error) {
      showToast(`Failed to clear data: ${error.message}`, 'error');
    }
  });

  // External links
  elements.websiteLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { serverUrl } = await getSettings();
    chrome.tabs.create({ url: serverUrl });
  });

  elements.docsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { serverUrl } = await getSettings();
    chrome.tabs.create({ url: `${serverUrl}/docs` });
  });
}

/**
 * Save current settings to storage
 */
async function saveCurrentSettings() {
  const apiKey = elements.apiKeyInput.value.trim();
  const serverUrl = elements.serverUrlInput.value.trim() || DEFAULT_SETTINGS.serverUrl;

  await saveSettings({ apiKey, serverUrl });
  await saveAdvancedSettings();

  // Update links
  elements.websiteLink.href = serverUrl;
  elements.docsLink.href = `${serverUrl}/docs`;
}

/**
 * Save advanced settings
 */
async function saveAdvancedSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      autoCapture: elements.autoCaptureToggle.checked,
      showNotifications: elements.showNotificationsToggle.checked,
      showBadge: elements.showBadgeToggle.checked
    }, resolve);
  });
}

/**
 * Export all extension data
 */
async function exportAllData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (localData) => {
      chrome.storage.sync.get(null, (syncData) => {
        resolve({
          exportedAt: new Date().toISOString(),
          version: '1.0.0',
          sync: {
            ...syncData,
            apiKey: syncData.apiKey ? '[REDACTED]' : undefined
          },
          local: localData
        });
      });
    });
  });
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconPaths = {
    success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
  };

  toast.innerHTML = `
    <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${iconPaths[type] || iconPaths.info}
    </svg>
    <span class="toast-message">${message}</span>
  `;

  elements.toastContainer.appendChild(toast);

  // Remove after delay
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

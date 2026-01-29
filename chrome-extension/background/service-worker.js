/**
 * DocuSynth AI Background Service Worker
 * Handles context menus, notifications, and background tasks
 */

import {
  addCapturedSource,
  getCapturedSources,
  updateBadge,
  generateDocumentation,
  getSettings
} from '../lib/api.js';

// Context menu IDs
const MENU_CAPTURE_PAGE = 'docusynth-capture-page';
const MENU_CAPTURE_SELECTION = 'docusynth-capture-selection';
const MENU_GENERATE_DOCS = 'docusynth-generate-docs';

/**
 * Initialize context menus on extension install
 */
chrome.runtime.onInstalled.addListener(() => {
  // Remove existing menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Capture entire page
    chrome.contextMenus.create({
      id: MENU_CAPTURE_PAGE,
      title: 'Capture page as source',
      contexts: ['page']
    });

    // Capture selection
    chrome.contextMenus.create({
      id: MENU_CAPTURE_SELECTION,
      title: 'Capture selection as source',
      contexts: ['selection']
    });

    // Generate docs separator
    chrome.contextMenus.create({
      id: 'docusynth-separator',
      type: 'separator',
      contexts: ['page', 'selection']
    });

    // Generate docs from page
    chrome.contextMenus.create({
      id: MENU_GENERATE_DOCS,
      title: 'Generate documentation',
      contexts: ['page']
    });
  });

  // Initialize badge
  updateBadgeCount();

  // Set up alarm for periodic badge updates
  chrome.alarms.create('updateBadge', { periodInMinutes: 5 });
});

/**
 * Handle context menu clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case MENU_CAPTURE_PAGE:
      await handleCapturePage(tab);
      break;
    case MENU_CAPTURE_SELECTION:
      await handleCaptureSelection(info, tab);
      break;
    case MENU_GENERATE_DOCS:
      await handleGenerateDocs(tab);
      break;
  }
});

/**
 * Capture entire page as source
 */
async function handleCapturePage(tab) {
  try {
    // Get page content from content script
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        content: document.body.innerText,
        html: document.documentElement.outerHTML
      })
    });

    const source = {
      url: tab.url,
      title: tab.title,
      content: result.result.content,
      type: 'page'
    };

    await addCapturedSource(source);
    await updateBadgeCount();

    showNotification('Source Captured', `"${tab.title}" added to your sources.`);
  } catch (error) {
    console.error('Failed to capture page:', error);
    showNotification('Capture Failed', error.message);
  }
}

/**
 * Capture selected text as source
 */
async function handleCaptureSelection(info, tab) {
  try {
    const source = {
      url: tab.url,
      title: `Selection from: ${tab.title}`,
      content: info.selectionText,
      type: 'selection'
    };

    await addCapturedSource(source);
    await updateBadgeCount();

    showNotification('Selection Captured', `${info.selectionText.slice(0, 50)}...`);
  } catch (error) {
    console.error('Failed to capture selection:', error);
    showNotification('Capture Failed', error.message);
  }
}

/**
 * Generate documentation from current page
 */
async function handleGenerateDocs(tab) {
  try {
    const { apiKey } = await getSettings();

    if (!apiKey) {
      showNotification('Configuration Required', 'Please set your API key in the extension options.');
      chrome.runtime.openOptionsPage();
      return;
    }

    // Get page content
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText
    });

    showNotification('Generating...', 'Creating documentation from this page.');

    const doc = await generateDocumentation({
      url: tab.url,
      content: result.result,
      title: tab.title,
      type: 'page'
    });

    showNotification('Documentation Ready', `"${doc.title}" has been generated.`);

    // Store the generated doc ID for quick access
    chrome.storage.local.set({ lastGeneratedDoc: doc });

  } catch (error) {
    console.error('Failed to generate docs:', error);
    showNotification('Generation Failed', error.message);
  }
}

/**
 * Update badge count with captured sources count
 */
async function updateBadgeCount() {
  const sources = await getCapturedSources();
  updateBadge(sources.length);
}

/**
 * Show a notification
 */
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: `DocuSynth AI: ${title}`,
    message: message
  });
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.action) {
    case 'capturePage':
      await handleCapturePage(sender.tab);
      return { success: true };

    case 'captureSelection':
      const source = {
        url: message.url,
        title: message.title,
        content: message.content,
        type: 'selection'
      };
      await addCapturedSource(source);
      await updateBadgeCount();
      return { success: true };

    case 'updateBadge':
      await updateBadgeCount();
      return { success: true };

    case 'generateDocs':
      try {
        const doc = await generateDocumentation(message.data);
        return { success: true, doc };
      } catch (error) {
        return { success: false, error: error.message };
      }

    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Handle alarms
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateBadge') {
    updateBadgeCount();
  }
});

/**
 * Handle extension button click when popup is disabled
 */
chrome.action.onClicked.addListener((tab) => {
  // This only fires if popup is disabled
  // For now, we always show the popup
});

// Log when service worker starts
console.log('DocuSynth AI service worker initialized');

/**
 * DocuSynth AI Content Script
 * Runs on web pages to enable page capture and selection
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__docuSynthInjected) return;
  window.__docuSynthInjected = true;

  /**
   * Get page metadata
   */
  function getPageMetadata() {
    const meta = {};

    // Get OpenGraph and meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(tag => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (name && content) {
        meta[name] = content;
      }
    });

    return {
      url: window.location.href,
      title: document.title,
      description: meta['description'] || meta['og:description'] || '',
      author: meta['author'] || meta['article:author'] || '',
      publishedDate: meta['article:published_time'] || meta['datePublished'] || '',
      keywords: meta['keywords'] || '',
      ogImage: meta['og:image'] || ''
    };
  }

  /**
   * Get clean text content from the page
   */
  function getPageContent() {
    // Clone the body to avoid modifying the actual page
    const clone = document.body.cloneNode(true);

    // Remove scripts, styles, and other non-content elements
    const removeElements = clone.querySelectorAll(
      'script, style, noscript, iframe, svg, canvas, video, audio, ' +
      'nav, header, footer, aside, [role="navigation"], [role="banner"], ' +
      '[role="contentinfo"], [aria-hidden="true"], .ad, .ads, .advertisement, ' +
      '.sidebar, .comments, .comment, .social-share, .share-buttons'
    );
    removeElements.forEach(el => el.remove());

    // Get text content
    let text = clone.innerText || clone.textContent || '';

    // Clean up whitespace
    text = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    return text;
  }

  /**
   * Get selected text with context
   */
  function getSelectionWithContext() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      return null;
    }

    // Try to get surrounding context
    let context = '';
    const container = range.commonAncestorContainer;
    const parentElement = container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : container;

    if (parentElement) {
      // Get parent paragraph or section
      const contextEl = parentElement.closest('p, article, section, div, li');
      if (contextEl) {
        context = contextEl.innerText || contextEl.textContent || '';
      }
    }

    return {
      text: selectedText,
      context: context,
      html: range.cloneContents().textContent
    };
  }

  /**
   * Highlight an element temporarily
   */
  function highlightElement(element, duration = 1000) {
    const originalOutline = element.style.outline;
    const originalTransition = element.style.transition;

    element.style.transition = 'outline 0.2s ease';
    element.style.outline = '3px solid #3b82f6';

    setTimeout(() => {
      element.style.outline = originalOutline;
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, 200);
    }, duration);
  }

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.getElementById('docusynth-toast');
    if (existing) existing.remove();

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'docusynth-toast';
    toast.textContent = message;

    const colors = {
      success: { bg: '#10b981', text: '#ffffff' },
      error: { bg: '#ef4444', text: '#ffffff' },
      info: { bg: '#3b82f6', text: '#ffffff' }
    };

    const color = colors[type] || colors.info;

    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '12px 24px',
      backgroundColor: color.bg,
      color: color.text,
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: '2147483647',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      fontWeight: '500',
      opacity: '0',
      transform: 'translateY(20px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease'
    });

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Listen for messages from the extension
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getPageContent':
        const metadata = getPageMetadata();
        const content = getPageContent();
        sendResponse({
          success: true,
          data: { ...metadata, content }
        });
        break;

      case 'getSelection':
        const selection = getSelectionWithContext();
        if (selection) {
          sendResponse({ success: true, data: selection });
        } else {
          sendResponse({ success: false, error: 'No text selected' });
        }
        break;

      case 'showToast':
        showToast(message.message, message.type);
        sendResponse({ success: true });
        break;

      case 'ping':
        sendResponse({ success: true, injected: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }

    return true; // Keep channel open for async response
  });

  /**
   * Listen for keyboard shortcuts
   */
  document.addEventListener('keydown', (e) => {
    // Alt + Shift + C: Capture selection
    if (e.altKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      const selection = getSelectionWithContext();
      if (selection) {
        chrome.runtime.sendMessage({
          action: 'captureSelection',
          url: window.location.href,
          title: `Selection from: ${document.title}`,
          content: selection.text
        }, (response) => {
          if (response?.success) {
            showToast('Selection captured!', 'success');
          } else {
            showToast('Failed to capture selection', 'error');
          }
        });
      } else {
        showToast('Please select some text first', 'info');
      }
    }

    // Alt + Shift + P: Capture page
    if (e.altKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      chrome.runtime.sendMessage({
        action: 'capturePage'
      }, (response) => {
        if (response?.success) {
          showToast('Page captured!', 'success');
        } else {
          showToast('Failed to capture page', 'error');
        }
      });
    }
  });

  // Log injection
  console.log('DocuSynth AI content script loaded');
})();

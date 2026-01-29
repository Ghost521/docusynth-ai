// DocuSynth AI Service Worker
// Version: 1.0.0

const CACHE_NAME = 'docusynth-v1';
const OFFLINE_CACHE = 'docusynth-offline-v1';
const DOCUMENTS_CACHE = 'docusynth-documents-v1';
const API_CACHE = 'docusynth-api-v1';

// Static assets to cache on install
// Note: Don't cache '/' or '/index.html' here - the SPA is dynamic
// and should be cached via navigationHandler on first successful load
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  // Icons
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// API patterns to cache
const API_PATTERNS = [
  /\/api\/documents/,
  /\/api\/projects/,
  /\/api\/search/,
];

// Convex patterns (handled specially)
const CONVEX_PATTERNS = [
  /convex\.cloud/,
  /convex\.dev/,
];

// ===============================================================
// Installation
// ===============================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.filter(url => !url.includes('undefined')));
      }).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
      }),

      // Create offline cache
      caches.open(OFFLINE_CACHE).then((cache) => {
        console.log('[SW] Offline cache created');
      }),

      // Create documents cache
      caches.open(DOCUMENTS_CACHE).then((cache) => {
        console.log('[SW] Documents cache created');
      }),
    ]).then(() => {
      // Force activate immediately
      return self.skipWaiting();
    })
  );
});

// ===============================================================
// Activation
// ===============================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Keep current caches, delete old versions
              return name.startsWith('docusynth-') &&
                !name.endsWith('-v1');
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),

      // Take control of all clients
      self.clients.claim(),
    ])
  );
});

// ===============================================================
// Fetch Handling
// ===============================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching
  if (request.method !== 'GET') {
    // Queue mutations for background sync if offline
    if (!navigator.onLine && request.method !== 'GET') {
      event.respondWith(handleOfflineMutation(request));
      return;
    }
    return;
  }

  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isDocumentRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request, DOCUMENTS_CACHE));
  } else if (isAPIRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (isConvexRequest(url)) {
    event.respondWith(networkFirst(request, API_CACHE, 3000));
  } else if (isNavigationRequest(request)) {
    event.respondWith(navigationHandler(request));
  } else {
    // Default: network first with fallback
    event.respondWith(networkFirstWithFallback(request));
  }
});

// ===============================================================
// Caching Strategies
// ===============================================================

// Cache First - for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network First - for API requests
async function networkFirst(request, cacheName, timeout = 5000) {
  const cache = await caches.open(cacheName);

  try {
    // Race between network and timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network first failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// Stale While Revalidate - for documents
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise;
}

// Network First with Fallback
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Navigation Handler
async function navigationHandler(request) {
  // Always try the network first for navigation requests
  try {
    const response = await fetch(request);
    // Cache successful navigation responses for genuine offline use later
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch (error) {
    // Network truly failed - try cached app shell
    const cached = await caches.match('/index.html');
    if (cached) {
      return cached;
    }

    // No cached app shell - show offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

    return new Response(getOfflineHTML(), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// Handle offline mutations
async function handleOfflineMutation(request) {
  // Store the mutation for later sync
  const clonedRequest = request.clone();
  const body = await clonedRequest.text();

  const pendingSync = {
    id: Date.now().toString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: body,
    timestamp: Date.now(),
  };

  // Store in IndexedDB via message to client
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'QUEUE_OFFLINE_CHANGE',
      payload: pendingSync,
    });
  });

  // Return a pending response
  return new Response(JSON.stringify({
    queued: true,
    syncId: pendingSync.id,
    message: 'Changes will be synced when online'
  }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ===============================================================
// Request Type Detection
// ===============================================================

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function isDocumentRequest(url, request) {
  return url.pathname.includes('/api/documents/') ||
         request.headers.get('X-Document-Cache') === 'true';
}

function isAPIRequest(url) {
  return API_PATTERNS.some(pattern => pattern.test(url.href));
}

function isConvexRequest(url) {
  return CONVEX_PATTERNS.some(pattern => pattern.test(url.href));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

// ===============================================================
// Background Sync
// ===============================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'docusynth-sync') {
    event.waitUntil(syncPendingChanges());
  }
});

async function syncPendingChanges() {
  // Notify clients to start sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_START',
    });
  });

  try {
    // Request pending changes from client
    // The actual sync is handled by the syncService in the main app
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_PENDING_CHANGES',
      });
    });
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ERROR',
        payload: { error: error.message },
      });
    });
  }
}

// ===============================================================
// Push Notifications (Optional)
// ===============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'New update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: data.tag || 'docusynth-notification',
    renotify: data.renotify || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DocuSynth AI', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        const url = data?.url || '/';
        return clients.openWindow(url);
      }
    })
  );
});

// ===============================================================
// Message Handling
// ===============================================================

self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_DOCUMENT':
      cacheDocument(payload);
      break;

    case 'UNCACHE_DOCUMENT':
      uncacheDocument(payload);
      break;

    case 'CLEAR_CACHE':
      clearAllCaches();
      break;

    case 'GET_CACHE_STATUS':
      getCacheStatus(event.source);
      break;

    case 'REGISTER_SYNC':
      registerSync(payload?.tag || 'docusynth-sync');
      break;
  }
});

async function cacheDocument(payload) {
  if (!payload?.documentId) return;

  const cache = await caches.open(DOCUMENTS_CACHE);
  const url = `/api/documents/${payload.documentId}`;

  try {
    // If we have content, cache it directly
    if (payload.content) {
      const response = new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(url, response);
      console.log('[SW] Document cached:', payload.documentId);
    } else {
      // Otherwise fetch and cache
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log('[SW] Document fetched and cached:', payload.documentId);
      }
    }

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'DOCUMENT_CACHED',
        payload: { documentId: payload.documentId },
      });
    });
  } catch (error) {
    console.error('[SW] Failed to cache document:', error);
  }
}

async function uncacheDocument(payload) {
  if (!payload?.documentId) return;

  const cache = await caches.open(DOCUMENTS_CACHE);
  const url = `/api/documents/${payload.documentId}`;

  try {
    await cache.delete(url);
    console.log('[SW] Document uncached:', payload.documentId);

    // Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'DOCUMENT_UNCACHED',
        payload: { documentId: payload.documentId },
      });
    });
  } catch (error) {
    console.error('[SW] Failed to uncache document:', error);
  }
}

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('docusynth-'))
      .map(name => caches.delete(name))
  );
  console.log('[SW] All caches cleared');

  // Notify clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'CACHE_CLEARED',
    });
  });
}

async function getCacheStatus(client) {
  const cacheNames = await caches.keys();
  const status = {};

  for (const name of cacheNames.filter(n => n.startsWith('docusynth-'))) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    status[name] = keys.length;
  }

  client.postMessage({
    type: 'CACHE_STATUS',
    payload: status,
  });
}

async function registerSync(tag) {
  if ('sync' in self.registration) {
    try {
      await self.registration.sync.register(tag);
      console.log('[SW] Sync registered:', tag);
    } catch (error) {
      console.error('[SW] Sync registration failed:', error);
    }
  }
}

// ===============================================================
// Offline HTML Fallback
// ===============================================================

function getOfflineHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DocuSynth AI - Offline</title>
  <style>
    :root {
      --bg-color: #0b0c0e;
      --surface-color: #14161a;
      --text-main: #f9fafb;
      --text-secondary: #9ca3af;
      --primary-color: #10b981;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Manrope', system-ui, sans-serif;
      background: var(--bg-color);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.5rem;
      opacity: 0.6;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .retry-btn {
      background: var(--primary-color);
      color: white;
      border: none;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .retry-btn:hover { opacity: 0.9; }
    .cached-info {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #374151;
    }
    .cached-info h2 {
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
      margin-bottom: 0.5rem;
    }
    .cached-info p {
      font-size: 0.875rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a5 5 0 01-1.414-3.536 5 5 0 011.414-3.536m0 0L6.343 6.343m0 5.657L3 15" />
    </svg>
    <h1>You're Offline</h1>
    <p>DocuSynth AI needs an internet connection to generate and sync documentation.</p>
    <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
    <div class="cached-info">
      <h2>Offline Access</h2>
      <p>Your cached documents are still available. They will sync when you're back online.</p>
    </div>
  </div>
</body>
</html>
  `;
}

console.log('[SW] Service worker loaded');

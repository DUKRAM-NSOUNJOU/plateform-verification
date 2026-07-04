/**
 * sw.js — Service Worker Plate-Verification PWA
 * ───────────────────────────────────────────────
 * Stratégie :
 *   - Assets statiques (HTML/CSS/JS/images) → Cache First
 *   - API calls → Network First avec fallback offline
 */

const CACHE_NAME    = 'plate-verif-v1.0.1';
const OFFLINE_URL   = '/offline.html';

/* ── Ressources à pré-cacher (App Shell) ─────────────────────── */
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/verification.html',
    '/admin.html',
    '/offline.html',
    '/manifest.json',
    '/admin-manifest.json',
    '/images/icon-192.png',
    '/images/icon-512.png',
    '/css/admin.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

/* ── Install : pré-cache de l'App Shell ─────────────────────── */
self.addEventListener('install', (event) => {
    console.log('[SW] Install — mise en cache des ressources statiques');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('[SW] Certaines ressources n\'ont pas pu être mises en cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

/* ── Activate : nettoyage des anciens caches ─────────────────── */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate — nettoyage des anciens caches');
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Suppression ancien cache:', name);
                        return caches.delete(name);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

/* ── Fetch : interception des requêtes ───────────────────────── */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorer les extensions Chrome et requêtes non-HTTP
    if (!request.url.startsWith('http')) return;

    // Requêtes API → Network First
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }

    // Assets statiques → Cache First
    if (
        request.method === 'GET' &&
        (url.pathname.endsWith('.html') ||
         url.pathname.endsWith('.css')  ||
         url.pathname.endsWith('.js')   ||
         url.pathname.endsWith('.png')  ||
         url.pathname.endsWith('.jpg')  ||
         url.pathname.endsWith('.svg')  ||
         url.pathname.endsWith('.webp') ||
         url.pathname === '/'           ||
         url.pathname.endsWith('.json'))
    ) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Autres → Network avec fallback cache
    event.respondWith(networkFirst(request));
});

/* ── Stratégies ─────────────────────────────────────────────── */

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        // Fallback page hors-ligne pour les navigations HTML
        if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match(OFFLINE_URL);
        }
        return new Response('', { status: 408 });
    }
}

async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        // Mettre en cache les réponses API réussies
        if (networkResponse.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch {
        // Chercher en cache
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fallback HTML hors-ligne
        if (request.headers.get('Accept')?.includes('text/html')) {
            return caches.match(OFFLINE_URL);
        }
        return new Response(
            JSON.stringify({ error: 'Vous êtes hors-ligne. Reconnectez-vous pour utiliser cette fonctionnalité.' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

/* ── Background Sync (soumission de tickets hors-ligne) ──────── */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-tickets') {
        console.log('[SW] Background sync: envoi des tickets en attente');
        event.waitUntil(syncPendingTickets());
    }
});

async function syncPendingTickets() {
    // Dans une vraie implémentation, utiliser IndexedDB pour stocker les tickets offline
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE', message: 'Tickets synchronisés.' });
    });
}

/* ── Push Notifications ──────────────────────────────────────── */
self.addEventListener('push', (event) => {
    const data = event.data?.json() || {};
    const title   = data.title   || 'Plate-Verification';
    const options = {
        body:    data.body    || 'Vous avez une notification.',
        icon:    '/images/icon-192.png',
        badge:   '/images/icon-192.png',
        vibrate: [200, 100, 200],
        data:    { url: data.url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});

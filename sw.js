/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-0227930e93a9';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-12bc7cec605f6245c4ba6f0cf4df6aa5.js","_expo/static/js/web/EventAdminScreen-4b98880330f1f7f7ca0c9528a9d6c8f5.js","_expo/static/js/web/EventReportScreen-a08ef7f733c9504fbf69407e36f5eb96.js","_expo/static/js/web/FormAdminsScreen-9455b71ca443a162e5fc26ff39e15e64.js","_expo/static/js/web/FormEditorScreen-906b2770c4a543b9f4b8e5f71057fc43.js","_expo/static/js/web/MyFormsScreen-7df8d5ef8c44039f7207c75423ec1a30.js","_expo/static/js/web/ParticipantProfileScreen-6835db602e652d3b4add4c9829c7063e.js","_expo/static/js/web/ParticipantsScreen-3c5c962c5689f3f1408c837176ce2ba3.js","_expo/static/js/web/PaymentsScreen-8160cd23038bd9cbaff1123a9f71e155.js","_expo/static/js/web/ResponsesScreen-8b7075c4e265e8ae7ab27aa66fdccbac.js","_expo/static/js/web/ShareScreen-621b899154455bc5ba11b39d1cc0860e.js","_expo/static/js/web/StatsScreen-5ffd3e8f01ff0e264909c0c56caac2cb.js","_expo/static/js/web/__common-5bf7e3e90cd6ae3ccefbe88d09023d0b.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-8040de49e4ecdce686ad59ebced46b2a.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).toString())))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('forms-app-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  // 只處理本站、且在 App 範圍內的請求
  if (url.origin !== self.location.origin || !request.url.startsWith(SCOPE)) {
    return;
  }

  // 頁面導覽：先走網路（拿到最新版），離線時用快取的 index.html。
  // cache: 'no-cache' 讓瀏覽器向 GitHub Pages 重新確認（它的 HTTP 快取是 max-age=600），
  // 新版部署後不會再被舊的 index.html（指向舊 JS）擋住 10 分鐘。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(new URL('./', SCOPE).toString(), copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(new URL('./', SCOPE).toString()).then(
            (cached) => cached || caches.match(new URL('index.html', SCOPE).toString()),
          ),
        ),
    );
    return;
  }

  // 靜態檔（JS 檔名含 hash、圖示、manifest）：快取優先
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});

/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-e05bd7055bb6';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-d50bc07c9633a3cdf6385426b250dae8.js","_expo/static/js/web/EventAdminScreen-6ecc8c1da2dc78f2fb92a7df05d58d08.js","_expo/static/js/web/EventReportScreen-d93a460412d2d399aa350a7bbb682b85.js","_expo/static/js/web/FormAdminsScreen-328cdeb610fffbb4fcfd44c00bcda6d4.js","_expo/static/js/web/FormEditorScreen-f7b317b185f2f8bbb89326d664a8ae84.js","_expo/static/js/web/MyFormsScreen-ab4e0aac35bacfb25a7fffd7294a0f41.js","_expo/static/js/web/ParticipantProfileScreen-cc4f584694199a45ffdbb1e2845279fb.js","_expo/static/js/web/ParticipantsScreen-c07061e628ce45195880e8ed7b3ab952.js","_expo/static/js/web/PaymentsScreen-9bb70489d065cd161f943b0b9ab1143f.js","_expo/static/js/web/ResponsesScreen-b665fc36e2d43222b8852f16f4906050.js","_expo/static/js/web/ShareScreen-8b2981e419d545226ad8b07a7e33ca44.js","_expo/static/js/web/StatsScreen-4bd5d1a8cce1386782bd6d83f7f98f4a.js","_expo/static/js/web/__common-90778aa4b2fe99bafda0f7d5144b0c88.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-c450db7c7d70fb08284b147998460e4a.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

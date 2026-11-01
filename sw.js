/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-db6a93ea85fb';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/EventReportScreen-c3fa6d39a55c13c44aaa1aed630548eb.js","_expo/static/js/web/FormEditorScreen-4ffc292204b0720752f5ccfb75e2dc1f.js","_expo/static/js/web/MyFormsScreen-a882168ec5c27d8465e1f7248f0291b8.js","_expo/static/js/web/ParticipantProfileScreen-58e5fb7c7fbb64e730a5dc5f65040d44.js","_expo/static/js/web/ParticipantsScreen-467b6ccb279c475b2ddf643a612ff89e.js","_expo/static/js/web/PaymentsScreen-06f6feca3a89abd68c8dea1f2028ff45.js","_expo/static/js/web/ResponsesScreen-1fe5c6b413e392f4447c94a639e1e8b7.js","_expo/static/js/web/ShareScreen-d0a35617999b422bf4895d64dc096b1a.js","_expo/static/js/web/StatsScreen-24528afa767dc5683bb260595ce83286.js","_expo/static/js/web/__common-6c4c69186c597dae6e2d98fb16af5ee9.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-09cf9a779ff42c253a57031c45e89a60.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

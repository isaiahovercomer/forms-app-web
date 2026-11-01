/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-1c3a84ce837d';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-c6bb189115a34c4fb6a2b29371e346e1.js","_expo/static/js/web/EventAdminScreen-eae35b4e902a65bf5bc2ab4a9d145965.js","_expo/static/js/web/EventReportScreen-cf66b447a079f5682fafa4aa2c2e94e9.js","_expo/static/js/web/FormAdminsScreen-125a4484f1f3a42a002e1dc143d2d5e5.js","_expo/static/js/web/FormEditorScreen-5a8750f0865c16c22c021c83d60a3e48.js","_expo/static/js/web/MyFormsScreen-b877f58f95f4095348f3b6af17e0d4aa.js","_expo/static/js/web/ParticipantProfileScreen-06194ce22fcf07f479e79423751884b8.js","_expo/static/js/web/ParticipantsScreen-949d9726d604e611b6fc809406267333.js","_expo/static/js/web/PaymentsScreen-1330d9678d375b2c61ef5ab6e301d0be.js","_expo/static/js/web/ResponsesScreen-e5ed34e1bd0d9c1b13d0360c8c744ae2.js","_expo/static/js/web/ShareScreen-e0330f0209071c9439d868993e031a93.js","_expo/static/js/web/StatsScreen-26a0021c1153417e786c63acccaac876.js","_expo/static/js/web/__common-89474b8250f90f140db468fe9fcee4e1.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-979268c1fbca3157abcc121fccb0be9b.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

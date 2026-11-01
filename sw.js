/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-0bb0bcf3012f';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-e08a0b4fa9fc84e2c30c3fa481503327.js","_expo/static/js/web/EventAdminScreen-50a60223791154703e39e2e4527c846e.js","_expo/static/js/web/EventReportScreen-bb3500465cec5eba72e4f2e436c3c6d1.js","_expo/static/js/web/FormAdminsScreen-2ba9076cbf5c7a86712981e2ec674ad3.js","_expo/static/js/web/FormEditorScreen-04e842b2610e2bea6819a84af88bf7fb.js","_expo/static/js/web/MyFormsScreen-4f70b8f0cd0d78508748d656fbf790e3.js","_expo/static/js/web/ParticipantProfileScreen-1b507df56863cbb2b81d28afb12ef1c1.js","_expo/static/js/web/ParticipantsScreen-4c6af5d36db43e78cff5f22f2b62f501.js","_expo/static/js/web/PaymentsScreen-270cbb6f8b214f8515de178d33368322.js","_expo/static/js/web/ResponsesScreen-47391ba55c02a231bc6d80cd5d02076f.js","_expo/static/js/web/ShareScreen-4ec2a05f68f649810bd70bbc139d4269.js","_expo/static/js/web/StatsScreen-33de2e79547b5969f95208f4a3bd327b.js","_expo/static/js/web/__common-c9dc99d66dc77e7f0a0b43c1e237c7a1.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-7d2008d0dcf75e5aad51642c6ae948da.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

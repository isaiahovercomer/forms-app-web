/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-210e10c46877';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-df7736a28f089ca19df5e643fc791196.js","_expo/static/js/web/EventAdminScreen-3432ba689edd10b170dd77d819ddc208.js","_expo/static/js/web/EventReportScreen-c4491e6f0d42c1329f7fdb2dc7bd59bc.js","_expo/static/js/web/FormAdminsScreen-162f2cd9faaf58216053e3debcd3477d.js","_expo/static/js/web/FormEditorScreen-88aa19bc627b03c4f172ec6b5ac21724.js","_expo/static/js/web/MyFormsScreen-e7ea1006a07eafdba4400707f3715f46.js","_expo/static/js/web/ParticipantProfileScreen-4380c721befc88c5ea2505c7a512c159.js","_expo/static/js/web/ParticipantsScreen-cac42ef8159df0c4254ca4f764886c9d.js","_expo/static/js/web/PaymentsScreen-f6ba49a4f0099568897b5dfebf47ed7e.js","_expo/static/js/web/ResponsesScreen-280635cb721d3a19f507f7e6444c6b8b.js","_expo/static/js/web/ShareScreen-37fde2259157db7f072e51596f4a601a.js","_expo/static/js/web/StatsScreen-d6df2d0076f2fff36f369ad09b06d633.js","_expo/static/js/web/__common-2a6e46a20430a31fedf827dd8407c858.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-ae70d7e75cdfd51710afa1f1cb05fc48.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

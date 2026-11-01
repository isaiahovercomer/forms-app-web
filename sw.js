/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-32f9aeecd7a9';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-bcc6df58e3a3258b71da76c2865d7dc4.js","_expo/static/js/web/EventAdminScreen-46bad36e4408cad3e5e13fb7b0cfd480.js","_expo/static/js/web/EventReportScreen-754bc13c0d1ac3fcc49207b25b10443c.js","_expo/static/js/web/FormAdminsScreen-2f0bb663ca9d838b0161d5e9beeceaa0.js","_expo/static/js/web/FormEditorScreen-3da7f0a005419bb9d9f009de06dc5345.js","_expo/static/js/web/MyFormsScreen-6ca54520ef61b6ae78118711f8727abb.js","_expo/static/js/web/ParticipantProfileScreen-fddbc8f643b02ab8bcfad0ad659aad31.js","_expo/static/js/web/ParticipantsScreen-a7dad39128e6ca32cf2bc086ba956a84.js","_expo/static/js/web/PaymentsScreen-d939351bbea30eed0b800403cc0ed442.js","_expo/static/js/web/ResponsesScreen-44360db7865dd9ed159c16c27f391e2d.js","_expo/static/js/web/ShareScreen-e864041678e643c96e1a66378e5cee72.js","_expo/static/js/web/StatsScreen-4f5a236620c13cee7f096188010cfae7.js","_expo/static/js/web/__common-579ebe63ff613643468e8d2e1fc4f0b9.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-05d3f2f5618b51f64fefc711f99339af.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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

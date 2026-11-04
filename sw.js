/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-6bb4885a2cbd';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-4d87910e4d9af6de4dabf53ebdcfeaa3.js","_expo/static/js/web/EventAdminScreen-e1ead535501726d1ed33b0e1f4e01a4a.js","_expo/static/js/web/EventReportScreen-afb3303958a5e6622549f7a33ca4e194.js","_expo/static/js/web/FormAdminsScreen-0f3c007a86be6dde7ea254118d443274.js","_expo/static/js/web/FormEditorScreen-22af8d99b6a2d02eaf9e4a53b4cdccb8.js","_expo/static/js/web/MyFormsScreen-400bf4ad57a87c29253cfed007a3ebcc.js","_expo/static/js/web/ParticipantProfileScreen-0b438164d8e49508331d801306ca3f72.js","_expo/static/js/web/ParticipantsScreen-c76934d3780e8c447a158edc28200025.js","_expo/static/js/web/PaymentsScreen-c0328f794207a05944b54b8a57e4ca53.js","_expo/static/js/web/RecentlyDeletedScreen-311130ee6e57e15d99946e03591accbc.js","_expo/static/js/web/ResponsesScreen-b957ab8f48f9c092a2aa38d48924c037.js","_expo/static/js/web/ShareScreen-c44e62a8dfe7607e1580eadab82f8ff6.js","_expo/static/js/web/StatsScreen-cf41f6df3174f3a8c8fb195e3802b6a1.js","_expo/static/js/web/__common-e37b60a805163fffdbf4ba47010356c2.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-53e1e526c3d3cb75197fe0fde5fbd328.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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
      .then((keys) => {
        // 第十九輪 D(b)：保留上一版的快取。正在填寫的舊頁面之後要載入的檔案還找得到，
        // 不會因為新版上線而讀不到檔案、整頁重來（填到一半的資料不見）。只刪更舊的版本。
        // 也不會主動重新整理任何頁面：新版只在下次開啟時生效。
        const old = keys.filter((key) => key.startsWith('forms-app-') && key !== CACHE);
        const keepPrevious = old.slice(-1);
        return Promise.all(old.filter((key) => !keepPrevious.includes(key)).map((key) => caches.delete(key)));
      })
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

  // 隱私權政策／服務條款是獨立靜態頁：交給瀏覽器直接讀，不要被當成 App 外殼存進快取
  if (/\/(privacy|terms)\.html$/.test(url.pathname)) {
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

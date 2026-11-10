/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-eb9d98c4e3ee';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-c0641bd4ece3280f4bb018e68b2743b9.js","_expo/static/js/web/EditRosterScreen-f178bf7e74960c9b7605ef8166137927.js","_expo/static/js/web/EventAdminScreen-0d381a4970f454f7bfa4f39db4ec77df.js","_expo/static/js/web/EventReportScreen-1541804813f8281b29dd4cceee469d65.js","_expo/static/js/web/FormAdminsScreen-d876ecc2d0eaf7c65a2742f24f168fb5.js","_expo/static/js/web/FormEditorScreen-ab5ce6be533ba75aa8412b4d5f6f4adf.js","_expo/static/js/web/MyFormsScreen-dabebab42134d9f24b4b29bb0e54a005.js","_expo/static/js/web/ParticipantProfileScreen-6489d431f69908003c6247ac96447e53.js","_expo/static/js/web/ParticipantsScreen-2f22d5411c3e0f705d2447b67a1a6288.js","_expo/static/js/web/PaymentsScreen-4037d0d8777a5e23bbf5fb2328f85606.js","_expo/static/js/web/PublicStatsScreen-e8cc2066ab4e4c53ab9004abcc07c229.js","_expo/static/js/web/RecentlyDeletedScreen-6397994db403152826a7e477efcb406a.js","_expo/static/js/web/ResponsesScreen-086ed45d6314803594098787b57b1316.js","_expo/static/js/web/ShareScreen-da3be009a67c14fdacc16a3b3482645e.js","_expo/static/js/web/StatsScreen-381f607d97c80b515e2f326da5bd553a.js","_expo/static/js/web/__common-c2b966ce90f1985b82593add8aea175d.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-d2cfb2334c523b9315a769e6f846a33b.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

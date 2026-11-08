/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-52c1b48a64e3';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-25bb451745ca5d7d93622c1bc4ea6c3e.js","_expo/static/js/web/EditRosterScreen-5af739cfdeb5ad1f23207927d0994097.js","_expo/static/js/web/EventAdminScreen-6c8f267f93a92f54413c7f51ec65da46.js","_expo/static/js/web/EventReportScreen-5471ca4766abb46b4c58a2c02886c139.js","_expo/static/js/web/FormAdminsScreen-01ea18683c76f672f26bca949e0be0f0.js","_expo/static/js/web/FormEditorScreen-4c91462ce9688044e3d8984333e732ad.js","_expo/static/js/web/MyFormsScreen-282163fbe4493f918032ddcecfb3ea22.js","_expo/static/js/web/ParticipantProfileScreen-64a0316fbd50e6b474e105589c6768a3.js","_expo/static/js/web/ParticipantsScreen-b2fc1eb142ff84eb9c1a2617995580f3.js","_expo/static/js/web/PaymentsScreen-619d1823125c40ba4ccc81f5afbc7600.js","_expo/static/js/web/PublicStatsScreen-d18a26b5775849ac26e6c9add93a1941.js","_expo/static/js/web/RecentlyDeletedScreen-b13a85a819c1289e84915119a00ee71a.js","_expo/static/js/web/ResponsesScreen-0b1111c7e0fa48f9f1e843af48e2d885.js","_expo/static/js/web/ShareScreen-b5b73145f70843b540e415e1152b81f7.js","_expo/static/js/web/StatsScreen-d918bb7ccaa034597f90d43ecebf269c.js","_expo/static/js/web/__common-a22c220dca8fb9b3b298fe3896bcef01.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-1bb40f30a9327e89557fbd1dc8bda4a4.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

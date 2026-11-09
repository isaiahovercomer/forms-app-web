/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-8f91cea4e3ff';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-6f84560e53dc181e5ceeb2b8ef1d1192.js","_expo/static/js/web/EditRosterScreen-c869001a8d56da7772b5d28127aad46c.js","_expo/static/js/web/EventAdminScreen-d951937e0b7e11d7ad1912258221844e.js","_expo/static/js/web/EventReportScreen-77fa24dab3b5cc6659759144344c0824.js","_expo/static/js/web/FormAdminsScreen-48c9e62ada0d60b33fe8032ac1c041fe.js","_expo/static/js/web/FormEditorScreen-065bec484a3400fde1d613002322bd1b.js","_expo/static/js/web/MyFormsScreen-1a1602ba0cddb0a018f0693c3c2994e1.js","_expo/static/js/web/ParticipantProfileScreen-eee294176059aefe110c9d4b6ec04010.js","_expo/static/js/web/ParticipantsScreen-6ca33c39ff74c33c58c61688f2c4ab5a.js","_expo/static/js/web/PaymentsScreen-ea14e39d97f6c2ab9faf5b18f36ebb09.js","_expo/static/js/web/PublicStatsScreen-cbc2aad01d3938d22723e30bf98446ea.js","_expo/static/js/web/RecentlyDeletedScreen-6efd8dbdbce5a22306f1218b7ce7c4ed.js","_expo/static/js/web/ResponsesScreen-bdaa6a9e8b9f0c9d30987caacea4a6f6.js","_expo/static/js/web/ShareScreen-8989a27f61b98d00ade4a2611a6db8a2.js","_expo/static/js/web/StatsScreen-3340937f5ecb9cf829eb3740046e7bfb.js","_expo/static/js/web/__common-f8a6868f8e47235cccc71fe6d03b8651.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-f5d977083512699ab0d475c9a4286819.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

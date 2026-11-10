/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-d39b91d2ca71';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-d73ec98e4eea469d10ff6bb236746280.js","_expo/static/js/web/EditRosterScreen-067a1efc867d47d34694e9e728446823.js","_expo/static/js/web/EventAdminScreen-94d16743b46a8231b7cb0eda4691bd8a.js","_expo/static/js/web/EventReportScreen-5cb5639d0b0b25c0e9ef2c00dba10c7e.js","_expo/static/js/web/FormAdminsScreen-ea35a9a2870483b47eae6aefa9927bd0.js","_expo/static/js/web/FormEditorScreen-1b0e6abcfbb3b57de4eff9e8b6e50bba.js","_expo/static/js/web/MyFormsScreen-9a01cc164b6d8b43710fe08694b330ae.js","_expo/static/js/web/ParticipantProfileScreen-ca9acc25e5d891962ca45111aa297cd0.js","_expo/static/js/web/ParticipantsScreen-4f93d36bf4179e2546747e11a243d8c7.js","_expo/static/js/web/PaymentsScreen-02878c80ef87d2504e5862a85b285d0f.js","_expo/static/js/web/PublicStatsScreen-f6aa947c41a07a444b1f92f042b58566.js","_expo/static/js/web/RecentlyDeletedScreen-d59ee4224f764a0efa5685ca7235e2d8.js","_expo/static/js/web/ResponsesScreen-ce007fa0cfcc90bf324f40d22ea8faa5.js","_expo/static/js/web/ShareScreen-e6923212e583e33b5f101c6daea253e6.js","_expo/static/js/web/StatsScreen-837b756b4ce219a1ec6a437a6b8672ad.js","_expo/static/js/web/__common-044b9fdca7bbedfcbbb9cbc6e6a2f1d3.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-747c41d0ed3e7e9bbfe1dcd470c24a03.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

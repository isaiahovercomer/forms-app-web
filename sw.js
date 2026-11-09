/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-a4be5b1ab147';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-38bb4d9dae6bc3570bae551858ef9394.js","_expo/static/js/web/EditRosterScreen-291be8241f25f7786a3e80c10660c867.js","_expo/static/js/web/EventAdminScreen-cfbc8e19a2e7b0e4084c6d99057b3526.js","_expo/static/js/web/EventReportScreen-28d51e14aacfb2c43a3be25effe06603.js","_expo/static/js/web/FormAdminsScreen-c5a326e305ac206120e908c06ee36a3a.js","_expo/static/js/web/FormEditorScreen-81761e8ac2d7cf30a90363caabf59f37.js","_expo/static/js/web/MyFormsScreen-8a370a114beb0a13cd44b9af1b11d96f.js","_expo/static/js/web/ParticipantProfileScreen-7b9d2b08a8cece24d93b564873ec1d41.js","_expo/static/js/web/ParticipantsScreen-ef32029c3f372f5f199f84aeccba2ef8.js","_expo/static/js/web/PaymentsScreen-69121818d6c1a12ad5ab0ff92f820636.js","_expo/static/js/web/PublicStatsScreen-464420283aaa39ca68bcc02cc4546a0b.js","_expo/static/js/web/RecentlyDeletedScreen-824b4080b7ab2eb8bea5d08534dd67df.js","_expo/static/js/web/ResponsesScreen-4f09bbaf1c4a545d86f2391ccbc2adba.js","_expo/static/js/web/ShareScreen-9cbf1773fca995ac4d0551a0d71674a4.js","_expo/static/js/web/StatsScreen-bcd66e00f2d82a06b3f543950e989579.js","_expo/static/js/web/__common-a44efe6be1032433789fbb9a97d7f98b.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-b771bdd1d8990f82278b773f57d3ea59.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-5ea0a8d6b3d0';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-9e3d25e7565be8a65eca17e25321a4b5.js","_expo/static/js/web/EditRosterScreen-e0d441bf9d8a2f9c2aba960fb817b8b9.js","_expo/static/js/web/EventAdminScreen-11748f3bebd13be3aaae536593eedcbd.js","_expo/static/js/web/EventReportScreen-cc4f703a3d379d2f11a89222639d26be.js","_expo/static/js/web/FormAdminsScreen-c5e1b19afbed9f5992a4741161efb5c6.js","_expo/static/js/web/FormEditorScreen-5fa681d5bdf1689a488f080b51e4e633.js","_expo/static/js/web/MyFormsScreen-effcace254280a72afd73a6c817428ee.js","_expo/static/js/web/ParticipantProfileScreen-7ed6d1cf223fa38f2bd9d7d3bd48ebfc.js","_expo/static/js/web/ParticipantsScreen-aa8f11fab18c91164547898ec760e30d.js","_expo/static/js/web/PaymentsScreen-42cb48bbb47df77cda3e984b209425eb.js","_expo/static/js/web/PublicStatsScreen-23727dcbee48c0fb785d78ee3f09c241.js","_expo/static/js/web/RecentlyDeletedScreen-5a16274069915e455dc4f557f24e26fe.js","_expo/static/js/web/ResponsesScreen-bb18c82e13cb74261f6ee43f1f757881.js","_expo/static/js/web/ShareScreen-36d9092918adeb89b352ae5831a9fa36.js","_expo/static/js/web/StatsScreen-7688c22173fa20dce277cfd0a798067b.js","_expo/static/js/web/__common-14729d3d3dc4d83a4bcc972f6e8858a9.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-bb5644da369d3cc619215d4488f81080.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

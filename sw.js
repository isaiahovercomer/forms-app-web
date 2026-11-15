/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-faddbae43724';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-937105c11377d490d6176c99ff1ab391.js","_expo/static/js/web/EditRosterScreen-31db0e741fb7dda09511bde644de7e6c.js","_expo/static/js/web/EventAdminScreen-c8d6bdc521f473e7296bd85dd2e26779.js","_expo/static/js/web/EventReportScreen-e6c47ab6bcf27281a4a7e8eceeb570f2.js","_expo/static/js/web/FormAdminsScreen-575e6efbd4cd4784c81e94700bb703b3.js","_expo/static/js/web/FormEditorScreen-e04e785da9cd4cd3a3afe4bf8a69267d.js","_expo/static/js/web/MyFormsScreen-9fe171a37c1cc33c71aa88f744e274d7.js","_expo/static/js/web/ParticipantProfileScreen-781e1fb3c3850ebc90b113d742a64f73.js","_expo/static/js/web/ParticipantsScreen-4f3849aee45127911d39e9509b5e1c62.js","_expo/static/js/web/PaymentsScreen-033ecc6eaf0d01554e8bcabd1501a17c.js","_expo/static/js/web/PublicStatsScreen-8d239db749b3df95ec8565d7dc4519bc.js","_expo/static/js/web/RecentlyDeletedScreen-d09b10729275489cb2d0318941b6ad73.js","_expo/static/js/web/ResponsesScreen-a70368979ba59e8abdf89693aaf9a6e2.js","_expo/static/js/web/ShareScreen-9374e87a83557fb45cfb4f8b7ab3a091.js","_expo/static/js/web/StatsScreen-0eb28ccb85253ddabb099129990d8497.js","_expo/static/js/web/__common-8fd293487fa073ad03c8dc1f6e12ccdf.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-ac2d68eb9bdb566be54215cb14cbdc14.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

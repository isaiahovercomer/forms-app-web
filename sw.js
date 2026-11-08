/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-3a5730c6beac';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-22d7d4be25e40f622ba9bc64204c1446.js","_expo/static/js/web/EditRosterScreen-d2ae6ef01ebcac743d2791119b56bad9.js","_expo/static/js/web/EventAdminScreen-6f859b6632f8fd5f67e4d04ceb0ce174.js","_expo/static/js/web/EventReportScreen-32635523d828629499e96cd4c4177f6f.js","_expo/static/js/web/FormAdminsScreen-12ccf6162f00cdfb97b236ce805c40e5.js","_expo/static/js/web/FormEditorScreen-720eb5600dea97ab05e636f4b612ea92.js","_expo/static/js/web/MyFormsScreen-578e0ed77f6e41f0898d364407f7acd1.js","_expo/static/js/web/ParticipantProfileScreen-9b0e842b408a8e867bc24482119a7eb6.js","_expo/static/js/web/ParticipantsScreen-6b2b0913e96dbe95f76e322e97bc8ff6.js","_expo/static/js/web/PaymentsScreen-415b6f4ec313c0278f4ef42858a9ee7a.js","_expo/static/js/web/PublicStatsScreen-6c1000feb62c4b72f6f6b9146a3d0c14.js","_expo/static/js/web/RecentlyDeletedScreen-d47cafb9134528622a2a40ff11a5b6ac.js","_expo/static/js/web/ResponsesScreen-2ed88353a7889f6d8c87474d43275de0.js","_expo/static/js/web/ShareScreen-06c3dcd6503059c34f4c92489d22e836.js","_expo/static/js/web/StatsScreen-1f223145a0039f6d58eff031b467d655.js","_expo/static/js/web/__common-01c561a6154bb708ad0f4f123892189e.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-a7cd39385aa24ca4e533fa7fbbab13a4.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

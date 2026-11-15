/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-3a50edc0ae08';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-444c626c7d8b385197dbc1bb6e5339a7.js","_expo/static/js/web/EditRosterScreen-42aff1dce14d89b2101fb5decf8eccda.js","_expo/static/js/web/EventAdminScreen-c999b6a67cbd685ea8cd3cffc4f0a24c.js","_expo/static/js/web/EventReportScreen-29b865cedc8eddb4c59ddbb5c218c7b4.js","_expo/static/js/web/FormAdminsScreen-eff0d4ed7f97516e8989ebf8acdc0cc8.js","_expo/static/js/web/FormEditorScreen-e92b9e3dca62a05e40b44386fdbd931e.js","_expo/static/js/web/MyFormsScreen-9fb1e4ca3b4971a11650ac8be6b456d4.js","_expo/static/js/web/ParticipantProfileScreen-f5da7d182b072114995534f90a659f19.js","_expo/static/js/web/ParticipantsScreen-cc5420273e1ed98675b9cef51eca3aa0.js","_expo/static/js/web/PaymentsScreen-05dbaa7a938673f95ae47258d8b9db4a.js","_expo/static/js/web/PublicStatsScreen-d20b9777206f06a7823e2001a4e789e9.js","_expo/static/js/web/RecentlyDeletedScreen-50f9b3e1fb6af0da63560a9b69025d74.js","_expo/static/js/web/ResponsesScreen-dd906b42259b1b12fea54325be2f71ff.js","_expo/static/js/web/ShareScreen-f0f554beda75b8eefda9e2f2eff13757.js","_expo/static/js/web/StatsScreen-f2290e2aa67a56e065fa62d7f06fbd7f.js","_expo/static/js/web/__common-81a123f3433e786249b91565593589aa.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-229d5cd4fbee9932fd6f567637304dbb.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-cadfab776504';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-929107fc9b7af322d335ddd63a501d8e.js","_expo/static/js/web/EditRosterScreen-a38dac1f062bd2388b142cc5a3b30575.js","_expo/static/js/web/EventAdminScreen-dcd9bb864f0d7c5440e40aeedf4a59e9.js","_expo/static/js/web/EventReportScreen-7e1b9b83b2b23c8c8a8f72c6960e1486.js","_expo/static/js/web/FormAdminsScreen-49f812367a9bb65dd23e608c3ef4d37b.js","_expo/static/js/web/FormEditorScreen-fb7aebd1c68c62d101d6f4d9a8490f23.js","_expo/static/js/web/MyFormsScreen-5a6765e72e335e1a20f704f140bb8723.js","_expo/static/js/web/ParticipantProfileScreen-b33f74a81f913902b48b153a00b27a7e.js","_expo/static/js/web/ParticipantsScreen-b069aa9a51f97482026bba8272fa03ec.js","_expo/static/js/web/PaymentsScreen-3b291e6d63d122a926e41d22ff3a6ceb.js","_expo/static/js/web/PublicStatsScreen-69df95d2c2ef7cb67be5d6b2a96a029f.js","_expo/static/js/web/RecentlyDeletedScreen-0d3da53e16d38b132f6aac4de854452f.js","_expo/static/js/web/ResponsesScreen-d98f4f6f759ec92441a8f416ea71b1cd.js","_expo/static/js/web/ShareScreen-0083f5fd6b71cbfbcaeec6f21c10eaca.js","_expo/static/js/web/StatsScreen-fa143f67359bebfa57f352fefd1dc71a.js","_expo/static/js/web/__common-2ff2aca984d3b3141b7ee5076b8220d5.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-e10bfadc6daabb7adcc2e6c6c0c32411.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

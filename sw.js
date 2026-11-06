/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-b061b57594d8';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-b5b8d3730c2b465f63d462d1adbbcd06.js","_expo/static/js/web/EditRosterScreen-8bf90599e0d2844674c0500c8588135e.js","_expo/static/js/web/EventAdminScreen-2db55d677d5c7ef3f260e98ade2da1cd.js","_expo/static/js/web/EventReportScreen-cf606fe9cfd168e325766299d1c09c7f.js","_expo/static/js/web/FormAdminsScreen-8d027567a28b6068f978384a22f71837.js","_expo/static/js/web/FormEditorScreen-bdbb2539569daed74922a09c43852062.js","_expo/static/js/web/MyFormsScreen-d6463acd00a221dcc110e13decc2aaab.js","_expo/static/js/web/ParticipantProfileScreen-74cd1e8aa254d789c880e335464c6529.js","_expo/static/js/web/ParticipantsScreen-0f856ff8a53f67d718c230e7b6f17cf1.js","_expo/static/js/web/PaymentsScreen-a15526e119d7d98ebb075a141cc5d322.js","_expo/static/js/web/PublicStatsScreen-cf18ee6e396220ca586b88fce1eeb9fb.js","_expo/static/js/web/RecentlyDeletedScreen-8b2efbda00ac77fef1edb22ae9d67096.js","_expo/static/js/web/ResponsesScreen-a7e71e492aefd425579bf9239da1cc13.js","_expo/static/js/web/ShareScreen-3cfb5542f32f6177be598eb720a03a90.js","_expo/static/js/web/StatsScreen-4b0b8751f2216226af61e83d0e067cd3.js","_expo/static/js/web/__common-c0cd11c1d0beafc7bd5c2e143d071152.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-362684978bd8506998c197be839e137a.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

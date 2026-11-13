/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-891e43c9321b';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-5446399b9c60c9802fb070e7a7177890.js","_expo/static/js/web/EditRosterScreen-616cceea3b94669e96006f88490ac1af.js","_expo/static/js/web/EventAdminScreen-6979d17d77607319350b678ee5f45122.js","_expo/static/js/web/EventReportScreen-4420643524f64ac1cdfada1a5353dbe4.js","_expo/static/js/web/FormAdminsScreen-24abbede5d5bfeb1c35dbca9e0ff7966.js","_expo/static/js/web/FormEditorScreen-6905712165260ea4b0b2a00734b1b153.js","_expo/static/js/web/MyFormsScreen-858d9ae2ea1f415af489b8e13b603459.js","_expo/static/js/web/ParticipantProfileScreen-ae24422594375bddc0af5341afbaa69e.js","_expo/static/js/web/ParticipantsScreen-34a79ca6af4cb24e7180b085d739ba3a.js","_expo/static/js/web/PaymentsScreen-20be432504e7d0164342e21bf0ed49ac.js","_expo/static/js/web/PublicStatsScreen-0e55956716c97b8c7786e309aa9b8e8d.js","_expo/static/js/web/RecentlyDeletedScreen-432cc706d2ae20ec5728cf3bad8c50fe.js","_expo/static/js/web/ResponsesScreen-c9f51884c3a1bf4accbb5d637bd6cd28.js","_expo/static/js/web/ShareScreen-2320723beab4dc90705289a770e3682b.js","_expo/static/js/web/StatsScreen-21c85c59a3986b393b878a9fe70b64cf.js","_expo/static/js/web/__common-0e1a9e258932b66030f4f4e26a9bbc62.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-a04ac97f885c11e438a414c2ff34cfd3.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

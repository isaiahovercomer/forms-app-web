/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-63c96f9bf2e5';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-8c72d52d87bf29bf0364f138da95ed97.js","_expo/static/js/web/EditRosterScreen-20833439ebf2222c841316cbb73710eb.js","_expo/static/js/web/EventAdminScreen-878f39f2aa3ef152cafc820f7808d323.js","_expo/static/js/web/EventReportScreen-98449755be29279408ac97e14a981875.js","_expo/static/js/web/FormAdminsScreen-b9100aafa2bcf374eb754d8de94b1eff.js","_expo/static/js/web/FormEditorScreen-4e99dfe8347cfc5b7e01fd03c577afbf.js","_expo/static/js/web/MyFormsScreen-ec21da4113c086e8806a5a81407c0636.js","_expo/static/js/web/ParticipantProfileScreen-9bc2d5c8dacf54a8d97fcf75d9d3b7b1.js","_expo/static/js/web/ParticipantsScreen-2002801b2f7abe4c229f9d6211b22593.js","_expo/static/js/web/PaymentsScreen-9081d8d2619975bb05d29e603e51bf40.js","_expo/static/js/web/PublicStatsScreen-54f03815cd6b0ae618d916aa252729ac.js","_expo/static/js/web/RecentlyDeletedScreen-f6354effa05b39e2fd4d13471ecdea16.js","_expo/static/js/web/ResponsesScreen-7d5505a2fde6cabf53bef2e132d82cb7.js","_expo/static/js/web/ShareScreen-f704bc867547a81a49635ba71f9dcb74.js","_expo/static/js/web/StatsScreen-dc91fd9dd7716145a4c0cd661fad9868.js","_expo/static/js/web/__common-a3f869bc7a9f7a6939b2c6cbdf45bfa7.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-32d3b06abecbfbe791be8159b74e2f27.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

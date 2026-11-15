/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-e6ce452434be';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-3798e3de56da27d1f4c862b1024d863c.js","_expo/static/js/web/EditRosterScreen-268c6795401c8b6bcf605b7f2666495e.js","_expo/static/js/web/EventAdminScreen-dba8dc90b509d2b1e6a238eb76bf23d2.js","_expo/static/js/web/EventReportScreen-7eccc1362c93f351786cb2c390c494c9.js","_expo/static/js/web/FormAdminsScreen-7addfa5a7a13bf87ad1348f16b766825.js","_expo/static/js/web/FormEditorScreen-83786c6f5965e84b1498ad3861f0b674.js","_expo/static/js/web/MyFormsScreen-42340a7f45835e625720689dc4d4e5bd.js","_expo/static/js/web/ParticipantProfileScreen-41c3764664fe834ff8961472748e10c3.js","_expo/static/js/web/ParticipantsScreen-394c566aaa67d56e319b65c11c71d7ed.js","_expo/static/js/web/PaymentsScreen-0b545fdf54b8b1e6e610ad8ae8156d48.js","_expo/static/js/web/PublicStatsScreen-d09c73a4c5318d3b2850cbc5e4d04e66.js","_expo/static/js/web/RecentlyDeletedScreen-152010699fca17c37d360b96f12e172a.js","_expo/static/js/web/ResponsesScreen-c701c1ef6c7b80808935c5320b1ba388.js","_expo/static/js/web/ShareScreen-5697d447d5f9a7ffdabe6f1b9fc09619.js","_expo/static/js/web/StatsScreen-95a42bf9050abecdf94a3ed188bff18b.js","_expo/static/js/web/__common-629a5d0a2f2e601aba313445c26b287a.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-bd5a2a4466791591a5c8e904f6bd0a54.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

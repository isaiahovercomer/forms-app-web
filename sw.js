/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-ff7c866dac33';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-3798e3de56da27d1f4c862b1024d863c.js","_expo/static/js/web/EditRosterScreen-f73199e5120473f284aaa2e34247cc57.js","_expo/static/js/web/EventAdminScreen-fc15ad71763426b1ac80b872d90546dd.js","_expo/static/js/web/EventReportScreen-0d352deee2164eb0e450f24995cd4564.js","_expo/static/js/web/FormAdminsScreen-7addfa5a7a13bf87ad1348f16b766825.js","_expo/static/js/web/FormEditorScreen-9205b213d885b50bd91824569c4ac950.js","_expo/static/js/web/MyFormsScreen-42340a7f45835e625720689dc4d4e5bd.js","_expo/static/js/web/ParticipantProfileScreen-9a61d1639386ca63199d42cc407debf3.js","_expo/static/js/web/ParticipantsScreen-7485f3ccd8e9c4fcfb7a1887c1342756.js","_expo/static/js/web/PaymentsScreen-3a5f8e06c6107d23f8da179bdb8d82f0.js","_expo/static/js/web/PublicStatsScreen-53931ab219b6ae2b6126d808961e2818.js","_expo/static/js/web/RecentlyDeletedScreen-152010699fca17c37d360b96f12e172a.js","_expo/static/js/web/ResponsesScreen-996dad03d8e18deecdbf903064d7cb28.js","_expo/static/js/web/ShareScreen-5697d447d5f9a7ffdabe6f1b9fc09619.js","_expo/static/js/web/StatsScreen-f7ac6e54aa68e1e931090a2bcb2e37b6.js","_expo/static/js/web/__common-f8cc89a479ed6acb17180fbb7832b321.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-8943bfdf9841c76356cc76d804829ce6.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

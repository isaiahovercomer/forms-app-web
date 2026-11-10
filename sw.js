/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-675f38af1301';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-298a94b4358821224f1355c95de5f652.js","_expo/static/js/web/EditRosterScreen-242ec0f03cea94dce50a9b302ff09d76.js","_expo/static/js/web/EventAdminScreen-9d4d866286ad6282274830e528aeea77.js","_expo/static/js/web/EventReportScreen-301f9116435889a0ffc2874cfc7326b7.js","_expo/static/js/web/FormAdminsScreen-bf29fecaf60636cea4c844f2ac78a458.js","_expo/static/js/web/FormEditorScreen-95436f3abb8ed71fef136c99fb3193fe.js","_expo/static/js/web/MyFormsScreen-afad8310cf3c1fab51fa98b2c17d29b2.js","_expo/static/js/web/ParticipantProfileScreen-344889c29e13312e17c98a11f4d3bb8f.js","_expo/static/js/web/ParticipantsScreen-3812f835937279a359619599c3248976.js","_expo/static/js/web/PaymentsScreen-dc8c43abb9d360674d0425db24af9671.js","_expo/static/js/web/PublicStatsScreen-40b612ea35bc814db5eea7738d905c48.js","_expo/static/js/web/RecentlyDeletedScreen-9c78b676d6ad4a69fc7aeee7d5f965e6.js","_expo/static/js/web/ResponsesScreen-e8edef962d858a44dc35ea4f0d446479.js","_expo/static/js/web/ShareScreen-8ad469fa56e10d643fc1fc988f482849.js","_expo/static/js/web/StatsScreen-a52f8ec3dda63b4ff85387d6069e42d0.js","_expo/static/js/web/__common-4465fd3cc8fb023eb6c53dc6a8da1ca3.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-19afba52b9b121663cde53c500a802f7.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png","privacy.html","terms.html"];

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

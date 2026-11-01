/* 台中的民數記 service worker：離線也能開啟 App 外殼。
 * 只快取本站（同源）的靜態檔；Google API、Apps Script、OAuth 等跨網域請求一律不攔截、不快取。
 * 快取版本號與預快取清單由 scripts/build-web.mjs 在建置時填入。 */
const CACHE = 'forms-app-6bc662234f43';
const SCOPE = self.registration.scope; // 例：https://isaiahovercomer.github.io/forms-app-web/
const PRECACHE = ["./","_expo/static/js/web/AdminsScreen-fed6e82434608963d14325768ff3c909.js","_expo/static/js/web/EventAdminScreen-111b40397b20e14913d45bf7f8538eb8.js","_expo/static/js/web/EventReportScreen-3f396d7190497ad9fe42bfe3be098f45.js","_expo/static/js/web/FormAdminsScreen-2fc6b1d5dbbf52380f0595106b1a1bdd.js","_expo/static/js/web/FormEditorScreen-36e015e025982e934d99bb9cb0b915c8.js","_expo/static/js/web/MyFormsScreen-f2d0f96adf185cee325353d12523824c.js","_expo/static/js/web/ParticipantProfileScreen-9668824b1f3dd1ac7bd17f7f59f0d564.js","_expo/static/js/web/ParticipantsScreen-b7aa381be3d0c91e59ebcf016462cb5d.js","_expo/static/js/web/PaymentsScreen-42fa567a5e72948262f2257dbb265a24.js","_expo/static/js/web/ResponsesScreen-d7a0a018f1324defe8820763976fac2c.js","_expo/static/js/web/ShareScreen-dac790af225357f1d58cfe3a99a7ec93.js","_expo/static/js/web/StatsScreen-5780ce4f21028c33d5e4041791e108f2.js","_expo/static/js/web/__common-740d0f96c92873934413a734aaaab6ba.js","_expo/static/js/web/__expo-metro-runtime-8c088df87a31e4e6accd81c554ec290d.js","_expo/static/js/web/index-eebd90f583435449c79f941c63785410.js","assets/assets/brand/lsm-seal.0178822bb4251375fbff7dd1182080c8.png","favicon.ico","icons/apple-touch-icon.png","icons/emblem.svg","icons/favicon-48.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-192.png","icons/maskable-512.png","manifest.webmanifest","og-image.png"];

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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('forms-app-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
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

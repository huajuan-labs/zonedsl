// ZoneDSL 文档站 Service Worker
// 策略:
//   - assets/*(css/js/图片/字体) → cache-first,后台静默更新(stale-while-revalidate)
//   - index.html                → network-first,离线时回退 cache
//   - 跨域 CDN(marked/echarts/etc.) → cache-first,更新周期长
//
// 更新流程:改了 CACHE_VERSION 后,老 SW 收到 controllerchange 事件、页面自动刷新

// 改版本号会强制刷全部 cache.资源改动大时 bump 一下.
const CACHE_VERSION = 'zonedsl-docs-v2';
const CORE_CACHE = CACHE_VERSION + '-core';
const CDN_CACHE = CACHE_VERSION + '-cdn';

// 站内首屏必需资源,install 时并发预取
const CORE_ASSETS = [
  './index.html',
  './assets/style.css',
  './assets/docs.css',
  './assets/theme-switcher.css',
  './assets/components-preview.css',
  './assets/theme-switcher.js',
  './assets/preview-interact.js',
  './assets/echarts-preview.js',
  './assets/web-renderer.js',
  './assets/parser.umd.js',
  './assets/parser.mjs',
  './assets/morphdom.min.js',
  './assets/huajuan-logo.png',
  './assets/avatar-sample.jpg',
];

// 跨域 CDN 资源:install 时也预取(要 CORS 模式,和页面里 crossorigin 属性对齐).
// 失败静默(离线/CDN 挂了),不阻塞 SW 激活.
const CDN_ASSETS = [
  'https://cdn.bootcdn.net/ajax/libs/echarts/5.4.3/echarts.min.js',
  'https://cdn.bootcdn.net/ajax/libs/marked/12.0.2/marked.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE).then((c) =>
        c.addAll(CORE_ASSETS).catch(() => {})
      ),
      caches.open(CDN_CACHE).then((c) =>
        // 跨域用 no-cors 也能存,但 opaque 无法 length 检测;
        // 页面已经在 <script crossorigin>,这里就用 CORS 请求保证 opaque 之外的 hit.
        Promise.all(CDN_ASSETS.map((url) =>
          fetch(url, { mode: 'cors', credentials: 'omit' })
            .then((res) => { if (res.ok) return c.put(url, res); })
            .catch(() => {})
        ))
      ),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))  // 清老版本
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 跨域 CDN(marked / echarts / morphdom 等):cache-first
  if (!sameOrigin) {
    event.respondWith(
      caches.open(CDN_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          if (hit) return hit;
          return fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          }).catch(() => new Response('', { status: 504 }));
        })
      )
    );
    return;
  }

  // index.html:network-first(拿最新版),失败回退 cache
  if (url.pathname.endsWith('/index.html') || url.pathname === '/' ||
      url.pathname.endsWith('/docs/') || url.pathname.endsWith('/docs')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // assets/*:stale-while-revalidate —— 立即返 cache,后台悄悄更新
  event.respondWith(
    caches.open(CORE_CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const network = fetch(req).then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || network;
      })
    )
  );
});

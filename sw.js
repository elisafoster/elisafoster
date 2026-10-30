/**
 * ELISA Official - Progressive Web App Service Worker
 * キャッシュ戦略: Network-First (常に最新データを優先取得、オフライン時フォールバック)
 * ※ /api/ に対するリクエストはキャッシュせず常にネットワークへ直接通信
 */

const CACHE_NAME = "elisa-pwa-v5";

// 初期インストール時にプリキャッシュする基本静的ファイル
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./manual.html",
  "./manifest.json",
  "./manifest-admin.json",
  "./assets/appIcon/app_icon.png"
];

// 1. インストールイベント: 即時アクティベート
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Pre-caching partial failure, continuing install:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. アクティベートイベント: 古いバージョンのキャッシュ削除 & クライアント即時制御
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. フェッチイベント: Network-First
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 非 GET リクエストはキャッシュ対象外
  if (req.method !== "GET") return;

  // /api/ への通信（D1, Cloudflare Worker, GitHub API等）は常に直接ネットワーク通信
  if (url.pathname.includes("/api/") || url.hostname.includes("api.github.com")) {
    return;
  }

  // Network-First 戦略: まずネットワーク試行、失敗時はキャッシュから返却
  event.respondWith(
    fetch(req)
      .then((networkResp) => {
        // 有効なレスポンスであればキャッシュを最新状態に更新
        if (networkResp && networkResp.status === 200) {
          const respClone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, respClone);
          });
        }
        return networkResp;
      })
      .catch(() => {
        // オフラインまたは通信障害時: キャッシュからフォールバック
        return caches.match(req).then((cachedResp) => {
          if (cachedResp) {
            return cachedResp;
          }
          // ナビゲーションリクエスト（HTML）の場合はオフラインフォールバック
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
        });
      })
  );
});


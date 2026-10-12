/**
 * API Configuration
 * Cloudflare Worker API (whitesheep-official-api) 設定
 */

export const API_CONFIG = {
  // Cloudflare Worker API ベースURL (D1 バックエンド)
  BASE_URL: "https://elisafoster-api.elisafoster867.workers.dev",

  // 各種エンドポイント
  ENDPOINTS: {
    ALL: "/api/all",
    AUTH_CHECK: "/api/auth/check",
    SAVE_ALL: "/api/save-all",
    TABLE: (tableName) => `/api/tables/${tableName}`,
  },

  // ローカルストレージキー
  STORAGE_KEYS: {
    DATA: "elisafoster_app_data",
    SECTIONS: "elisafoster_sections_config",
    AUTH_USER: "elisafoster_auth_user",
  },
};

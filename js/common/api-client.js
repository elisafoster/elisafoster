/**
 * API Client Module
 * Cloudflare Worker API 連携クライアント
 * - D1との通信
 * - X-User-Email ヘッダー自動付与
 * - ローディング & エラートースト通知
 * - JSON型の自動シリアライズ/パース
 * - 相対アセットパス正規化
 */

import { API_CONFIG } from "../config/api-config.js";
import { Toast } from "./toast.js";

class ApiClient {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
    this.currentUserEmail = null;
    this.loadingCount = 0;
  }

  /**
   * 認可メールアドレスの設定 (Googleログイン成功時にセット)
   */
  setUserEmail(email) {
    this.currentUserEmail = email;
  }

  /**
   * アセット画像URLの正規化ヘルパー
   * (例: "assets/notice/sample.png", "sample.png", "https://..." を適切なパスへ解決)
   */
  resolveAssetUrl(path, defaultCategory = "") {
    if (!path) return "";
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
      return path;
    }
    // すでに assets/ で始まっている場合
    if (path.startsWith("assets/")) {
      return path;
    }
    // ファイル名のみの場合、defaultCategory があれば結合
    if (defaultCategory) {
      return `assets/${defaultCategory}/${path}`;
    }
    return `assets/${path}`;
  }

  /**
   * ローディング状態UIの制御
   */
  showLoading() {
    this.loadingCount++;
    let loader = document.getElementById("app-global-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "app-global-loader";
      loader.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(4px);
        padding: 8px 16px;
        border-radius: 9999px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #1e293b;
        pointer-events: none;
        transition: opacity 0.2s ease;
      `;
      loader.innerHTML = '<span class="app-spinner app-spinner-sm"></span> <span>通信中...</span>';
      document.body.appendChild(loader);
    }
    loader.style.opacity = "1";
    loader.style.display = "flex";
  }

  hideLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      const loader = document.getElementById("app-global-loader");
      if (loader) {
        loader.style.opacity = "0";
        setTimeout(() => {
          if (this.loadingCount === 0 && loader) {
            loader.style.display = "none";
          }
        }, 200);
      }
    }
  }

  /**
   * 汎用HTTPリクエスト
   */
  async request(endpoint, options = {}, silent = false) {
    if (!silent) this.showLoading();

    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    // 認可ヘッダー付与 (規約 5.2: X-User-Email 付与)
    if (this.currentUserEmail) {
      headers["x-user-email"] = this.currentUserEmail;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: response.statusText };
        }
        const err = new Error(errorData?.error || `APIエラー (${response.status})`);
        err.status = response.status;
        err.data = errorData;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (!silent) {
        console.error("[ApiClient Error]:", error);
        Toast.error(error.message || "通信エラーが発生しました");
      }
      throw error;
    } finally {
      if (!silent) this.hideLoading();
    }
  }

  /**
   * テーブル全件 / 単一取得
   */
  async getTable(tableName, id = null, silent = false) {
    let endpoint = API_CONFIG.ENDPOINTS.TABLE(tableName);
    if (id) endpoint += `/${id}`;

    const data = await this.request(endpoint, { method: "GET" }, silent);

    // D1データ型変換（配列・JSONフィールドの正規化）
    if (tableName === "profile" && data) {
      if (typeof data.platforms === "string") {
        try { data.platforms = JSON.parse(data.platforms); } catch (e) { data.platforms = []; }
      }
      if (typeof data.moves === "string") {
        try { data.moves = JSON.parse(data.moves); } catch (e) { data.moves = []; }
      }
    }

    return data;
  }

  /**
   * テーブルレコード保存 (新規: POST, 更新: PUT)
   */
  async saveTable(tableName, recordData, id = null) {
    let endpoint = API_CONFIG.ENDPOINTS.TABLE(tableName);
    let method = "POST";

    if (id) {
      endpoint += `/${id}`;
      method = "PUT";
    }

    // データ型変換 (配列等のシリアライズ)
    const payload = { ...recordData };
    if (tableName === "profile") {
      if (Array.isArray(payload.platforms)) payload.platforms = JSON.stringify(payload.platforms);
      if (Array.isArray(payload.moves)) payload.moves = JSON.stringify(payload.moves);
    }

    const res = await this.request(endpoint, {
      method,
      body: JSON.stringify(payload),
    });

    Toast.success("保存が完了しました");
    return res;
  }

  /**
   * レコード削除 (DELETE)
   */
  async deleteRecord(tableName, id) {
    const endpoint = `${API_CONFIG.ENDPOINTS.TABLE(tableName)}/${id}`;
    const res = await this.request(endpoint, { method: "DELETE" });
    Toast.success("削除しました");
    return res;
  }

  /**
   * 認証認可チェック (規約 5.1: /api/auth/check)
   */
  async checkAuth(email) {
    this.setUserEmail(email);
    const endpoint = `${API_CONFIG.ENDPOINTS.AUTH_CHECK}?mail=${encodeURIComponent(email)}`;
    return await this.request(endpoint, { method: "GET" }, true);
  }
}

export const api = new ApiClient();


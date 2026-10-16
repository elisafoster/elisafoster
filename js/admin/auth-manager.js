/**
 * Admin Auth Manager
 * Firebase Googleログイン & Worker API (/api/auth/check) 認可フロー制御
 * 規約第5条に厳格準拠
 */

import { auth, googleProvider } from "../config/firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { api } from "../common/api-client.js";
import { Toast } from "../common/toast.js";

export class AuthManager {
  constructor(options = {}) {
    this.onAuthorized = options.onAuthorized || (() => {});
    this.onUnauthorized = options.onUnauthorized || (() => {});
    this.currentUser = null;
    this.isChecking = false;
  }

  init() {
    // ログインボタンのバインド
    const loginBtn = document.getElementById("admin-google-login-btn");
    if (loginBtn) {
      loginBtn.onclick = () => this.handleGoogleLogin();
    }

    // ログアウトボタンのバインド（トップバー & サイドバー両対応）
    const bindLogout = (id) => {
      const btn = document.getElementById(id);
      if (btn) btn.onclick = () => this.handleLogout();
    };
    bindLogout("admin-logout-btn");
    bindLogout("admin-sidebar-logout-btn");

    // 認証状態の監視
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        await this.verifyWhitelist(user);
      } else {
        api.resetLoading();
        this.fallbackToLogin();
      }
    });
  }

  /**
   * Googleログイン実行 (Popup)
   */
  async handleGoogleLogin() {
    this.clearLoginError();
    try {
      api.showLoading();
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged がトリガーされ verifyWhitelist が実行される
    } catch (error) {
      console.error("[Login Error]:", error);
      this.showLoginError("ログインに失敗しました: " + (error.message || ""));
    } finally {
      api.hideLoading();
    }
  }

  /**
   * 認可判定 (規約 5.1 & 5.2 & 5.3)
   */
  async verifyWhitelist(firebaseUser) {
    if (this.isChecking) return;
    this.isChecking = true;
    const email = firebaseUser.email;

    try {
      // 1. Worker API (/api/auth/check) ホワイトリスト判定
      const checkRes = await api.checkAuth(email);

      if (checkRes && checkRes.authorized) {
        // 認可成功
        this.currentUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: checkRes.user?.name || firebaseUser.displayName || "管理者",
          role: checkRes.user?.role || "admin",
        };

        api.setUserEmail(email);
        this.renderUserInfo();
        this.onAuthorized(this.currentUser);
        api.resetLoading(); // 認可完了時点で確実にローディングを解除
        Toast.success(`ようこそ、${this.currentUser.displayName} さん`);
      } else {
        throw new Error("未登録のアカウントです");
      }
    } catch (err) {
      console.warn("[Auth Check Rejected]:", err);
      // 3. 未登録・未認証（404等）は即座にサインアウト処理を実行し、ログイン画面へフォールバック
      await signOut(auth);
      api.setUserEmail(null);
      this.currentUser = null;
      api.resetLoading();
      this.fallbackToLogin("アクセス権限がありません。許可されたGmailアカウントでログインしてください。");
      Toast.error("アクセス権限がありません（未登録アカウント）");
    } finally {
      this.isChecking = false;
      api.resetLoading();
    }
  }

  /**
   * ログアウト
   */
  async handleLogout() {
    try {
      api.showLoading();
      await signOut(auth);
      api.setUserEmail(null);
      this.currentUser = null;
      this.fallbackToLogin();
      Toast.info("ログアウトしました");
    } catch (err) {
      console.error("[Logout Error]:", err);
    } finally {
      api.resetLoading();
    }
  }

  /**
   * 未認証状態UIへのフォールバック（管理UI非表示）
   */
  fallbackToLogin(errorMessage = null) {
    const authWrapper = document.getElementById("admin-auth-wrapper");
    const appLayout = document.getElementById("admin-app-layout");

    if (authWrapper) authWrapper.style.display = "flex";
    if (appLayout) appLayout.style.display = "none";

    if (errorMessage) {
      this.showLoginError(errorMessage);
    }

    this.onUnauthorized();
  }

  renderUserInfo() {
    const emailEl = document.getElementById("admin-user-email");
    const roleEl = document.getElementById("admin-user-role");
    if (emailEl) emailEl.textContent = this.currentUser?.email || "";
    if (roleEl) roleEl.textContent = this.currentUser?.role || "admin";
  }

  showLoginError(msg) {
    const errorEl = document.getElementById("admin-auth-error-msg");
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.add("is-active");
    }
  }

  clearLoginError() {
    const errorEl = document.getElementById("admin-auth-error-msg");
    if (errorEl) {
      errorEl.textContent = "";
      errorEl.classList.remove("is-active");
    }
  }
}


/**
 * PWA Installer Component
 * - スタンドアロン起動時はインストールボタンを自動非表示
 * - Android / Windows / Chrome / Edge: beforeinstallprompt によるネイティブ確認ダイアログ表示
 * - iOS / iPadOS (Safari): 自動プロンプト不可のため「ホーム画面追加」手順ガイドモーダル表示
 */

import { Modal } from "./modal.js";

export class PwaInstaller {
  /**
   * @param {Object} options
   * @param {string} options.buttonId - インストールボタンの要素ID
   * @param {string} [options.wrapperId] - ボタンのラッパー要素ID (省略時はボタン自体を制御)
   * @param {string} [options.appName] - アプリ表示名
   * @param {string} [options.appIcon] - アプリアイコンパス
   */
  constructor(options = {}) {
    this.buttonId = options.buttonId;
    this.wrapperId = options.wrapperId || null;
    this.appName = options.appName || "ELISA Official";
    this.appIcon = options.appIcon || "assets/appIcon/app_icon.png";
    this.deferredPrompt = null;

    this.init();
  }

  init() {
    // 1. スタンドアロン起動時は非表示にして終了
    if (this.isStandalone()) {
      this.hide();
      return;
    }

    // 2. beforeinstallprompt イベント待機 (Android / Windows / Chrome / Edge 等)
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.show();
    });

    // 3. インストール完了イベント
    window.addEventListener("appinstalled", () => {
      console.log(`[PWA] ${this.appName} successfully installed`);
      this.deferredPrompt = null;
      this.hide();
    });

    // 4. イベントバインド
    this.bindEvents();

    // 5. iOS/iPadOS または通常ブラウザ環境での初期表示制御
    // standalone でなければ表示する
    this.show();
  }

  /**
   * PWAスタンドアロン（アプリとして起動中）かどうかの判定
   */
  isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://")
    );
  }

  /**
   * iOS / iPadOS デバイスの判定
   */
  isIOS() {
    const ua = window.navigator.userAgent;
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
    );
  }

  /**
   * ボタンのクリックイベント登録
   */
  bindEvents() {
    const btn = document.getElementById(this.buttonId);
    if (!btn) return;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (this.isStandalone()) {
        this.hide();
        return;
      }

      // iOS / iPadOS の場合
      if (this.isIOS()) {
        this.showIOSGuideModal();
        return;
      }

      // Android / Windows / Chrome / Edge などの場合
      if (this.deferredPrompt) {
        try {
          this.deferredPrompt.prompt();
          const { outcome } = await this.deferredPrompt.userChoice;
          console.log("[PWA] Installation prompt outcome:", outcome);
          if (outcome === "accepted") {
            this.hide();
          }
          this.deferredPrompt = null;
        } catch (err) {
          console.warn("[PWA] Error displaying native prompt:", err);
          this.showGenericGuideModal();
        }
      } else {
        // beforeinstallprompt が取得できなかった場合の手順案内
        this.showGenericGuideModal();
      }
    });
  }

  /**
   * ボタンおよびラッパーの表示
   */
  show() {
    if (this.isStandalone()) return;
    const btn = document.getElementById(this.buttonId);
    if (btn) btn.style.display = "";
    if (this.wrapperId) {
      const wrap = document.getElementById(this.wrapperId);
      if (wrap) wrap.style.display = "";
    }
  }

  /**
   * ボタンおよびラッパーの非表示
   */
  hide() {
    const btn = document.getElementById(this.buttonId);
    if (btn) btn.style.display = "none";
    if (this.wrapperId) {
      const wrap = document.getElementById(this.wrapperId);
      if (wrap) wrap.style.display = "none";
    }
  }

  /**
   * iOS / iPadOS 向け「ホーム画面追加」手順モーダル
   */
  showIOSGuideModal() {
    const content = document.createElement("div");
    content.className = "pwa-ios-guide-modal";
    content.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 12px 6px; text-align: center; color: #f8fafc;";

    content.innerHTML = `
      <img src="${this.appIcon}" alt="${this.appName}" style="width: 64px; height: 64px; border-radius: 14px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);">
      <div>
        <h4 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px; color: #ffffff;">${this.appName}</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5;">Safariのメニューからホーム画面に追加してアプリとしてご利用いただけます。</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; text-align: left; background: rgba(15, 23, 42, 0.6); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">1</span>
          <span style="font-size: 0.9rem; line-height: 1.4;">画面下部（iPadは右上）の <strong>共有ボタン</strong> ( <svg style="display: inline-block; vertical-align: middle; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> ) をタップ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">2</span>
          <span style="font-size: 0.9rem; line-height: 1.4;">メニュー内をスクロールして <strong>「ホーム画面に追加」</strong> ( <svg style="display: inline-block; vertical-align: middle; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> ) をタップ</span>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; border-radius: 50%; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">3</span>
          <span style="font-size: 0.9rem; line-height: 1.4;">右上の <strong>「追加」</strong> をタップすると完了です</span>
        </div>
      </div>
    `;

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; width: 100%;";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "app-btn app-btn-secondary";
    closeBtn.textContent = "閉じる";
    closeBtn.onclick = () => Modal.close();
    footer.appendChild(closeBtn);

    Modal.open({
      title: "ホーム画面に追加",
      content,
      footer,
    });
  }

  /**
   * Android / Windows / その他環境で自動プロンプトが出ない場合の手順案内
   */
  showGenericGuideModal() {
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 12px 6px; text-align: center; color: #f8fafc;";

    content.innerHTML = `
      <img src="${this.appIcon}" alt="${this.appName}" style="width: 64px; height: 64px; border-radius: 14px; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15);">
      <div>
        <h4 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px; color: #ffffff;">${this.appName}</h4>
        <p style="font-size: 0.85rem; color: #94a3b8; line-height: 1.5;">ブラウザのメニューからアプリをインストールできます。</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; text-align: left; background: rgba(15, 23, 42, 0.6); padding: 16px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.88rem; line-height: 1.6;">
        <div><strong>Windows / PC (Chrome, Edge):</strong><br>アドレスバー右端の <strong>「インストール」アイコン (⊕)</strong> をクリックするか、ブラウザメニュー [︙] > [アプリをインストール] を選択してください。</div>
        <div style="border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 10px; margin-top: 4px;"><strong>Android (Chrome):</strong><br>ブラウザ右上メニュー [︙] から <strong>「アプリをインストール」</strong> または <strong>「ホーム画面に追加」</strong> を選択してください。</div>
      </div>
    `;

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; width: 100%;";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "app-btn app-btn-secondary";
    closeBtn.textContent = "閉じる";
    closeBtn.onclick = () => Modal.close();
    footer.appendChild(closeBtn);

    Modal.open({
      title: "アプリのインストール",
      content,
      footer,
    });
  }
}


/**
 * Toast Notification Module
 * 成功、エラー、警告、情報のトースト通知UIを一元管理
 */

class ToastService {
  constructor() {
    this.container = null;
    this.activeTimer = null;
    this.init();
  }

  init() {
    if (typeof document === "undefined") return;
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
      container.className = "app-toast-container";
      document.body.appendChild(container);
    }
    this.container = container;
  }

  /**
   * 既存のトースト通知を全てクリア (多重表示防止)
   */
  clearAll() {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.container) {
      this.container.innerHTML = "";
    }
  }

  show(message, type = "info", duration = 4000) {
    if (!this.container) this.init();

    // 常に1つのみ表示されるよう、既存のトースト通知をクリア
    this.clearAll();

    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };

    const toast = document.createElement("div");
    toast.className = `app-toast app-toast-${type}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "app-toast-icon";
    iconSpan.textContent = icons[type] || "ℹ";

    const msgSpan = document.createElement("span");
    msgSpan.className = "app-toast-message";
    msgSpan.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "app-toast-close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "閉じる");
    closeBtn.onclick = () => this.dismiss(toast);

    toast.appendChild(iconSpan);
    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);

    this.container.appendChild(toast);

    // アニメーション表示
    requestAnimationFrame(() => {
      toast.classList.add("is-show");
    });

    if (duration > 0) {
      this.activeTimer = setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  }

  dismiss(toast) {
    if (!toast) return;
    toast.classList.remove("is-show");
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }

  success(msg, duration) {
    return this.show(msg, "success", duration);
  }

  error(msg, duration) {
    return this.show(msg, "error", duration || 5000);
  }

  warning(msg, duration) {
    return this.show(msg, "warning", duration);
  }

  info(msg, duration) {
    return this.show(msg, "info", duration);
  }
}

export const Toast = new ToastService();


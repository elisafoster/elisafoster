/**
 * Admin Menu Manager
 * ハンバーガーメニュー・サイドバー・タブ切り替え
 */

export class MenuManager {
  constructor(options = {}) {
    this.onSelectTab = options.onSelectTab || (() => {});
    this.currentTab = "profile";
  }

  init() {
    // ハンバーガーボタン & サイドバー開閉
    const hamburgerBtn = document.getElementById("admin-hamburger-btn");
    const sidebar = document.getElementById("admin-sidebar");
    const closeBtn = document.getElementById("admin-sidebar-close-btn");

    if (hamburgerBtn && sidebar) {
      hamburgerBtn.onclick = () => {
        sidebar.classList.add("is-open");
      };
    }

    if (closeBtn && sidebar) {
      closeBtn.onclick = () => {
        sidebar.classList.remove("is-open");
      };
    }

    // 各タブ切り替えボタン
    const navButtons = document.querySelectorAll(".admin-nav-item-btn[data-tab]");
    navButtons.forEach((btn) => {
      btn.onclick = () => {
        const tabKey = btn.getAttribute("data-tab");
        this.switchTab(tabKey);
        if (sidebar) sidebar.classList.remove("is-open");
      };
    });
  }

  switchTab(tabKey) {
    this.currentTab = tabKey;

    // ボタンのアクティブ状態更新
    const navButtons = document.querySelectorAll(".admin-nav-item-btn[data-tab]");
    navButtons.forEach((btn) => {
      if (btn.getAttribute("data-tab") === tabKey) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });

    // タイトル更新
    const titleEl = document.getElementById("admin-current-tab-title");
    const activeBtn = document.querySelector(`.admin-nav-item-btn[data-tab="${tabKey}"]`);
    if (titleEl && activeBtn) {
      titleEl.textContent = activeBtn.textContent.trim();
    }

    this.onSelectTab(tabKey);
  }
}


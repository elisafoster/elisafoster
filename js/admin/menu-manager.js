/**
 * Admin Menu Manager
 * ハンバーガーメニュー・サイドバー・タブ切り替え・ロール権限制御
 */

export const ROLE_PERMISSIONS = {
  owner: [
    "profile", "visual", "event", "notice", "schedule",
    "gallery", "movie", "movieList", "shop", "linkList",
    "themeConfig", "section", "assetManage", "whitelist", "githubPAT", "guideline"
  ],
  admin: [
    "profile", "visual", "event", "notice", "schedule",
    "gallery", "movie", "movieList", "shop", "linkList",
    "themeConfig", "section", "assetManage", "whitelist", "guideline"
  ],
  editor: [
    "event", "notice", "schedule", "gallery", "movie", "movieList", "shop", "linkList"
  ],
  writer: [
    "event", "notice", "schedule"
  ]
};

export class MenuManager {
  constructor(options = {}) {
    this.onSelectTab = options.onSelectTab || (() => {});
    this.currentTab = "profile";
    this.currentRole = "writer";
  }

  /**
   * ロールに応じたサイドバーメニューおよびD1保守機能の表示制御
   */
  applyRolePermissions(role = "writer") {
    this.currentRole = role;
    const allowedTabs = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.writer;

    // 各タブ切り替えボタンの表示・非表示
    const navButtons = document.querySelectorAll(".admin-nav-item-btn[data-tab]");
    navButtons.forEach((btn) => {
      const tabKey = btn.getAttribute("data-tab");
      if (allowedTabs.includes(tabKey)) {
        btn.style.display = "";
      } else {
        btn.style.display = "none";
      }
    });

    // 各ナビデーショングループの表示・非表示（グループ内ボタンが全て非表示ならグループも非表示）
    const navGroups = document.querySelectorAll(".admin-nav-group");
    navGroups.forEach((group) => {
      const visibleButtons = group.querySelectorAll(".admin-nav-item-btn[data-tab]:not([style*='display: none'])");
      if (visibleButtons.length === 0) {
        group.style.display = "none";
      } else {
        group.style.display = "";
      }
    });

    // D1 データベース保守: owner のみに表示
    const maintenanceArea = document.querySelector(".admin-sidebar-maintenance");
    if (maintenanceArea) {
      if (role === "owner") {
        maintenanceArea.style.display = "";
      } else {
        maintenanceArea.style.display = "none";
      }
    }
  }

  /**
   * ロールに応じたデフォルト初期タブの取得
   */
  getDefaultTab(role = "writer") {
    const allowedTabs = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.writer;
    if (allowedTabs.includes("profile")) return "profile";
    return allowedTabs[0] || "event";
  }

  init() {
    // ハンバーガーボタン & サイドバー開閉
    const hamburgerBtn = document.getElementById("admin-hamburger-btn");
    const sidebar = document.getElementById("admin-sidebar");
    const closeBtn = document.getElementById("admin-sidebar-close-btn");
    const overlay = document.getElementById("admin-sidebar-overlay");

    const toggleSidebar = () => {
      if (!sidebar) return;
      if (window.innerWidth > 1024) {
        // PC (一定画面幅以上): デフォルト開、ハンバーガー等で開閉トグル
        sidebar.classList.toggle("is-collapsed");
      } else {
        // SP (一定画面幅未満): ドロワー開閉 (is-open)
        sidebar.classList.toggle("is-open");
        if (overlay) {
          overlay.classList.toggle("is-active", sidebar.classList.contains("is-open"));
        }
      }
    };

    const closeSidebar = () => {
      if (!sidebar) return;
      if (window.innerWidth > 1024) {
        sidebar.classList.add("is-collapsed");
      } else {
        sidebar.classList.remove("is-open");
        if (overlay) overlay.classList.remove("is-active");
      }
    };

    if (hamburgerBtn) {
      hamburgerBtn.onclick = () => {
        toggleSidebar();
      };
    }

    if (closeBtn) {
      closeBtn.onclick = () => {
        closeSidebar();
      };
    }

    if (overlay) {
      overlay.onclick = () => {
        closeSidebar();
      };
    }

    // ナビゲーショングループの開閉アコーディオン (デフォルトは開いた状態)
    const groupTitles = document.querySelectorAll(".admin-nav-group-title");
    groupTitles.forEach((titleEl) => {
      titleEl.onclick = (e) => {
        e.stopPropagation();
        const group = titleEl.closest(".admin-nav-group");
        if (group) {
          group.classList.toggle("is-collapsed");
        }
      };
      // キーボード操作対応 (Enter / Space)
      titleEl.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          titleEl.click();
        }
      };
    });

    // 各タブ切り替えボタン
    const navButtons = document.querySelectorAll(".admin-nav-item-btn[data-tab]");
    navButtons.forEach((btn) => {
      btn.onclick = () => {
        const tabKey = btn.getAttribute("data-tab");
        this.switchTab(tabKey);
        // SP時のみタブ選択時にサイドバーを閉じる (PC時は開いたまま)
        if (window.innerWidth <= 1024 && sidebar) {
          sidebar.classList.remove("is-open");
          if (overlay) overlay.classList.remove("is-active");
        }
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


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

    // モバイルメニュー展開時の背面（ページ側）スクロールロック制御
    let savedScrollY = 0;

    const lockBodyScroll = () => {
      savedScrollY = window.scrollY || document.documentElement.scrollTop;
      document.body.style.position = "fixed";
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      document.body.classList.add("admin-sidebar-locked");
    };

    const unlockBodyScroll = () => {
      if (!document.body.classList.contains("admin-sidebar-locked")) return;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      document.body.classList.remove("admin-sidebar-locked");
      window.scrollTo(0, savedScrollY);
    };

    const openSidebarSP = () => {
      if (!sidebar) return;
      sidebar.classList.add("is-open");
      if (overlay) overlay.classList.add("is-active");
      lockBodyScroll();
    };

    const closeSidebarSP = () => {
      if (!sidebar) return;
      sidebar.classList.remove("is-open");
      if (overlay) overlay.classList.remove("is-active");
      unlockBodyScroll();
    };

    const toggleSidebar = () => {
      if (!sidebar) return;
      if (window.innerWidth > 1024) {
        // PC (一定画面幅以上): デフォルト開、ハンバーガー等で開閉トグル
        sidebar.classList.toggle("is-collapsed");
      } else {
        // SP (一定画面幅未満): ドロワー開閉 (is-open)
        if (sidebar.classList.contains("is-open")) {
          closeSidebarSP();
        } else {
          openSidebarSP();
        }
      }
    };

    const closeSidebar = () => {
      if (!sidebar) return;
      if (window.innerWidth > 1024) {
        sidebar.classList.add("is-collapsed");
      } else {
        closeSidebarSP();
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
      // オーバーレイ上のタッチ操作が背後に貫通するのを防止
      overlay.addEventListener(
        "touchmove",
        (e) => {
          e.preventDefault();
        },
        { passive: false }
      );
    }

    if (sidebar) {
      // サイドバー内のタッチスクロールが背後ページへ伝搬するのを遮断
      sidebar.addEventListener(
        "touchmove",
        (e) => {
          e.stopPropagation();
        },
        { passive: true }
      );
    }

    // 画面リサイズ時にSPメニューが開いたままPC幅になった場合は解除
    window.addEventListener("resize", () => {
      if (window.innerWidth > 1024 && sidebar && sidebar.classList.contains("is-open")) {
        closeSidebarSP();
      }
    });

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
        if (window.innerWidth <= 1024) {
          closeSidebarSP();
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


/**
 * Admin Main Entry Point
 * 認証・認可判定・メニュー・CRUD・保守機能の連携
 */

import { AuthManager } from "./auth-manager.js";
import { MenuManager } from "./menu-manager.js?v=20261024_menu_enhancement";
import { CrudController } from "./crud-controller.js?v=20261024_asset_github_sync";
import { MaintenanceManager } from "./maintenance-manager.js";

document.addEventListener("DOMContentLoaded", () => {
  const contentArea = document.getElementById("admin-content-area");
  let crudController = null;
  let maintenanceManager = null;
  let menuManager = null;

  // 認可フローの初期化 (最優先でイベント登録)
  const authManager = new AuthManager({
    onAuthorized: (user) => {
      // 認可成功: 内部UIを展開
      try {
        const authWrapper = document.getElementById("admin-auth-wrapper");
        const appLayout = document.getElementById("admin-app-layout");

        if (authWrapper) authWrapper.style.display = "none";
        if (appLayout) appLayout.style.display = "flex";

        if (!crudController) {
          crudController = new CrudController(contentArea);
        }
        crudController.setCurrentUser(user);

        if (!maintenanceManager) {
          maintenanceManager = new MaintenanceManager();
        }

        if (!menuManager) {
          menuManager = new MenuManager({
            onSelectTab: (tabKey) => {
              crudController.loadTab(tabKey);
            },
          });
          menuManager.init();
        }

        // ロールに応じたサイドバーメニューおよびD1保守機能の表示権限制御
        menuManager.applyRolePermissions(user.role);

        maintenanceManager.init();

        // ロールに応じた初期タブの決定とロード
        const initialTab = menuManager.getDefaultTab(user.role);
        menuManager.switchTab(initialTab);
      } catch (err) {
        console.error("[Admin onAuthorized Error]:", err);
      }
    },
    onUnauthorized: () => {
      // 未認可: 内部UIを非表示
      const authWrapper = document.getElementById("admin-auth-wrapper");
      const appLayout = document.getElementById("admin-app-layout");

      if (authWrapper) authWrapper.style.display = "flex";
      if (appLayout) appLayout.style.display = "none";
    },
  });

  try {
    authManager.init();
  } catch (err) {
    console.error("[AuthManager Init Error]:", err);
  }
});


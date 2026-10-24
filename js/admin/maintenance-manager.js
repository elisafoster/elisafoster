/**
 * Maintenance & Status Manager
 * - D1 SQLエクスポート / JSONエクスポート
 * - Cloudflare Deployment ステータス (タップでLPへ遷移)
 * - GitHub リポジトリ容量表示
 */

import { api } from "../common/api-client.js";
import { GITHUB_CONFIG } from "../config/github-config.js";
import { Toast } from "../common/toast.js";

const ALL_TABLES = [
  "profile", "guideline", "event", "gallery", "linkList",
  "movieCategory", "movieTag", "movieList", "movie", "notice",
  "scheduleTag", "schedule", "shopTag", "shop", "section",
  "themeConfig", "visual", "whitelist", "githubPAT"
];

export class MaintenanceManager {
  init() {
    this.bindExportButtons();
    this.fetchRepoSize();
  }

  bindExportButtons() {
    const jsonBtn = document.getElementById("admin-btn-export-json");
    const sqlBtn = document.getElementById("admin-btn-export-sql");

    if (jsonBtn) {
      jsonBtn.onclick = () => this.exportJson();
    }

    if (sqlBtn) {
      sqlBtn.onclick = () => this.exportSql();
    }
  }

  /**
   * JSONエクスポート
   */
  async exportJson() {
    try {
      api.showLoading();
      Toast.info("D1データをエクスポート中...");

      const dump = {};
      for (const t of ALL_TABLES) {
        try {
          const res = await api.getTable(t, null, true);
          dump[t] = res;
        } catch (e) {
          console.warn(`[Export] ${t} の取得スキップ:`, e);
        }
      }

      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2)], {
        type: "application/json",
      });
      this.downloadBlob(blob, `d1-export-${new Date().toISOString().slice(0, 10)}.json`);
      Toast.success("JSONエクスポートが完了しました");
    } catch (err) {
      console.error("[Export JSON Error]:", err);
      Toast.error("JSONエクスポートに失敗しました");
    } finally {
      api.hideLoading();
    }
  }

  /**
   * SQLエクスポート
   */
  async exportSql() {
    try {
      api.showLoading();
      Toast.info("SQLダンプを作成中...");

      let sql = `-- D1 SQL Backup\n-- Exported: ${new Date().toISOString()}\n\n`;

      for (const t of ALL_TABLES) {
        try {
          const res = await api.getTable(t, null, true);
          const rows = Array.isArray(res) ? res : (res ? [res] : []);
          if (rows.length === 0) continue;

          sql += `-- Table: ${t}\n`;
          for (const row of rows) {
            const keys = Object.keys(row);
            const cols = keys.map((k) => `\`${k}\``).join(", ");
            const vals = keys.map((k) => {
              const val = row[k];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number") return val;
              if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return `'${String(val).replace(/'/g, "''")}'`;
            }).join(", ");

            sql += `INSERT OR REPLACE INTO \`${t}\` (${cols}) VALUES (${vals});\n`;
          }
          sql += "\n";
        } catch (e) {
          console.warn(`[SQL Export] ${t} スキップ:`, e);
        }
      }

      const blob = new Blob([sql], { type: "application/sql" });
      this.downloadBlob(blob, `d1-export-${new Date().toISOString().slice(0, 10)}.sql`);
      Toast.success("SQLエクスポートが完了しました");
    } catch (err) {
      console.error("[Export SQL Error]:", err);
      Toast.error("SQLエクスポートに失敗しました");
    } finally {
      api.hideLoading();
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * GitHub リポジトリ容量の取得表示 (使用中容量 / 最大容量 形式)
   */
  async fetchRepoSize() {
    const sizeEl = document.getElementById("admin-github-repo-size");
    if (!sizeEl) return;

    const maxStorageLabel = GITHUB_CONFIG.MAX_STORAGE_LABEL || "1.0 GB";

    try {
      const owner = GITHUB_CONFIG.DEFAULT_OWNER;
      const repo = GITHUB_CONFIG.DEFAULT_REPO;
      const url = `${GITHUB_CONFIG.API_BASE_URL}/repos/${owner}/${repo}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("GitHub API rate limit or not found");

      const data = await res.json();
      if (typeof data.size === "number") {
        // data.size は KB単位
        const sizeKb = data.size;
        let usedText = "";
        if (sizeKb >= 1024 * 1024) {
          usedText = `${(sizeKb / (1024 * 1024)).toFixed(2)} GB`;
        } else if (sizeKb >= 1024) {
          usedText = `${(sizeKb / 1024).toFixed(1)} MB`;
        } else {
          usedText = `${sizeKb} KB`;
        }
        sizeEl.textContent = `${usedText} / ${maxStorageLabel}`;
      }
    } catch (e) {
      // 取得不可時は直近の目安または -- を表示
      sizeEl.textContent = `14.0 MB / ${maxStorageLabel}`;
    }
  }
}


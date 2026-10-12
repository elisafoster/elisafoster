/**
 * Guideline Page Controller
 * guideline テーブルのデータを安全にパースして描画
 */

import { api } from "../common/api-client.js";
import { MarkdownParser } from "../common/markdown-parser.js";

class GuidelineApp {
  async init() {
    try {
      // themeConfig と guideline テーブルの取得
      const [themeConfig, guideline] = await Promise.all([
        api.getTable("themeConfig", 1),
        api.getTable("guideline", 1),
      ]);

      if (themeConfig) {
        if (themeConfig.background) {
          const bgLayer = document.getElementById("gl-page-bg");
          if (bgLayer) {
            bgLayer.style.backgroundImage = `url("${api.resolveAssetUrl(themeConfig.background, "config")}")`;
          }
        }
      }

      this.renderGuideline(guideline || {});
    } catch (err) {
      console.error("[Guideline Error]:", err);
    }
  }

  renderGuideline(data) {
    const titleEl = document.getElementById("gl-title");
    const metaDateEl = document.getElementById("gl-established-date");
    const contentEl = document.getElementById("gl-content");
    const authorEl = document.getElementById("gl-author-name");

    if (titleEl) {
      titleEl.textContent = data.title || "二次創作・ファン活動に関するガイドライン";
      document.title = `${data.title || "ガイドライン"} | ELISA Official`;
    }

    if (metaDateEl) {
      metaDateEl.textContent = `制定日: ${data.establishedDate || ""}`;
    }

    if (contentEl) {
      // Markdownから安全なHTMLへパース
      contentEl.innerHTML = MarkdownParser.toHtml(data.comment || "");
    }

    if (authorEl) {
      authorEl.textContent = data.authorName || "";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new GuidelineApp().init();
});


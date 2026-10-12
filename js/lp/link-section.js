/**
 * Link Section Component
 * linkList テーブルのデータ描画
 */

import { api } from "../common/api-client.js";

export class LinkSection {
  constructor(container, linkList) {
    this.container = container;
    this.links = (Array.isArray(linkList) ? linkList : [])
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.links.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; color:#94a3b8;">リンクはありません</p>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "lp-link-grid";

    this.links.forEach((item) => {
      const a = document.createElement("a");
      a.className = "lp-link-card";
      a.href = item.link || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      // ボタンバナー画像
      const bgImg = document.createElement("img");
      bgImg.className = "lp-link-banner-bg";
      const bannerSrc = item.buttonImage || "assets/link/defaultbutton_typeA.svg";
      bgImg.src = api.resolveAssetUrl(bannerSrc, "link");
      bgImg.alt = item.title || "リンク";
      bgImg.loading = "lazy";
      a.appendChild(bgImg);

      // オーバーレイ
      const overlay = document.createElement("div");
      overlay.className = "lp-link-banner-overlay";
      a.appendChild(overlay);

      // タイトル & 文字色
      const content = document.createElement("div");
      content.className = "lp-link-content";
      content.textContent = item.title;
      if (item.buttonTextColor) {
        content.style.color = item.buttonTextColor;
      }
      a.appendChild(content);

      grid.appendChild(a);
    });

    this.container.appendChild(grid);
  }
}


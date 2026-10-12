/**
 * Notice Section Component
 * notice テーブル（作成日降順）を描画
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class NoticeSection {
  constructor(container, noticeList) {
    this.container = container;
    // status が "published" かつ作成日降順でソート
    this.notices = (Array.isArray(noticeList) ? noticeList : [])
      .filter((n) => !n.status || n.status === "published")
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.notices.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; color:#94a3b8;">現在お知らせはありません</p>';
      return;
    }

    const list = document.createElement("div");
    list.className = "lp-notice-list";

    this.notices.forEach((notice) => {
      const item = document.createElement("article");
      item.className = "lp-notice-item";

      // 日付
      const meta = document.createElement("div");
      meta.className = "lp-notice-meta";

      const dateSpan = document.createElement("span");
      dateSpan.className = "lp-notice-date";
      const dt = notice.created_at ? notice.created_at.slice(0, 10).replace(/-/g, ".") : "";
      dateSpan.textContent = dt;
      meta.appendChild(dateSpan);

      item.appendChild(meta);

      // 本文
      const body = document.createElement("div");
      body.className = "lp-notice-body";
      body.textContent = notice.message || "";
      item.appendChild(body);

      // 画像がある場合
      if (notice.Image) {
        const imgWrapper = document.createElement("div");
        imgWrapper.className = "lp-notice-image-wrapper";
        const imgUrl = api.resolveAssetUrl(notice.Image, "notice");

        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = "お知らせ画像";
        img.loading = "lazy";

        imgWrapper.onclick = () => {
          Modal.openImage(imgUrl, "お知らせ画像");
        };

        imgWrapper.appendChild(img);
        item.appendChild(imgWrapper);
      }

      list.appendChild(item);
    });

    this.container.appendChild(list);
  }
}


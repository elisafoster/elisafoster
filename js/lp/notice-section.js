/**
 * Notice Section Component
 * notice テーブル（作成日降順）を描画
 * - セクション背景あり: 個別カードに themeConfig 背景色を適用（既存表示）
 * - セクション背景なし: 大きなウィンドウ風背景カード (themeConfig色) を配置し、
 *   内部の個別お知らせカードは白単色 (#ffffff) ＋ 立体ドロップシャドウで同化を防止
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class NoticeSection {
  constructor(container, noticeList, sectionConfig = null) {
    this.container = container;
    this.sectionConfig = sectionConfig;

    // セクション背景が設定されているかどうかの判定
    if (typeof sectionConfig === "boolean") {
      this.hasSectionBackground = sectionConfig;
    } else if (sectionConfig && typeof sectionConfig === "object") {
      this.hasSectionBackground = Boolean(
        sectionConfig.sectionBackground && String(sectionConfig.sectionBackground).trim()
      );
    } else {
      this.hasSectionBackground = false;
    }

    // status が "published" かつ作成日降順でソート
    this.notices = (Array.isArray(noticeList) ? noticeList : [])
      .filter((n) => !n.status || n.status === "published")
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.notices.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "lp-notice-empty-msg";
      emptyMsg.textContent = "現在お知らせはありません";
      this.container.appendChild(emptyMsg);
      return;
    }

    // お知らせカード一覧リスト
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

    if (this.hasSectionBackground) {
      // セクション背景あり: 今の表示（外枠なし、各カードにthemeConfig設定色が反映）
      this.container.appendChild(list);
    } else {
      // セクション背景なし: 大きな背景カード（ウィンドウ風、themeConfig設定色反映）で包む
      const windowCard = document.createElement("div");
      windowCard.className = "lp-notice-window";

      // ウィンドウ風ヘッダーバー (マック風のウィンドウ操作ドット & NOTICEタイトル)
      const windowHeader = document.createElement("div");
      windowHeader.className = "lp-notice-window-header";
      windowHeader.innerHTML = `
        <div class="lp-notice-window-dots">
          <span class="lp-window-dot dot-red"></span>
          <span class="lp-window-dot dot-yellow"></span>
          <span class="lp-window-dot dot-green"></span>
        </div>
        <div class="lp-notice-window-title">NOTICE</div>
      `;
      windowCard.appendChild(windowHeader);
      windowCard.appendChild(list);

      this.container.appendChild(windowCard);
    }
  }
}

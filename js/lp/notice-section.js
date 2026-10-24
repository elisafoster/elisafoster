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

    // 日時文字列の安全パースヘルパー (例: "2026-10-12 12:00" -> Date)
    const parseNoticeDate = (dateStr) => {
      if (!dateStr || typeof dateStr !== "string") return null;
      const s = dateStr.trim().replace(/-/g, "/").replace("T", " ");
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    };

    // 表示基準日（予約投稿なら scheduled_at、それ以外は created_at）を取得
    this.getNoticeDisplayDate = (n) => {
      if ((n.status || "").toLowerCase() === "scheduled" && n.scheduled_at) {
        return n.scheduled_at;
      }
      return n.created_at || n.scheduled_at || "";
    };

    // 日付ラベル文字列 (YYYY.MM.DD 形式) の生成
    this.formatNoticeDateLabel = (dateStr) => {
      if (!dateStr) return "";
      const s = String(dateStr).trim().slice(0, 10);
      return s.replace(/[-\/]/g, ".");
    };

    const now = new Date();

    // フィルタリング & ソート:
    // 1. draft (下書き) は非表示
    // 2. scheduled (予約) は scheduled_at の時刻を経過したら表示
    // 3. published (公開) または未設定は常に表示
    // 4. ソート順は表示日（予約なら scheduled_at、通常なら created_at）の新しい順（降順）
    this.notices = (Array.isArray(noticeList) ? noticeList : [])
      .filter((n) => {
        if (!n) return false;
        const status = (n.status || "published").toLowerCase();
        if (status === "draft") return false;

        if (status === "scheduled") {
          if (!n.scheduled_at) return false;
          const targetTime = parseNoticeDate(n.scheduled_at);
          if (!targetTime) return false;
          return targetTime.getTime() <= now.getTime();
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = parseNoticeDate(this.getNoticeDisplayDate(a))?.getTime() || 0;
        const timeB = parseNoticeDate(this.getNoticeDisplayDate(b))?.getTime() || 0;
        return timeB - timeA;
      });
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

      // 日付: 予約投稿は scheduled_at の日にち、それ以外は created_at の日にち
      const meta = document.createElement("div");
      meta.className = "lp-notice-meta";

      const dateSpan = document.createElement("span");
      dateSpan.className = "lp-notice-date";
      const dt = this.formatNoticeDateLabel(this.getNoticeDisplayDate(notice));
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

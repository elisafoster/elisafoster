/**
 * Schedule Section Component
 * schedule & scheduleTag テーブルのデータ描画
 * 3系統横スクロール対応
 */

import { api } from "../common/api-client.js";
import { HorizontalScroll } from "../common/horizontal-scroll.js";
import { Modal } from "../common/modal.js";

export class ScheduleSection {
  constructor(container, scheduleList, tagList) {
    this.container = container;
    this.schedules = (Array.isArray(scheduleList) ? scheduleList : [])
      .filter((s) => s.is_active === 1 || s.is_active === true || s.is_active === undefined);
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.selectedTagId = "ALL";
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    // 1. タグフィルタボタン群
    if (this.tags.length > 0) {
      const tagBar = document.createElement("div");
      tagBar.className = "lp-schedule-tags";

      const allBtn = document.createElement("button");
      allBtn.className = `lp-schedule-tag-btn ${this.selectedTagId === "ALL" ? "is-active" : ""}`;
      allBtn.textContent = "すべて";
      allBtn.onclick = () => {
        this.selectedTagId = "ALL";
        this.render();
      };
      tagBar.appendChild(allBtn);

      this.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.className = `lp-schedule-tag-btn ${this.selectedTagId === String(tag.id) ? "is-active" : ""}`;
        btn.textContent = tag.tagName;
        btn.onclick = () => {
          this.selectedTagId = String(tag.id);
          this.render();
        };
        tagBar.appendChild(btn);
      });

      this.container.appendChild(tagBar);
    }

    // 2. フィルタリング後のスケジュール
    const filtered = this.selectedTagId === "ALL"
      ? this.schedules
      : this.schedules.filter((s) => String(s.scheduleTag_id) === this.selectedTagId);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.style.textAlign = "center";
      empty.style.color = "#94a3b8";
      empty.textContent = "該当するスケジュールはありません";
      this.container.appendChild(empty);
      return;
    }

    // 3. 横スクロールラッパー & トラック
    const hscrollWrapper = document.createElement("div");
    hscrollWrapper.className = "app-hscroll-wrapper";

    const prevArrow = document.createElement("button");
    prevArrow.className = "app-hscroll-arrow is-left";
    prevArrow.innerHTML = "&lsaquo;";
    prevArrow.setAttribute("aria-label", "前へスクロール");

    const nextArrow = document.createElement("button");
    nextArrow.className = "app-hscroll-arrow is-right";
    nextArrow.innerHTML = "&rsaquo;";
    nextArrow.setAttribute("aria-label", "次へスクロール");

    const track = document.createElement("div");
    track.className = "app-hscroll-track";

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "lp-schedule-card";

      // サムネイル画像
      if (item.Image) {
        const img = document.createElement("img");
        img.className = "lp-schedule-thumb";
        img.src = api.resolveAssetUrl(item.Image, "schedule");
        img.alt = item.title || "スケジュール画像";
        img.loading = "lazy";
        img.onclick = () => Modal.openImage(img.src, item.title);
        card.appendChild(img);
      }

      const content = document.createElement("div");
      content.className = "lp-schedule-content";

      // 日時 & タグ
      const header = document.createElement("div");
      header.className = "lp-schedule-header";

      const dt = document.createElement("span");
      dt.className = "lp-schedule-datetime";
      const timePart = item.time ? ` ${item.time}` : "";
      dt.textContent = `${item.schedule_at || ""}${timePart}`;
      header.appendChild(dt);

      const tagObj = this.tags.find((t) => String(t.id) === String(item.scheduleTag_id));
      if (tagObj) {
        const tagBadge = document.createElement("span");
        tagBadge.className = "app-badge app-badge-primary";
        tagBadge.textContent = tagObj.tagName;
        header.appendChild(tagBadge);
      }
      content.appendChild(header);

      // タイトル
      const title = document.createElement("h4");
      title.className = "lp-schedule-title";
      title.textContent = item.title;
      content.appendChild(title);

      // 詳細
      if (item.detail) {
        const detail = document.createElement("div");
        detail.className = "lp-schedule-detail";
        detail.textContent = item.detail;
        content.appendChild(detail);
      }

      // リンク
      if (item.link) {
        const linkBtn = document.createElement("a");
        linkBtn.className = "app-btn app-btn-primary lp-schedule-link-btn";
        linkBtn.href = item.link;
        linkBtn.target = "_blank";
        linkBtn.rel = "noopener noreferrer";
        linkBtn.textContent = "配信・詳細を見る";
        content.appendChild(linkBtn);
      }

      card.appendChild(content);
      track.appendChild(card);
    });

    hscrollWrapper.appendChild(prevArrow);
    hscrollWrapper.appendChild(track);
    hscrollWrapper.appendChild(nextArrow);

    this.container.appendChild(hscrollWrapper);

    // 3系統スクロールをバインド
    HorizontalScroll.attach(track, { prevBtn: prevArrow, nextBtn: nextArrow });
  }
}


/**
 * Event Section Component
 * event テーブルのバナー画像・リンク・期間を描画
 */

import { api } from "../common/api-client.js";

export class EventSection {
  constructor(container, eventList) {
    this.container = container;
    this.events = Array.isArray(eventList) ? eventList : [];
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.events.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; color:#94a3b8;">現在開催中のイベントはありません</p>';
      return;
    }

    const eventContainer = document.createElement("div");
    eventContainer.className = "lp-event-container";

    this.events.forEach((ev) => {
      const card = document.createElement("div");
      card.className = "lp-event-card";

      const linkWrapper = document.createElement(ev.link ? "a" : "div");
      linkWrapper.className = "lp-event-banner-link";
      if (ev.link) {
        linkWrapper.href = ev.link;
        linkWrapper.target = "_blank";
        linkWrapper.rel = "noopener noreferrer";
      }

      const img = document.createElement("img");
      img.className = "lp-event-banner-img";
      img.src = api.resolveAssetUrl(ev.banner, "event");
      img.alt = "イベントバナー";
      linkWrapper.appendChild(img);
      card.appendChild(linkWrapper);

      // メタ情報（開始・終了日時）
      const meta = document.createElement("div");
      meta.className = "lp-event-meta";

      const dates = document.createElement("div");
      dates.className = "lp-event-dates";
      const startText = ev.start_at ? ev.start_at.slice(0, 10) : "";
      const endText = ev.end_at ? ev.end_at.slice(0, 10) : "";
      dates.textContent = `期間: ${startText} 〜 ${endText}`;

      const badge = document.createElement("span");
      badge.className = "lp-event-status-badge is-active";
      badge.textContent = "開催中 / 告知中";

      meta.appendChild(dates);
      meta.appendChild(badge);
      card.appendChild(meta);

      eventContainer.appendChild(card);
    });

    this.container.appendChild(eventContainer);
  }
}


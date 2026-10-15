/**
 * Schedule Section Component
 * schedule & scheduleTag テーブルのデータ描画
 * - カレンダー週次ナビゲーション (前の週 / 今週 / 次の週)
 * - 曜日タブ (月〜日の7日間、件数バッジ付き)
 * - 選択された日のスケジュール一覧
 * - スケジュールカードは日時、タイトル、タグのみ表示し、タップで詳細ダイアログを開く
 * - カラー設計:
 *   - 全体枠カード: themeConfig の設定値 (--theme-card-bg, --theme-card-text-color)
 *   - スケジュール内容カード & 詳細ダイアログ: themeConfig.sub_bg_color (--theme-sub-bg)
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class ScheduleSection {
  constructor(container, scheduleList, tagList) {
    this.container = container;
    this.schedules = (Array.isArray(scheduleList) ? scheduleList : []).filter(
      (s) => s.is_active === 1 || s.is_active === true || s.is_active === undefined
    );
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.selectedTagId = "ALL";

    // 基準週の月曜日 (00:00:00)
    this.currentMonday = this.computeInitialMonday();

    // 選択された日付キー (YYYY-MM-DD)
    this.selectedDateKey = this.computeInitialSelectedDateKey();
  }

  // Date -> "YYYY-MM-DD"
  formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // "YYYY-MM-DD" -> Date
  parseDateKey(str) {
    if (!str) return new Date();
    const parts = String(str).split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0])) return new Date();
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  // 任意のDateからその週の月曜日(00:00:00)を算出
  getMondayOfWeek(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0(日) 〜 6(土)
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  // 表示開始週の月曜日を計算
  computeInitialMonday() {
    const today = new Date();
    const todayMonday = this.getMondayOfWeek(today);

    if (this.schedules.length === 0) return todayMonday;

    const validDates = this.schedules
      .filter((s) => s.schedule_at)
      .map((s) => s.schedule_at)
      .sort();

    if (validDates.length === 0) return todayMonday;

    const todayStr = this.formatDateKey(today);
    // 今日以降の最も直近の予定がある週
    const upcoming = validDates.find((d) => d >= todayStr);
    if (upcoming) {
      return this.getMondayOfWeek(this.parseDateKey(upcoming));
    }

    // 今日以降がなければ最後の予定の週
    const lastDate = validDates[validDates.length - 1];
    return this.getMondayOfWeek(this.parseDateKey(lastDate));
  }

  // 初期選択日キーを計算
  computeInitialSelectedDateKey() {
    const weekDates = this.getWeekDates(this.currentMonday);
    const todayStr = this.formatDateKey(new Date());

    // その週に今日が含まれていれば今日を選択
    if (weekDates.some((d) => this.formatDateKey(d) === todayStr)) {
      return todayStr;
    }

    // その週の中で予定がある最初の日、なければ月曜日
    const dateKeys = weekDates.map((d) => this.formatDateKey(d));
    const hasEventDate = dateKeys.find((k) =>
      this.schedules.some((s) => s.schedule_at === k)
    );

    return hasEventDate || dateKeys[0];
  }

  // 月曜日から始まる7日分の Date 配列を返す
  getWeekDates(monday) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    }
    return dates;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const mainWrap = document.createElement("div");
    mainWrap.className = "lp-schedule-container";

    // 1. タグフィルターボタン群
    const tagBar = this.createTagFilter();
    if (tagBar) mainWrap.appendChild(tagBar);

    // 2. カレンダー・スケジュール構造ボックス
    const scheduleBox = document.createElement("div");
    scheduleBox.className = "lp-schedule-box";

    // 上段: 週ナビゲーションバー
    scheduleBox.appendChild(this.createWeekNavBar());

    // 中段: 曜日タブ (7日間)
    scheduleBox.appendChild(this.createWeekTabs());

    // 下段: 選択された日のスケジュール一覧カード
    scheduleBox.appendChild(this.createDaySchedulePanel());

    mainWrap.appendChild(scheduleBox);
    this.container.appendChild(mainWrap);
  }

  /**
   * 1. タグフィルターボタン群
   */
  createTagFilter() {
    if (this.tags.length === 0) return null;

    const tagBar = document.createElement("div");
    tagBar.className = "lp-schedule-tags";

    // すべて
    const allBtn = document.createElement("button");
    allBtn.className = `lp-schedule-tag-btn ${this.selectedTagId === "ALL" ? "is-active" : ""}`;
    allBtn.type = "button";
    allBtn.textContent = "すべて";
    allBtn.onclick = () => {
      if (this.selectedTagId === "ALL") return;
      this.selectedTagId = "ALL";
      this.render();
    };
    tagBar.appendChild(allBtn);

    // 各タグ
    this.tags.forEach((tag) => {
      const btn = document.createElement("button");
      btn.className = `lp-schedule-tag-btn ${this.selectedTagId === String(tag.id) ? "is-active" : ""}`;
      btn.type = "button";
      btn.textContent = tag.tagName;
      btn.onclick = () => {
        if (this.selectedTagId === String(tag.id)) return;
        this.selectedTagId = String(tag.id);
        this.render();
      };
      tagBar.appendChild(btn);
    });

    return tagBar;
  }

  /**
   * 2. 週ナビゲーションバー
   * [ ‹ 前の週 ] [ 今週 ] [ 次の週 › ]     📅 2026年9月21日(月) 〜 9月27日(日)
   */
  createWeekNavBar() {
    const navBar = document.createElement("div");
    navBar.className = "lp-schedule-nav-bar";

    // 左側: 操作ボタン群
    const btnGroup = document.createElement("div");
    btnGroup.className = "lp-schedule-nav-btns";

    // 前の週
    const prevBtn = document.createElement("button");
    prevBtn.className = "lp-schedule-nav-btn";
    prevBtn.type = "button";
    prevBtn.innerHTML = `&lsaquo; 前の週`;
    prevBtn.onclick = () => {
      const nextM = new Date(this.currentMonday);
      nextM.setDate(nextM.getDate() - 7);
      this.currentMonday = nextM;
      this.selectedDateKey = this.computeInitialSelectedDateKey();
      this.render();
    };
    btnGroup.appendChild(prevBtn);

    // 今週
    const todayMonday = this.getMondayOfWeek(new Date());
    const isCurrentWeek = this.formatDateKey(this.currentMonday) === this.formatDateKey(todayMonday);

    const currentBtn = document.createElement("button");
    currentBtn.className = `lp-schedule-nav-btn lp-nav-today-btn ${isCurrentWeek ? "is-active" : ""}`;
    currentBtn.type = "button";
    currentBtn.textContent = "今週";
    currentBtn.onclick = () => {
      this.currentMonday = todayMonday;
      this.selectedDateKey = this.formatDateKey(new Date());
      this.render();
    };
    btnGroup.appendChild(currentBtn);

    // 次の週
    const nextBtn = document.createElement("button");
    nextBtn.className = "lp-schedule-nav-btn";
    nextBtn.type = "button";
    nextBtn.innerHTML = `次の週 &rsaquo;`;
    nextBtn.onclick = () => {
      const nextM = new Date(this.currentMonday);
      nextM.setDate(nextM.getDate() + 7);
      this.currentMonday = nextM;
      this.selectedDateKey = this.computeInitialSelectedDateKey();
      this.render();
    };
    btnGroup.appendChild(nextBtn);

    navBar.appendChild(btnGroup);

    // 右側: 期間テキスト
    const rangeText = document.createElement("div");
    rangeText.className = "lp-schedule-week-range";

    const weekDates = this.getWeekDates(this.currentMonday);
    const startD = weekDates[0];
    const endD = weekDates[6];

    const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
    const startStr = `${startD.getFullYear()}年${startD.getMonth() + 1}月${startD.getDate()}日(${dayLabels[startD.getDay()]})`;
    const endStr = startD.getFullYear() === endD.getFullYear()
      ? `${endD.getMonth() + 1}月${endD.getDate()}日(${dayLabels[endD.getDay()]})`
      : `${endD.getFullYear()}年${endD.getMonth() + 1}月${endD.getDate()}日(${dayLabels[endD.getDay()]})`;

    rangeText.innerHTML = `
      <svg class="lp-schedule-cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
      <span>${startStr} 〜 ${endStr}</span>
    `;

    navBar.appendChild(rangeText);
    return navBar;
  }

  /**
   * 3. 曜日タブ (7日間)
   */
  createWeekTabs() {
    const tabsContainer = document.createElement("div");
    tabsContainer.className = "lp-schedule-week-tabs";

    const weekDates = this.getWeekDates(this.currentMonday);
    const dayNames = ["月", "火", "水", "木", "金", "土", "日"];

    weekDates.forEach((date, idx) => {
      const dateKey = this.formatDateKey(date);
      const isSelected = this.selectedDateKey === dateKey;

      // この日の予定件数 (現在のタグフィルタを考慮)
      const daySchedules = this.getFilteredSchedulesForDate(dateKey);
      const count = daySchedules.length;

      const tab = document.createElement("button");
      tab.className = `lp-schedule-day-tab ${isSelected ? "is-active" : ""} ${idx === 5 ? "is-sat" : ""} ${idx === 6 ? "is-sun" : ""}`;
      tab.type = "button";
      tab.setAttribute("aria-selected", isSelected ? "true" : "false");

      // 曜日
      const nameEl = document.createElement("span");
      nameEl.className = "lp-schedule-day-name";
      nameEl.textContent = dayNames[idx];
      tab.appendChild(nameEl);

      // 日付の数字
      const numEl = document.createElement("span");
      numEl.className = "lp-schedule-day-number";
      numEl.textContent = String(date.getDate());
      tab.appendChild(numEl);

      // 件数表示
      const badgeEl = document.createElement("span");
      badgeEl.className = `lp-schedule-day-badge ${count > 0 ? "has-events" : ""}`;
      badgeEl.textContent = count > 0 ? `● ${count}件` : "・";
      tab.appendChild(badgeEl);

      tab.onclick = () => {
        if (this.selectedDateKey === dateKey) return;
        this.selectedDateKey = dateKey;
        this.render();
      };

      tabsContainer.appendChild(tab);
    });

    return tabsContainer;
  }

  /**
   * 4. 選択された日のスケジュール一覧カード
   */
  createDaySchedulePanel() {
    const panel = document.createElement("div");
    panel.className = "lp-schedule-day-panel";

    // 選択日情報ヘッダー
    const selectedDate = this.parseDateKey(this.selectedDateKey);
    const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
    const dayOfWeek = dayLabels[selectedDate.getDay()];
    const dateFormatted = `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日 (${dayOfWeek})`;

    const daySchedules = this.getFilteredSchedulesForDate(this.selectedDateKey);
    const count = daySchedules.length;

    const panelHeader = document.createElement("div");
    panelHeader.className = "lp-schedule-panel-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "lp-schedule-panel-header-left";
    headerLeft.innerHTML = `
      <span class="lp-schedule-panel-bar"></span>
      <h3 class="lp-schedule-panel-title">${dateFormatted} <span class="lp-schedule-panel-subtitle">の予定</span></h3>
    `;

    const countBadge = document.createElement("span");
    countBadge.className = "lp-schedule-panel-count";
    countBadge.textContent = `${count}件`;

    panelHeader.appendChild(headerLeft);
    panelHeader.appendChild(countBadge);
    panel.appendChild(panelHeader);

    // スケジュールカード一覧
    const listContainer = document.createElement("div");
    listContainer.className = "lp-schedule-item-list";

    if (count === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "lp-schedule-empty-msg";
      emptyMsg.textContent = "この日の予定はありません";
      listContainer.appendChild(emptyMsg);
    } else {
      // 時間順にソート (time昇順)
      const sorted = [...daySchedules].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

      sorted.forEach((item) => {
        const itemCard = this.createScheduleItemCard(item);
        listContainer.appendChild(itemCard);
      });
    }

    panel.appendChild(listContainer);
    return panel;
  }

  /**
   * スケジュールカード生成
   * - 日時、タイトル、タグのみ表示
   * - 背景色: themeConfig.sub_bg_color
   * - タップで詳細ダイアログを表示
   */
  createScheduleItemCard(item) {
    const card = document.createElement("div");
    card.className = "lp-schedule-item-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${item.title || "スケジュール"}の詳細を見る`);

    // 上段: 日時 & タグ
    const topRow = document.createElement("div");
    topRow.className = "lp-schedule-card-top";

    const timeStr = item.time ? `${item.time}〜` : "時間未定";
    const dateStr = item.schedule_at || "";
    const dtText = document.createElement("span");
    dtText.className = "lp-schedule-card-time";
    dtText.textContent = `${dateStr} ${timeStr}`;
    topRow.appendChild(dtText);

    const tagObj = this.tags.find((t) => String(t.id) === String(item.scheduleTag_id));
    if (tagObj) {
      const tagBadge = document.createElement("span");
      tagBadge.className = "lp-schedule-card-tag";
      tagBadge.textContent = tagObj.tagName;
      topRow.appendChild(tagBadge);
    }

    card.appendChild(topRow);

    // 中段: タイトル
    const titleEl = document.createElement("h4");
    titleEl.className = "lp-schedule-card-title";
    titleEl.textContent = item.title || "無題のイベント";
    card.appendChild(titleEl);

    // 下段: 詳細を見る
    const moreEl = document.createElement("div");
    moreEl.className = "lp-schedule-card-more";
    moreEl.innerHTML = `<span>詳細を見る</span> <span class="lp-schedule-arrow">&rsaquo;</span>`;
    card.appendChild(moreEl);

    // クリック / キーボードEnterで詳細ダイアログを開く
    card.onclick = () => this.openDetailModal(item);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openDetailModal(item);
      }
    };

    return card;
  }

  /**
   * スケジュール詳細ダイアログを開く
   * - 日時やタイトル含む詳細内容、添付画像、リンクを表示
   * - 背景色: themeConfig.sub_bg_color
   */
  openDetailModal(item) {
    const modalContent = document.createElement("div");
    modalContent.className = "lp-schedule-modal-content";

    // 1. 添付画像 (あれば上部に表示)
    if (item.Image) {
      const imgUrl = api.resolveAssetUrl(item.Image, "schedule");
      const imgWrap = document.createElement("div");
      imgWrap.className = "lp-schedule-modal-img-wrap";

      const img = document.createElement("img");
      img.className = "lp-schedule-modal-img";
      img.src = imgUrl;
      img.alt = item.title || "スケジュール画像";
      img.loading = "lazy";
      img.onclick = () => Modal.openImage(imgUrl, item.title);

      imgWrap.appendChild(img);
      modalContent.appendChild(imgWrap);
    }

    // 2. メタ情報 (日時 & タグ)
    const metaRow = document.createElement("div");
    metaRow.className = "lp-schedule-modal-meta";

    const timeStr = item.time ? `${item.time}〜` : "時間未定";
    const dtEl = document.createElement("span");
    dtEl.className = "lp-schedule-modal-datetime";
    dtEl.innerHTML = `📅 ${item.schedule_at || ""} ${timeStr}`;
    metaRow.appendChild(dtEl);

    const tagObj = this.tags.find((t) => String(t.id) === String(item.scheduleTag_id));
    if (tagObj) {
      const tagBadge = document.createElement("span");
      tagBadge.className = "lp-schedule-card-tag";
      tagBadge.textContent = tagObj.tagName;
      metaRow.appendChild(tagBadge);
    }
    modalContent.appendChild(metaRow);

    // 3. タイトル
    const titleEl = document.createElement("h3");
    titleEl.className = "lp-schedule-modal-title";
    titleEl.textContent = item.title || "無題のイベント";
    modalContent.appendChild(titleEl);

    // 4. 詳細説明テキスト
    if (item.detail) {
      const detailEl = document.createElement("div");
      detailEl.className = "lp-schedule-modal-detail";
      detailEl.textContent = item.detail;
      modalContent.appendChild(detailEl);
    }

    // 5. 外部リンク
    if (item.link) {
      const linkWrap = document.createElement("div");
      linkWrap.className = "lp-schedule-modal-link-wrap";

      const linkBtn = document.createElement("a");
      linkBtn.className = "lp-schedule-modal-link-btn";
      linkBtn.href = item.link;
      linkBtn.target = "_blank";
      linkBtn.rel = "noopener noreferrer";
      linkBtn.innerHTML = `
        <span>配信・詳細ページを開く</span>
        <svg class="lp-schedule-ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      `;
      linkWrap.appendChild(linkBtn);
      modalContent.appendChild(linkWrap);
    }

    Modal.open({
      title: "スケジュール詳細",
      content: modalContent,
      isLarge: false
    });
  }

  // 指定日のスケジュールリスト (タグフィルタ適用後) を取得
  getFilteredSchedulesForDate(dateKey) {
    return this.schedules.filter((s) => {
      if (s.schedule_at !== dateKey) return false;
      if (this.selectedTagId === "ALL") return true;
      return String(s.scheduleTag_id) === this.selectedTagId;
    });
  }
}

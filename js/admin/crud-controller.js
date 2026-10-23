/**
 * Admin CRUD Controller
 * 各テーブルの一覧・編集・新規作成・削除ロジック
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";
import { Toast } from "../common/toast.js";
import { RichTextEditor } from "./richtext-editor.js";
import { escapeHtml } from "../common/utils.js";

/**
 * 一体型ドラムロールピッカークラス (iOS風 Wheel Date Picker)
 */
class DrumRollPicker {
  constructor({ container, columns, initialValues = {}, onChange }) {
    this.container = container;
    this.columnsConfig = columns; // [{ key, items: [{ value, label }] }, ...]
    this.onChange = onChange;
    this.values = { ...initialValues };
    this.colElements = {};
    this.itemHeight = 40;
    this.render();
  }

  render() {
    this.container.innerHTML = "";
    this.container.className = "drum-picker-wrapper";

    const highlight = document.createElement("div");
    highlight.className = "drum-picker-highlight";
    this.container.appendChild(highlight);

    const mask = document.createElement("div");
    mask.className = "drum-picker-mask";
    this.container.appendChild(mask);

    const colsWrap = document.createElement("div");
    colsWrap.className = "drum-picker-columns";

    this.columnsConfig.forEach((colCfg) => {
      const colEl = document.createElement("div");
      colEl.className = "drum-picker-col";
      colEl.dataset.key = colCfg.key;
      this.colElements[colCfg.key] = colEl;

      this.populateColumn(colCfg.key, colCfg.items, this.values[colCfg.key]);
      this.attachEvents(colEl, colCfg.key);

      colsWrap.appendChild(colEl);
    });

    this.container.appendChild(colsWrap);

    // 初期スクロール位置を反映
    requestAnimationFrame(() => {
      this.columnsConfig.forEach((colCfg) => {
        this.scrollToValue(colCfg.key, this.values[colCfg.key], false);
      });
    });
  }

  populateColumn(key, items, selectedValue) {
    const colEl = this.colElements[key];
    if (!colEl) return;
    colEl.innerHTML = "";

    const topSpacer = document.createElement("div");
    topSpacer.className = "drum-picker-spacer";
    colEl.appendChild(topSpacer);

    items.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = "drum-picker-item";
      itemEl.dataset.value = item.value;
      itemEl.textContent = item.label;
      if (item.value === selectedValue) {
        itemEl.classList.add("is-selected");
      }
      itemEl.addEventListener("click", () => {
        this.scrollToValue(key, item.value, true);
      });
      colEl.appendChild(itemEl);
    });

    const bottomSpacer = document.createElement("div");
    bottomSpacer.className = "drum-picker-spacer";
    colEl.appendChild(bottomSpacer);
  }

  attachEvents(colEl, key) {
    let scrollTimeout = null;

    const handleScroll = () => {
      const scrollTop = colEl.scrollTop;
      const index = Math.round(scrollTop / this.itemHeight);
      const items = colEl.querySelectorAll(".drum-picker-item");

      items.forEach((it, idx) => {
        if (idx === index) {
          it.classList.add("is-selected");
        } else {
          it.classList.remove("is-selected");
        }
      });

      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const activeItem = items[index];
        if (activeItem) {
          const newVal = activeItem.dataset.value;
          if (this.values[key] !== newVal) {
            this.values[key] = newVal;
            if (this.onChange) this.onChange(key, newVal, this.values);
          }
        }
      }, 60);
    };

    colEl.addEventListener("scroll", handleScroll, { passive: true });

    // マウスホイールによるスクロール制御 (1ノッチにつき1項目ずつ移動)
    let isWheeling = false;
    colEl.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (Math.abs(e.deltaY) < 1) return;
        if (isWheeling) return;
        isWheeling = true;

        const items = colEl.querySelectorAll(".drum-picker-item");
        const maxIdx = items.length - 1;
        const currentIdx = Math.round(colEl.scrollTop / this.itemHeight);
        const dir = e.deltaY > 0 ? 1 : -1;
        const nextIdx = Math.max(0, Math.min(maxIdx, currentIdx + dir));

        if (nextIdx !== currentIdx) {
          colEl.scrollTo({
            top: nextIdx * this.itemHeight,
            behavior: "smooth",
          });
        }

        setTimeout(() => {
          isWheeling = false;
        }, 80);
      },
      { passive: false }
    );

    // PCマウスドラッグ対応
    let isDown = false;
    let startY = 0;
    let initialScroll = 0;

    colEl.addEventListener("mousedown", (e) => {
      isDown = true;
      startY = e.pageY;
      initialScroll = colEl.scrollTop;
    });

    const onMouseUp = () => { isDown = false; };
    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const deltaY = e.pageY - startY;
      colEl.scrollTop = initialScroll - deltaY;
    };

    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
  }

  scrollToValue(key, val, smooth = true) {
    const colEl = this.colElements[key];
    if (!colEl) return;
    const items = Array.from(colEl.querySelectorAll(".drum-picker-item"));
    let targetIdx = items.findIndex((it) => it.dataset.value === String(val));
    if (targetIdx === -1) targetIdx = 0;

    const targetTop = targetIdx * this.itemHeight;
    if (smooth) {
      colEl.scrollTo({ top: targetTop, behavior: "smooth" });
    } else {
      colEl.scrollTop = targetTop;
    }

    items.forEach((it, idx) => {
      if (idx === targetIdx) it.classList.add("is-selected");
      else it.classList.remove("is-selected");
    });
    this.values[key] = items[targetIdx]?.dataset.value || "";
  }

  getValue(key) {
    return this.values[key];
  }

  updateColumnItems(key, newItems, preserveValue = true) {
    const currentVal = this.values[key];
    let selectedVal = preserveValue ? currentVal : newItems[0]?.value;
    const exists = newItems.some((it) => it.value === selectedVal);
    if (!exists) {
      selectedVal = newItems[newItems.length - 1]?.value || "";
    }
    this.values[key] = selectedVal;
    this.populateColumn(key, newItems, selectedVal);
    this.scrollToValue(key, selectedVal, false);
  }
}

export class CrudController {
  constructor(contentArea) {
    this.container = contentArea;
    this.currentTab = "profile";

    // 立ち絵・衣装 (visual) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.visualState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };

    // イベントバナー (event) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.eventState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };

    // お知らせ (notice) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.noticeState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };
    this.noticeLibraryCache = null;

    // スケジュール (schedule) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.scheduleState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };
    this.scheduleLibraryCache = null;

    // ギャラリー (gallery) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.galleryState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };
    this.galleryLibraryCache = null;

    // 動画リスト (movie) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.movieState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };
    // 動画リスト (movie) 専用ライブラリキャッシュ
    this.movieLibraryCache = null;

    // ショップグッズ (shop) 専用のドラフト状態（更新反映ボタンを押すまでD1に保存しない）
    this.shopState = {
      isInitialized: false,
      originalRecords: [],
      currentRecords: [],
      hasPendingChanges: false,
    };
    // ショップグッズ (shop) 専用ライブラリキャッシュ
    this.shopLibraryCache = null;

    // 誤った離脱防止
    window.addEventListener("beforeunload", (e) => {
      if (
        this.visualState?.hasPendingChanges ||
        this.eventState?.hasPendingChanges ||
        this.noticeState?.hasPendingChanges ||
        this.scheduleState?.hasPendingChanges ||
        this.galleryState?.hasPendingChanges ||
        this.movieState?.hasPendingChanges ||
        this.shopState?.hasPendingChanges
      ) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  async loadTab(tabKey) {
    // 立ち絵・衣装一覧で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "visual" && tabKey !== "visual" && this.visualState?.hasPendingChanges) {
      const ok = confirm(
        "立ち絵・衣装一覧に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.visualState.hasPendingChanges = false;
      this.visualState.isInitialized = false;
    }

    // イベントバナー管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "event" && tabKey !== "event" && this.eventState?.hasPendingChanges) {
      const ok = confirm(
        "イベントバナー管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.eventState.hasPendingChanges = false;
      this.eventState.isInitialized = false;
    }

    // お知らせ管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "notice" && tabKey !== "notice" && this.noticeState?.hasPendingChanges) {
      const ok = confirm(
        "お知らせ管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.noticeState.hasPendingChanges = false;
      this.noticeState.isInitialized = false;
    }

    // スケジュール管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "schedule" && tabKey !== "schedule" && this.scheduleState?.hasPendingChanges) {
      const ok = confirm(
        "スケジュール管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.scheduleState.hasPendingChanges = false;
      this.scheduleState.isInitialized = false;
    }

    // ギャラリー管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "gallery" && tabKey !== "gallery" && this.galleryState?.hasPendingChanges) {
      const ok = confirm(
        "ギャラリー管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.galleryState.hasPendingChanges = false;
      this.galleryState.isInitialized = false;
    }

    // 動画リスト管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "movie" && tabKey !== "movie" && this.movieState?.hasPendingChanges) {
      const ok = confirm(
        "動画リスト管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.movieState.hasPendingChanges = false;
      this.movieState.isInitialized = false;
    }

    // ショップグッズ管理で未反映の変更がある状態で他タブへ移動しようとした場合
    if (this.currentTab === "shop" && tabKey !== "shop" && this.shopState?.hasPendingChanges) {
      const ok = confirm(
        "ショップグッズ管理に未反映の変更（未保存）があります。\n保存（更新反映）せずに移動すると変更が破棄されますが、よろしいですか？"
      );
      if (!ok) return;
      this.shopState.hasPendingChanges = false;
      this.shopState.isInitialized = false;
    }

    this.currentTab = tabKey;
    if (!this.container) return;

    this.container.innerHTML = '<div style="text-align:center; padding: 40px;"><span class="app-spinner app-spinner-lg"></span></div>';

    try {
      switch (tabKey) {
        case "profile":
          await this.renderProfileTab();
          break;
        case "visual":
          await this.renderTableListTab(
            "visual",
            "立ち絵・衣装一覧",
            [
              { key: "actions", label: "操作", isAction: true },
              { key: "id", label: "id" },
              { key: "costumeName", label: "衣装名" },
              { key: "visual", label: "立ち絵", type: "image", category: "visual/standing" },
              { key: "defoemed", label: "SD", type: "image", category: "visual/deformed", fallbackKey: "deformed" },
              { key: "thumbnail", label: "サムネイル", type: "image", category: "visual/thumbnail", fallbackKey: "costumeThumbnail" },
              { key: "visualBackground", label: "衣装背景", type: "image", category: "visual/background" },
              { key: "priority", label: "表示順" },
            ],
            {
              hideDesc: true,
              showCountBadge: true,
              verticalActions: true,
            }
          );
          break;
        case "event":
          await this.renderTableListTab(
            "event",
            "イベントバナー管理",
            [
              { key: "actions", label: "操作", isAction: true },
              { key: "id", label: "id" },
              { key: "banner", label: "バナー画像", type: "image", category: "event", isBanner: true },
              { key: "link", label: "リンク", isLink: true },
              { key: "start_at", label: "開始日時", type: "datetime" },
              { key: "end_at", label: "終了日時", type: "datetime" },
            ],
            {
              hideDesc: true,
              showCountBadge: true,
              verticalActions: true,
            }
          );
          break;
        case "notice":
          await this.renderTableListTab(
            "notice",
            "お知らせ管理",
            [
              { key: "actions", label: "操作", isAction: true },
              { key: "id", label: "id" },
              {
                key: "notice_time",
                label: "送信時刻 / 予約投稿時刻",
                labelHtml: '<div class="admin-th-tworow"><span>送信時刻</span><span class="admin-th-sub">予約投稿時刻</span></div>',
                type: "notice_time",
              },
              { key: "status", label: "ステータス", type: "status" },
              { key: "message", label: "お知らせ本文", type: "message" },
              { key: "Image", label: "画像", type: "image", category: "notice" },
            ],
            {
              hideDesc: true,
              showCountBadge: true,
              verticalActions: true,
            }
          );
          break;
        case "schedule":
          await this.renderScheduleTab();
          break;
        case "gallery":
          await this.renderTableListTab(
            "gallery",
            "ギャラリー管理",
            [
              { key: "actions", label: "操作", isAction: true },
              { key: "id", label: "id" },
              { key: "name", label: "画像名" },
              { key: "image", label: "画像", type: "image", category: "gallery", isGallery: true },
            ],
            {
              hideDesc: true,
              showCountBadge: true,
              verticalActions: true,
            }
          );
          break;
        case "movie":
          await this.renderMovieTab();
          break;
        case "shop":
          await this.renderShopTab();
          break;
        case "linkList":
          await this.renderTableListTab(
            "linkList",
            "リンクリスト管理",
            [
              { key: "actions", label: "操作", isAction: true, style: { width: "80px", textAlign: "center" } },
              { key: "id", label: "id", style: { width: "60px", textAlign: "center" } },
              { key: "title", label: "ボタンテキスト", style: { minWidth: "160px" } },
              { key: "buttonTextColor", label: "文字色", type: "color", style: { width: "140px", textAlign: "center" } },
              { key: "link", label: "リンク", isLink: true, style: { minWidth: "220px" } },
              { key: "buttonImage", label: "ボタン画像", type: "image", category: "link", isButtonBanner: true, style: { width: "140px", textAlign: "center" } },
              { key: "priority", label: "表示順", style: { width: "80px", textAlign: "center" } },
            ],
            {
              hideDesc: true,
              showCountBadge: true,
              verticalActions: true,
            }
          );
          break;
        case "themeConfig":
          await this.renderThemeConfigTab();
          break;
        case "section":
          await this.renderTableListTab("section", "セクション設定管理", ["id", "item", "headerName", "sectionName", "sectionType", "isFeatured", "priority"]);
          break;
        case "whitelist":
          await this.renderTableListTab("whitelist", "アカウントwhitelist管理", ["id", "name", "mail", "role"]);
          break;
        case "githubPAT":
          await this.renderGithubPatTab();
          break;
        case "guideline":
          await this.renderGuidelineTab();
          break;
        default:
          this.container.innerHTML = `<p>未定義のタブ: ${tabKey}</p>`;
          break;
      }
    } catch (err) {
      console.error(`[Load Tab Error ${tabKey}]:`, err);
      this.container.innerHTML = `<div class="admin-card" style="padding: 24px; color: var(--color-danger);">データ読み込みエラー: ${err.message}</div>`;
    }
  }

  /**
   * 1. 汎用テーブル一覧画面
   */
  async renderTableListTab(tableName, title, displayColumns, options = {}) {
    let rows = [];

    // 立ち絵・衣装 (visual)、イベントバナー (event)、お知らせ (notice) の場合は保留バッファ（ドラフト）を使用
    if (tableName === "visual") {
      if (!this.visualState.isInitialized) {
        const records = await api.getTable("visual");
        const loaded = Array.isArray(records) ? records : (records ? [records] : []);
        this.visualState.originalRecords = JSON.parse(JSON.stringify(loaded));
        this.visualState.currentRecords = JSON.parse(JSON.stringify(loaded));
        this.visualState.hasPendingChanges = false;
        this.visualState.isInitialized = true;
      }
      rows = this.visualState.currentRecords;
    } else if (tableName === "event") {
      if (!this.eventState.isInitialized) {
        const records = await api.getTable("event");
        const loaded = Array.isArray(records) ? records : (records ? [records] : []);
        this.eventState.originalRecords = JSON.parse(JSON.stringify(loaded));
        this.eventState.currentRecords = JSON.parse(JSON.stringify(loaded));
        this.eventState.hasPendingChanges = false;
        this.eventState.isInitialized = true;
      }
      rows = this.eventState.currentRecords;
    } else if (tableName === "notice") {
      if (!this.noticeState.isInitialized) {
        const records = await api.getTable("notice");
        const loaded = Array.isArray(records) ? records : (records ? [records] : []);
        this.noticeState.originalRecords = JSON.parse(JSON.stringify(loaded));
        this.noticeState.currentRecords = JSON.parse(JSON.stringify(loaded));
        this.noticeState.hasPendingChanges = false;
        this.noticeState.isInitialized = true;
      }
      rows = this.noticeState.currentRecords;
    } else if (tableName === "gallery") {
      if (!this.galleryState.isInitialized) {
        const records = await api.getTable("gallery");
        const loaded = Array.isArray(records) ? records : (records ? [records] : []);
        this.galleryState.originalRecords = JSON.parse(JSON.stringify(loaded));
        this.galleryState.currentRecords = JSON.parse(JSON.stringify(loaded));
        this.galleryState.hasPendingChanges = false;
        this.galleryState.isInitialized = true;
      }
      rows = this.galleryState.currentRecords;
    } else {
      const records = await api.getTable(tableName);
      rows = Array.isArray(records) ? records : (records ? [records] : []);
    }

    const { hideDesc = false, showCountBadge = false, verticalActions = false } = options;

    const card = document.createElement("div");
    card.className = "admin-card";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "admin-card-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "admin-card-title-group";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";

    const h2 = document.createElement("h2");
    h2.className = "admin-card-title";
    h2.textContent = title;
    titleRow.appendChild(h2);

    if (showCountBadge) {
      const countBadge = document.createElement("span");
      countBadge.className = "admin-count-badge";
      countBadge.textContent = `${rows.length}件`;
      titleRow.appendChild(countBadge);
    }

    titleGroup.appendChild(titleRow);

    if (!hideDesc) {
      const desc = document.createElement("p");
      desc.className = "admin-card-desc";
      desc.textContent = `テーブル: ${tableName} (${rows.length}件)`;
      titleGroup.appendChild(desc);
    }

    header.appendChild(titleGroup);

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.style.cssText = "display: flex; align-items: center; gap: 10px; flex-wrap: wrap;";

    const addBtn = document.createElement("button");
    addBtn.className = "app-btn app-btn-primary";
    addBtn.innerHTML = "+ 新規追加";
    addBtn.onclick = () => this.openEditModal(tableName, null);
    actions.appendChild(addBtn);

    // 立ち絵・衣装一覧: 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    if (tableName === "visual") {
      const commitBtn = document.createElement("button");
      commitBtn.id = "visual-commit-btn";
      commitBtn.className = "app-btn app-btn-orange";

      const changesCount = this.getVisualChangesCount();
      if (this.visualState.hasPendingChanges && changesCount > 0) {
        commitBtn.classList.add("has-changes");
        commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
        commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
        commitBtn.disabled = false;
      } else {
        commitBtn.innerHTML = `<span>更新反映</span>`;
        commitBtn.title = "D1に未反映の変更はありません";
        commitBtn.disabled = true;
      }

      commitBtn.onclick = async () => {
        await this.commitVisualChanges();
      };
      actions.appendChild(commitBtn);
    }

    // イベントバナー管理: 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    if (tableName === "event") {
      const commitBtn = document.createElement("button");
      commitBtn.id = "event-commit-btn";
      commitBtn.className = "app-btn app-btn-orange";

      const changesCount = this.getEventChangesCount();
      if (this.eventState.hasPendingChanges && changesCount > 0) {
        commitBtn.classList.add("has-changes");
        commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
        commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
        commitBtn.disabled = false;
      } else {
        commitBtn.innerHTML = `<span>更新反映</span>`;
        commitBtn.title = "D1に未反映の変更はありません";
        commitBtn.disabled = true;
      }

      commitBtn.onclick = async () => {
        await this.commitEventChanges();
      };
      actions.appendChild(commitBtn);
    }

    // お知らせ管理: 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    if (tableName === "notice") {
      const commitBtn = document.createElement("button");
      commitBtn.id = "notice-commit-btn";
      commitBtn.className = "app-btn app-btn-orange";

      const changesCount = this.getNoticeChangesCount();
      if (this.noticeState.hasPendingChanges && changesCount > 0) {
        commitBtn.classList.add("has-changes");
        commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
        commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
        commitBtn.disabled = false;
      } else {
        commitBtn.innerHTML = `<span>更新反映</span>`;
        commitBtn.title = "D1に未反映の変更はありません";
        commitBtn.disabled = true;
      }

      commitBtn.onclick = async () => {
        await this.commitNoticeChanges();
      };
      actions.appendChild(commitBtn);
    }

    // ギャラリー管理: 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    if (tableName === "gallery") {
      const commitBtn = document.createElement("button");
      commitBtn.id = "gallery-commit-btn";
      commitBtn.className = "app-btn app-btn-orange";

      const changesCount = this.getGalleryChangesCount();
      if (this.galleryState.hasPendingChanges && changesCount > 0) {
        commitBtn.classList.add("has-changes");
        commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
        commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
        commitBtn.disabled = false;
      } else {
        commitBtn.innerHTML = `<span>更新反映</span>`;
        commitBtn.title = "D1に未反映の変更はありません";
        commitBtn.disabled = true;
      }

      commitBtn.onclick = async () => {
        await this.commitGalleryChanges();
      };
      actions.appendChild(commitBtn);
    }

    header.appendChild(actions);

    card.appendChild(header);

    // 立ち絵・衣装一覧で未反映の変更がある場合は通知アラートを表示
    if (tableName === "visual" && this.visualState.hasPendingChanges) {
      const changesCount = this.getVisualChangesCount();
      if (changesCount > 0) {
        const alertBar = document.createElement("div");
        alertBar.className = "admin-pending-alert";
        alertBar.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span>
            <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
          </div>
          <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
        `;
        alertBar.querySelector("button").onclick = async () => {
          await this.commitVisualChanges();
        };
        card.appendChild(alertBar);
      }
    }

    // イベントバナー管理で未反映の変更がある場合は通知アラートを表示
    if (tableName === "event" && this.eventState.hasPendingChanges) {
      const changesCount = this.getEventChangesCount();
      if (changesCount > 0) {
        const alertBar = document.createElement("div");
        alertBar.className = "admin-pending-alert";
        alertBar.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span>
            <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
          </div>
          <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
        `;
        alertBar.querySelector("button").onclick = async () => {
          await this.commitEventChanges();
        };
        card.appendChild(alertBar);
      }
    }

    // お知らせ管理で未反映の変更がある場合は通知アラートを表示
    if (tableName === "notice" && this.noticeState.hasPendingChanges) {
      const changesCount = this.getNoticeChangesCount();
      if (changesCount > 0) {
        const alertBar = document.createElement("div");
        alertBar.className = "admin-pending-alert";
        alertBar.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span>
            <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
          </div>
          <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
        `;
        alertBar.querySelector("button").onclick = async () => {
          await this.commitNoticeChanges();
        };
        card.appendChild(alertBar);
      }
    }

    // ギャラリー管理で未反映の変更がある場合は通知アラートを表示
    if (tableName === "gallery" && this.galleryState.hasPendingChanges) {
      const changesCount = this.getGalleryChangesCount();
      if (changesCount > 0) {
        const alertBar = document.createElement("div");
        alertBar.className = "admin-pending-alert";
        alertBar.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span>
            <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
          </div>
          <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
        `;
        alertBar.querySelector("button").onclick = async () => {
          await this.commitGalleryChanges();
        };
        card.appendChild(alertBar);
      }
    }

    // カラム定義の標準化
    let normalizedCols = [];
    const hasCustomActionCol = displayColumns.some(col => typeof col === "object" && col.isAction);

    if (displayColumns.length > 0 && typeof displayColumns[0] === "string") {
      normalizedCols = displayColumns.map(col => ({ key: col, label: col }));
      normalizedCols.push({ key: "actions", label: "操作", isAction: true });
    } else {
      normalizedCols = displayColumns.map(col => typeof col === "string" ? { key: col, label: col } : col);
      if (!hasCustomActionCol) {
        normalizedCols.push({ key: "actions", label: "操作", isAction: true });
      }
    }

    // テーブル
    const tableContainer = document.createElement("div");
    tableContainer.className = "admin-table-container";

    const table = document.createElement("table");
    table.className = "admin-table";

    // THEAD
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    normalizedCols.forEach((col) => {
      const th = document.createElement("th");
      if (col.labelHtml) {
        th.innerHTML = col.labelHtml;
      } else {
        th.textContent = col.label;
      }
      if (col.style) {
        Object.assign(th.style, col.style);
      }
      if (col.isAction) {
        th.className = "admin-table-col-actions";
      } else if (col.key === "banner" || col.isBanner) {
        th.className = "admin-table-col-banner";
      } else if (col.isGallery || (tableName === "gallery" && (col.key === "image" || col.type === "image"))) {
        th.className = "admin-table-col-gallery-image";
      } else if (col.isButtonBanner || (tableName === "linkList" && (col.key === "buttonImage" || col.type === "image"))) {
        th.className = "admin-table-col-button-banner";
      } else if (col.type === "color" || col.key === "buttonTextColor") {
        th.className = "admin-table-col-color";
      } else if (col.type === "image" || ["visual", "defoemed", "thumbnail", "visualBackground", "Image", "image"].includes(col.key)) {
        th.className = "admin-table-col-image";
      } else if (col.key === "id") {
        th.className = "admin-table-col-id";
      } else if (col.key === "link" || col.isLink) {
        th.className = "admin-table-col-link";
      } else if (col.type === "datetime" || col.type === "notice_time" || col.key === "start_at" || col.key === "end_at" || col.key === "created_at" || col.key === "schedule_at") {
        th.className = "admin-table-col-datetime";
        if (col.type === "notice_time") {
          th.classList.add("admin-table-col-notice-time");
        }
      } else if (col.key === "status" || col.type === "status") {
        th.className = "admin-table-col-status";
      } else if (col.key === "message" || col.type === "message") {
        th.className = "admin-table-col-message";
      } else if (col.key === "costumeName") {
        th.className = "admin-table-col-costumeName";
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement("tbody");
    if (rows.length === 0) {
      const emptyRow = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = normalizedCols.length;
      td.style.textAlign = "center";
      td.style.color = "#94a3b8";
      td.textContent = "データがありません";
      emptyRow.appendChild(td);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach((row) => {
        const tr = document.createElement("tr");

        normalizedCols.forEach((colCfg) => {
          if (colCfg.isAction) {
            // 操作列 (td 自体は table-cell として vertical-align: middle を維持し、内部 div を flex 化)
            const tdAct = document.createElement("td");
            tdAct.className = "admin-table-col-actions";
            if (colCfg.style) {
              Object.assign(tdAct.style, colCfg.style);
            }
            const actWrap = document.createElement("div");
            actWrap.className = `admin-table-actions ${verticalActions ? "is-vertical" : ""}`;

            const editBtn = document.createElement("button");
            editBtn.className = "app-btn app-btn-secondary";
            editBtn.textContent = "編集";
            editBtn.onclick = () => this.openEditModal(tableName, row);
            actWrap.appendChild(editBtn);

            const delBtn = document.createElement("button");
            delBtn.className = "app-btn app-btn-danger";
            delBtn.textContent = "削除";
            delBtn.onclick = () => this.deleteRecord(tableName, row.id);
            actWrap.appendChild(delBtn);

            tdAct.appendChild(actWrap);
            tr.appendChild(tdAct);
          } else {
            const td = document.createElement("td");
            if (colCfg.style) {
              Object.assign(td.style, colCfg.style);
            }
            if (colCfg.key === "banner" || colCfg.isBanner) {
              td.className = "admin-table-col-banner";
            } else if (colCfg.isGallery || (tableName === "gallery" && (colCfg.key === "image" || colCfg.type === "image"))) {
              td.className = "admin-table-col-gallery-image";
            } else if (colCfg.isButtonBanner || (tableName === "linkList" && (colCfg.key === "buttonImage" || colCfg.type === "image"))) {
              td.className = "admin-table-col-button-banner";
            } else if (colCfg.type === "color" || colCfg.key === "buttonTextColor") {
              td.className = "admin-table-col-color";
            } else if (colCfg.type === "image" || ["visual", "defoemed", "thumbnail", "visualBackground", "Image", "image"].includes(colCfg.key)) {
              td.className = "admin-table-col-image";
            } else if (colCfg.key === "id") {
              td.className = "admin-table-col-id";
            } else if (colCfg.key === "link" || colCfg.isLink) {
              td.className = "admin-table-col-link";
            } else if (colCfg.type === "datetime" || colCfg.type === "notice_time" || colCfg.key === "start_at" || colCfg.key === "end_at" || colCfg.key === "created_at" || colCfg.key === "schedule_at") {
              td.className = "admin-table-col-datetime";
              if (colCfg.type === "notice_time") {
                td.classList.add("admin-table-col-notice-time");
              }
            } else if (colCfg.key === "status" || colCfg.type === "status") {
              td.className = "admin-table-col-status";
            } else if (colCfg.key === "message" || colCfg.type === "message") {
              td.className = "admin-table-col-message";
            } else if (colCfg.key === "costumeName") {
              td.className = "admin-table-col-costumeName";
            }

            let val = row[colCfg.key];
            if ((val === undefined || val === null || val === "") && colCfg.fallbackKey) {
              val = row[colCfg.fallbackKey];
            }

            if (colCfg.type === "notice_time") {
              const formatNoticeDateTime = (dtStr) => {
                if (!dtStr) return null;
                const s = String(dtStr).trim().replace("T", " ");
                const m = s.match(/^(\d{4}[-\/]\d{2}[-\/]\d{2}\s+\d{2}:\d{2})/);
                return m ? m[1].replace(/\//g, "-") : s;
              };
              const createdVal = formatNoticeDateTime(row.created_at);
              const scheduledVal = formatNoticeDateTime(row.scheduled_at);
              td.innerHTML = `
                <div class="admin-table-twoline-datetime">
                  <div class="admin-time-row is-created">
                    <span class="admin-time-badge is-created">送信</span>
                    <span class="admin-time-val">${createdVal ? escapeHtml(createdVal) : '<span style="color:#64748b;">-</span>'}</span>
                  </div>
                  <div class="admin-time-row is-scheduled">
                    <span class="admin-time-badge is-scheduled">予約</span>
                    <span class="admin-time-val">${scheduledVal ? escapeHtml(scheduledVal) : '<span style="color:#64748b;">-</span>'}</span>
                  </div>
                </div>
              `;
            } else if (colCfg.type === "status" || colCfg.key === "status") {
              const raw = String(val || "").toLowerCase();
              let sText = "下書き";
              let sClass = "is-draft";
              if (raw === "published" || raw === "公開") {
                sText = "公開";
                sClass = "is-published";
              } else if (raw === "scheduled" || raw === "予約") {
                sText = "予約";
                sClass = "is-scheduled";
              } else if (raw === "draft" || raw === "下書き") {
                sText = "下書き";
                sClass = "is-draft";
              } else if (val) {
                sText = String(val);
              }
              td.innerHTML = `<span class="admin-status-badge ${sClass}">${escapeHtml(sText)}</span>`;
            } else if (colCfg.type === "message" || (tableName === "notice" && colCfg.key === "message")) {
              const msgStr = String(val || "");
              td.textContent = msgStr.length > 50 ? msgStr.slice(0, 50) + "..." : (msgStr || "-");
              if (msgStr) td.title = msgStr;
            } else if (colCfg.type === "color" || colCfg.key === "buttonTextColor") {
              const rawColor = val ? String(val).trim() : "#ffffff";
              const colorVal = rawColor.startsWith("#") ? rawColor : `#${rawColor}`;
              const isValidHex = /^#[0-9a-fA-F]{6}$/.test(colorVal);

              const colorCell = document.createElement("div");
              colorCell.className = "admin-color-cell";
              colorCell.style.cssText = "display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: rgba(15, 23, 42, 0.6); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); margin: 0 auto;";
              colorCell.onclick = (e) => e.stopPropagation();

              // カラーUI (カラーピッカーinput)
              const colorInput = document.createElement("input");
              colorInput.type = "color";
              colorInput.className = "admin-color-input-ui";
              colorInput.value = isValidHex ? colorVal : "#ffffff";
              colorInput.title = "クリックして文字色を変更";
              colorInput.style.cssText = "width: 28px; height: 26px; padding: 0; border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 4px; background: transparent; cursor: pointer; vertical-align: middle;";

              const codeSpan = document.createElement("span");
              codeSpan.className = "admin-color-code";
              codeSpan.style.cssText = "font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.82rem; color: #e2e8f0; font-weight: 500; letter-spacing: 0.02em;";
              codeSpan.textContent = colorVal;

              colorInput.oninput = () => {
                codeSpan.textContent = colorInput.value;
              };

              colorInput.onchange = async () => {
                const newColor = colorInput.value;
                codeSpan.textContent = newColor;
                row.buttonTextColor = newColor;
                try {
                  await api.saveTable(tableName, { ...row, buttonTextColor: newColor }, row.id);
                } catch (err) {
                  console.error("文字色の保存に失敗しました:", err);
                }
              };

              colorCell.appendChild(colorInput);
              colorCell.appendChild(codeSpan);
              td.appendChild(colorCell);
            } else if (colCfg.isButtonBanner || (tableName === "linkList" && (colCfg.key === "buttonImage" || colCfg.type === "image"))) {
              // ボタン画像列: デフォルト画像も含めて常にプレビュー表示
              const isDefault = !val;
              const imgPath = val || "assets/link/defaultbutton_typeA.svg";
              const imgUrl = api.resolveAssetUrl(imgPath, "link");

              const bannerCell = document.createElement("div");
              bannerCell.className = "admin-button-banner-cell";
              bannerCell.style.cssText = "display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; margin: 0 auto;";

              const img = document.createElement("img");
              img.className = "admin-table-thumb is-button-banner";
              img.src = imgUrl;
              img.alt = colCfg.label;
              const titlePrefix = row.title || row.name || "";
              img.title = `${titlePrefix ? titlePrefix + " - " : ""}${colCfg.label}${isDefault ? " (デフォルト画像)" : ""} (クリックで拡大)`;
              img.style.cssText = "width: 110px; height: 26px; min-width: 110px; min-height: 26px; max-width: 120px; max-height: 30px; aspect-ratio: 5 / 1; object-fit: contain; padding: 0; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 4px; display: block; margin: 0 auto; cursor: zoom-in;";

              img.onclick = (e) => {
                e.stopPropagation();
                const modalTitle = `${titlePrefix ? titlePrefix + "：" : ""}${colCfg.label}${isDefault ? " (デフォルト)" : ""}`;
                this.openImageDetailModal(imgUrl, modalTitle, {
                  costumeName: titlePrefix,
                  columnLabel: colCfg.label,
                  path: imgPath,
                });
              };

              bannerCell.appendChild(img);

              if (isDefault) {
                const defSpan = document.createElement("span");
                defSpan.style.cssText = "font-size: 0.72rem; color: #94a3b8; letter-spacing: 0.02em;";
                defSpan.textContent = "(デフォルト画像)";
                bannerCell.appendChild(defSpan);
              }

              td.appendChild(bannerCell);
            } else {
              const isImage = colCfg.type === "image" ||
                (typeof val === "string" && (val.endsWith(".png") || val.endsWith(".jpg") || val.endsWith(".jpeg") || val.endsWith(".webp") || val.endsWith(".svg")));

              if (isImage && val) {
                const category = colCfg.category || tableName;
                const imgUrl = api.resolveAssetUrl(val, category);
                const img = document.createElement("img");
                const isBanner = colCfg.isBanner || colCfg.key === "banner";
                const isNotice = colCfg.category === "notice" || tableName === "notice";
                const isGallery = colCfg.isGallery || tableName === "gallery" || colCfg.category === "gallery";
                const isButtonBanner = colCfg.isButtonBanner || (tableName === "linkList" && colCfg.key === "buttonImage");
                let thumbModifier = "";
                if (isBanner) thumbModifier = "is-banner";
                else if (isNotice) thumbModifier = "is-notice-image";
                else if (isGallery) thumbModifier = "is-gallery";
                else if (isButtonBanner) thumbModifier = "is-button-banner";

                img.className = `admin-table-thumb ${thumbModifier}`.trim();
                img.src = imgUrl;
                img.alt = colCfg.label;
                const titlePrefix = row.costumeName || row.title || row.name || "";
                img.title = `${titlePrefix ? titlePrefix + " - " : ""}${colCfg.label} (クリックで拡大)`;
                img.onclick = () => {
                  const modalTitle = `${titlePrefix ? titlePrefix + "：" : ""}${colCfg.label}`;
                  this.openImageDetailModal(imgUrl, modalTitle, {
                    costumeName: titlePrefix,
                    columnLabel: colCfg.label,
                    path: val,
                  });
                };
                td.appendChild(img);
              } else if (val === null || val === undefined || val === "") {
                td.innerHTML = '<span style="color:#64748b;">-</span>';
              } else if (colCfg.isLink || colCfg.key === "link") {
                // リンク列: 全文折り返し表示 (URL形式はクリック可能リンク)
                const strVal = String(val);
                if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
                  const linkElem = document.createElement("a");
                  linkElem.className = "admin-table-link-text";
                  linkElem.href = strVal;
                  linkElem.target = "_blank";
                  linkElem.rel = "noopener noreferrer";
                  linkElem.textContent = strVal;
                  td.appendChild(linkElem);
                } else {
                  td.textContent = strVal;
                  td.style.wordBreak = "break-all";
                  td.style.whiteSpace = "normal";
                }
              } else if (typeof val === "boolean" || colCfg.key === "isFeatured" || colCfg.key === "is_active") {
                td.textContent = (val === 1 || val === true) ? "✓ 表示" : "✕ 非表示";
              } else {
                const str = String(val);
                td.textContent = str.length > 40 ? str.slice(0, 40) + "..." : str;
              }
            }
            tr.appendChild(td);
          }
        });

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);

    this.container.innerHTML = "";
    this.container.appendChild(card);
  }

  /**
   * 画像詳細・拡大モーダル
   */
  openImageDetailModal(imgSrc, title, meta = {}) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 4px 0;";

    // 画像表示エリア (背景に透明市松パターン)
    const imgBox = document.createElement("div");
    imgBox.style.cssText = `
      width: 100%;
      max-height: 65vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #090d16;
      background-image: 
        linear-gradient(45deg, #131d2e 25%, transparent 25%), 
        linear-gradient(-45deg, #131d2e 25%, transparent 25%), 
        linear-gradient(45deg, transparent 75%, #131d2e 75%), 
        linear-gradient(-45deg, transparent 75%, #131d2e 75%);
      background-size: 16px 16px;
      background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      border-radius: var(--radius-md, 8px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      overflow: hidden;
      padding: 16px;
      box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.5);
    `;

    const img = document.createElement("img");
    img.src = imgSrc;
    img.alt = title;
    img.style.cssText = "max-width: 100%; max-height: 58vh; object-fit: contain; border-radius: 4px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);";
    imgBox.appendChild(img);
    wrap.appendChild(imgBox);

    // メタ情報
    const metaBox = document.createElement("div");
    metaBox.style.cssText = `
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 10px;
      background: rgba(11, 20, 38, 0.65);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-sm, 6px);
      padding: 12px 16px;
      font-size: 0.85rem;
      color: #94a3b8;
    `;

    if (meta.costumeName) {
      metaBox.innerHTML += `<div><span style="color: #64748b; font-weight: 600;">衣装名:</span> <span style="color: #f8fafc; font-weight: 700; margin-left: 6px;">${meta.costumeName}</span></div>`;
    }
    if (meta.columnLabel) {
      metaBox.innerHTML += `<div><span style="color: #64748b; font-weight: 600;">種別:</span> <span style="color: #60a5fa; font-weight: 600; margin-left: 6px;">${meta.columnLabel}</span></div>`;
    }
    if (meta.path) {
      metaBox.innerHTML += `<div style="grid-column: 1 / -1;"><span style="color: #64748b; font-weight: 600;">ファイル:</span> <code style="color: #38bdf8; margin-left: 6px; word-break: break-all; font-family: monospace;">${meta.path}</code></div>`;
    }
    wrap.appendChild(metaBox);

    // フッターボタン
    const footerWrap = document.createElement("div");
    footerWrap.style.cssText = "display: flex; justify-content: flex-end; gap: 10px; width: 100%;";

    const openTabBtn = document.createElement("a");
    openTabBtn.className = "app-btn app-btn-secondary";
    openTabBtn.href = imgSrc;
    openTabBtn.target = "_blank";
    openTabBtn.rel = "noopener noreferrer";
    openTabBtn.textContent = "新しいタブで開く";
    footerWrap.appendChild(openTabBtn);

    const closeBtn = document.createElement("button");
    closeBtn.className = "app-btn app-btn-primary";
    closeBtn.textContent = "閉じる";
    closeBtn.onclick = () => Modal.close();
    footerWrap.appendChild(closeBtn);

    Modal.open({
      title: title || "画像詳細プレビュー",
      content: wrap,
      footer: footerWrap,
      isLarge: true,
    });
  }

  /**
   * 立ち絵・衣装 (visual) 専用の新規・編集モーダル
   */
  async openVisualModal(record, restoreState = null) {
    const isNew = !record;

    // 全visualレコードを取得して自動採番とライブラリ一覧候補を準備
    let allVisuals = [];
    if (this.visualState && this.visualState.isInitialized && this.visualState.currentRecords.length > 0) {
      allVisuals = this.visualState.currentRecords;
    } else {
      try {
        const res = await api.getTable("visual");
        allVisuals = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allVisuals = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allVisuals.length > 0 ? Math.max(...allVisuals.map((r) => Number(r.id) || 0)) + 1 : 1;
    const nextPriority = allVisuals.length > 0 ? Math.max(...allVisuals.map((r) => Number(r.priority) || 0)) + 1 : 1;

    // 現在のデータ (復元データがある場合は復元データを最優先)
    const currentData = {
      id: isNew ? nextId : record.id,
      priority: isNew ? nextPriority : (record?.priority ?? 1),
      costumeName: record?.costumeName || "",
      visual: record?.visual || "",
      defoemed: record?.defoemed || record?.deformed || "",
      thumbnail: record?.thumbnail || record?.costumeThumbnail || "",
      visualBackground: record?.visualBackground || "",
      characterDesign: record?.characterDesign || "",
      illustrator: record?.illustrator || "",
      live2d: record?.live2d || "",
      "3dModeling": record?.["3dModeling"] || "",
      ...restoreState,
    };

    // 各画像フィールドの定義
    const visualFieldsConfig = {
      visual: {
        label: "立ち絵",
        category: "visual/standing",
        uploadPath: "assets/visual/standing",
        defaultLibrary: ["ELISA.png", "sample.png"],
        accept: ".png",
        maxSizeBytes: 5242880,
        maxSizeMB: 5,
        aspectRatio: "4:3",
        displayMode: "contain",
        maxLongEdge: 1280,
      },
      defoemed: {
        label: "SD",
        category: "visual/deformed",
        uploadPath: "assets/visual/defoemed",
        fallbackKey: "deformed",
        defaultLibrary: ["ELISA_defoemed.png"],
        accept: ".png",
        maxSizeBytes: 3145728,
        maxSizeMB: 3,
        aspectRatio: "4:3",
        displayMode: "contain",
        maxLongEdge: 640,
      },
      thumbnail: {
        label: "サムネイル",
        category: "visual/thumbnail",
        uploadPath: "assets/visual/thumbnail",
        fallbackKey: "costumeThumbnail",
        defaultLibrary: ["ELISA_thumbnail.png", "sample_thumbnail.png"],
        accept: ".png",
        maxSizeBytes: 1048576,
        maxSizeMB: 1,
        aspectRatio: "1:1",
        displayMode: "contain",
        maxLongEdge: 512,
      },
      visualBackground: {
        label: "衣装背景",
        category: "visual/background",
        uploadPath: "assets/visual/background",
        defaultLibrary: ["sample_visualBackground.jpg"],
        accept: ".png,.jpg,.jpeg",
        maxSizeBytes: 5242880,
        maxSizeMB: 5,
        aspectRatio: null, // トリミングなし
        displayMode: "original",
      },
    };

    // ライブラリキャッシュの初期化 / 既存ファイル名の集約
    if (!this.visualLibraryCache) {
      this.visualLibraryCache = {};
    }

    Object.keys(visualFieldsConfig).forEach((field) => {
      if (!this.visualLibraryCache[field]) {
        const set = new Set(visualFieldsConfig[field].defaultLibrary);
        allVisuals.forEach((row) => {
          let val = row[field];
          if (!val && visualFieldsConfig[field].fallbackKey) {
            val = row[visualFieldsConfig[field].fallbackKey];
          }
          if (
            val &&
            typeof val === "string" &&
            !val.startsWith("http://") &&
            !val.startsWith("https://") &&
            !val.startsWith("data:")
          ) {
            const fileName = val.split("/").pop();
            if (fileName) set.add(fileName);
          }
        });
        this.visualLibraryCache[field] = Array.from(set);
      }
    });

    // Googleドライブ共有URL自動変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url || typeof url !== "string") return url;
      const trimmed = url.trim();
      const mFile = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (mFile && mFile[1]) {
        return `https://drive.google.com/uc?export=view&id=${mFile[1]}`;
      }
      const mId = trimmed.match(/drive\.google\.com\/(?:open|uc)\?(?:[^&]+&)*id=([a-zA-Z0-9_-]+)/);
      if (mId && mId[1]) {
        return `https://drive.google.com/uc?export=view&id=${mId[1]}`;
      }
      return trimmed;
    };

    const form = document.createElement("form");
    form.id = "visual-edit-form";
    form.className = "admin-visual-modal-form";

    form.innerHTML = `
      <!-- 基本情報: id ｜ 表示優先度(priority) -->
      <div class="admin-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">id</label>
          <input class="admin-form-input" name="id" value="${currentData.id}" readonly style="opacity: 0.85; background: rgba(0,0,0,0.35); cursor: not-allowed;" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">表示優先度 <span class="admin-form-label-required">*必須</span></label>
          <input class="admin-form-input" type="number" min="1" name="priority" value="${currentData.priority}" required />
        </div>
      </div>

      <!-- 衣装名(costumeNameカラム) -->
      <div class="admin-form-group">
        <label class="admin-form-label">衣装名</label>
        <input class="admin-form-input" name="costumeName" value="${currentData.costumeName || ""}" placeholder="衣装名 (例: サンプル衣装)" />
      </div>

      <!-- # イラスト -->
      <details class="admin-profile-accordion" open style="margin-top: 4px;">
        <summary class="admin-profile-accordion-summary">
          <div class="admin-profile-accordion-title">
            <span class="admin-profile-accordion-icon">🎨</span>
            <span>イラスト</span>
          </div>
          <span class="admin-profile-accordion-arrow">▼</span>
        </summary>
        <div class="admin-profile-accordion-body" style="gap: 16px; padding: 18px 20px;">
          ${Object.entries(visualFieldsConfig)
            .map(([field, cfg]) => {
              const rawVal = currentData[field] || "";
              const isUrl =
                rawVal.startsWith("http://") ||
                rawVal.startsWith("https://") ||
                rawVal.startsWith("data:");
              const defaultMode =
                currentData[`${field}_mode`] || (isUrl ? "url" : "library");
              const libraryList = this.visualLibraryCache[field] || [];
              const selectedFileName = !isUrl ? rawVal.split("/").pop() : "";

              return `
              <div class="admin-visual-field-row" data-field="${field}">
                <div class="admin-visual-field-input-col">
                  <div class="admin-visual-field-header">
                    <span class="admin-form-label" style="margin: 0; font-size: 0.9rem; font-weight: 700;">${cfg.label}</span>
                    <div class="admin-visual-mode-toggle">
                      <label class="admin-radio-label">
                        <input type="radio" name="${field}_mode" value="library" ${
                          defaultMode === "library" ? "checked" : ""
                        }> ライブラリ参照
                      </label>
                      <label class="admin-radio-label">
                        <input type="radio" name="${field}_mode" value="url" ${
                          defaultMode === "url" ? "checked" : ""
                        }> 直URL指定
                      </label>
                    </div>
                  </div>

                  <!-- ライブラリ選択UI -->
                  <div class="admin-visual-library-wrap" id="library-wrap-${field}" style="${
                    defaultMode === "library" ? "" : "display: none;"
                  }">
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <select class="admin-form-select admin-visual-file-select" data-field="${field}" style="flex: 1;">
                        <option value="">-- ファイルを選択 --</option>
                        ${libraryList
                          .map(
                            (fn) =>
                              `<option value="${fn}" ${
                                fn === selectedFileName ? "selected" : ""
                              }>${fn}</option>`
                          )
                          .join("")}
                      </select>
                      <button type="button" class="app-btn app-btn-secondary admin-visual-upload-trigger" data-field="${field}" style="white-space: nowrap; padding: 8px 14px; font-size: 0.82rem;">
                        📤 アップロード
                      </button>
                    </div>
                  </div>

                  <!-- 直URL指定UI -->
                  <div class="admin-visual-url-wrap" id="url-wrap-${field}" style="${
                    defaultMode === "url" ? "" : "display: none;"
                  }">
                    <input class="admin-form-input admin-visual-url-input" data-field="${field}" value="${
                      isUrl ? rawVal : ""
                    }" placeholder="https://drive.google.com/... または 画像URL" />
                    <span class="admin-form-hint" style="margin-top: 4px; display: block;">Googleドライブの共有URLは自動的に直リンクへ変換されます</span>
                  </div>
                </div>

                <!-- プレビュー枠 -->
                <div class="admin-visual-preview-col">
                  <div class="admin-visual-preview-box" id="preview-box-${field}">
                    <span class="admin-visual-preview-empty">未選択</span>
                  </div>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </details>

      <!-- # クレジット -->
      <details class="admin-profile-accordion" open style="margin-top: 4px;">
        <summary class="admin-profile-accordion-summary">
          <div class="admin-profile-accordion-title">
            <span class="admin-profile-accordion-icon">🖋️</span>
            <span>クレジット</span>
          </div>
          <span class="admin-profile-accordion-arrow">▼</span>
        </summary>
        <div class="admin-profile-accordion-body" style="gap: 14px; padding: 18px 20px;">
          <!-- キャラクターデザイン ｜ イラストレーター -->
          <div class="admin-grid-2">
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">キャラクターデザイン</label>
              <input class="admin-form-input" name="characterDesign" value="${
                currentData.characterDesign || ""
              }" placeholder="キャラクターデザイナー名" />
            </div>
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">イラストレーター</label>
              <input class="admin-form-input" name="illustrator" value="${
                currentData.illustrator || ""
              }" placeholder="イラストレーター名" />
            </div>
          </div>

          <!-- Live2Dモデラー ｜ 3Dモデラー -->
          <div class="admin-grid-2">
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">Live2Dモデラー</label>
              <input class="admin-form-input" name="live2d" value="${
                currentData.live2d || ""
              }" placeholder="Live2Dモデラー名" />
            </div>
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">3Dモデラー</label>
              <input class="admin-form-input" name="3dModeling" value="${
                currentData["3dModeling"] || ""
              }" placeholder="3Dモデラー名" />
            </div>
          </div>
        </div>
      </details>
    `;

    // プレビュー更新関数
    const updateFieldPreview = (field) => {
      const pBox = form.querySelector(`#preview-box-${field}`);
      if (!pBox) return;

      const mode = form.querySelector(`[name="${field}_mode"]:checked`)?.value || "library";
      const cfg = visualFieldsConfig[field];
      let src = "";

      if (mode === "library") {
        const select = form.querySelector(`.admin-visual-file-select[data-field="${field}"]`);
        const val = select ? select.value.trim() : "";
        if (val) {
          src = api.resolveAssetUrl(val, cfg.category);
        }
      } else {
        const urlInput = form.querySelector(`.admin-visual-url-input[data-field="${field}"]`);
        let val = urlInput ? urlInput.value.trim() : "";
        if (val) {
          const converted = convertGoogleDriveUrl(val);
          if (converted !== val) {
            urlInput.value = converted;
            val = converted;
          }
          src = val;
        }
      }

      if (src) {
        pBox.innerHTML = `<img src="${src}" alt="${cfg.label}" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\'>読込失敗</span>'" />`;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">未選択</span>';
      }
    };

    // イベントバインド
    Object.keys(visualFieldsConfig).forEach((field) => {
      const modeRadios = form.querySelectorAll(`[name="${field}_mode"]`);
      const libWrap = form.querySelector(`#library-wrap-${field}`);
      const urlWrap = form.querySelector(`#url-wrap-${field}`);
      const select = form.querySelector(`.admin-visual-file-select[data-field="${field}"]`);
      const urlInput = form.querySelector(`.admin-visual-url-input[data-field="${field}"]`);

      modeRadios.forEach((r) => {
        r.addEventListener("change", () => {
          if (r.value === "library") {
            libWrap.style.display = "";
            urlWrap.style.display = "none";
          } else {
            libWrap.style.display = "none";
            urlWrap.style.display = "";
          }
          updateFieldPreview(field);
        });
      });

      if (select) {
        select.addEventListener("change", () => updateFieldPreview(field));
      }

      if (urlInput) {
        urlInput.addEventListener("input", () => updateFieldPreview(field));
        urlInput.addEventListener("change", () => updateFieldPreview(field));
      }

      // アップロードボタン押下時
      const uploadTrigger = form.querySelector(`.admin-visual-upload-trigger[data-field="${field}"]`);
      if (uploadTrigger) {
        uploadTrigger.addEventListener("click", () => {
          const currentState = this.collectVisualFormData(form);
          this.openVisualUploadModal(field, record, currentState, visualFieldsConfig[field]);
        });
      }

      updateFieldPreview(field);
    });

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規登録する" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const payload = {
        id: Number(fd.get("id")),
        priority: Number(fd.get("priority")) || 1,
        costumeName: fd.get("costumeName")?.toString().trim() || null,
        characterDesign: fd.get("characterDesign")?.toString().trim() || null,
        illustrator: fd.get("illustrator")?.toString().trim() || null,
        live2d: fd.get("live2d")?.toString().trim() || null,
        "3dModeling": fd.get("3dModeling")?.toString().trim() || null,
      };

      Object.keys(visualFieldsConfig).forEach((field) => {
        const mode = form.querySelector(`[name="${field}_mode"]:checked`)?.value || "library";
        if (mode === "library") {
          const sel = form.querySelector(`.admin-visual-file-select[data-field="${field}"]`);
          payload[field] = sel?.value?.trim() || null;
        } else {
          const urlIn = form.querySelector(`.admin-visual-url-input[data-field="${field}"]`);
          const rawUrl = urlIn?.value?.trim() || null;
          payload[field] = rawUrl ? convertGoogleDriveUrl(rawUrl) : null;
        }
      });

      // 立ち絵・衣装 (visual) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.visualState.currentRecords.push(payload);
      } else {
        const idx = this.visualState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.visualState.currentRecords[idx] = {
            ...this.visualState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.visualState.currentRecords.push(payload);
        }
      }

      // priority 順でソート
      this.visualState.currentRecords.sort(
        (a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0)
      );

      this.visualState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "衣装を一覧に追加しました（※「更新反映」ボタンを押すまでD1には保存されません）"
          : "衣装の変更を一覧に反映しました（※「更新反映」ボタンを押すまでD1には保存されません）"
      );
      await this.loadTab("visual");
    };

    Modal.open({
      title: isNew ? "立ち絵・衣装の新規追加" : `立ち絵・衣装の編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectVisualFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    ["visual", "defoemed", "thumbnail", "visualBackground"].forEach((field) => {
      const mode = form.querySelector(`[name="${field}_mode"]:checked`)?.value || "library";
      data[`${field}_mode`] = mode;
      if (mode === "library") {
        data[field] = form.querySelector(`.admin-visual-file-select[data-field="${field}"]`)?.value || "";
      } else {
        data[field] = form.querySelector(`.admin-visual-url-input[data-field="${field}"]`)?.value || "";
      }
    });
    return data;
  }

  /**
   * 立ち絵・衣装 画像アップロードモーダル
   */
  async openVisualUploadModal(field, currentRecord, savedState, cfg) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    // 規格解像度・アスペクト比の算出
    let targetW = 1280;
    let targetH = 960;
    let headerTitleText = "トリミング調整";

    if (cfg.aspectRatio) {
      const [rw, rh] = cfg.aspectRatio.split(":").map(Number);
      const maxEdge = cfg.maxLongEdge || 1024;
      if (rw >= rh) {
        targetW = maxEdge;
        targetH = Math.round(maxEdge * (rh / rw));
      } else {
        targetH = maxEdge;
        targetW = Math.round(maxEdge * (rw / rh));
      }
      const ratioLabel = rw === rh ? "正方形" : (rw > rh ? "横長" : "縦長");
      headerTitleText = `トリミング調整 (${ratioLabel} ${cfg.aspectRatio} (${targetW}×${targetH}))`;
    } else {
      headerTitleText = `画像プレビュー＆調整 (最大 1920px)`;
    }

    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${cfg.label}</strong> (保存先: <code>${cfg.uploadPath}</code>)</div>
        <div>対応形式: <code>${cfg.accept}</code> ｜ 容量上限: <code>${cfg.maxSizeMB}MB (${maxKB} KB)</code> ${cfg.aspectRatio ? `｜ 規格比率: <code>${cfg.aspectRatio} (${cfg.displayMode})</code>` : ""}</div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone">
        <input type="file" id="upload-file-input" accept="${cfg.accept}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCから画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span id="crop-header-text">${headerTitleText}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong id="crop-resolution-val" class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input" placeholder="例: summer_costume" style="flex: 1;" />
          <span id="upload-ext-label" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.png</span>
        </div>
        <span id="upload-name-error" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    // キャンセル時は元のモーダルを復元
    cancelBtn.onclick = () => {
      this.openVisualModal(currentRecord, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone");
    const fileInput = wrap.querySelector("#upload-file-input");
    const cropStage = wrap.querySelector("#crop-stage");
    const cropCanvas = wrap.querySelector("#crop-canvas");
    const cropHeaderText = wrap.querySelector("#crop-header-text");
    const cropResVal = wrap.querySelector("#crop-resolution-val");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider");
    const fitBtn = wrap.querySelector("#crop-fit-btn");
    const centerBtn = wrap.querySelector("#crop-center-btn");
    const sizeBadge = wrap.querySelector("#crop-size-badge");
    const nameInput = wrap.querySelector("#upload-filename-input");
    const extLabel = wrap.querySelector("#upload-ext-label");
    const nameError = wrap.querySelector("#upload-name-error");

    dropzone.onclick = () => fileInput.click();

    // キャンバス変数の初期化
    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const checkUploadBtnState = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      uploadBtn.disabled = !selectedImg || !isValid || !isSizeValid;
    };

    // 描画処理
    const renderCanvas = () => {
      if (!selectedImg) return;
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    // リアルタイム容量計算
    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        if (!selectedImg) return;
        const ext = extLabel.textContent.toLowerCase();
        const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        const quality = ext === ".jpg" || ext === ".jpeg" ? 0.88 : undefined;

        cropCanvas.toBlob((blob) => {
          if (!blob) return;
          currentBlob = blob;
          const sizeKB = (blob.size / 1024).toFixed(1);
          const limitKB = Math.round(cfg.maxSizeBytes / 1024);
          const isOver = blob.size > cfg.maxSizeBytes;

          if (isOver) {
            sizeBadge.className = "crop-size-badge is-over";
            sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB 超過`;
            isSizeValid = false;
          } else {
            sizeBadge.className = "crop-size-badge is-ok";
            sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB OK`;
            isSizeValid = true;
          }
          checkUploadBtnState();
        }, mimeType, quality);
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) {
        onDragMove(e.clientX, e.clientY);
      }
    };

    const handleWindowMouseUp = () => {
      if (isDragging) {
        onDragEnd();
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) {
        onDragEnd();
      }
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // マウスホイールによるズーム
    cropCanvas.addEventListener("wheel", (e) => {
      if (!selectedImg) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      let newScale = scale * zoomFactor;
      const minS = parseFloat(zoomSlider.min);
      const maxS = parseFloat(zoomSlider.max);
      newScale = Math.max(minS, Math.min(maxS, newScale));
      scale = newScale;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(false);
    }, { passive: false });

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    // フィットボタン
    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // 中央揃えボタン
    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".png";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "costume";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;

          // アスペクト比未指定時の解像度計算
          if (!cfg.aspectRatio) {
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            const maxDim = 1920;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round(h * (maxDim / w));
                w = maxDim;
              } else {
                w = Math.round(w * (maxDim / h));
                h = maxDim;
              }
            }
            targetW = w;
            targetH = h;
            cropHeaderText.textContent = `画像プレビュー (${targetW}×${targetH})`;
          }

          cropResVal.textContent = `${targetW} × ${targetH} px`;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          // フィット倍率の算出
          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    // ファイル名バリデーション
    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.visualLibraryCache[field].includes(fullFileName)) {
            this.visualLibraryCache[field].push(fullFileName);
          }
          savedState[field] = fullFileName;
          savedState[`${field}_mode`] = "library";
          cleanupListeners();
          this.openVisualModal(currentRecord, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for visual via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.visualLibraryCache[field].includes(fullFileName)) {
          this.visualLibraryCache[field].push(fullFileName);
        }

        savedState[field] = fullFileName;
        savedState[`${field}_mode`] = "library";

        cleanupListeners();
        this.openVisualModal(currentRecord, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openVisualModal(currentRecord, savedState);
      },
    });
  }

  /**
   * イベントバナー (event) 専用の新規・編集モーダル
   */
  async openEventModal(record, restoreState = null) {
    const isNew = !record;

    // 全eventレコードを取得して自動採番とライブラリ一覧候補を準備
    let allEvents = [];
    if (this.eventState && this.eventState.isInitialized && this.eventState.currentRecords.length > 0) {
      allEvents = this.eventState.currentRecords;
    } else {
      try {
        const res = await api.getTable("event");
        allEvents = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allEvents = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allEvents.length > 0 ? Math.max(...allEvents.map((r) => Number(r.id) || 0)) + 1 : 1;

    // 現在のデータ (復元データがある場合は復元データを最優先)
    const currentData = {
      id: isNew ? nextId : record.id,
      link: record?.link || "",
      start_at: record?.start_at || "",
      end_at: record?.end_at || "",
      banner: record?.banner || "",
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.eventLibraryCache) {
      this.eventLibraryCache = [];
    }
    const librarySet = new Set(["samplebanner.jpg", ...this.eventLibraryCache]);
    allEvents.forEach((row) => {
      if (row.banner && typeof row.banner === "string" && !row.banner.startsWith("http")) {
        librarySet.add(row.banner.split("/").pop());
      }
    });
    this.eventLibraryCache = Array.from(librarySet);

    // 日時変換ヘルパー (YYYY-MM-DD HH:mm:ss <-> YYYY-MM-DDTHH:mm)
    const formatToInputDatetime = (val) => {
      if (!val) return "";
      const str = String(val).trim();
      return str.replace(" ", "T").substring(0, 16);
    };

    const formatFromInputDatetime = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      if (str.includes("T")) {
        const [d, t] = str.split("T");
        return `${d} ${t.length === 5 ? t + ":00" : t}`;
      }
      return str;
    };

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode = currentData.banner_mode ||
      (currentData.banner && (currentData.banner.startsWith("http://") || currentData.banner.startsWith("https://")) ? "url" : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ リンク -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${currentData.id}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">リンク</label>
          <input
            class="admin-form-input"
            name="link"
            type="url"
            value="${currentData.link || ""}"
            placeholder="https://example.com/event"
          />
        </div>
      </div>

      <!-- 行2: 開始日時 ｜ 終了日時 (カレンダーピッカー) -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            開始日時
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="start_at"
            type="datetime-local"
            value="${formatToInputDatetime(currentData.start_at)}"
            step="60"
            required
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            終了日時
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="end_at"
            type="datetime-local"
            value="${formatToInputDatetime(currentData.end_at)}"
            step="60"
            required
          />
        </div>
      </div>

      <!-- 行3: 画像選択 (バナー画像) -->
      <div class="admin-visual-field-card" style="margin-top: 4px;">
        <div class="admin-visual-field-header">
          <label class="admin-form-label" style="margin: 0; font-size: 0.95rem; font-weight: 700;">
            画像選択 (バナー画像)
            <span class="admin-form-label-required">*必須</span>
          </label>
          <div class="admin-visual-mode-toggle">
            <label class="admin-visual-radio-label">
              <input type="radio" name="banner_mode" value="library" ${initialMode === "library" ? "checked" : ""}>
              <span>ライブラリ参照</span>
            </label>
            <label class="admin-visual-radio-label">
              <input type="radio" name="banner_mode" value="url" ${initialMode === "url" ? "checked" : ""}>
              <span>直URL指定</span>
            </label>
          </div>
        </div>

        <div class="admin-visual-field-body">
          <div class="admin-visual-input-col">
            <!-- ライブラリ選択UI -->
            <div id="mode-library-banner" class="admin-visual-mode-panel" style="${initialMode === "library" ? "" : "display: none;"}">
              <div style="display: flex; gap: 8px; align-items: center;">
                <select class="admin-form-input admin-visual-file-select" data-field="banner" style="flex: 1;">
                  <option value="">-- ライブラリから画像を選択 --</option>
                  ${this.eventLibraryCache.map((fn) => `
                    <option value="${fn}" ${currentData.banner === fn ? "selected" : ""}>${fn}</option>
                  `).join("")}
                </select>
                <button type="button" class="app-btn app-btn-secondary admin-event-upload-btn" data-field="banner" style="white-space: nowrap;">
                  📤 アップロード
                </button>
              </div>
              <span class="admin-form-hint">assets/event 配下の画像をプルダウンで選択、または新規アップロードできます</span>
            </div>

            <!-- 直URL指定UI -->
            <div id="mode-url-banner" class="admin-visual-mode-panel" style="${initialMode === "url" ? "" : "display: none;"}">
              <input
                class="admin-form-input admin-visual-url-input"
                data-field="banner"
                type="url"
                value="${initialMode === "url" ? currentData.banner || "" : ""}"
                placeholder="https://drive.google.com/file/d/... または画像URL"
              />
              <span class="admin-form-hint">Googleドライブの共有URL、または画像の直接URLを入力してください（ドライブURLは自動変換されます）</span>
            </div>
          </div>

          <!-- プレビュー枠 (横長バナー用 3:1) -->
          <div class="admin-visual-preview-col" style="min-width: 240px; max-width: 280px;">
            <div id="preview-box-banner" class="admin-visual-preview-box is-banner-box">
              <span class="admin-visual-preview-empty">プレビューなし</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // プレビュー更新関数
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-banner");
      if (!pBox) return;

      const mode = form.querySelector('[name="banner_mode"]:checked')?.value || "library";
      let imgVal = "";
      if (mode === "library") {
        imgVal = form.querySelector('.admin-visual-file-select[data-field="banner"]')?.value || "";
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="banner"]')?.value?.trim() || "";
        imgVal = convertGoogleDriveUrl(raw);
      }

      if (imgVal) {
        const fullUrl = api.resolveAssetUrl(imgVal, "event");
        pBox.innerHTML = `
          <img src="${fullUrl}" alt="バナープレビュー" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\' style=\\'color:#ef4444;\\'>読込失敗</span>';" />
        `;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="banner_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-banner");
        const urlPanel = form.querySelector("#mode-url-banner");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="banner"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="banner"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // アップロードボタン押下
    form.querySelector('.admin-event-upload-btn[data-field="banner"]').onclick = () => {
      const savedState = this.collectEventFormData(form);
      const cfg = {
        label: "イベントバナー画像",
        category: "event",
        uploadPath: "assets/event",
        accept: ".png,.jpg,.jpeg",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "3:1",
        displayMode: "contain",
        maxLongEdge: 1500,
      };
      this.openEventUploadModal("banner", record, savedState, cfg);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const mode = form.querySelector('[name="banner_mode"]:checked')?.value || "library";
      let bannerVal = null;
      if (mode === "library") {
        bannerVal = form.querySelector('.admin-visual-file-select[data-field="banner"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="banner"]')?.value?.trim() || null;
        bannerVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const startAtVal = formatFromInputDatetime(fd.get("start_at"));
      const endAtVal = formatFromInputDatetime(fd.get("end_at"));

      if (!startAtVal || !endAtVal) {
        alert("開始日時と終了日時は必須項目です");
        return;
      }

      if (!bannerVal) {
        alert("バナー画像を選択または入力してください");
        return;
      }

      const payload = {
        id: Number(fd.get("id")),
        link: fd.get("link")?.toString().trim() || null,
        start_at: startAtVal,
        end_at: endAtVal,
        banner: bannerVal,
      };

      // イベントバナー (event) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.eventState.currentRecords.push(payload);
      } else {
        const idx = this.eventState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.eventState.currentRecords[idx] = {
            ...this.eventState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.eventState.currentRecords.push(payload);
        }
      }

      this.eventState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "イベントバナーを一覧に追加しました（※「更新反映」ボタンを押すまでD1には保存されません）"
          : "イベントバナーの変更を一覧に反映しました（※「更新反映」ボタンを押すまでD1には保存されません）"
      );
      await this.loadTab("event");
    };

    Modal.open({
      title: isNew ? "イベントバナーの新規追加" : `イベントバナーの編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * イベントバナー 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectEventFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    const mode = form.querySelector('[name="banner_mode"]:checked')?.value || "library";
    data["banner_mode"] = mode;
    if (mode === "library") {
      data["banner"] = form.querySelector('.admin-visual-file-select[data-field="banner"]')?.value || "";
    } else {
      data["banner"] = form.querySelector('.admin-visual-url-input[data-field="banner"]')?.value || "";
    }
    return data;
  }

  /**
   * イベントバナー 画像アップロードモーダル (インタラクティブ・クロッパー 3:1)
   */
  async openEventUploadModal(field, currentRecord, savedState, cfg) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    let targetW = 1500;
    let targetH = 500;
    const headerTitleText = `トリミング調整 (横長 3:1 (1500×500))`;
    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${cfg.label}</strong> (保存先: <code>${cfg.uploadPath}</code>)</div>
        <div>対応形式: <code>${cfg.accept}</code> ｜ 容量上限: <code>${cfg.maxSizeMB}MB (${maxKB} KB)</code> ｜ 規格比率: <code>${cfg.aspectRatio} (${cfg.displayMode})</code></div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone-event">
        <input type="file" id="upload-file-input-event" accept="${cfg.accept}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCからバナー画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage-event" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span>${headerTitleText}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas-event" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider-event" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn-event" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn-event" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge-event" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input-event" placeholder="例: summer_festival_banner" style="flex: 1;" />
          <span id="upload-ext-label-event" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.jpg</span>
        </div>
        <span id="upload-name-error-event" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openEventModal(currentRecord, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-event");
    const fileInput = wrap.querySelector("#upload-file-input-event");
    const cropStage = wrap.querySelector("#crop-stage-event");
    const cropCanvas = wrap.querySelector("#crop-canvas-event");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-event");
    const fitBtn = wrap.querySelector("#crop-fit-btn-event");
    const centerBtn = wrap.querySelector("#crop-center-btn-event");
    const sizeBadge = wrap.querySelector("#crop-size-badge-event");
    const nameInput = wrap.querySelector("#upload-filename-input-event");
    const extLabel = wrap.querySelector("#upload-ext-label-event");
    const nameError = wrap.querySelector("#upload-name-error-event");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const checkUploadBtnState = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      uploadBtn.disabled = !selectedImg || !isValid || !isSizeValid;
    };

    const renderCanvas = () => {
      if (!selectedImg) return;
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        if (!selectedImg) return;
        const ext = extLabel.textContent.toLowerCase();
        const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
        const quality = ext === ".png" ? undefined : 0.88;

        cropCanvas.toBlob((blob) => {
          if (!blob) return;
          currentBlob = blob;
          const sizeKB = (blob.size / 1024).toFixed(1);
          const limitKB = Math.round(cfg.maxSizeBytes / 1024);
          const isOver = blob.size > cfg.maxSizeBytes;

          if (isOver) {
            sizeBadge.className = "crop-size-badge is-over";
            sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB 超過`;
            isSizeValid = false;
          } else {
            sizeBadge.className = "crop-size-badge is-ok";
            sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB OK`;
            isSizeValid = true;
          }
          checkUploadBtnState();
        }, mimeType, quality);
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) onDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        onDragStart(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.addEventListener("wheel", (e) => {
      if (!selectedImg) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      let newScale = scale * zoomFactor;
      const minS = parseFloat(zoomSlider.min);
      const maxS = parseFloat(zoomSlider.max);
      newScale = Math.max(minS, Math.min(maxS, newScale));
      scale = newScale;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(false);
    }, { passive: false });

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "event_banner";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.eventLibraryCache.includes(fullFileName)) {
            this.eventLibraryCache.push(fullFileName);
          }
          savedState["banner"] = fullFileName;
          savedState["banner_mode"] = "library";
          cleanupListeners();
          this.openEventModal(currentRecord, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for event banner via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.eventLibraryCache.includes(fullFileName)) {
          this.eventLibraryCache.push(fullFileName);
        }

        savedState["banner"] = fullFileName;
        savedState["banner_mode"] = "library";

        cleanupListeners();
        this.openEventModal(currentRecord, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openEventModal(currentRecord, savedState);
      },
    });
  }

  /**
   * お知らせ (notice) 専用の新規・編集モーダル
   */
  async openNoticeModal(record, restoreState = null) {
    const isNew = !record;

    // 全noticeレコードを取得して自動採番とライブラリ一覧候補を準備
    let allNotices = [];
    if (this.noticeState && this.noticeState.isInitialized && this.noticeState.currentRecords.length > 0) {
      allNotices = this.noticeState.currentRecords;
    } else {
      try {
        const res = await api.getTable("notice");
        allNotices = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allNotices = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allNotices.length > 0 ? Math.max(...allNotices.map((r) => Number(r.id) || 0)) + 1 : 1;

    // 現在のデータ (復元データがある場合は復元データを最優先)
    const currentData = {
      id: isNew ? nextId : record.id,
      status: record?.status || "published",
      scheduled_at: record?.scheduled_at || "",
      created_at: record?.created_at || "",
      message: record?.message || "",
      Image: record?.Image || record?.image || "",
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.noticeLibraryCache) {
      this.noticeLibraryCache = [];
    }
    const librarySet = new Set(["noticesample.png", ...this.noticeLibraryCache]);
    allNotices.forEach((row) => {
      const img = row.Image || row.image;
      if (img && typeof img === "string" && !img.startsWith("http")) {
        librarySet.add(img.split("/").pop());
      }
    });
    this.noticeLibraryCache = Array.from(librarySet);

    // 日時変換ヘルパー (YYYY-MM-DD HH:mm:ss <-> YYYY-MM-DDTHH:mm)
    const formatToInputDatetime = (val) => {
      if (!val) return "";
      const str = String(val).trim();
      return str.replace(" ", "T").substring(0, 16);
    };

    const formatFromInputDatetime = (val) => {
      if (!val) return null;
      const str = String(val).trim();
      if (str.includes("T")) {
        const [d, t] = str.split("T");
        return `${d} ${t.length === 5 ? t + ":00" : t}`;
      }
      return str;
    };

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode =
      currentData.image_mode ||
      (currentData.Image && (currentData.Image.startsWith("http://") || currentData.Image.startsWith("https://"))
        ? "url"
        : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ ステータス -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${escapeHtml(currentData.id)}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            ステータス
            <span class="admin-form-label-required">*必須</span>
          </label>
          <select class="admin-form-input" name="status">
            <option value="published" ${currentData.status === "published" ? "selected" : ""}>公開 (published)</option>
            <option value="scheduled" ${currentData.status === "scheduled" ? "selected" : ""}>予約 (scheduled)</option>
            <option value="draft" ${currentData.status === "draft" ? "selected" : ""}>下書き (draft)</option>
          </select>
        </div>
      </div>

      <!-- 行2: 予約投稿時刻 ｜ 送信時刻 -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            予約投稿時刻
            <span style="color: #94a3b8; font-weight: normal; font-size: 0.78rem; margin-left: 4px;">(未設定時は即時公開)</span>
          </label>
          <input
            class="admin-form-input"
            name="scheduled_at"
            type="datetime-local"
            value="${escapeHtml(formatToInputDatetime(currentData.scheduled_at))}"
            step="60"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            送信時刻
            <span style="color: #94a3b8; font-weight: normal; font-size: 0.78rem; margin-left: 4px;">(${isNew ? "新規保存時に自動設定" : "作成日時"})</span>
          </label>
          <input
            class="admin-form-input"
            name="created_at"
            type="text"
            value="${escapeHtml(currentData.created_at || (isNew ? "保存時に自動設定" : "-"))}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>
      </div>

      <!-- 行3: お知らせ本文 -->
      <div class="admin-form-group">
        <label class="admin-form-label">
          お知らせ本文
          <span class="admin-form-label-required">*必須</span>
        </label>
        <textarea
          class="admin-form-textarea"
          name="message"
          rows="4"
          placeholder="お知らせ本文を入力してください"
          required
        >${escapeHtml(currentData.message || "")}</textarea>
      </div>

      <!-- 行4: 画像選択 (Image) -->
      <div class="admin-visual-field-card" style="margin-top: 4px;">
        <div class="admin-visual-field-header">
          <label class="admin-form-label" style="margin: 0; font-size: 0.95rem; font-weight: 700;">
            画像選択 (画像)
          </label>
          <div class="admin-visual-mode-toggle">
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="library" ${initialMode === "library" ? "checked" : ""}>
              <span>ライブラリ参照</span>
            </label>
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="url" ${initialMode === "url" ? "checked" : ""}>
              <span>直URL指定</span>
            </label>
          </div>
        </div>

        <div class="admin-visual-field-body">
          <div class="admin-visual-input-col">
            <!-- ライブラリ選択UI -->
            <div id="mode-library-notice" class="admin-visual-mode-panel" style="${initialMode === "library" ? "" : "display: none;"}">
              <div style="display: flex; gap: 8px; align-items: center;">
                <select class="admin-form-input admin-visual-file-select" data-field="Image" style="flex: 1;">
                  <option value="">-- 画像を選択しない (なし) --</option>
                  ${this.noticeLibraryCache.map((fn) => `
                    <option value="${escapeHtml(fn)}" ${currentData.Image === fn ? "selected" : ""}>${escapeHtml(fn)}</option>
                  `).join("")}
                </select>
                <button type="button" class="app-btn app-btn-secondary admin-notice-upload-btn" data-field="Image" style="white-space: nowrap;">
                  📤 アップロード
                </button>
              </div>
              <span class="admin-form-hint">assets/notice 配下の画像をプルダウンで選択、または新規アップロードできます</span>
            </div>

            <!-- 直URL指定UI -->
            <div id="mode-url-notice" class="admin-visual-mode-panel" style="${initialMode === "url" ? "" : "display: none;"}">
              <input
                class="admin-form-input admin-visual-url-input"
                data-field="Image"
                type="url"
                value="${initialMode === "url" ? escapeHtml(currentData.Image || "") : ""}"
                placeholder="https://drive.google.com/file/d/... または画像URL"
              />
              <span class="admin-form-hint">Googleドライブの共有URL、または画像の直接URLを入力してください（ドライブURLは自動変換されます）</span>
            </div>
          </div>

          <!-- プレビュー枠 (アスペクト比 16:9) -->
          <div class="admin-visual-preview-col" style="min-width: 240px; max-width: 280px;">
            <div id="preview-box-notice-image" class="admin-visual-preview-box is-notice-box">
              <span class="admin-visual-preview-empty">プレビューなし</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // プレビュー更新関数
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-notice-image");
      if (!pBox) return;

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imgVal = "";
      if (mode === "library") {
        imgVal = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value || "";
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value?.trim() || "";
        imgVal = convertGoogleDriveUrl(raw);
      }

      if (imgVal) {
        const fullUrl = api.resolveAssetUrl(imgVal, "notice");
        pBox.innerHTML = `
          <img src="${escapeHtml(fullUrl)}" alt="お知らせ画像プレビュー" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\' style=\\'color:#ef4444;\\'>読込失敗</span>';" />
        `;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="image_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-notice");
        const urlPanel = form.querySelector("#mode-url-notice");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="Image"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="Image"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // アップロードボタン押下
    form.querySelector('.admin-notice-upload-btn[data-field="Image"]').onclick = () => {
      const savedState = this.collectNoticeFormData(form);
      const cfg = {
        label: "お知らせ画像",
        category: "notice",
        uploadPath: "assets/notice",
        accept: ".png,.jpg,.jpeg,.webp",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "16:9",
        displayMode: "contain",
        maxLongEdge: 1280,
      };
      this.openNoticeUploadModal("Image", record, savedState, cfg);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imageVal = null;
      if (mode === "library") {
        imageVal = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value?.trim() || null;
        imageVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const statusVal = fd.get("status")?.toString().trim() || "published";
      const scheduledAtVal = formatFromInputDatetime(fd.get("scheduled_at"));
      const messageVal = fd.get("message")?.toString().trim();

      if (!messageVal) {
        alert("お知らせ本文は必須項目です");
        return;
      }

      if (statusVal === "scheduled" && !scheduledAtVal) {
        alert("予約投稿の場合は、予約投稿時刻を入力してください");
        return;
      }

      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

      const payload = {
        id: Number(fd.get("id")),
        status: statusVal,
        scheduled_at: scheduledAtVal,
        created_at: currentData.created_at || nowStr,
        message: messageVal,
        Image: imageVal || null,
      };

      // お知らせ (notice) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.noticeState.currentRecords.push(payload);
      } else {
        const idx = this.noticeState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.noticeState.currentRecords[idx] = {
            ...this.noticeState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.noticeState.currentRecords.push(payload);
        }
      }

      this.noticeState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "お知らせを一覧に追加しました（※「更新反映」ボタンを押すまでD1には保存されません）"
          : "お知らせの変更を一覧に反映しました（※「更新反映」ボタンを押すまでD1には保存されません）"
      );
      await this.loadTab("notice");
    };

    Modal.open({
      title: isNew ? "お知らせの新規追加" : `お知らせの編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * お知らせ 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectNoticeFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
    data["image_mode"] = mode;
    if (mode === "library") {
      data["Image"] = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value || "";
    } else {
      data["Image"] = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value || "";
    }
    return data;
  }

  /**
   * お知らせ 画像アップロードモーダル (インタラクティブ・クロッパー 16:9)
   */
  async openNoticeUploadModal(field, currentRecord, savedState, cfg) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    let targetW = 1280;
    let targetH = 720;
    const headerTitleText = `トリミング調整 (横長 16:9 (1280×720))`;
    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${escapeHtml(cfg.label)}</strong> (保存先: <code>${escapeHtml(cfg.uploadPath)}</code>)</div>
        <div>対応形式: <code>${escapeHtml(cfg.accept)}</code> ｜ 容量上限: <code>${escapeHtml(cfg.maxSizeMB)}MB (${maxKB} KB)</code> ｜ 規格比率: <code>${escapeHtml(cfg.aspectRatio)} (${escapeHtml(cfg.displayMode)})</code></div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone-notice">
        <input type="file" id="upload-file-input-notice" accept="${escapeHtml(cfg.accept)}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCからお知らせ画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage-notice" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span>${escapeHtml(headerTitleText)}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas-notice" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider-notice" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn-notice" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn-notice" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge-notice" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input-notice" placeholder="例: notice_image_202610" style="flex: 1;" />
          <span id="upload-ext-label-notice" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.jpg</span>
        </div>
        <span id="upload-name-error-notice" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openNoticeModal(currentRecord, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-notice");
    const fileInput = wrap.querySelector("#upload-file-input-notice");
    const cropStage = wrap.querySelector("#crop-stage-notice");
    const cropCanvas = wrap.querySelector("#crop-canvas-notice");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-notice");
    const fitBtn = wrap.querySelector("#crop-fit-btn-notice");
    const centerBtn = wrap.querySelector("#crop-center-btn-notice");
    const sizeBadge = wrap.querySelector("#crop-size-badge-notice");
    const nameInput = wrap.querySelector("#upload-filename-input-notice");
    const extLabel = wrap.querySelector("#upload-ext-label-notice");
    const nameError = wrap.querySelector("#upload-name-error-notice");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const checkUploadBtnState = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      uploadBtn.disabled = !selectedImg || !isValid || !isSizeValid;
    };

    const renderCanvas = () => {
      if (!selectedImg) return;
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        if (!selectedImg) return;
        const ext = extLabel.textContent.toLowerCase();
        let mimeType = "image/jpeg";
        let quality = 0.85;
        if (ext === ".png") {
          mimeType = "image/png";
          quality = undefined;
        } else if (ext === ".webp") {
          mimeType = "image/webp";
          quality = 0.85;
        }

        cropCanvas.toBlob(
          (blob) => {
            if (!blob) return;
            currentBlob = blob;
            const sizeKB = (blob.size / 1024).toFixed(1);
            const limitKB = Math.round(cfg.maxSizeBytes / 1024);
            const isOver = blob.size > cfg.maxSizeBytes;

            if (isOver) {
              sizeBadge.className = "crop-size-badge is-over";
              sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB 超過`;
              isSizeValid = false;
            } else {
              sizeBadge.className = "crop-size-badge is-ok";
              sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB OK`;
              isSizeValid = true;
            }
            checkUploadBtnState();
          },
          mimeType,
          quality
        );
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) onDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!selectedImg) return;
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        let newScale = scale * zoomFactor;
        const minS = parseFloat(zoomSlider.min);
        const maxS = parseFloat(zoomSlider.max);
        newScale = Math.max(minS, Math.min(maxS, newScale));
        scale = newScale;
        zoomSlider.value = scale;
        renderCanvas();
        scheduleSizeUpdate(false);
      },
      { passive: false }
    );

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "notice_image";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.noticeLibraryCache.includes(fullFileName)) {
            this.noticeLibraryCache.push(fullFileName);
          }
          savedState["Image"] = fullFileName;
          savedState["image_mode"] = "library";
          cleanupListeners();
          this.openNoticeModal(currentRecord, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for notice image via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.noticeLibraryCache.includes(fullFileName)) {
          this.noticeLibraryCache.push(fullFileName);
        }

        savedState["Image"] = fullFileName;
        savedState["image_mode"] = "library";

        cleanupListeners();
        this.openNoticeModal(currentRecord, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openNoticeModal(currentRecord, savedState);
      },
    });
  }

  /**
   * スケジュール管理タブ (scheduleTag 管理アコーディオン + アコーディオン付きスケジュール一覧)
   */
  async renderScheduleTab() {
    let schedules = [];
    let tags = [];

    try {
      if (!this.scheduleState.isInitialized) {
        const schedulesRes = await api.getTable("schedule").catch(() => []);
        const rawList = Array.isArray(schedulesRes) ? schedulesRes : (schedulesRes ? [schedulesRes] : []);
        this.scheduleState.originalRecords = JSON.parse(JSON.stringify(rawList));
        this.scheduleState.currentRecords = JSON.parse(JSON.stringify(rawList));
        this.scheduleState.hasPendingChanges = false;
        this.scheduleState.isInitialized = true;
      }
      schedules = this.scheduleState.currentRecords;

      const tagsRes = await api.getTable("scheduleTag").catch(() => []);
      tags = Array.isArray(tagsRes) ? tagsRes : (tagsRes ? [tagsRes] : []);
    } catch (err) {
      console.error("[Schedule Data Load Error]:", err);
      schedules = this.scheduleState.currentRecords || [];
      tags = [];
    }

    // タグのマップ (ID -> タグオブジェクト)
    const tagMap = new Map(tags.map((t) => [String(t.id), t]));

    const container = document.createElement("div");
    container.style.cssText = "display: flex; flex-direction: column; gap: 20px;";

    // ========================================================
    // 1. スケジュールタグ (scheduleTag) 管理アコーディオン
    // ========================================================
    const tagCard = document.createElement("div");
    tagCard.className = "admin-tag-manager-card";

    let isTagOpen = true;

    tagCard.innerHTML = `
      <div class="admin-tag-manager-header" id="tag-manager-toggle-btn">
        <div class="admin-tag-manager-title">
          <h2 class="admin-card-title">タグ</h2>
          <span class="admin-count-badge">${tags.length}件</span>
        </div>
        <span class="admin-tag-manager-arrow" id="tag-manager-arrow">▲</span>
      </div>
      <div class="admin-tag-manager-body" id="tag-manager-body">
        <div class="admin-tag-input-row">
          <input
            type="text"
            class="admin-form-input"
            id="new-tag-name-input"
            placeholder="新しいタグ名 (例: 配信、イベント、グッズ)"
          />
          <button type="button" class="app-btn app-btn-primary" id="add-tag-btn" style="white-space: nowrap; padding: 8px 20px;">
            追加
          </button>
        </div>
        <div class="admin-tag-chips-container" id="tag-chips-container">
          ${tags.length === 0 ? '<span style="color: #64748b; font-size: 0.85rem;">登録されているタグはありません</span>' : ""}
          ${tags.map((t) => `
            <div class="admin-tag-chip" data-id="${escapeHtml(t.id)}">
              <span>${escapeHtml(t.tagName)} <span class="admin-tag-chip-id">(ID: ${escapeHtml(t.id)})</span></span>
              <button type="button" class="admin-tag-chip-del" data-id="${escapeHtml(t.id)}" title="削除">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // アコーディオン開閉トグル
    const toggleBtn = tagCard.querySelector("#tag-manager-toggle-btn");
    const tagBody = tagCard.querySelector("#tag-manager-body");
    const tagArrow = tagCard.querySelector("#tag-manager-arrow");
    toggleBtn.onclick = () => {
      isTagOpen = !isTagOpen;
      tagBody.style.display = isTagOpen ? "flex" : "none";
      tagArrow.textContent = isTagOpen ? "▲" : "▼";
    };

    // タグ追加処理
    const tagInput = tagCard.querySelector("#new-tag-name-input");
    const addTagBtn = tagCard.querySelector("#add-tag-btn");

    const handleAddTag = async () => {
      const val = tagInput.value.trim();
      if (!val) {
        alert("タグ名を入力してください");
        tagInput.focus();
        return;
      }

      addTagBtn.disabled = true;
      try {
        const nextId = tags.length > 0 ? Math.max(...tags.map((t) => Number(t.id) || 0)) + 1 : 1;
        await api.saveTable("scheduleTag", { id: nextId, tagName: val }, null);
        Toast.success(`タグ「${val}」を追加しました`);
        await this.renderScheduleTab();
      } catch (e) {
        console.error("[Add Tag Error]:", e);
        Toast.error(`タグの追加に失敗しました: ${e.message}`);
        addTagBtn.disabled = false;
      }
    };

    addTagBtn.onclick = handleAddTag;
    tagInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    };

    // タグ削除処理
    tagCard.querySelectorAll(".admin-tag-chip-del").forEach((delBtn) => {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const tagId = delBtn.dataset.id;
        const targetTag = tags.find((t) => String(t.id) === String(tagId));
        const tagName = targetTag?.tagName || tagId;

        const ok = confirm(
          `タグ「${tagName}」を削除しますか？\n\n※このタグを使用しているスケジュールがある場合、タグ表示に影響する可能性があります。`
        );
        if (!ok) return;

        try {
          await api.deleteRecord("scheduleTag", tagId);
          Toast.info(`タグ「${tagName}」を削除しました`);
          await this.renderScheduleTab();
        } catch (err) {
          console.error("[Delete Tag Error]:", err);
          Toast.error(`タグの削除に失敗しました: ${err.message}`);
        }
      };
    });

    container.appendChild(tagCard);

    // ========================================================
    // 2. スケジュール管理テーブル (操作/id/タイトル/タグ/日にち・時間/公開フラグ)
    // ========================================================
    const card = document.createElement("div");
    card.className = "admin-card";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "admin-card-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "admin-card-title-group";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";

    const h2 = document.createElement("h2");
    h2.className = "admin-card-title";
    h2.textContent = "スケジュール管理";
    titleRow.appendChild(h2);

    const countBadge = document.createElement("span");
    countBadge.className = "admin-count-badge";
    countBadge.textContent = `${schedules.length}件`;
    titleRow.appendChild(countBadge);

    titleGroup.appendChild(titleRow);
    header.appendChild(titleGroup);

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const addBtn = document.createElement("button");
    addBtn.className = "app-btn app-btn-primary";
    addBtn.innerHTML = "+ 新規追加";
    addBtn.onclick = () => this.openScheduleModal(null, tags);
    actions.appendChild(addBtn);

    // 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    const commitBtn = document.createElement("button");
    commitBtn.id = "schedule-commit-btn";
    commitBtn.className = "app-btn app-btn-orange";

    const changesCount = this.getScheduleChangesCount();
    if (this.scheduleState.hasPendingChanges && changesCount > 0) {
      commitBtn.classList.add("has-changes");
      commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
      commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
      commitBtn.disabled = false;
    } else {
      commitBtn.innerHTML = `<span>更新反映</span>`;
      commitBtn.title = "D1に未反映の変更はありません";
      commitBtn.disabled = true;
    }

    commitBtn.onclick = async () => {
      await this.commitScheduleChanges();
    };
    actions.appendChild(commitBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // スケジュール管理で未反映の変更がある場合は通知アラートを表示
    if (this.scheduleState.hasPendingChanges && changesCount > 0) {
      const alertBar = document.createElement("div");
      alertBar.className = "admin-pending-alert";
      alertBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>⚠️</span>
          <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
        </div>
        <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
      `;
      alertBar.querySelector("button").onclick = async () => {
        await this.commitScheduleChanges();
      };
      card.appendChild(alertBar);
    }

    // テーブル生成
    const tableContainer = document.createElement("div");
    tableContainer.className = "admin-table-container";

    const table = document.createElement("table");
    table.className = "admin-table";

    // thead
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th class="admin-table-col-actions" style="width: 80px; text-align: center;">操作</th>
        <th style="width: 75px; text-align: center;">詳細</th>
        <th style="width: 60px; text-align: center;">id</th>
        <th>タイトル</th>
        <th style="width: 140px;">タグ</th>
        <th class="admin-table-col-notice-time" style="width: 180px;">
          <div class="admin-th-tworow">
            <span>日にち</span>
            <span class="admin-th-sub">時間</span>
          </div>
        </th>
        <th style="width: 120px; text-align: center;">公開フラグ</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (schedules.length === 0) {
      const emptyTr = document.createElement("tr");
      emptyTr.innerHTML = `
        <td colspan="7" style="text-align: center; color: #64748b; padding: 36px 16px;">
          スケジュールデータがありません。「+ 新規追加」ボタンから登録してください。
        </td>
      `;
      tbody.appendChild(emptyTr);
    } else {
      schedules.forEach((item) => {
        const trMain = document.createElement("tr");
        trMain.className = "admin-schedule-row";

        const trDetail = document.createElement("tr");
        trDetail.className = "admin-schedule-detail-row";
        trDetail.style.display = "none";

        let isRowOpen = false;

        // 1. 操作列 (縦並び「編集」「削除」)
        const tdActions = document.createElement("td");
        tdActions.className = "admin-table-col-actions";
        tdActions.style.textAlign = "center";

        const actWrap = document.createElement("div");
        actWrap.className = "admin-table-actions is-vertical";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "app-btn app-btn-secondary app-btn-sm";
        editBtn.textContent = "編集";
        editBtn.onclick = (e) => {
          e.stopPropagation();
          this.openScheduleModal(item, tags);
        };

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "app-btn app-btn-danger app-btn-sm";
        delBtn.textContent = "削除";
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.deleteRecord("schedule", item.id);
        };

        actWrap.appendChild(editBtn);
        actWrap.appendChild(delBtn);
        tdActions.appendChild(actWrap);
        trMain.appendChild(tdActions);

        // 2. 開閉トグル列 (操作とidの間)
        const tdToggle = document.createElement("td");
        tdToggle.style.textAlign = "center";
        tdToggle.style.width = "75px";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "admin-accordion-toggle-btn";
        toggleBtn.id = `toggle-indicator-${item.id}`;
        toggleBtn.textContent = "開く ▼";
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          toggleAccordion();
        };
        tdToggle.appendChild(toggleBtn);
        trMain.appendChild(tdToggle);

        // 3. id列
        const tdId = document.createElement("td");
        tdId.style.textAlign = "center";
        tdId.textContent = item.id;
        trMain.appendChild(tdId);

        // 4. タイトル列
        const tdTitle = document.createElement("td");
        tdTitle.innerHTML = `<span class="admin-schedule-title-text">${escapeHtml(item.title || "")}</span>`;
        trMain.appendChild(tdTitle);

        // 5. タグ列 (scheduleTag_id -> tagName)
        const tdTag = document.createElement("td");
        const tagObj = tagMap.get(String(item.scheduleTag_id));
        if (tagObj) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge">${escapeHtml(tagObj.tagName)}</span>`;
        } else if (item.scheduleTag_id) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge" style="opacity: 0.7;">ID: ${escapeHtml(item.scheduleTag_id)}</span>`;
        } else {
          tdTag.innerHTML = `<span style="color: #64748b;">-</span>`;
        }
        trMain.appendChild(tdTag);

        // 6. 日にち / 時間 (2段表示)
        const tdDateTime = document.createElement("td");
        tdDateTime.className = "admin-table-col-notice-time";
        tdDateTime.innerHTML = `
          <div class="admin-table-twoline-datetime">
            <div class="admin-time-row is-created">
              <span class="admin-time-badge is-created" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border-color: rgba(59, 130, 246, 0.3);">日にち</span>
              <span class="admin-time-val">${escapeHtml(item.schedule_at || "-")}</span>
            </div>
            <div class="admin-time-row is-scheduled">
              <span class="admin-time-badge is-scheduled" style="background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.3);">時間</span>
              <span class="admin-time-val">${escapeHtml(item.time || "-")}</span>
            </div>
          </div>
        `;
        trMain.appendChild(tdDateTime);

        // 7. 公開フラグ (トグルスイッチ表示)
        const tdActive = document.createElement("td");
        tdActive.style.textAlign = "center";

        const isActive = item.is_active === 1 || item.is_active === true || item.is_active === "1";

        const switchLabel = document.createElement("label");
        switchLabel.className = "admin-switch-label";
        switchLabel.style.cssText = "justify-content: center; margin: 0 auto;";

        const switchInput = document.createElement("input");
        switchInput.type = "checkbox";
        switchInput.className = "admin-switch-input";
        switchInput.checked = isActive;

        const switchSlider = document.createElement("span");
        switchSlider.className = "admin-switch-slider";

        const statusText = document.createElement("span");
        statusText.className = "admin-switch-status-text";
        statusText.style.cssText = "font-size: 0.82rem; min-width: 42px; text-align: left;";
        statusText.textContent = isActive ? "表示" : "非表示";

        switchInput.onchange = (e) => {
          e.stopPropagation();
          const newActive = switchInput.checked ? 1 : 0;
          statusText.textContent = newActive ? "表示" : "非表示";
          item.is_active = newActive;
          this.scheduleState.hasPendingChanges = true;
          this.renderScheduleTab();
        };

        // トグルのクリックがアコーディオン開閉をトリガーしないようバブリング防止
        switchLabel.onclick = (e) => e.stopPropagation();

        switchLabel.appendChild(switchInput);
        switchLabel.appendChild(switchSlider);
        switchLabel.appendChild(statusText);
        tdActive.appendChild(switchLabel);
        trMain.appendChild(tdActive);

        // ========================================================
        // アコーディオン詳細行 (detail / Image / link)
        // ========================================================
        const tdDetailCell = document.createElement("td");
        tdDetailCell.colSpan = 7;
        tdDetailCell.className = "admin-schedule-detail-cell";

        const detailBox = document.createElement("div");
        detailBox.className = "admin-schedule-detail-box";

        // 詳細 (detail)
        const secDetail = document.createElement("div");
        secDetail.className = "admin-schedule-detail-section";
        secDetail.innerHTML = `
          <div class="admin-schedule-detail-heading">
            <span>📝 詳細</span>
          </div>
          <div class="admin-schedule-detail-body is-text">
            ${item.detail ? escapeHtml(item.detail) : '<span style="color: #64748b;">(詳細なし)</span>'}
          </div>
        `;
        detailBox.appendChild(secDetail);

        // 画像 (Image)
        const secImage = document.createElement("div");
        secImage.className = "admin-schedule-detail-section";
        const hasImg = item.Image || item.image;
        if (hasImg) {
          const imgUrl = api.resolveAssetUrl(hasImg, "schedule");
          secImage.innerHTML = `
            <div class="admin-schedule-detail-heading">
              <span>🖼️ 画像</span>
            </div>
            <div class="admin-schedule-detail-body">
              <div class="admin-schedule-img-wrap">
                <img src="${escapeHtml(imgUrl)}" alt="スケジュール画像" class="admin-schedule-detail-img" title="クリックで拡大表示" />
                <span class="admin-schedule-img-name">${escapeHtml(hasImg)}</span>
              </div>
            </div>
          `;
          secImage.querySelector("img").onclick = (e) => {
            e.stopPropagation();
            this.openImageDetailModal(imgUrl, item.title || "スケジュール画像", {
              costumeName: item.title,
              columnLabel: "スケジュール画像",
              path: hasImg,
            });
          };
        } else {
          secImage.innerHTML = `
            <div class="admin-schedule-detail-heading">
              <span>🖼️ 画像</span>
            </div>
            <div class="admin-schedule-detail-body">
              <span style="color: #64748b;">(画像なし)</span>
            </div>
          `;
        }
        detailBox.appendChild(secImage);

        // リンク (link)
        const secLink = document.createElement("div");
        secLink.className = "admin-schedule-detail-section";
        if (item.link) {
          secLink.innerHTML = `
            <div class="admin-schedule-detail-heading">
              <span>🔗 リンク</span>
            </div>
            <div class="admin-schedule-detail-body">
              <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer" class="admin-schedule-link-anchor" title="${escapeHtml(item.link)}">
                ${escapeHtml(item.link)} ↗
              </a>
            </div>
          `;
        } else {
          secLink.innerHTML = `
            <div class="admin-schedule-detail-heading">
              <span>🔗 リンク</span>
            </div>
            <div class="admin-schedule-detail-body">
              <span style="color: #64748b;">(リンクなし)</span>
            </div>
          `;
        }
        detailBox.appendChild(secLink);

        tdDetailCell.appendChild(detailBox);
        trDetail.appendChild(tdDetailCell);

        // 行クリックまたはトグルボタンでアコーディオン開閉
        const toggleAccordion = () => {
          isRowOpen = !isRowOpen;
          trDetail.style.display = isRowOpen ? "table-row" : "none";
          const indicator = trMain.querySelector(`#toggle-indicator-${item.id}`);
          if (indicator) {
            indicator.textContent = isRowOpen ? "閉じる ▲" : "開く ▼";
            indicator.classList.toggle("is-open", isRowOpen);
          }
        };

        trMain.onclick = toggleAccordion;

        tbody.appendChild(trMain);
        tbody.appendChild(trDetail);
      });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    container.appendChild(card);

    this.container.innerHTML = "";
    this.container.appendChild(container);
  }

  /**
   * スケジュール (schedule) 専用の新規・編集モーダル
   */
  async openScheduleModal(record, tags = null, restoreState = null) {
    const isNew = !record;

    // タグ一覧の取得 (渡されていない場合)
    let allTags = tags;
    if (!allTags || !Array.isArray(allTags) || allTags.length === 0) {
      try {
        const res = await api.getTable("scheduleTag");
        allTags = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allTags = [];
      }
    }

    // 全スケジュール取得 (ID自動採番 & ライブラリキャッシュ用)
    let allSchedules = [];
    if (this.scheduleState && this.scheduleState.isInitialized && this.scheduleState.currentRecords.length > 0) {
      allSchedules = this.scheduleState.currentRecords;
    } else {
      try {
        const res = await api.getTable("schedule");
        allSchedules = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allSchedules = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allSchedules.length > 0 ? Math.max(...allSchedules.map((s) => Number(s.id) || 0)) + 1 : 1;

    // 現在のデータ
    const currentData = {
      id: isNew ? nextId : record.id,
      title: record?.title || "",
      scheduleTag_id: record?.scheduleTag_id || (allTags[0]?.id || ""),
      schedule_at: record?.schedule_at || "",
      time: record?.time || "",
      is_active: record ? (record.is_active === 1 || record.is_active === true || record.is_active === "1") : true,
      detail: record?.detail || "",
      Image: record?.Image || record?.image || "",
      link: record?.link || "",
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.scheduleLibraryCache) {
      this.scheduleLibraryCache = [];
    }
    const librarySet = new Set(["schedulesample.png", ...this.scheduleLibraryCache]);
    allSchedules.forEach((row) => {
      const img = row.Image || row.image;
      if (img && typeof img === "string" && !img.startsWith("http")) {
        librarySet.add(img.split("/").pop());
      }
    });
    this.scheduleLibraryCache = Array.from(librarySet);

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode =
      currentData.image_mode ||
      (currentData.Image && (currentData.Image.startsWith("http://") || currentData.Image.startsWith("https://"))
        ? "url"
        : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ 公開フラグ -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${escapeHtml(currentData.id)}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">公開フラグ (表示/非表示)</label>
          <div style="padding-top: 6px;">
            <label class="admin-switch-label">
              <input type="checkbox" name="is_active" class="admin-switch-input" ${currentData.is_active ? "checked" : ""} />
              <span class="admin-switch-slider"></span>
              <span class="admin-switch-status-text">${currentData.is_active ? "表示" : "非表示"}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 行2: タイトル ｜ タグ -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            タイトル
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="title"
            type="text"
            value="${escapeHtml(currentData.title)}"
            placeholder="例: 定期配信 #42"
            required
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            タグ
            <span class="admin-form-label-required">*必須</span>
          </label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select class="admin-form-input" name="scheduleTag_id" id="modal-schedule-tag-select" required style="flex: 1;">
              ${allTags.length === 0 ? '<option value="">(タグが未登録です)</option>' : ""}
              ${allTags.map((t) => `
                <option value="${escapeHtml(t.id)}" ${String(currentData.scheduleTag_id) === String(t.id) ? "selected" : ""}>
                  ${escapeHtml(t.tagName)} (ID: ${escapeHtml(t.id)})
                </option>
              `).join("")}
            </select>
            <button type="button" class="app-btn app-btn-secondary" id="btn-toggle-modal-tag" style="white-space: nowrap; padding: 8px 14px; font-size: 0.85rem;">
              ＋ タグ追加
            </button>
          </div>

          <!-- インラインタグ追加パネル -->
          <div id="modal-inline-tag-panel" style="display: none; margin-top: 8px; padding: 10px 12px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-sm, 6px);">
            <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>新規タグ名を入力してください:</span>
              <button type="button" id="btn-modal-tag-close" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 0 4px; line-height: 1;" title="閉じる">×</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                class="admin-form-input"
                id="modal-inline-tag-input"
                placeholder="新しいタグ名 (例: 配信、グッズ、コラボ)"
                style="flex: 1; padding: 6px 10px; font-size: 0.85rem;"
              />
              <button type="button" class="app-btn app-btn-primary app-btn-sm" id="btn-modal-tag-submit" style="white-space: nowrap; padding: 6px 14px; font-size: 0.82rem;">
                追加
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 行3: 日にち ｜ 時間 -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            日にち
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="schedule_at"
            type="date"
            value="${escapeHtml(currentData.schedule_at)}"
            required
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            時間 (time)
            <span style="color: #94a3b8; font-weight: normal; font-size: 0.78rem; margin-left: 4px;">(任意)</span>
          </label>
          <input
            class="admin-form-input"
            name="time"
            type="time"
            value="${escapeHtml(currentData.time)}"
          />
        </div>
      </div>

      <!-- 行4: 外部リンク -->
      <div class="admin-form-group">
        <label class="admin-form-label">
          リンク (link)
          <span style="color: #94a3b8; font-weight: normal; font-size: 0.78rem; margin-left: 4px;">(YouTube・配信ページ等)</span>
        </label>
        <input
          class="admin-form-input"
          name="link"
          type="url"
          value="${escapeHtml(currentData.link)}"
          placeholder="https://..."
        />
      </div>

      <!-- 行5: 詳細 -->
      <div class="admin-form-group">
        <label class="admin-form-label">詳細 (detail)</label>
        <textarea
          class="admin-form-textarea"
          name="detail"
          rows="3"
          placeholder="スケジュールの詳細情報を入力してください"
        >${escapeHtml(currentData.detail)}</textarea>
      </div>

      <!-- 行6: 画像選択 (Image) -->
      <div class="admin-visual-field-card" style="margin-top: 4px;">
        <div class="admin-visual-field-header">
          <label class="admin-form-label" style="margin: 0; font-size: 0.95rem; font-weight: 700;">
            画像選択 (Image)
          </label>
          <div class="admin-visual-mode-toggle">
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="library" ${initialMode === "library" ? "checked" : ""}>
              <span>ライブラリ参照</span>
            </label>
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="url" ${initialMode === "url" ? "checked" : ""}>
              <span>直URL指定</span>
            </label>
          </div>
        </div>

        <div class="admin-visual-field-body">
          <div class="admin-visual-input-col">
            <!-- ライブラリ選択UI -->
            <div id="mode-library-schedule" class="admin-visual-mode-panel" style="${initialMode === "library" ? "" : "display: none;"}">
              <div style="display: flex; gap: 8px; align-items: center;">
                <select class="admin-form-input admin-visual-file-select" data-field="Image" style="flex: 1;">
                  <option value="">-- 画像を選択しない (なし) --</option>
                  ${this.scheduleLibraryCache.map((fn) => `
                    <option value="${escapeHtml(fn)}" ${currentData.Image === fn ? "selected" : ""}>${escapeHtml(fn)}</option>
                  `).join("")}
                </select>
                <button type="button" class="app-btn app-btn-secondary admin-schedule-upload-btn" data-field="Image" style="white-space: nowrap;">
                  📤 アップロード
                </button>
              </div>
              <span class="admin-form-hint">assets/schedule 配下の画像をプルダウンで選択、または新規アップロードできます</span>
            </div>

            <!-- 直URL指定UI -->
            <div id="mode-url-schedule" class="admin-visual-mode-panel" style="${initialMode === "url" ? "" : "display: none;"}">
              <input
                class="admin-form-input admin-visual-url-input"
                data-field="Image"
                type="url"
                value="${initialMode === "url" ? escapeHtml(currentData.Image || "") : ""}"
                placeholder="https://drive.google.com/file/d/... または画像URL"
              />
              <span class="admin-form-hint">Googleドライブの共有URL、または画像の直接URLを入力してください（ドライブURLは自動変換されます）</span>
            </div>
          </div>

          <!-- プレビュー枠 (16:9) -->
          <div class="admin-visual-preview-col" style="min-width: 240px; max-width: 280px;">
            <div id="preview-box-schedule-image" class="admin-visual-preview-box is-schedule-box">
              <span class="admin-visual-preview-empty">プレビューなし</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // スイッチのラベル切り替え
    const swInput = form.querySelector('[name="is_active"]');
    const swText = form.querySelector('.admin-switch-status-text');
    if (swInput && swText) {
      swInput.onchange = () => {
        swText.textContent = swInput.checked ? "表示" : "非表示";
      };
    }

    // タグ追加処理 (インラインパネル)
    const tagSelect = form.querySelector("#modal-schedule-tag-select");
    const toggleTagBtn = form.querySelector("#btn-toggle-modal-tag");
    const tagPanel = form.querySelector("#modal-inline-tag-panel");
    const tagInput = form.querySelector("#modal-inline-tag-input");
    const tagSubmitBtn = form.querySelector("#btn-modal-tag-submit");
    const tagCloseBtn = form.querySelector("#btn-modal-tag-close");

    if (toggleTagBtn && tagPanel && tagInput && tagSubmitBtn) {
      toggleTagBtn.onclick = () => {
        const isVisible = tagPanel.style.display !== "none";
        tagPanel.style.display = isVisible ? "none" : "block";
        if (!isVisible) {
          tagInput.focus();
        }
      };

      if (tagCloseBtn) {
        tagCloseBtn.onclick = () => {
          tagPanel.style.display = "none";
        };
      }

      const handleCreateTag = async () => {
        const val = tagInput.value.trim();
        if (!val) {
          alert("タグ名を入力してください");
          tagInput.focus();
          return;
        }

        // 既存タグとの重複チェック
        const isExist = allTags.some((t) => t.tagName === val);
        if (isExist) {
          const existTag = allTags.find((t) => t.tagName === val);
          tagSelect.value = String(existTag.id);
          Toast.info(`タグ「${val}」は既に存在するため選択しました`);
          tagPanel.style.display = "none";
          tagInput.value = "";
          return;
        }

        tagSubmitBtn.disabled = true;
        try {
          const nextTagId = allTags.length > 0 ? Math.max(...allTags.map((t) => Number(t.id) || 0)) + 1 : 1;
          const newTag = { id: nextTagId, tagName: val };
          await api.saveTable("scheduleTag", newTag, null);

          // allTags 配列と select を更新
          allTags.push(newTag);

          // (タグが未登録です) の空optionがあれば削除
          const emptyOpt = tagSelect.querySelector('option[value=""]');
          if (emptyOpt) emptyOpt.remove();

          const newOpt = document.createElement("option");
          newOpt.value = String(newTag.id);
          newOpt.textContent = `${newTag.tagName} (ID: ${newTag.id})`;
          tagSelect.appendChild(newOpt);
          tagSelect.value = String(newTag.id);

          Toast.success(`タグ「${val}」を追加し、選択しました`);
          tagInput.value = "";
          tagPanel.style.display = "none";
        } catch (err) {
          console.error("[Create Tag Error]:", err);
          Toast.error(`タグの追加に失敗しました: ${err.message}`);
        } finally {
          tagSubmitBtn.disabled = false;
        }
      };

      tagSubmitBtn.onclick = handleCreateTag;
      tagInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleCreateTag();
        } else if (e.key === "Escape") {
          e.preventDefault();
          tagPanel.style.display = "none";
        }
      };
    }

    // プレビュー更新関数
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-schedule-image");
      if (!pBox) return;

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imgVal = "";
      if (mode === "library") {
        imgVal = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value || "";
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value?.trim() || "";
        imgVal = convertGoogleDriveUrl(raw);
      }

      if (imgVal) {
        const fullUrl = api.resolveAssetUrl(imgVal, "schedule");
        pBox.innerHTML = `
          <img src="${escapeHtml(fullUrl)}" alt="スケジュール画像プレビュー" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\' style=\\'color:#ef4444;\\'>読込失敗</span>';" />
        `;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="image_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-schedule");
        const urlPanel = form.querySelector("#mode-url-schedule");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="Image"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="Image"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // アップロードボタン押下
    form.querySelector('.admin-schedule-upload-btn[data-field="Image"]').onclick = () => {
      const savedState = this.collectScheduleFormData(form);
      const cfg = {
        label: "スケジュール画像",
        category: "schedule",
        uploadPath: "assets/schedule",
        accept: ".png,.jpg,.jpeg,.webp",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "16:9",
        displayMode: "contain",
        maxLongEdge: 1280,
      };
      this.openScheduleUploadModal("Image", record, savedState, cfg, allTags);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const titleVal = fd.get("title")?.toString().trim();
      const scheduleAtVal = fd.get("schedule_at")?.toString().trim();

      if (!titleVal) {
        alert("タイトルは必須項目です");
        return;
      }

      if (!scheduleAtVal) {
        alert("日にちは必須項目です");
        return;
      }

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imageVal = null;
      if (mode === "library") {
        imageVal = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value?.trim() || null;
        imageVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const payload = {
        id: Number(fd.get("id")),
        title: titleVal,
        scheduleTag_id: fd.get("scheduleTag_id") ? Number(fd.get("scheduleTag_id")) : null,
        schedule_at: scheduleAtVal,
        time: fd.get("time")?.toString().trim() || null,
        is_active: form.querySelector('[name="is_active"]')?.checked ? 1 : 0,
        detail: fd.get("detail")?.toString().trim() || null,
        Image: imageVal || null,
        link: fd.get("link")?.toString().trim() || null,
      };

      // スケジュール (schedule) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.scheduleState.currentRecords.push(payload);
      } else {
        const idx = this.scheduleState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.scheduleState.currentRecords[idx] = {
            ...this.scheduleState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.scheduleState.currentRecords.push(payload);
        }
      }

      this.scheduleState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "スケジュールを一覧に追加しました（※「更新反映」ボタンを押すまでD1には保存されません）"
          : "スケジュールの変更を一覧に反映しました（※「更新反映」ボタンを押すまでD1には保存されません）"
      );
      await this.renderScheduleTab();
    };

    Modal.open({
      title: isNew ? "スケジュールの新規追加" : `スケジュールの編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * スケジュール 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectScheduleFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    data["is_active"] = form.querySelector('[name="is_active"]')?.checked;
    const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
    data["image_mode"] = mode;
    if (mode === "library") {
      data["Image"] = form.querySelector('.admin-visual-file-select[data-field="Image"]')?.value || "";
    } else {
      data["Image"] = form.querySelector('.admin-visual-url-input[data-field="Image"]')?.value || "";
    }
    return data;
  }

  /**
   * スケジュール 画像アップロードモーダル (インタラクティブ・クロッパー 16:9)
   */
  async openScheduleUploadModal(field, currentRecord, savedState, cfg, tags) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    let targetW = 1280;
    let targetH = 720;
    const headerTitleText = `トリミング調整 (横長 16:9 (1280×720))`;
    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${escapeHtml(cfg.label)}</strong> (保存先: <code>${escapeHtml(cfg.uploadPath)}</code>)</div>
        <div>対応形式: <code>${escapeHtml(cfg.accept)}</code> ｜ 容量上限: <code>${escapeHtml(cfg.maxSizeMB)}MB (${maxKB} KB)</code> ｜ 規格比率: <code>${escapeHtml(cfg.aspectRatio)} (${escapeHtml(cfg.displayMode)})</code></div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone-schedule">
        <input type="file" id="upload-file-input-schedule" accept="${escapeHtml(cfg.accept)}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCからスケジュール画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage-schedule" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span>${escapeHtml(headerTitleText)}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas-schedule" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider-schedule" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn-schedule" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn-schedule" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge-schedule" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input-schedule" placeholder="例: schedule_banner_01" style="flex: 1;" />
          <span id="upload-ext-label-schedule" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.jpg</span>
        </div>
        <span id="upload-name-error-schedule" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openScheduleModal(currentRecord, tags, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-schedule");
    const fileInput = wrap.querySelector("#upload-file-input-schedule");
    const cropStage = wrap.querySelector("#crop-stage-schedule");
    const cropCanvas = wrap.querySelector("#crop-canvas-schedule");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-schedule");
    const fitBtn = wrap.querySelector("#crop-fit-btn-schedule");
    const centerBtn = wrap.querySelector("#crop-center-btn-schedule");
    const sizeBadge = wrap.querySelector("#crop-size-badge-schedule");
    const nameInput = wrap.querySelector("#upload-filename-input-schedule");
    const extLabel = wrap.querySelector("#upload-ext-label-schedule");
    const nameError = wrap.querySelector("#upload-name-error-schedule");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const checkUploadBtnState = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      uploadBtn.disabled = !selectedImg || !isValid || !isSizeValid;
    };

    const renderCanvas = () => {
      if (!selectedImg) return;
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        if (!selectedImg) return;
        const ext = extLabel.textContent.toLowerCase();
        let mimeType = "image/jpeg";
        let quality = 0.85;
        if (ext === ".png") {
          mimeType = "image/png";
          quality = undefined;
        } else if (ext === ".webp") {
          mimeType = "image/webp";
          quality = 0.85;
        }

        cropCanvas.toBlob(
          (blob) => {
            if (!blob) return;
            currentBlob = blob;
            const sizeKB = (blob.size / 1024).toFixed(1);
            const limitKB = Math.round(cfg.maxSizeBytes / 1024);
            const isOver = blob.size > cfg.maxSizeBytes;

            if (isOver) {
              sizeBadge.className = "crop-size-badge is-over";
              sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB 超過`;
              isSizeValid = false;
            } else {
              sizeBadge.className = "crop-size-badge is-ok";
              sizeBadge.textContent = `${sizeKB} KB / ${limitKB} KB OK`;
              isSizeValid = true;
            }
            checkUploadBtnState();
          },
          mimeType,
          quality
        );
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) onDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!selectedImg) return;
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        let newScale = scale * zoomFactor;
        const minS = parseFloat(zoomSlider.min);
        const maxS = parseFloat(zoomSlider.max);
        newScale = Math.max(minS, Math.min(maxS, newScale));
        scale = newScale;
        zoomSlider.value = scale;
        renderCanvas();
        scheduleSizeUpdate(false);
      },
      { passive: false }
    );

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "schedule_image";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.scheduleLibraryCache.includes(fullFileName)) {
            this.scheduleLibraryCache.push(fullFileName);
          }
          savedState["Image"] = fullFileName;
          savedState["image_mode"] = "library";
          cleanupListeners();
          this.openScheduleModal(currentRecord, tags, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for schedule image via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.scheduleLibraryCache.includes(fullFileName)) {
          this.scheduleLibraryCache.push(fullFileName);
        }

        savedState["Image"] = fullFileName;
        savedState["image_mode"] = "library";

        cleanupListeners();
        this.openScheduleModal(currentRecord, tags, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openScheduleModal(currentRecord, tags, savedState);
      },
    });
  }

  /**
   * ギャラリー (gallery) 専用の新規・編集モーダル
   */
  async openGalleryModal(record, restoreState = null) {
    const isNew = !record;

    // 全galleryレコードを取得して自動採番とライブラリ一覧候補を準備
    let allGalleries = [];
    if (this.galleryState && this.galleryState.isInitialized && this.galleryState.currentRecords.length > 0) {
      allGalleries = this.galleryState.currentRecords;
    } else {
      try {
        const res = await api.getTable("gallery");
        allGalleries = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allGalleries = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allGalleries.length > 0 ? Math.max(...allGalleries.map((r) => Number(r.id) || 0)) + 1 : 1;

    // 現在のデータ (復元データがある場合は復元データを最優先)
    const currentData = {
      id: isNew ? nextId : record.id,
      name: record?.name || "",
      image: record?.image || "",
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.galleryLibraryCache) {
      this.galleryLibraryCache = [];
    }
    const librarySet = new Set(["samplegallery.png", ...this.galleryLibraryCache]);
    allGalleries.forEach((row) => {
      const img = row.image;
      if (img && typeof img === "string" && !img.startsWith("http")) {
        librarySet.add(img.split("/").pop());
      }
    });
    this.galleryLibraryCache = Array.from(librarySet);

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode =
      currentData.image_mode ||
      (currentData.image && (currentData.image.startsWith("http://") || currentData.image.startsWith("https://"))
        ? "url"
        : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ 画像名 -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${escapeHtml(currentData.id)}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            画像名
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="name"
            type="text"
            value="${escapeHtml(currentData.name)}"
            placeholder="例: 三面図、表情差分など"
            required
          />
        </div>
      </div>

      <!-- 行2: 画像選択 (画像) -->
      <div class="admin-visual-field-card" style="margin-top: 4px;">
        <div class="admin-visual-field-header">
          <label class="admin-form-label" style="margin: 0; font-size: 0.95rem; font-weight: 700;">
            画像選択 (画像)
            <span class="admin-form-label-required">*必須</span>
          </label>
          <div class="admin-visual-mode-toggle">
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="library" ${initialMode === "library" ? "checked" : ""}>
              <span>ライブラリ参照</span>
            </label>
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="url" ${initialMode === "url" ? "checked" : ""}>
              <span>直URL指定</span>
            </label>
          </div>
        </div>

        <div class="admin-visual-field-body">
          <div class="admin-visual-input-col">
            <!-- ライブラリ選択UI -->
            <div id="mode-library-gallery" class="admin-visual-mode-panel" style="${initialMode === "library" ? "" : "display: none;"}">
              <div style="display: flex; gap: 8px; align-items: center;">
                <select class="admin-form-input admin-visual-file-select" data-field="image" style="flex: 1;">
                  <option value="">-- 画像を選択してください --</option>
                  ${this.galleryLibraryCache.map((fn) => `
                    <option value="${escapeHtml(fn)}" ${currentData.image === fn ? "selected" : ""}>${escapeHtml(fn)}</option>
                  `).join("")}
                </select>
                <button type="button" class="app-btn app-btn-secondary admin-gallery-upload-btn" data-field="image" style="white-space: nowrap;">
                  📤 アップロード
                </button>
              </div>
              <span class="admin-form-hint">assets/gallery 配下の画像をプルダウンで選択、または新規アップロードできます</span>
            </div>

            <!-- 直URL指定UI -->
            <div id="mode-url-gallery" class="admin-visual-mode-panel" style="${initialMode === "url" ? "" : "display: none;"}">
              <input
                class="admin-form-input admin-visual-url-input"
                data-field="image"
                type="url"
                value="${initialMode === "url" ? escapeHtml(currentData.image || "") : ""}"
                placeholder="https://drive.google.com/file/d/... または画像URL"
              />
              <span class="admin-form-hint">Googleドライブの共有URL、または画像の直接URLを入力してください（ドライブURLは自動変換されます）</span>
            </div>
          </div>

          <!-- プレビュー枠 (アスペクト比 16:9) -->
          <div class="admin-visual-preview-col" style="min-width: 240px; max-width: 280px;">
            <div id="preview-box-gallery-image" class="admin-visual-preview-box is-notice-box">
              <span class="admin-visual-preview-empty">プレビューなし</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // プレビュー更新関数
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-gallery-image");
      if (!pBox) return;

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imgVal = "";
      if (mode === "library") {
        imgVal = form.querySelector('.admin-visual-file-select[data-field="image"]')?.value || "";
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="image"]')?.value?.trim() || "";
        imgVal = convertGoogleDriveUrl(raw);
      }

      if (imgVal) {
        const fullUrl = api.resolveAssetUrl(imgVal, "gallery");
        pBox.innerHTML = `
          <img src="${escapeHtml(fullUrl)}" alt="ギャラリー画像プレビュー" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\' style=\\'color:#ef4444;\\'>読込失敗</span>';" />
        `;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="image_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-gallery");
        const urlPanel = form.querySelector("#mode-url-gallery");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="image"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="image"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // アップロードボタン押下
    form.querySelector('.admin-gallery-upload-btn[data-field="image"]').onclick = () => {
      const savedState = this.collectGalleryFormData(form);
      const cfg = {
        label: "ギャラリー画像",
        category: "gallery",
        uploadPath: "assets/gallery",
        accept: ".png,.jpg,.jpeg,.webp",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "16:9",
        displayMode: "contain",
        maxLongEdge: 1280,
      };
      this.openGalleryUploadModal("image", record, savedState, cfg);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imageVal = null;
      if (mode === "library") {
        imageVal = form.querySelector('.admin-visual-file-select[data-field="image"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="image"]')?.value?.trim() || null;
        imageVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const nameVal = fd.get("name")?.toString().trim();

      if (!nameVal) {
        alert("画像名は必須項目です");
        return;
      }

      if (!imageVal) {
        alert("画像を選択または入力してください");
        return;
      }

      const payload = {
        id: Number(fd.get("id")),
        name: nameVal,
        image: imageVal,
      };

      // ギャラリー (gallery) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.galleryState.currentRecords.push(payload);
      } else {
        const idx = this.galleryState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.galleryState.currentRecords[idx] = {
            ...this.galleryState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.galleryState.currentRecords.push(payload);
        }
      }

      this.galleryState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "ギャラリー画像を一覧に追加しました（※「更新反映」ボタンを押すまでD1には保存されません）"
          : "ギャラリー画像の変更を一覧に反映しました（※「更新反映」ボタンを押すまでD1には保存されません）"
      );
      await this.loadTab("gallery");
    };

    Modal.open({
      title: isNew ? "ギャラリー画像の新規追加" : `ギャラリー画像の編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * ギャラリー 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectGalleryFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
    data["image_mode"] = mode;
    if (mode === "library") {
      data["image"] = form.querySelector('.admin-visual-file-select[data-field="image"]')?.value || "";
    } else {
      data["image"] = form.querySelector('.admin-visual-url-input[data-field="image"]')?.value || "";
    }
    return data;
  }

  /**
   * ギャラリー 画像アップロードモーダル (インタラクティブ・クロッパー 16:9)
   */
  async openGalleryUploadModal(field, currentRecord, savedState, cfg) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    let targetW = 1280;
    let targetH = 720;
    const headerTitleText = `トリミング調整 (横長 16:9 (1280×720))`;
    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${escapeHtml(cfg.label)}</strong> (保存先: <code>${escapeHtml(cfg.uploadPath)}</code>)</div>
        <div>対応形式: <code>${escapeHtml(cfg.accept)}</code> ｜ 容量上限: <code>${escapeHtml(cfg.maxSizeMB)}MB (${maxKB} KB)</code> ｜ 規格比率: <code>${escapeHtml(cfg.aspectRatio)} (${escapeHtml(cfg.displayMode)})</code></div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone-gallery">
        <input type="file" id="upload-file-input-gallery" accept="${escapeHtml(cfg.accept)}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCからギャラリー画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage-gallery" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span>${escapeHtml(headerTitleText)}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas-gallery" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider-gallery" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn-gallery" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn-gallery" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge-gallery" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input-gallery" placeholder="例: gallery_image_202610" style="flex: 1;" />
          <span id="upload-ext-label-gallery" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.jpg</span>
        </div>
        <span id="upload-name-error-gallery" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openGalleryModal(currentRecord, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-gallery");
    const fileInput = wrap.querySelector("#upload-file-input-gallery");
    const cropStage = wrap.querySelector("#crop-stage-gallery");
    const cropCanvas = wrap.querySelector("#crop-canvas-gallery");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-gallery");
    const fitBtn = wrap.querySelector("#crop-fit-btn-gallery");
    const centerBtn = wrap.querySelector("#crop-center-btn-gallery");
    const sizeBadge = wrap.querySelector("#crop-size-badge-gallery");
    const nameInput = wrap.querySelector("#upload-filename-input-gallery");
    const extLabel = wrap.querySelector("#upload-ext-label-gallery");
    const nameError = wrap.querySelector("#upload-name-error-gallery");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const renderCanvas = () => {
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetW, targetH);

      if (!selectedImg) return;

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        cropCanvas.toBlob(
          (blob) => {
            currentBlob = blob;
            if (!blob) return;
            const kb = Math.round(blob.size / 1024);
            const isOk = blob.size <= cfg.maxSizeBytes;
            isSizeValid = isOk;

            if (isOk) {
              sizeBadge.className = "crop-size-badge is-ok";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB OK`;
            } else {
              sizeBadge.className = "crop-size-badge is-ng";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB 超過`;
            }
            checkUploadBtnState();
          },
          "image/jpeg",
          0.85
        );
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) onDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!selectedImg) return;
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        let newScale = scale * zoomFactor;
        const minS = parseFloat(zoomSlider.min);
        const maxS = parseFloat(zoomSlider.max);
        newScale = Math.max(minS, Math.min(maxS, newScale));
        scale = newScale;
        zoomSlider.value = scale;
        renderCanvas();
        scheduleSizeUpdate(false);
      },
      { passive: false }
    );

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "gallery_image";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン活性判定
    const checkUploadBtnState = () => {
      const nameVal = nameInput.value.trim();
      const isNameValid = nameVal.length > 0 && /^[a-zA-Z0-9_-]+$/.test(nameVal);
      uploadBtn.disabled = !selectedImg || !isSizeValid || !isNameValid;
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.galleryLibraryCache.includes(fullFileName)) {
            this.galleryLibraryCache.push(fullFileName);
          }
          savedState["image"] = fullFileName;
          savedState["image_mode"] = "library";
          cleanupListeners();
          this.openGalleryModal(currentRecord, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for gallery image via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.galleryLibraryCache.includes(fullFileName)) {
          this.galleryLibraryCache.push(fullFileName);
        }

        savedState["image"] = fullFileName;
        savedState["image_mode"] = "library";

        cleanupListeners();
        this.openGalleryModal(currentRecord, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openGalleryModal(currentRecord, savedState);
      },
    });
  }

  /**
   * 動画リスト管理タブ (movieTag 管理アコーディオン + 動画一覧)
   */
  async renderMovieTab() {
    let movies = [];
    let categories = [];
    let tags = [];
    let lists = [];

    try {
      if (!this.movieState.isInitialized) {
        const moviesRes = await api.getTable("movie").catch(() => []);
        const rawList = Array.isArray(moviesRes) ? moviesRes : (moviesRes ? [moviesRes] : []);
        this.movieState.originalRecords = JSON.parse(JSON.stringify(rawList));
        this.movieState.currentRecords = JSON.parse(JSON.stringify(rawList));
        this.movieState.hasPendingChanges = false;
        this.movieState.isInitialized = true;
      }
      movies = this.movieState.currentRecords;

      const [categoriesRes, tagsRes, listsRes] = await Promise.all([
        api.getTable("movieCategory").catch(() => []),
        api.getTable("movieTag").catch(() => []),
        api.getTable("movieList").catch(() => []),
      ]);
      categories = Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes ? [categoriesRes] : []);
      tags = Array.isArray(tagsRes) ? tagsRes : (tagsRes ? [tagsRes] : []);
      lists = Array.isArray(listsRes) ? listsRes : (listsRes ? [listsRes] : []);
    } catch (err) {
      console.error("[Movie Data Load Error]:", err);
      movies = this.movieState.currentRecords || [];
      categories = [];
      tags = [];
      lists = [];
    }

    // マップ
    const categoryMap = new Map(categories.map((c) => [String(c.id), c]));
    const tagMap = new Map(tags.map((t) => [String(t.id), t]));
    const listMap = new Map(lists.map((l) => [String(l.id), l]));

    // YouTube サムネイル取得ヘルパー
    const getYouTubeThumbnail = (url) => {
      if (!url || typeof url !== "string") return null;
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
      }
      return null;
    };

    const container = document.createElement("div");
    container.style.cssText = "display: flex; flex-direction: column; gap: 20px;";

    // ========================================================
    // 0. 動画タイプ (movieCategory) 管理アコーディオン
    // ========================================================
    const categoryCard = document.createElement("div");
    categoryCard.className = "admin-tag-manager-card";

    if (this._isMovieCategoryOpen === undefined) {
      this._isMovieCategoryOpen = true;
    }

    categoryCard.innerHTML = `
      <div class="admin-tag-manager-header" id="movie-category-manager-toggle-btn">
        <div class="admin-tag-manager-title">
          <h2 class="admin-card-title">動画タイプ</h2>
          <span class="admin-count-badge">${categories.length}件</span>
        </div>
        <span class="admin-tag-manager-arrow" id="movie-category-manager-arrow">${this._isMovieCategoryOpen ? "▲" : "▼"}</span>
      </div>
      <div class="admin-tag-manager-body" id="movie-category-manager-body" style="display: ${this._isMovieCategoryOpen ? "flex" : "none"};">
        <div class="admin-tag-input-row" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <input
            type="text"
            class="admin-form-input"
            id="new-movie-category-name-input"
            placeholder="新しい動画タイプ名 (例: Shorts、配信アーカイブ、MV)"
            style="flex: 2; min-width: 200px;"
          />
          <select class="admin-form-input" id="new-movie-category-ratio-select" style="flex: 1; min-width: 140px;" title="動画のアスペクト比">
            <option value="wide">横長（16:9）</option>
            <option value="tall">縦長（9:16）</option>
          </select>
          <button type="button" class="app-btn app-btn-primary" id="add-movie-category-btn" style="white-space: nowrap; padding: 8px 20px;">
            追加
          </button>
        </div>
        <div class="admin-tag-chips-container" id="movie-category-chips-container">
          ${categories.length === 0 ? '<span style="color: #64748b; font-size: 0.85rem;">登録されている動画タイプはありません</span>' : ""}
          ${categories.map((c) => `
            <div class="admin-tag-chip admin-category-chip" data-id="${escapeHtml(c.id)}">
              <span>${escapeHtml(c.categoryName)} <span class="admin-tag-chip-id">(ID: ${escapeHtml(c.id)}${c.aspectRatio === "tall" ? "・縦長" : "・横長"})</span></span>
              <button type="button" class="admin-tag-chip-del admin-category-chip-del" data-id="${escapeHtml(c.id)}" title="削除">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // アコーディオン開閉トグル
    const catToggleBtn = categoryCard.querySelector("#movie-category-manager-toggle-btn");
    const catBody = categoryCard.querySelector("#movie-category-manager-body");
    const catArrow = categoryCard.querySelector("#movie-category-manager-arrow");
    catToggleBtn.onclick = () => {
      this._isMovieCategoryOpen = !this._isMovieCategoryOpen;
      catBody.style.display = this._isMovieCategoryOpen ? "flex" : "none";
      catArrow.textContent = this._isMovieCategoryOpen ? "▲" : "▼";
    };

    // 動画タイプ追加処理
    const catInput = categoryCard.querySelector("#new-movie-category-name-input");
    const catRatio = categoryCard.querySelector("#new-movie-category-ratio-select");
    const addCatBtn = categoryCard.querySelector("#add-movie-category-btn");

    const handleAddCategory = async () => {
      const val = catInput.value.trim();
      if (!val) {
        alert("動画タイプ名を入力してください");
        catInput.focus();
        return;
      }

      addCatBtn.disabled = true;
      try {
        const nextId = categories.length > 0 ? Math.max(...categories.map((c) => Number(c.id) || 0)) + 1 : 1;
        const nextPriority = categories.length > 0 ? Math.max(...categories.map((c) => Number(c.priority) || 0)) + 10 : 10;
        await api.saveTable(
          "movieCategory",
          {
            id: nextId,
            categoryName: val,
            aspectRatio: catRatio.value || "wide",
            priority: nextPriority,
          },
          null
        );
        Toast.success(`動画タイプ「${val}」を追加しました`);
        await this.renderMovieTab();
      } catch (e) {
        console.error("[Add Movie Category Error]:", e);
        Toast.error(`動画タイプの追加に失敗しました: ${e.message}`);
        addCatBtn.disabled = false;
      }
    };

    addCatBtn.onclick = handleAddCategory;
    catInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCategory();
      }
    };

    // 動画タイプ削除処理
    categoryCard.querySelectorAll(".admin-category-chip-del").forEach((delBtn) => {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const catId = delBtn.dataset.id;
        const targetCat = categories.find((c) => String(c.id) === String(catId));
        const catName = targetCat?.categoryName || catId;

        const ok = confirm(
          `動画タイプ「${catName}」を削除しますか？\n\n※この動画タイプを使用している動画がある場合、動画タイプ表示に影響する可能性があります。`
        );
        if (!ok) return;

        try {
          await api.deleteRecord("movieCategory", catId);
          Toast.info(`動画タイプ「${catName}」を削除しました`);
          await this.renderMovieTab();
        } catch (err) {
          console.error("[Delete Movie Category Error]:", err);
          Toast.error(`動画タイプの削除に失敗しました: ${err.message}`);
        }
      };
    });

    container.appendChild(categoryCard);

    // ========================================================
    // 1. 動画タグ (movieTag) 管理アコーディオン
    // ========================================================
    const tagCard = document.createElement("div");
    tagCard.className = "admin-tag-manager-card";

    if (this._isMovieTagOpen === undefined) {
      this._isMovieTagOpen = true;
    }

    tagCard.innerHTML = `
      <div class="admin-tag-manager-header" id="movie-tag-manager-toggle-btn">
        <div class="admin-tag-manager-title">
          <h2 class="admin-card-title">タグ</h2>
          <span class="admin-count-badge">${tags.length}件</span>
        </div>
        <span class="admin-tag-manager-arrow" id="movie-tag-manager-arrow">${this._isMovieTagOpen ? "▲" : "▼"}</span>
      </div>
      <div class="admin-tag-manager-body" id="movie-tag-manager-body" style="display: ${this._isMovieTagOpen ? "flex" : "none"};">
        <div class="admin-tag-input-row">
          <input
            type="text"
            class="admin-form-input"
            id="new-movie-tag-name-input"
            placeholder="新しいタグ名 (例: MV、歌ってみた、切り抜き)"
          />
          <button type="button" class="app-btn app-btn-primary" id="add-movie-tag-btn" style="white-space: nowrap; padding: 8px 20px;">
            追加
          </button>
        </div>
        <div class="admin-tag-chips-container" id="movie-tag-chips-container">
          ${tags.length === 0 ? '<span style="color: #64748b; font-size: 0.85rem;">登録されているタグはありません</span>' : ""}
          ${tags.map((t) => `
            <div class="admin-tag-chip" data-id="${escapeHtml(t.id)}">
              <span>${escapeHtml(t.tagName)} <span class="admin-tag-chip-id">(ID: ${escapeHtml(t.id)})</span></span>
              <button type="button" class="admin-tag-chip-del" data-id="${escapeHtml(t.id)}" title="削除">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // アコーディオン開閉トグル
    const toggleBtn = tagCard.querySelector("#movie-tag-manager-toggle-btn");
    const tagBody = tagCard.querySelector("#movie-tag-manager-body");
    const tagArrow = tagCard.querySelector("#movie-tag-manager-arrow");
    toggleBtn.onclick = () => {
      this._isMovieTagOpen = !this._isMovieTagOpen;
      tagBody.style.display = this._isMovieTagOpen ? "flex" : "none";
      tagArrow.textContent = this._isMovieTagOpen ? "▲" : "▼";
    };

    // タグ追加処理
    const tagInput = tagCard.querySelector("#new-movie-tag-name-input");
    const addTagBtn = tagCard.querySelector("#add-movie-tag-btn");

    const handleAddTag = async () => {
      const val = tagInput.value.trim();
      if (!val) {
        alert("タグ名を入力してください");
        tagInput.focus();
        return;
      }

      addTagBtn.disabled = true;
      try {
        const nextId = tags.length > 0 ? Math.max(...tags.map((t) => Number(t.id) || 0)) + 1 : 1;
        await api.saveTable("movieTag", { id: nextId, tagName: val }, null);
        Toast.success(`タグ「${val}」を追加しました`);
        await this.renderMovieTab();
      } catch (e) {
        console.error("[Add Movie Tag Error]:", e);
        Toast.error(`タグの追加に失敗しました: ${e.message}`);
        addTagBtn.disabled = false;
      }
    };

    addTagBtn.onclick = handleAddTag;
    tagInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    };

    // タグ削除処理
    tagCard.querySelectorAll(".admin-tag-chip-del").forEach((delBtn) => {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const tagId = delBtn.dataset.id;
        const targetTag = tags.find((t) => String(t.id) === String(tagId));
        const tagName = targetTag?.tagName || tagId;

        const ok = confirm(
          `タグ「${tagName}」を削除しますか？\n\n※このタグを使用している動画がある場合、タグ表示に影響する可能性があります。`
        );
        if (!ok) return;

        try {
          await api.deleteRecord("movieTag", tagId);
          Toast.info(`タグ「${tagName}」を削除しました`);
          await this.renderMovieTab();
        } catch (err) {
          console.error("[Delete Movie Tag Error]:", err);
          Toast.error(`タグの削除に失敗しました: ${err.message}`);
        }
      };
    });

    container.appendChild(tagCard);

    // ========================================================
    // 2. 動画リスト管理テーブル
    // ========================================================
    const card = document.createElement("div");
    card.className = "admin-card";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "admin-card-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "admin-card-title-group";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";

    const h2 = document.createElement("h2");
    h2.className = "admin-card-title";
    h2.textContent = "動画リスト管理";
    titleRow.appendChild(h2);

    const countBadge = document.createElement("span");
    countBadge.className = "admin-count-badge";
    countBadge.textContent = `${movies.length}件`;
    titleRow.appendChild(countBadge);

    titleGroup.appendChild(titleRow);
    header.appendChild(titleGroup);

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const addBtn = document.createElement("button");
    addBtn.className = "app-btn app-btn-primary";
    addBtn.innerHTML = "+ 新規追加";
    addBtn.onclick = () => this.openMovieModal(null, categories, tags, lists);
    actions.appendChild(addBtn);

    // 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    const commitBtn = document.createElement("button");
    commitBtn.id = "movie-commit-btn";
    commitBtn.className = "app-btn app-btn-orange";

    const changesCount = this.getMovieChangesCount();
    if (this.movieState.hasPendingChanges && changesCount > 0) {
      commitBtn.classList.add("has-changes");
      commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
      commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
      commitBtn.disabled = false;
    } else {
      commitBtn.innerHTML = `<span>更新反映</span>`;
      commitBtn.title = "D1に未反映の変更はありません";
      commitBtn.disabled = true;
    }

    commitBtn.onclick = async () => {
      await this.commitMovieChanges();
    };
    actions.appendChild(commitBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // 動画リスト管理で未反映の変更がある場合は通知アラートを表示
    if (this.movieState.hasPendingChanges && changesCount > 0) {
      const alertBar = document.createElement("div");
      alertBar.className = "admin-pending-alert";
      alertBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>⚠️</span>
          <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
        </div>
        <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
      `;
      alertBar.querySelector("button").onclick = async () => {
        await this.commitMovieChanges();
      };
      card.appendChild(alertBar);
    }

    // テーブル生成
    const tableContainer = document.createElement("div");
    tableContainer.className = "admin-table-container";

    const table = document.createElement("table");
    table.className = "admin-table";

    // thead
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th class="admin-table-col-actions" style="width: 80px; text-align: center;">操作</th>
        <th style="width: 60px; text-align: center;">id</th>
        <th style="width: 130px;">動画タイプ</th>
        <th style="width: 130px;">タグ</th>
        <th style="min-width: 260px;">動画</th>
        <th style="width: 240px; min-width: 200px;">再生リスト</th>
        <th style="width: 120px; text-align: center;">公開フラグ</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (movies.length === 0) {
      const emptyTr = document.createElement("tr");
      emptyTr.innerHTML = `
        <td colspan="7" style="text-align: center; color: #64748b; padding: 36px 16px;">
          動画データがありません。「+ 新規追加」ボタンから登録してください。
        </td>
      `;
      tbody.appendChild(emptyTr);
    } else {
      movies.forEach((item) => {
        const tr = document.createElement("tr");

        // 1. 操作列 (縦並び「編集」「削除」)
        const tdActions = document.createElement("td");
        tdActions.className = "admin-table-col-actions";
        tdActions.style.textAlign = "center";

        const actWrap = document.createElement("div");
        actWrap.className = "admin-table-actions is-vertical";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "app-btn app-btn-secondary app-btn-sm";
        editBtn.textContent = "編集";
        editBtn.onclick = (e) => {
          e.stopPropagation();
          this.openMovieModal(item, categories, tags, lists);
        };

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "app-btn app-btn-danger app-btn-sm";
        delBtn.textContent = "削除";
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          await this.deleteRecord("movie", item.id);
        };

        actWrap.appendChild(editBtn);
        actWrap.appendChild(delBtn);
        tdActions.appendChild(actWrap);
        tr.appendChild(tdActions);

        // 2. id列
        const tdId = document.createElement("td");
        tdId.style.textAlign = "center";
        tdId.textContent = item.id;
        tr.appendChild(tdId);

        // 3. 動画タイプ (movieCategory_id)
        const tdCategory = document.createElement("td");
        const catObj = categoryMap.get(String(item.movieCategory_id));
        if (catObj) {
          tdCategory.innerHTML = `<span class="admin-category-badge">${escapeHtml(catObj.categoryName)}</span>`;
        } else if (item.movieCategory_id) {
          tdCategory.innerHTML = `<span class="admin-category-badge" style="opacity: 0.7;">ID: ${escapeHtml(item.movieCategory_id)}</span>`;
        } else {
          tdCategory.innerHTML = `<span style="color: #64748b;">-</span>`;
        }
        tr.appendChild(tdCategory);

        // 4. タグ (movieTag_id)
        const tdTag = document.createElement("td");
        const tagObj = tagMap.get(String(item.movieTag_id));
        if (tagObj) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge">${escapeHtml(tagObj.tagName)}</span>`;
        } else if (item.movieTag_id) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge" style="opacity: 0.7;">ID: ${escapeHtml(item.movieTag_id)}</span>`;
        } else {
          tdTag.innerHTML = `<span style="color: #64748b;">-</span>`;
        }
        tr.appendChild(tdTag);

        // 5. 動画 (movieImage / movieUrl の 2段表示)
        const tdMovie = document.createElement("td");
        const ytThumb = getYouTubeThumbnail(item.movieUrl);
        const hasImg = item.movieImage || item.image;
        let thumbHtml = "";
        let imgDisplayUrl = "";

        if (hasImg) {
          imgDisplayUrl = api.resolveAssetUrl(hasImg, "movie");
          thumbHtml = `
            <img src="${escapeHtml(imgDisplayUrl)}" alt="動画サムネイル" class="admin-table-thumb is-movie-thumb" title="クリックで拡大表示" />
          `;
        } else if (ytThumb) {
          imgDisplayUrl = ytThumb;
          thumbHtml = `
            <img src="${escapeHtml(ytThumb)}" alt="YouTubeサムネイル" class="admin-table-thumb is-movie-thumb" title="クリックで拡大表示" />
          `;
        } else {
          thumbHtml = `<span style="color: #64748b; font-size: 0.78rem;">(画像なし)</span>`;
        }

        tdMovie.innerHTML = `
          <div class="admin-movie-tworow-cell">
            <div class="admin-movie-thumb-wrap">
              ${thumbHtml}
            </div>
            <div class="admin-movie-url-wrap">
              ${item.movieUrl ? `
                <a href="${escapeHtml(item.movieUrl)}" target="_blank" rel="noopener noreferrer" class="admin-movie-url-link" title="${escapeHtml(item.movieUrl)}">
                  🔗 ${escapeHtml(item.movieUrl)} ↗
                </a>
              ` : '<span style="color: #64748b;">-</span>'}
            </div>
          </div>
        `;

        if (imgDisplayUrl) {
          const imgEl = tdMovie.querySelector("img");
          if (imgEl) {
            imgEl.onclick = (e) => {
              e.stopPropagation();
              this.openImageDetailModal(imgDisplayUrl, `動画サムネイル (ID: ${item.id})`, {
                costumeName: `動画 ID: ${item.id}`,
                columnLabel: "動画サムネイル",
                path: hasImg || item.movieUrl,
              });
            };
          }
        }
        tdMovie.style.paddingRight = "16px";
        tr.appendChild(tdMovie);

        // 6. 再生リスト (movieList > listName、プルダウンで変更可能)
        const tdList = document.createElement("td");
        tdList.style.minWidth = "200px";
        const listSelect = document.createElement("select");
        listSelect.className = "admin-form-input admin-table-select";
        listSelect.title = "クリックして再生リストを変更できます";

        const optEmpty = document.createElement("option");
        optEmpty.value = "";
        optEmpty.textContent = "(未設定 / なし)";
        listSelect.appendChild(optEmpty);

        lists.forEach((l) => {
          const opt = document.createElement("option");
          opt.value = String(l.id);
          opt.textContent = l.listName;
          if (String(item.movieList) === String(l.id)) {
            opt.selected = true;
          }
          listSelect.appendChild(opt);
        });

        listSelect.onchange = async (e) => {
          e.stopPropagation();
          const newVal = listSelect.value ? Number(listSelect.value) : null;
          item.movieList = newVal;
          this.movieState.hasPendingChanges = true;
          const selectedListName = newVal ? (listMap.get(String(newVal))?.listName || `ID: ${newVal}`) : "未設定";
          Toast.info(`ID: ${item.id} の再生リストを「${selectedListName}」に変更しました（※「更新反映」を押すまでD1には保存されません）`);
          await this.renderMovieTab();
        };

        tdList.appendChild(listSelect);
        tr.appendChild(tdList);

        // 7. 公開フラグ (トグルスイッチ)
        const tdActive = document.createElement("td");
        tdActive.style.textAlign = "center";

        const isActive = item.is_active === 1 || item.is_active === true || item.is_active === "1";

        const switchLabel = document.createElement("label");
        switchLabel.className = "admin-switch-label";
        switchLabel.style.cssText = "justify-content: center; margin: 0 auto;";

        const switchInput = document.createElement("input");
        switchInput.type = "checkbox";
        switchInput.className = "admin-switch-input";
        switchInput.checked = isActive;

        const switchSlider = document.createElement("span");
        switchSlider.className = "admin-switch-slider";

        const statusText = document.createElement("span");
        statusText.className = "admin-switch-status-text";
        statusText.style.cssText = "font-size: 0.82rem; min-width: 42px; text-align: left;";
        statusText.textContent = isActive ? "表示" : "非表示";

        switchInput.onchange = async (e) => {
          e.stopPropagation();
          const newActive = switchInput.checked ? 1 : 0;
          item.is_active = newActive;
          this.movieState.hasPendingChanges = true;
          Toast.info(`ID: ${item.id} の公開フラグを「${newActive ? "表示" : "非表示"}」に変更しました（※「更新反映」を押すまでD1には保存されません）`);
          await this.renderMovieTab();
        };

        switchLabel.appendChild(switchInput);
        switchLabel.appendChild(switchSlider);
        switchLabel.appendChild(statusText);
        tdActive.appendChild(switchLabel);
        tr.appendChild(tdActive);

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    container.appendChild(card);

    this.container.innerHTML = "";
    this.container.appendChild(container);
  }

  /**
   * 動画 (movie) 専用の新規・編集モーダル
   */
  async openMovieModal(record, categories = null, tags = null, lists = null, restoreState = null) {
    const isNew = !record;

    // マスタデータの取得 (渡されていない場合)
    let allCategories = categories;
    let allTags = tags;
    let allLists = lists;

    if (!allCategories || !allTags || !allLists) {
      try {
        const [cRes, tRes, lRes] = await Promise.all([
          allCategories ? Promise.resolve(allCategories) : api.getTable("movieCategory").catch(() => []),
          allTags ? Promise.resolve(allTags) : api.getTable("movieTag").catch(() => []),
          allLists ? Promise.resolve(allLists) : api.getTable("movieList").catch(() => []),
        ]);
        allCategories = Array.isArray(cRes) ? cRes : (cRes ? [cRes] : []);
        allTags = Array.isArray(tRes) ? tRes : (tRes ? [tRes] : []);
        allLists = Array.isArray(lRes) ? lRes : (lRes ? [lRes] : []);
      } catch (e) {
        allCategories = allCategories || [];
        allTags = allTags || [];
        allLists = allLists || [];
      }
    }

    // 全動画レコード取得 (ID自動採番 & ライブラリキャッシュ用)
    let allMovies = [];
    if (this.movieState && this.movieState.isInitialized && this.movieState.currentRecords.length > 0) {
      allMovies = this.movieState.currentRecords;
    } else {
      try {
        const res = await api.getTable("movie");
        allMovies = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allMovies = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allMovies.length > 0 ? Math.max(...allMovies.map((m) => Number(m.id) || 0)) + 1 : 1;

    // 現在のデータ
    const currentData = {
      id: isNew ? nextId : record.id,
      movieCategory_id: record?.movieCategory_id || (allCategories[0]?.id || ""),
      movieTag_id: record?.movieTag_id || "",
      movieUrl: record?.movieUrl || "",
      movieImage: record?.movieImage || record?.image || "",
      movieList: record?.movieList || "",
      is_active: record ? (record.is_active === 1 || record.is_active === true || record.is_active === "1") : true,
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.movieLibraryCache) {
      this.movieLibraryCache = [];
    }
    const librarySet = new Set(["moviesample.png", ...this.movieLibraryCache]);
    allMovies.forEach((row) => {
      const img = row.movieImage || row.image;
      if (img && typeof img === "string" && !img.startsWith("http")) {
        librarySet.add(img.split("/").pop());
      }
    });
    this.movieLibraryCache = Array.from(librarySet);

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode =
      currentData.image_mode ||
      (currentData.movieImage && (currentData.movieImage.startsWith("http://") || currentData.movieImage.startsWith("https://"))
        ? "url"
        : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ 公開フラグ -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${escapeHtml(currentData.id)}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">公開フラグ (表示/非表示)</label>
          <div style="padding-top: 6px;">
            <label class="admin-switch-label">
              <input type="checkbox" name="is_active" class="admin-switch-input" ${currentData.is_active ? "checked" : ""} />
              <span class="admin-switch-slider"></span>
              <span class="admin-switch-status-text">${currentData.is_active ? "表示" : "非表示"}</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 行2: 動画タイプ ｜ タグ -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            動画タイプ
            <span class="admin-form-label-required">*必須</span>
          </label>
          <select class="admin-form-input" name="movieCategory_id" required>
            ${allCategories.length === 0 ? '<option value="">(動画タイプが未登録です)</option>' : ""}
            ${allCategories.map((c) => `
              <option value="${escapeHtml(c.id)}" ${String(currentData.movieCategory_id) === String(c.id) ? "selected" : ""}>
                ${escapeHtml(c.categoryName)} (ID: ${escapeHtml(c.id)})
              </option>
            `).join("")}
          </select>
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">タグ</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select class="admin-form-input" name="movieTag_id" id="modal-movie-tag-select" style="flex: 1;">
              <option value="">-- タグを選択しない (なし) --</option>
              ${allTags.map((t) => `
                <option value="${escapeHtml(t.id)}" ${String(currentData.movieTag_id) === String(t.id) ? "selected" : ""}>
                  ${escapeHtml(t.tagName)} (ID: ${escapeHtml(t.id)})
                </option>
              `).join("")}
            </select>
            <button type="button" class="app-btn app-btn-secondary" id="btn-toggle-movie-tag" style="white-space: nowrap; padding: 8px 14px; font-size: 0.85rem;">
              ＋ タグ追加
            </button>
          </div>

          <!-- インラインタグ追加パネル -->
          <div id="modal-inline-movie-tag-panel" style="display: none; margin-top: 8px; padding: 10px 12px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-sm, 6px);">
            <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
              <span>新規タグ名を入力してください:</span>
              <button type="button" id="btn-modal-movie-tag-close" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 0 4px; line-height: 1;" title="閉じる">×</button>
            </div>
            <div style="display: flex; gap: 8px;">
              <input
                type="text"
                class="admin-form-input"
                id="modal-inline-movie-tag-input"
                placeholder="新しいタグ名 (例: MV、歌ってみた、切り抜き)"
                style="flex: 1; padding: 6px 10px; font-size: 0.85rem;"
              />
              <button type="button" class="app-btn app-btn-primary app-btn-sm" id="btn-modal-movie-tag-submit" style="white-space: nowrap; padding: 6px 14px; font-size: 0.82rem;">
                追加
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 行3: 動画URL ｜ 再生リスト -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            動画URL
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="movieUrl"
            type="url"
            value="${escapeHtml(currentData.movieUrl)}"
            placeholder="https://www.youtube.com/watch?v=... または TikTok等のURL"
            required
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">再生リスト (所属リスト)</label>
          <select class="admin-form-input" name="movieList">
            <option value="">-- 再生リストに所属しない (なし) --</option>
            ${allLists.map((l) => `
              <option value="${escapeHtml(l.id)}" ${String(currentData.movieList) === String(l.id) ? "selected" : ""}>
                ${escapeHtml(l.listName)} (ID: ${escapeHtml(l.id)})
              </option>
            `).join("")}
          </select>
        </div>
      </div>

      <!-- 行4: 動画画像 (movieImage) -->
      <div class="admin-visual-field-card" style="margin-top: 4px;">
        <div class="admin-visual-field-header">
          <label class="admin-form-label" style="margin: 0; font-size: 0.95rem; font-weight: 700;">
            動画画像 (サムネイル)
            <span style="color: #94a3b8; font-weight: normal; font-size: 0.78rem; margin-left: 4px;">(未設定の場合は動画URLから自動取得可能)</span>
          </label>
          <div class="admin-visual-mode-toggle">
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="library" ${initialMode === "library" ? "checked" : ""}>
              <span>ライブラリ参照</span>
            </label>
            <label class="admin-visual-radio-label">
              <input type="radio" name="image_mode" value="url" ${initialMode === "url" ? "checked" : ""}>
              <span>直URL指定</span>
            </label>
          </div>
        </div>

        <div class="admin-visual-field-body">
          <div class="admin-visual-input-col">
            <!-- ライブラリ選択UI -->
            <div id="mode-library-movie" class="admin-visual-mode-panel" style="${initialMode === "library" ? "" : "display: none;"}">
              <div style="display: flex; gap: 8px; align-items: center;">
                <select class="admin-form-input admin-visual-file-select" data-field="movieImage" style="flex: 1;">
                  <option value="">-- 画像を選択しない (なし) --</option>
                  ${this.movieLibraryCache.map((fn) => `
                    <option value="${escapeHtml(fn)}" ${currentData.movieImage === fn ? "selected" : ""}>${escapeHtml(fn)}</option>
                  `).join("")}
                </select>
                <button type="button" class="app-btn app-btn-secondary admin-movie-upload-btn" data-field="movieImage" style="white-space: nowrap;">
                  📤 アップロード
                </button>
              </div>
              <span class="admin-form-hint">assets/movie 配下の画像をプルダウンで選択、または新規アップロードできます</span>
            </div>

            <!-- 直URL指定UI -->
            <div id="mode-url-movie" class="admin-visual-mode-panel" style="${initialMode === "url" ? "" : "display: none;"}">
              <input
                class="admin-form-input admin-visual-url-input"
                data-field="movieImage"
                type="url"
                value="${initialMode === "url" ? escapeHtml(currentData.movieImage || "") : ""}"
                placeholder="https://drive.google.com/file/d/... または画像URL"
              />
              <span class="admin-form-hint">Googleドライブの共有URL、または画像の直接URLを入力してください（ドライブURLは自動変換されます）</span>
            </div>
          </div>

          <!-- プレビュー枠 (アスペクト比 16:9) -->
          <div class="admin-visual-preview-col" style="min-width: 240px; max-width: 280px;">
            <div id="preview-box-movie-image" class="admin-visual-preview-box is-notice-box">
              <span class="admin-visual-preview-empty">プレビューなし</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // スイッチ切り替え
    const swInput = form.querySelector('[name="is_active"]');
    const swText = form.querySelector('.admin-switch-status-text');
    if (swInput && swText) {
      swInput.onchange = () => {
        swText.textContent = swInput.checked ? "表示" : "非表示";
      };
    }

    // タグ追加処理 (インラインパネル)
    const tagSelect = form.querySelector("#modal-movie-tag-select");
    const toggleTagBtn = form.querySelector("#btn-toggle-movie-tag");
    const tagPanel = form.querySelector("#modal-inline-movie-tag-panel");
    const tagInput = form.querySelector("#modal-inline-movie-tag-input");
    const tagSubmitBtn = form.querySelector("#btn-modal-movie-tag-submit");
    const tagCloseBtn = form.querySelector("#btn-modal-movie-tag-close");

    if (toggleTagBtn && tagPanel && tagInput && tagSubmitBtn) {
      toggleTagBtn.onclick = () => {
        const isVisible = tagPanel.style.display !== "none";
        tagPanel.style.display = isVisible ? "none" : "block";
        if (!isVisible) {
          tagInput.focus();
        }
      };

      if (tagCloseBtn) {
        tagCloseBtn.onclick = () => {
          tagPanel.style.display = "none";
        };
      }

      const handleCreateTag = async () => {
        const val = tagInput.value.trim();
        if (!val) {
          alert("タグ名を入力してください");
          tagInput.focus();
          return;
        }

        // 既存タグとの重複チェック
        const isExist = allTags.some((t) => t.tagName === val);
        if (isExist) {
          const existTag = allTags.find((t) => t.tagName === val);
          tagSelect.value = String(existTag.id);
          Toast.info(`タグ「${val}」は既に存在するため選択しました`);
          tagPanel.style.display = "none";
          tagInput.value = "";
          return;
        }

        tagSubmitBtn.disabled = true;
        try {
          const nextTagId = allTags.length > 0 ? Math.max(...allTags.map((t) => Number(t.id) || 0)) + 1 : 1;
          const newTag = { id: nextTagId, tagName: val };
          await api.saveTable("movieTag", newTag, null);

          // allTags 配列と select を更新
          allTags.push(newTag);

          const newOpt = document.createElement("option");
          newOpt.value = String(newTag.id);
          newOpt.textContent = `${newTag.tagName} (ID: ${newTag.id})`;
          tagSelect.appendChild(newOpt);
          tagSelect.value = String(newTag.id);

          Toast.success(`タグ「${val}」を追加し、選択しました`);
          tagInput.value = "";
          tagPanel.style.display = "none";
        } catch (err) {
          console.error("[Create Movie Tag Error]:", err);
          Toast.error(`タグの追加に失敗しました: ${err.message}`);
        } finally {
          tagSubmitBtn.disabled = false;
        }
      };

      tagSubmitBtn.onclick = handleCreateTag;
      tagInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleCreateTag();
        } else if (e.key === "Escape") {
          e.preventDefault();
          tagPanel.style.display = "none";
        }
      };
    }

    // プレビュー更新関数
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-movie-image");
      if (!pBox) return;

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imgVal = "";
      if (mode === "library") {
        imgVal = form.querySelector('.admin-visual-file-select[data-field="movieImage"]')?.value || "";
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="movieImage"]')?.value?.trim() || "";
        imgVal = convertGoogleDriveUrl(raw);
      }

      if (imgVal) {
        const fullUrl = api.resolveAssetUrl(imgVal, "movie");
        pBox.innerHTML = `
          <img src="${escapeHtml(fullUrl)}" alt="動画サムネイルプレビュー" onerror="this.parentElement.innerHTML='<span class=\\'admin-visual-preview-empty\\' style=\\'color:#ef4444;\\'>読込失敗</span>';" />
        `;
      } else {
        const mUrl = form.querySelector('[name="movieUrl"]')?.value?.trim();
        const match = mUrl ? mUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/) : null;
        if (match && match[1]) {
          const ytThumb = `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
          pBox.innerHTML = `
            <img src="${escapeHtml(ytThumb)}" alt="YouTubeサムネイルプレビュー" />
          `;
        } else {
          pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
        }
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="image_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-movie");
        const urlPanel = form.querySelector("#mode-url-movie");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="movieImage"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="movieImage"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // 動画URL変更時も自動プレビュー更新
    form.querySelector('[name="movieUrl"]').oninput = updatePreview;

    // アップロードボタン押下
    form.querySelector('.admin-movie-upload-btn[data-field="movieImage"]').onclick = () => {
      const savedState = this.collectMovieFormData(form);
      const cfg = {
        label: "動画画像",
        category: "movie",
        uploadPath: "assets/movie",
        accept: ".png,.jpg,.jpeg,.webp",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "16:9",
        displayMode: "contain",
        maxLongEdge: 1280,
      };
      this.openMovieUploadModal("movieImage", record, savedState, cfg, allCategories, allTags, allLists);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const catVal = fd.get("movieCategory_id")?.toString().trim();
      const urlVal = fd.get("movieUrl")?.toString().trim();

      if (!catVal) {
        alert("動画タイプは必須項目です");
        return;
      }

      if (!urlVal) {
        alert("動画URLは必須項目です");
        return;
      }

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imageVal = null;
      if (mode === "library") {
        imageVal = form.querySelector('.admin-visual-file-select[data-field="movieImage"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="movieImage"]')?.value?.trim() || null;
        imageVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const payload = {
        id: Number(fd.get("id")),
        movieCategory_id: Number(catVal) || catVal,
        movieTag_id: fd.get("movieTag_id") ? Number(fd.get("movieTag_id")) : null,
        movieUrl: urlVal,
        movieImage: imageVal || null,
        movieList: fd.get("movieList") ? Number(fd.get("movieList")) : null,
        is_active: form.querySelector('[name="is_active"]')?.checked ? 1 : 0,
      };

      // 動画リスト (movie) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.movieState.currentRecords.push(payload);
      } else {
        const idx = this.movieState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.movieState.currentRecords[idx] = {
            ...this.movieState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.movieState.currentRecords.push(payload);
        }
      }

      this.movieState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "動画を保留リストに追加しました。「更新反映」を押すまで確定されません。"
          : "動画の変更を保留しました。「更新反映」を押すまで確定されません。"
      );
      await this.renderMovieTab();
    };

    Modal.open({
      title: isNew ? "動画の新規追加" : `動画の編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * 動画 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectMovieFormData(form) {
    if (!form) return {};
    const fd = new FormData(form);
    const data = {};
    for (const [k, v] of fd.entries()) {
      data[k] = v;
    }
    data["is_active"] = form.querySelector('[name="is_active"]')?.checked;
    const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
    data["image_mode"] = mode;
    if (mode === "library") {
      data["movieImage"] = form.querySelector('.admin-visual-file-select[data-field="movieImage"]')?.value || "";
    } else {
      data["movieImage"] = form.querySelector('.admin-visual-url-input[data-field="movieImage"]')?.value || "";
    }
    return data;
  }

  /**
   * 動画 画像アップロードモーダル (インタラクティブ・クロッパー 16:9)
   */
  async openMovieUploadModal(field, currentRecord, savedState, cfg, categories, tags, lists) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = true;

    let targetW = 1280;
    let targetH = 720;
    const headerTitleText = `トリミング調整 (横長 16:9 (1280×720))`;
    const maxKB = Math.round(cfg.maxSizeBytes / 1024);

    wrap.innerHTML = `
      <div style="font-size: 0.88rem; color: #94a3b8; background: rgba(15, 23, 42, 0.6); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid rgba(255, 255, 255, 0.08); line-height: 1.6;">
        <div>項目: <strong style="color: #60a5fa; font-size: 0.95rem;">${escapeHtml(cfg.label)}</strong> (保存先: <code>${escapeHtml(cfg.uploadPath)}</code>)</div>
        <div>対応形式: <code>${escapeHtml(cfg.accept)}</code> ｜ 容量上限: <code>${escapeHtml(cfg.maxSizeMB)}MB (${maxKB} KB)</code> ｜ 規格比率: <code>${escapeHtml(cfg.aspectRatio)} (${escapeHtml(cfg.displayMode)})</code></div>
      </div>

      <!-- 画像選択ドロップゾーン -->
      <div class="admin-upload-dropzone" id="upload-dropzone-movie">
        <input type="file" id="upload-file-input-movie" accept="${escapeHtml(cfg.accept)}" style="display: none;" />
        <span style="font-size: 2.2rem;">📁</span>
        <div style="font-weight: 700; color: #f8fafc; font-size: 1rem;">画像ファイルを選択</div>
        <div style="font-size: 0.8rem; color: #94a3b8;">クリックしてPCから動画画像を選択してください</div>
      </div>

      <!-- 画像プレビュー＆トリミングコンテナ -->
      <div id="crop-stage-movie" class="admin-upload-crop-wrapper" style="display: none;">
        <!-- ヘッダー帯 -->
        <div class="crop-header">
          <div class="crop-header-title">
            <span>✂</span>
            <span>${escapeHtml(headerTitleText)}</span>
          </div>
          <div class="crop-header-hint">ドラッグで移動 / スライダーでズーム</div>
        </div>

        <!-- キャンバスプレビュー枠 (点線外枠) -->
        <div class="admin-upload-crop-container">
          <div class="crop-canvas-box">
            <canvas id="crop-canvas-movie" class="admin-upload-crop-canvas"></canvas>
          </div>
        </div>

        <!-- ズームコントロールバー -->
        <div class="crop-controls">
          <div class="crop-zoom-label">
            <span>🔍</span> <span>ズーム:</span>
          </div>
          <input type="range" id="crop-zoom-slider-movie" class="crop-zoom-slider" min="0.1" max="3" step="0.005" value="1" />
          <button type="button" id="crop-fit-btn-movie" class="crop-btn">フィット</button>
          <button type="button" id="crop-center-btn-movie" class="crop-btn">中央揃え</button>
        </div>

        <!-- ステータスバーカード -->
        <div class="crop-status-card">
          <div class="crop-resolution-label">
            仕上がり解像度: <strong class="crop-resolution-val">${targetW} × ${targetH} px</strong>
          </div>
          <span id="crop-size-badge-movie" class="crop-size-badge is-ok">-- KB / ${maxKB} KB OK</span>
        </div>
      </div>

      <!-- ファイル名入力欄 -->
      <div class="admin-form-group" style="margin-bottom: 0;">
        <label class="admin-form-label">
          ファイル名 (半角英数字, ハイフン, アンダースコアのみ)
          <span class="admin-form-label-required">*必須</span>
        </label>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input class="admin-form-input" id="upload-filename-input-movie" placeholder="例: movie_thumb_202610" style="flex: 1;" />
          <span id="upload-ext-label-movie" style="color: #60a5fa; font-weight: 700; font-size: 0.95rem;">.jpg</span>
        </div>
        <span id="upload-name-error-movie" style="color: #f87171; font-size: 0.78rem; display: none; margin-top: 4px;">
          半角英数字、ハイフン、アンダースコアのみ使用可能です
        </span>
      </div>
    `;

    // フッターボタン
    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openMovieModal(currentRecord, categories, tags, lists, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-movie");
    const fileInput = wrap.querySelector("#upload-file-input-movie");
    const cropStage = wrap.querySelector("#crop-stage-movie");
    const cropCanvas = wrap.querySelector("#crop-canvas-movie");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-movie");
    const fitBtn = wrap.querySelector("#crop-fit-btn-movie");
    const centerBtn = wrap.querySelector("#crop-center-btn-movie");
    const sizeBadge = wrap.querySelector("#crop-size-badge-movie");
    const nameInput = wrap.querySelector("#upload-filename-input-movie");
    const extLabel = wrap.querySelector("#upload-ext-label-movie");
    const nameError = wrap.querySelector("#upload-name-error-movie");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const renderCanvas = () => {
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetW, targetH);

      if (!selectedImg) return;

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        cropCanvas.toBlob(
          (blob) => {
            currentBlob = blob;
            if (!blob) return;
            const kb = Math.round(blob.size / 1024);
            const isOk = blob.size <= cfg.maxSizeBytes;
            isSizeValid = isOk;

            if (isOk) {
              sizeBadge.className = "crop-size-badge is-ok";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB OK`;
            } else {
              sizeBadge.className = "crop-size-badge is-ng";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB 超過`;
            }
            checkUploadBtnState();
          },
          "image/jpeg",
          0.85
        );
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 90);
      }
    };

    // ドラッグ移動制御
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startCenterX = 0;
    let startCenterY = 0;

    const onDragStart = (clientX, clientY) => {
      if (!selectedImg) return;
      isDragging = true;
      startX = clientX;
      startY = clientY;
      startCenterX = centerX;
      startCenterY = centerY;
      cropCanvas.classList.add("is-dragging");
    };

    const onDragMove = (clientX, clientY) => {
      if (!isDragging || !selectedImg) return;
      const rect = cropCanvas.getBoundingClientRect();
      const factorX = targetW / rect.width;
      const factorY = targetH / rect.height;
      const dx = (clientX - startX) * factorX;
      const dy = (clientY - startY) * factorY;
      centerX = startCenterX + dx;
      centerY = startCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const onDragEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cropCanvas.classList.remove("is-dragging");
      scheduleSizeUpdate(true);
    };

    cropCanvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDragStart(e.clientX, e.clientY);
    });

    const handleWindowMouseMove = (e) => {
      if (isDragging) onDragMove(e.clientX, e.clientY);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 1) {
          onDragStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: false }
    );

    const handleWindowTouchMove = (e) => {
      if (isDragging && e.touches.length === 1) {
        onDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) onDragEnd();
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.addEventListener(
      "wheel",
      (e) => {
        if (!selectedImg) return;
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
        let newScale = scale * zoomFactor;
        const minS = parseFloat(zoomSlider.min);
        const maxS = parseFloat(zoomSlider.max);
        newScale = Math.max(minS, Math.min(maxS, newScale));
        scale = newScale;
        zoomSlider.value = scale;
        renderCanvas();
        scheduleSizeUpdate(false);
      },
      { passive: false }
    );

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "movie_thumb";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン活性判定
    const checkUploadBtnState = () => {
      const nameVal = nameInput.value.trim();
      const isNameValid = nameVal.length > 0 && /^[a-zA-Z0-9_-]+$/.test(nameVal);
      uploadBtn.disabled = !selectedImg || !isSizeValid || !isNameValid;
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const reader = new FileReader();
        const base64Promise = new Promise((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            const b64 = result.split(",")[1];
            resolve(b64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(currentBlob);
        const base64Data = await base64Promise;

        let patRecord = null;
        try {
          patRecord = await api.getTable("githubPAT", 1, true);
        } catch (e) {}

        const owner = patRecord?.github_repo_owner || "elisafoster";
        const repo = patRecord?.github_repo_name || "elisafoster";
        const pat = patRecord?.github_pat;

        if (!pat) {
          Toast.error("GitHub PATが未設定です。管理画面の『GitHub PAT』設定を確認してください。");
          if (!this.movieLibraryCache.includes(fullFileName)) {
            this.movieLibraryCache.push(fullFileName);
          }
          savedState["movieImage"] = fullFileName;
          savedState["image_mode"] = "library";
          cleanupListeners();
          this.openMovieModal(currentRecord, categories, tags, lists, savedState);
          return;
        }

        const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${uploadPath}`;

        let sha = null;
        try {
          const checkRes = await fetch(ghUrl, {
            headers: {
              Authorization: `token ${pat}`,
              Accept: "application/vnd.github.v3+json",
            },
          });
          if (checkRes.ok) {
            const fileInfo = await checkRes.json();
            sha = fileInfo.sha;
          }
        } catch (e) {}

        if (sha) {
          alert(`同名のファイル (${fullFileName}) が既にリポジトリに存在します。別のファイル名を指定してください。`);
          uploadBtn.disabled = false;
          uploadBtn.textContent = "アップロード";
          return;
        }

        const putRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${pat}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            message: `Upload ${fullFileName} for movie thumbnail via admin`,
            content: base64Data,
            branch: "main",
          }),
        });

        if (!putRes.ok) {
          const errData = await putRes.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API エラー (${putRes.status})`);
        }

        Toast.success(`${fullFileName} を正常にアップロードしました`);

        if (!this.movieLibraryCache.includes(fullFileName)) {
          this.movieLibraryCache.push(fullFileName);
        }

        savedState["movieImage"] = fullFileName;
        savedState["image_mode"] = "library";

        cleanupListeners();
        this.openMovieModal(currentRecord, categories, tags, lists, savedState);
      } catch (err) {
        console.error("[Upload Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openMovieModal(currentRecord, categories, tags, lists, savedState);
      },
    });
  }

  /**
   * ショップグッズ管理タブ (shopTag 管理アコーディオン + ショップ商品一覧)
   */
  async renderShopTab() {
    let shops = [];
    let tags = [];

    try {
      if (!this.shopState.isInitialized) {
        const shopsRes = await api.getTable("shop").catch(() => []);
        const rawList = Array.isArray(shopsRes) ? shopsRes : (shopsRes ? [shopsRes] : []);
        this.shopState.originalRecords = JSON.parse(JSON.stringify(rawList));
        this.shopState.currentRecords = JSON.parse(JSON.stringify(rawList));
        this.shopState.hasPendingChanges = false;
        this.shopState.isInitialized = true;
      }
      shops = this.shopState.currentRecords;

      const tagsRes = await api.getTable("shopTag").catch(() => []);
      tags = Array.isArray(tagsRes) ? tagsRes : (tagsRes ? [tagsRes] : []);
    } catch (err) {
      console.error("[Shop Data Load Error]:", err);
      shops = this.shopState.currentRecords || [];
      tags = [];
    }

    // 表示順（priority）昇順でソート（同じ場合はID昇順）
    shops.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0) || (Number(a.id) || 0) - (Number(b.id) || 0));

    // タグマップ (ID -> タグオブジェクト)
    const tagMap = new Map(tags.map((t) => [String(t.id), t]));

    const container = document.createElement("div");
    container.style.cssText = "display: flex; flex-direction: column; gap: 20px;";

    // ========================================================
    // 1. ショップタグ (shopTag) 管理アコーディオン
    // ========================================================
    const tagCard = document.createElement("div");
    tagCard.className = "admin-tag-manager-card";

    if (this._isShopTagOpen === undefined) {
      this._isShopTagOpen = true;
    }

    tagCard.innerHTML = `
      <div class="admin-tag-manager-header" id="shop-tag-manager-toggle-btn">
        <div class="admin-tag-manager-title">
          <h2 class="admin-card-title">タグ</h2>
          <span class="admin-count-badge">${tags.length}件</span>
        </div>
        <span class="admin-tag-manager-arrow" id="shop-tag-manager-arrow">${this._isShopTagOpen ? "▲" : "▼"}</span>
      </div>
      <div class="admin-tag-manager-body" id="shop-tag-manager-body" style="display: ${this._isShopTagOpen ? "flex" : "none"};">
        <div class="admin-tag-input-row">
          <input
            type="text"
            class="admin-form-input"
            id="new-shop-tag-name-input"
            placeholder="新しいタグ名 (例: グッズ、ボイス、音楽、デジタル)"
          />
          <button type="button" class="app-btn app-btn-primary" id="add-shop-tag-btn" style="white-space: nowrap; padding: 8px 20px;">
            追加
          </button>
        </div>
        <div class="admin-tag-chips-container" id="shop-tag-chips-container">
          ${tags.length === 0 ? '<span style="color: #64748b; font-size: 0.85rem;">登録されているタグはありません</span>' : ""}
          ${tags.map((t) => `
            <div class="admin-tag-chip" data-id="${escapeHtml(t.id)}">
              <span>${escapeHtml(t.tagName)} <span class="admin-tag-chip-id">(ID: ${escapeHtml(t.id)})</span></span>
              <button type="button" class="admin-tag-chip-del" data-id="${escapeHtml(t.id)}" title="削除">×</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    // アコーディオン開閉トグル
    const toggleBtn = tagCard.querySelector("#shop-tag-manager-toggle-btn");
    const tagBody = tagCard.querySelector("#shop-tag-manager-body");
    const tagArrow = tagCard.querySelector("#shop-tag-manager-arrow");
    toggleBtn.onclick = () => {
      this._isShopTagOpen = !this._isShopTagOpen;
      tagBody.style.display = this._isShopTagOpen ? "flex" : "none";
      tagArrow.textContent = this._isShopTagOpen ? "▲" : "▼";
    };

    // タグ追加処理
    const tagInput = tagCard.querySelector("#new-shop-tag-name-input");
    const addTagBtn = tagCard.querySelector("#add-shop-tag-btn");

    const handleAddTag = async () => {
      const val = tagInput.value.trim();
      if (!val) {
        alert("タグ名を入力してください");
        tagInput.focus();
        return;
      }

      addTagBtn.disabled = true;
      try {
        const nextId = tags.length > 0 ? Math.max(...tags.map((t) => Number(t.id) || 0)) + 1 : 1;
        await api.saveTable("shopTag", { id: nextId, tagName: val }, null);
        Toast.success(`タグ「${val}」を追加しました`);
        await this.renderShopTab();
      } catch (e) {
        console.error("[Add Shop Tag Error]:", e);
        Toast.error(`タグの追加に失敗しました: ${e.message}`);
        addTagBtn.disabled = false;
      }
    };

    addTagBtn.onclick = handleAddTag;
    tagInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddTag();
      }
    };

    // タグ削除処理
    tagCard.querySelectorAll(".admin-tag-chip-del").forEach((delBtn) => {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        const tagId = delBtn.dataset.id;
        const targetTag = tags.find((t) => String(t.id) === String(tagId));
        const tagName = targetTag?.tagName || tagId;

        const ok = confirm(
          `タグ「${tagName}」を削除しますか？\n\n※このタグを使用している商品がある場合、タグ表示に影響する可能性があります。`
        );
        if (!ok) return;

        try {
          await api.deleteRecord("shopTag", tagId);
          Toast.info(`タグ「${tagName}」を削除しました`);
          await this.renderShopTab();
        } catch (err) {
          console.error("[Delete Shop Tag Error]:", err);
          Toast.error(`タグの削除に失敗しました: ${err.message}`);
        }
      };
    });

    container.appendChild(tagCard);

    // ========================================================
    // 2. ショップグッズ管理テーブルカード
    // ========================================================
    const card = document.createElement("div");
    card.className = "admin-card";

    // ヘッダー: 「ショップグッズ管理」+ 件数チップ + 「+ 新規追加」+ 「更新反映」
    // ※「テーブル: shop (7件)」のテキストは非表示
    const header = document.createElement("div");
    header.className = "admin-card-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "admin-card-title-group";

    const titleRow = document.createElement("div");
    titleRow.style.cssText = "display: flex; align-items: center; gap: 12px; flex-wrap: wrap;";

    const h2 = document.createElement("h2");
    h2.className = "admin-card-title";
    h2.textContent = "ショップグッズ管理";
    titleRow.appendChild(h2);

    const countBadge = document.createElement("span");
    countBadge.className = "admin-count-badge";
    countBadge.textContent = `${shops.length}件`;
    titleRow.appendChild(countBadge);

    titleGroup.appendChild(titleRow);
    header.appendChild(titleGroup);

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    actions.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const addBtn = document.createElement("button");
    addBtn.className = "app-btn app-btn-primary";
    addBtn.innerHTML = "+ 新規追加";
    addBtn.onclick = () => this.openShopModal(null, tags);
    actions.appendChild(addBtn);

    // 新規追加ボタンの横に「更新反映」ボタンを設置（オレンジ色）
    const commitBtn = document.createElement("button");
    commitBtn.id = "shop-commit-btn";
    commitBtn.className = "app-btn app-btn-orange";

    const changesCount = this.getShopChangesCount();
    if (this.shopState.hasPendingChanges && changesCount > 0) {
      commitBtn.classList.add("has-changes");
      commitBtn.innerHTML = `<span>更新反映</span><span class="admin-badge-count">${changesCount}</span>`;
      commitBtn.title = `${changesCount}件の未反映の変更があります。クリックしてD1に保存（更新反映）します`;
      commitBtn.disabled = false;
    } else {
      commitBtn.innerHTML = `<span>更新反映</span>`;
      commitBtn.title = "D1に未反映の変更はありません";
      commitBtn.disabled = true;
    }

    commitBtn.onclick = async () => {
      await this.commitShopChanges();
    };
    actions.appendChild(commitBtn);

    header.appendChild(actions);
    card.appendChild(header);

    // ショップグッズ管理で未反映の変更がある場合は通知アラートを表示
    if (this.shopState.hasPendingChanges && changesCount > 0) {
      const alertBar = document.createElement("div");
      alertBar.className = "admin-pending-alert";
      alertBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>⚠️</span>
          <span>現在 <strong>${changesCount}件の変更</strong> が保留されています。「更新反映」ボタンを押すまでD1データベースには保存されません。</span>
        </div>
        <button type="button" class="app-btn app-btn-orange" style="padding: 5px 14px; font-size: 0.85rem;">更新反映する</button>
      `;
      alertBar.querySelector("button").onclick = async () => {
        await this.commitShopChanges();
      };
      card.appendChild(alertBar);
    }

    // テーブル生成
    // ヘッダーカラム: 操作｜id｜商品名/価格(2段表示)｜タグ｜商品画像｜表示順
    const tableContainer = document.createElement("div");
    tableContainer.className = "admin-table-container";

    const table = document.createElement("table");
    table.className = "admin-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th class="admin-table-col-actions" style="width: 80px; text-align: center;">操作</th>
        <th style="width: 60px; text-align: center;">id</th>
        <th style="min-width: 200px;">商品名 / 価格</th>
        <th style="width: 140px;">タグ</th>
        <th style="width: 130px; text-align: center;">商品画像</th>
        <th style="width: 80px; text-align: center;">表示順</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    if (shops.length === 0) {
      const emptyTr = document.createElement("tr");
      emptyTr.innerHTML = `
        <td colspan="6" style="text-align: center; color: #64748b; padding: 36px 16px;">
          ショップ商品データがありません。「+ 新規追加」ボタンから登録してください。
        </td>
      `;
      tbody.appendChild(emptyTr);
    } else {
      shops.forEach((item) => {
        const tr = document.createElement("tr");

        // 1. 操作列 (縦並び「編集」「削除」)
        const tdActions = document.createElement("td");
        tdActions.className = "admin-table-col-actions";
        tdActions.style.textAlign = "center";

        const actWrap = document.createElement("div");
        actWrap.className = "admin-table-actions is-vertical";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "app-btn app-btn-secondary app-btn-sm";
        editBtn.textContent = "編集";
        editBtn.onclick = (e) => {
          e.stopPropagation();
          this.openShopModal(item, tags);
        };

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "app-btn app-btn-danger app-btn-sm";
        delBtn.textContent = "削除";
        delBtn.onclick = async (e) => {
          e.stopPropagation();
          await this.deleteRecord("shop", item.id);
        };

        actWrap.appendChild(editBtn);
        actWrap.appendChild(delBtn);
        tdActions.appendChild(actWrap);
        tr.appendChild(tdActions);

        // 2. id列
        const tdId = document.createElement("td");
        tdId.style.textAlign = "center";
        tdId.textContent = item.id;
        tr.appendChild(tdId);

        // 3. 商品名 / 価格 (2段表示)
        const tdNamePrice = document.createElement("td");
        const formattedPrice =
          item.price != null && item.price !== ""
            ? `¥${Number(item.price).toLocaleString()}`
            : '<span style="color: #64748b;">(価格未設定)</span>';

        tdNamePrice.innerHTML = `
          <div class="admin-shop-tworow-cell">
            <div class="admin-shop-name-row">${escapeHtml(item.name || "")}</div>
            <div class="admin-shop-price-row">${formattedPrice}</div>
          </div>
        `;
        tr.appendChild(tdNamePrice);

        // 4. タグ (shopTag_id)
        const tdTag = document.createElement("td");
        const tagObj = tagMap.get(String(item.shopTag_id));
        if (tagObj) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge">${escapeHtml(tagObj.tagName)}</span>`;
        } else if (item.shopTag_id) {
          tdTag.innerHTML = `<span class="admin-schedule-tag-badge" style="opacity: 0.7;">ID: ${escapeHtml(item.shopTag_id)}</span>`;
        } else {
          tdTag.innerHTML = `<span style="color: #64748b;">-</span>`;
        }
        tr.appendChild(tdTag);

        // 5. 商品画像 (merchandiseImage)
        const tdImg = document.createElement("td");
        tdImg.style.textAlign = "center";
        const hasImg = item.merchandiseImage || item.image;
        if (hasImg) {
          const imgDisplayUrl = api.resolveAssetUrl(hasImg, "shop");
          const img = document.createElement("img");
          img.className = "admin-table-thumb is-shop-thumb";
          img.src = imgDisplayUrl;
          img.alt = item.name || "商品画像";
          img.title = `${item.name || "商品画像"} (クリックで拡大)`;
          img.onclick = (e) => {
            e.stopPropagation();
            this.openImageDetailModal(imgDisplayUrl, `商品画像: ${item.name || `ID: ${item.id}`}`, {
              costumeName: item.name || `商品 ID: ${item.id}`,
              columnLabel: "商品画像",
              path: hasImg,
            });
          };
          tdImg.appendChild(img);
        } else {
          tdImg.innerHTML = `<span style="color: #64748b; font-size: 0.78rem;">(画像なし)</span>`;
        }
        tr.appendChild(tdImg);

        // 6. 表示順 (priority)
        const tdPriority = document.createElement("td");
        tdPriority.style.textAlign = "center";
        tdPriority.textContent = item.priority != null ? item.priority : "-";
        tr.appendChild(tdPriority);

        tbody.appendChild(tr);
      });
    }

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    container.appendChild(card);

    this.container.innerHTML = "";
    this.container.appendChild(container);
  }

  /**
   * ショップグッズ (shop) 専用の新規・編集モーダル
   */
  async openShopModal(record, tags = null, restoreState = null) {
    const isNew = !record;

    // タグマスタの取得 (渡されていない場合)
    let allTags = tags;
    if (!allTags) {
      try {
        const tRes = await api.getTable("shopTag").catch(() => []);
        allTags = Array.isArray(tRes) ? tRes : (tRes ? [tRes] : []);
      } catch (e) {
        allTags = [];
      }
    }

    // 全ショップレコード取得 (ID自動採番 & 表示順設定 & ライブラリキャッシュ用)
    let allShops = [];
    if (this.shopState && this.shopState.isInitialized && this.shopState.currentRecords.length > 0) {
      allShops = this.shopState.currentRecords;
    } else {
      try {
        const res = await api.getTable("shop");
        allShops = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) {
        allShops = [];
      }
    }

    // 自動採番 (新規時)
    const nextId = allShops.length > 0 ? Math.max(...allShops.map((s) => Number(s.id) || 0)) + 1 : 1;
    const nextPriority = allShops.length > 0 ? Math.max(...allShops.map((s) => Number(s.priority) || 0)) + 1 : 1;

    // 現在のデータ
    const currentData = {
      id: isNew ? nextId : record.id,
      name: record?.name || "",
      price: record?.price != null ? record.price : "",
      shopTag_id: record?.shopTag_id || "",
      merchandiseImage: record?.merchandiseImage || record?.image || "",
      priority: record?.priority != null ? record.priority : nextPriority,
      booth: record?.booth || "",
      base: record?.base || "",
      streamart: record?.streamart || "",
      freeshop: record?.freeshop || "",
      ...restoreState,
    };

    // ライブラリ候補の集約
    if (!this.shopLibraryCache) {
      this.shopLibraryCache = [];
    }
    const librarySet = new Set(["samplegoods.png", ...this.shopLibraryCache]);
    allShops.forEach((row) => {
      const img = row.merchandiseImage || row.image;
      if (img && typeof img === "string" && !img.startsWith("http")) {
        librarySet.add(img.split("/").pop());
      }
    });
    this.shopLibraryCache = Array.from(librarySet);

    // GoogleドライブURL変換ヘルパー
    const convertGoogleDriveUrl = (url) => {
      if (!url) return url;
      const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1600`;
      }
      return url;
    };

    const initialMode =
      currentData.image_mode ||
      (currentData.merchandiseImage &&
      (currentData.merchandiseImage.startsWith("http://") || currentData.merchandiseImage.startsWith("https://"))
        ? "url"
        : "library");

    const form = document.createElement("form");
    form.className = "admin-modal-form";
    form.style.cssText = "display: flex; flex-direction: column; gap: 16px;";

    form.innerHTML = `
      <!-- 行1: id ｜ 表示順 -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            id
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="id"
            type="number"
            value="${escapeHtml(currentData.id)}"
            readonly
            style="background: rgba(15, 23, 42, 0.7); color: #94a3b8; cursor: not-allowed;"
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            表示順 (priority)
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="priority"
            type="number"
            value="${escapeHtml(currentData.priority)}"
            required
          />
        </div>
      </div>

      <!-- 行2: 商品名 ｜ 価格 -->
      <div class="admin-form-row admin-form-grid-2">
        <div class="admin-form-group">
          <label class="admin-form-label">
            商品名
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="name"
            type="text"
            value="${escapeHtml(currentData.name)}"
            placeholder="例: アクリルスタンド、ボイスドラマvol.1"
            required
          />
        </div>

        <div class="admin-form-group">
          <label class="admin-form-label">
            価格 (円)
            <span class="admin-form-label-required">*必須</span>
          </label>
          <input
            class="admin-form-input"
            name="price"
            type="number"
            min="0"
            step="1"
            value="${escapeHtml(currentData.price)}"
            placeholder="例: 1500"
            required
          />
        </div>
      </div>

      <!-- 行3: タグ (shopTag) -->
      <div class="admin-form-group">
        <label class="admin-form-label">タグ (区分)</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select class="admin-form-input" name="shopTag_id" id="modal-shop-tag-select" style="flex: 1;">
            <option value="">-- タグを選択しない (なし) --</option>
            ${allTags.map((t) => `
              <option value="${escapeHtml(t.id)}" ${String(currentData.shopTag_id) === String(t.id) ? "selected" : ""}>
                ${escapeHtml(t.tagName)} (ID: ${escapeHtml(t.id)})
              </option>
            `).join("")}
          </select>
          <button type="button" class="app-btn app-btn-secondary" id="btn-toggle-shop-tag" style="white-space: nowrap; padding: 8px 14px; font-size: 0.85rem;">
            ＋ タグ追加
          </button>
        </div>

        <!-- インラインタグ追加パネル -->
        <div id="modal-inline-shop-tag-panel" style="display: none; margin-top: 8px; padding: 10px 12px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: var(--radius-sm, 6px);">
          <div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
            <span>新規タグ名を入力してください:</span>
            <button type="button" id="btn-modal-shop-tag-close" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 0 4px; line-height: 1;" title="閉じる">×</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <input
              type="text"
              class="admin-form-input"
              id="modal-inline-shop-tag-input"
              placeholder="新しいタグ名 (例: グッズ、ボイス、音楽)"
              style="flex: 1; padding: 6px 10px; font-size: 0.85rem;"
            />
            <button type="button" class="app-btn app-btn-primary app-btn-sm" id="btn-modal-shop-tag-submit" style="white-space: nowrap; padding: 6px 14px; font-size: 0.82rem;">
              追加
            </button>
          </div>
        </div>
      </div>

      <!-- 行4: 商品画像 (merchandiseImage) -->
      <div class="admin-visual-field-card">
        <div class="admin-visual-field-header">
          <span class="admin-visual-field-title">商品画像 (4:3)</span>
          <span class="admin-form-label-required">*必須</span>
        </div>

        <!-- モード切替ラジオ -->
        <div class="admin-visual-mode-selector">
          <label class="admin-visual-mode-label">
            <input type="radio" name="image_mode" value="library" ${initialMode === "library" ? "checked" : ""} />
            <span>ライブラリから選択 / アップロード</span>
          </label>
          <label class="admin-visual-mode-label">
            <input type="radio" name="image_mode" value="url" ${initialMode === "url" ? "checked" : ""} />
            <span>外部URL指定 (Googleドライブ等)</span>
          </label>
        </div>

        <!-- モード1: ライブラリ選択パネル -->
        <div class="admin-visual-mode-panel" id="mode-library-shop" style="display: ${initialMode === "library" ? "block" : "none"};">
          <div style="display: flex; gap: 8px; align-items: center;">
            <select class="admin-form-input admin-visual-file-select" data-field="merchandiseImage" style="flex: 1;">
              <option value="">-- ライブラリから選択 --</option>
              ${this.shopLibraryCache.map((fn) => `
                <option value="${escapeHtml(fn)}" ${currentData.merchandiseImage && currentData.merchandiseImage.endsWith(fn) ? "selected" : ""}>
                  ${escapeHtml(fn)}
                </option>
              `).join("")}
            </select>
            <button type="button" class="app-btn app-btn-secondary admin-shop-upload-btn" data-field="merchandiseImage" style="white-space: nowrap; padding: 8px 14px;">
              📁 アップロード
            </button>
          </div>
        </div>

        <!-- モード2: 外部URL指定パネル -->
        <div class="admin-visual-mode-panel" id="mode-url-shop" style="display: ${initialMode === "url" ? "block" : "none"};">
          <input
            type="text"
            class="admin-form-input admin-visual-url-input"
            data-field="merchandiseImage"
            placeholder="https://drive.google.com/file/d/... または画像直URL"
            value="${initialMode === "url" ? escapeHtml(currentData.merchandiseImage || "") : ""}"
          />
          <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
            ※ Googleドライブの「リンクを知っている全員」の共有リンクを貼り付けると自動変換されます
          </p>
        </div>

        <!-- プレビュー枠 (4:3) -->
        <div class="admin-visual-preview-box is-shop-box" id="preview-box-shop" style="margin-top: 10px; max-width: 200px; aspect-ratio: 4 / 3;">
          <span class="admin-visual-preview-empty">プレビューなし</span>
        </div>
      </div>

      <!-- 行5: 各種ショップURLリンク (任意) -->
      <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: var(--radius-md, 8px); padding: 14px 16px;">
        <div style="font-weight: 600; font-size: 0.88rem; color: #f1f5f9; margin-bottom: 10px;">
          🔗 商品ページリンク設定 (任意)
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div class="admin-form-group">
            <label class="admin-form-label" style="font-size: 0.82rem;">BOOTH URL</label>
            <input
              class="admin-form-input"
              name="booth"
              type="url"
              value="${escapeHtml(currentData.booth)}"
              placeholder="https://◯◯.booth.pm/items/..."
            />
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label" style="font-size: 0.82rem;">BASE URL</label>
            <input
              class="admin-form-input"
              name="base"
              type="url"
              value="${escapeHtml(currentData.base)}"
              placeholder="https://◯◯.thebase.in/items/..."
            />
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label" style="font-size: 0.82rem;">StreamArt URL</label>
            <input
              class="admin-form-input"
              name="streamart"
              type="url"
              value="${escapeHtml(currentData.streamart)}"
              placeholder="https://streamart.jp/..."
            />
          </div>

          <div class="admin-form-group">
            <label class="admin-form-label" style="font-size: 0.82rem;">任意ショップ URL (freeshop)</label>
            <input
              class="admin-form-input"
              name="freeshop"
              type="url"
              value="${escapeHtml(currentData.freeshop)}"
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
    `;

    // インラインタグ追加パネルの開閉 & 登録
    const btnToggleTag = form.querySelector("#btn-toggle-shop-tag");
    const tagPanel = form.querySelector("#modal-inline-shop-tag-panel");
    const btnCloseTag = form.querySelector("#btn-modal-shop-tag-close");
    const inputInlineTag = form.querySelector("#modal-inline-shop-tag-input");
    const btnSubmitTag = form.querySelector("#btn-modal-shop-tag-submit");
    const selectTag = form.querySelector("#modal-shop-tag-select");

    btnToggleTag.onclick = () => {
      const isHidden = tagPanel.style.display === "none";
      tagPanel.style.display = isHidden ? "block" : "none";
      if (isHidden) inputInlineTag.focus();
    };

    btnCloseTag.onclick = () => {
      tagPanel.style.display = "none";
    };

    const handleInlineTagSubmit = async () => {
      const val = inputInlineTag.value.trim();
      if (!val) {
        alert("タグ名を入力してください");
        inputInlineTag.focus();
        return;
      }

      btnSubmitTag.disabled = true;
      try {
        const nextTagId = allTags.length > 0 ? Math.max(...allTags.map((t) => Number(t.id) || 0)) + 1 : 1;
        await api.saveTable("shopTag", { id: nextTagId, tagName: val }, null);
        Toast.success(`タグ「${val}」を追加しました`);

        // セレクトボックスに即時反映
        const newOpt = document.createElement("option");
        newOpt.value = String(nextTagId);
        newOpt.textContent = `${val} (ID: ${nextTagId})`;
        newOpt.selected = true;
        selectTag.appendChild(newOpt);
        allTags.push({ id: nextTagId, tagName: val });

        inputInlineTag.value = "";
        tagPanel.style.display = "none";
      } catch (e) {
        console.error("[Inline Add Shop Tag Error]:", e);
        Toast.error(`タグの追加に失敗しました: ${e.message}`);
      } finally {
        btnSubmitTag.disabled = false;
      }
    };

    btnSubmitTag.onclick = handleInlineTagSubmit;
    inputInlineTag.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInlineTagSubmit();
      }
    };

    // プレビュー描画ヘルパー
    const updatePreview = () => {
      const pBox = form.querySelector("#preview-box-shop");
      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let val = null;

      if (mode === "library") {
        val = form.querySelector('.admin-visual-file-select[data-field="merchandiseImage"]')?.value?.trim();
      } else {
        val = form.querySelector('.admin-visual-url-input[data-field="merchandiseImage"]')?.value?.trim();
      }

      if (val) {
        const fullUrl = api.resolveAssetUrl(val, "shop");
        pBox.innerHTML = `
          <img src="${escapeHtml(fullUrl)}" alt="プレビュー" style="width: 100%; height: 100%; object-fit: contain;" />
        `;
      } else {
        pBox.innerHTML = '<span class="admin-visual-preview-empty">プレビューなし</span>';
      }
    };

    // モード切り替えリスナー
    form.querySelectorAll('[name="image_mode"]').forEach((radio) => {
      radio.onchange = (e) => {
        const mode = e.target.value;
        const libPanel = form.querySelector("#mode-library-shop");
        const urlPanel = form.querySelector("#mode-url-shop");
        if (mode === "library") {
          libPanel.style.display = "block";
          urlPanel.style.display = "none";
        } else {
          libPanel.style.display = "none";
          urlPanel.style.display = "block";
        }
        updatePreview();
      };
    });

    // プルダウン変更
    form.querySelector('.admin-visual-file-select[data-field="merchandiseImage"]').onchange = updatePreview;

    // URL入力変更
    const urlInput = form.querySelector('.admin-visual-url-input[data-field="merchandiseImage"]');
    urlInput.oninput = () => {
      const converted = convertGoogleDriveUrl(urlInput.value.trim());
      if (converted !== urlInput.value.trim()) {
        urlInput.value = converted;
      }
      updatePreview();
    };

    // アップロードボタン押下
    form.querySelector('.admin-shop-upload-btn[data-field="merchandiseImage"]').onclick = () => {
      const savedState = this.collectShopFormData(form);
      const cfg = {
        label: "商品画像",
        category: "shop",
        uploadPath: "assets/shop",
        accept: ".png,.jpg,.jpeg,.webp",
        maxSizeBytes: 2097152, // 2MB
        maxSizeMB: 2,
        aspectRatio: "4:3",
        displayMode: "contain",
        maxLongEdge: 800,
      };
      this.openShopUploadModal("merchandiseImage", record, savedState, cfg, allTags);
    };

    updatePreview();

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.style.padding = "10px 24px";
    submitBtn.textContent = isNew ? "新規作成" : "変更を保存する";

    submitBtn.onclick = async () => {
      const fd = new FormData(form);
      const nameVal = fd.get("name")?.toString().trim();
      const priceVal = fd.get("price")?.toString().trim();

      if (!nameVal) {
        alert("商品名は必須項目です");
        return;
      }

      if (!priceVal) {
        alert("価格は必須項目です");
        return;
      }

      const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
      let imageVal = null;
      if (mode === "library") {
        imageVal = form.querySelector('.admin-visual-file-select[data-field="merchandiseImage"]')?.value?.trim() || null;
      } else {
        const raw = form.querySelector('.admin-visual-url-input[data-field="merchandiseImage"]')?.value?.trim() || null;
        imageVal = raw ? convertGoogleDriveUrl(raw) : null;
      }

      const payload = {
        id: Number(fd.get("id")),
        name: nameVal,
        price: Number(priceVal) || 0,
        shopTag_id: fd.get("shopTag_id") ? Number(fd.get("shopTag_id")) : null,
        merchandiseImage: imageVal || null,
        priority: fd.get("priority") ? Number(fd.get("priority")) : 0,
        booth: fd.get("booth")?.toString().trim() || null,
        base: fd.get("base")?.toString().trim() || null,
        streamart: fd.get("streamart")?.toString().trim() || null,
        freeshop: fd.get("freeshop")?.toString().trim() || null,
      };

      // ショップグッズ (shop) の場合は D1 には直接保存せず、保留バッファ（ドラフト）を更新
      if (isNew) {
        this.shopState.currentRecords.push(payload);
      } else {
        const idx = this.shopState.currentRecords.findIndex(
          (r) => Number(r.id) === Number(currentData.id)
        );
        if (idx !== -1) {
          this.shopState.currentRecords[idx] = {
            ...this.shopState.currentRecords[idx],
            ...payload,
          };
        } else {
          this.shopState.currentRecords.push(payload);
        }
      }

      this.shopState.hasPendingChanges = true;
      Modal.close();
      Toast.info(
        isNew
          ? "商品を保留リストに追加しました。「更新反映」を押すまで確定されません。"
          : "商品の変更を保留しました。「更新反映」を押すまで確定されません。"
      );
      await this.renderShopTab();
    };

    Modal.open({
      title: isNew ? "ショップ商品の新規追加" : `ショップ商品の編集 (id: ${currentData.id})`,
      content: form,
      footer: submitBtn,
      isLarge: true,
    });
  }

  /**
   * ショップ商品 編集フォームの現在の入力値を収集するヘルパー (アップロード時の一時退避用)
   */
  collectShopFormData(form) {
    const fd = new FormData(form);
    const mode = form.querySelector('[name="image_mode"]:checked')?.value || "library";
    let imageVal = "";
    if (mode === "library") {
      imageVal = form.querySelector('.admin-visual-file-select[data-field="merchandiseImage"]')?.value?.trim() || "";
    } else {
      imageVal = form.querySelector('.admin-visual-url-input[data-field="merchandiseImage"]')?.value?.trim() || "";
    }

    return {
      id: fd.get("id") ? Number(fd.get("id")) : undefined,
      name: fd.get("name")?.toString() || "",
      price: fd.get("price")?.toString() || "",
      shopTag_id: fd.get("shopTag_id")?.toString() || "",
      merchandiseImage: imageVal,
      image_mode: mode,
      priority: fd.get("priority")?.toString() || "1",
      booth: fd.get("booth")?.toString() || "",
      base: fd.get("base")?.toString() || "",
      streamart: fd.get("streamart")?.toString() || "",
      freeshop: fd.get("freeshop")?.toString() || "",
    };
  }

  /**
   * ショップ商品 (shop) 専用の画像アップロード・クロップモーダル
   */
  async openShopUploadModal(field, currentRecord, savedState, cfg, tags) {
    const wrap = document.createElement("div");
    wrap.className = "admin-upload-dialog-wrap";

    let selectedImg = null;
    let currentBlob = null;
    let isSizeValid = false;

    const targetW = 800;
    const targetH = 600;
    const maxKB = cfg.maxSizeMB * 1024;

    wrap.innerHTML = `
      <div class="admin-upload-dropzone" id="upload-dropzone-shop">
        <input type="file" id="upload-file-input-shop" accept="${cfg.accept}" style="display: none;" />
        <div class="admin-upload-dropzone-icon">📁</div>
        <div class="admin-upload-dropzone-text">クリックまたはドラッグ＆ドロップで画像を選択</div>
        <div class="admin-upload-dropzone-hint">${cfg.accept} / 最大 ${cfg.maxSizeMB}MB</div>
      </div>

      <div class="crop-stage" id="crop-stage-shop" style="display: none;">
        <div class="crop-canvas-wrapper" style="max-width: 480px; aspect-ratio: 4 / 3;">
          <canvas id="crop-canvas-shop"></canvas>
        </div>

        <div class="crop-controls">
          <div class="crop-control-row">
            <span class="crop-control-label">ズーム</span>
            <input type="range" class="crop-slider" id="crop-zoom-slider-shop" />
          </div>
          <div class="crop-btn-group">
            <button type="button" class="app-btn app-btn-secondary app-btn-sm" id="crop-fit-btn-shop">全体表示</button>
            <button type="button" class="app-btn app-btn-secondary app-btn-sm" id="crop-center-btn-shop">中央揃え</button>
            <span class="crop-size-badge" id="crop-size-badge-shop">- KB / ${maxKB} KB</span>
          </div>
        </div>
      </div>

      <div class="admin-upload-filename-row">
        <label class="admin-upload-filename-label">保存ファイル名:</label>
        <div class="admin-upload-filename-input-wrap">
          <input type="text" class="admin-form-input" id="upload-filename-input-shop" placeholder="例: goods_stand" />
          <span class="admin-upload-ext-label" id="upload-ext-label-shop">.jpg</span>
        </div>
      </div>
      <div class="admin-upload-error-text" id="upload-name-error-shop" style="display: none;">
        ※ 半角英数字、ハイフン、アンダースコアのみ使用できます
      </div>
    `;

    const footer = document.createElement("div");
    footer.style.cssText = "display: flex; justify-content: flex-end; gap: 12px; width: 100%;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "app-btn app-btn-secondary";
    cancelBtn.textContent = "キャンセル";

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "app-btn app-btn-primary";
    uploadBtn.textContent = "アップロード";
    uploadBtn.disabled = true;

    footer.appendChild(cancelBtn);
    footer.appendChild(uploadBtn);

    cancelBtn.onclick = () => {
      this.openShopModal(currentRecord, tags, savedState);
    };

    const dropzone = wrap.querySelector("#upload-dropzone-shop");
    const fileInput = wrap.querySelector("#upload-file-input-shop");
    const cropStage = wrap.querySelector("#crop-stage-shop");
    const cropCanvas = wrap.querySelector("#crop-canvas-shop");
    const zoomSlider = wrap.querySelector("#crop-zoom-slider-shop");
    const fitBtn = wrap.querySelector("#crop-fit-btn-shop");
    const centerBtn = wrap.querySelector("#crop-center-btn-shop");
    const sizeBadge = wrap.querySelector("#crop-size-badge-shop");
    const nameInput = wrap.querySelector("#upload-filename-input-shop");
    const extLabel = wrap.querySelector("#upload-ext-label-shop");
    const nameError = wrap.querySelector("#upload-name-error-shop");

    dropzone.onclick = () => fileInput.click();

    let scale = 1;
    let baseScale = 1;
    let centerX = targetW / 2;
    let centerY = targetH / 2;

    const renderCanvas = () => {
      const ctx = cropCanvas.getContext("2d");
      ctx.clearRect(0, 0, targetW, targetH);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetW, targetH);

      if (!selectedImg) return;

      const drawW = selectedImg.naturalWidth * scale;
      const drawH = selectedImg.naturalHeight * scale;
      const drawX = centerX - drawW / 2;
      const drawY = centerY - drawH / 2;

      ctx.drawImage(selectedImg, drawX, drawY, drawW, drawH);
    };

    let sizeCalcTimer = null;
    const scheduleSizeUpdate = (immediate = false) => {
      if (sizeCalcTimer) clearTimeout(sizeCalcTimer);

      const calculateSize = () => {
        cropCanvas.toBlob(
          (blob) => {
            currentBlob = blob;
            if (!blob) return;
            const kb = Math.round(blob.size / 1024);
            const isOk = blob.size <= cfg.maxSizeBytes;
            isSizeValid = isOk;

            if (isOk) {
              sizeBadge.className = "crop-size-badge is-ok";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB OK`;
            } else {
              sizeBadge.className = "crop-size-badge is-ng";
              sizeBadge.textContent = `${kb} KB / ${maxKB} KB 超過`;
            }
            checkUploadBtnState();
          },
          "image/jpeg",
          0.85
        );
      };

      if (immediate) {
        calculateSize();
      } else {
        sizeCalcTimer = setTimeout(calculateSize, 200);
      }
    };

    const checkUploadBtnState = () => {
      const fileNameRaw = nameInput.value.trim();
      const isNameOk = /^[a-zA-Z0-9_-]+$/.test(fileNameRaw);
      uploadBtn.disabled = !selectedImg || !isSizeValid || !isNameOk;
    };

    // ドラッグ移動
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialCenterX = targetW / 2;
    let initialCenterY = targetH / 2;

    cropCanvas.onmousedown = (e) => {
      if (!selectedImg) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialCenterX = centerX;
      initialCenterY = centerY;
      cropCanvas.style.cursor = "grabbing";
    };

    const handleWindowMouseMove = (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - dragStartX) * (targetW / cropCanvas.clientWidth);
      const dy = (e.clientY - dragStartY) * (targetH / cropCanvas.clientHeight);
      centerX = initialCenterX + dx;
      centerY = initialCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const handleWindowMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        cropCanvas.style.cursor = "grab";
        scheduleSizeUpdate(true);
      }
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    // タッチ対応
    cropCanvas.ontouchstart = (e) => {
      if (!selectedImg || e.touches.length !== 1) return;
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartY = e.touches[0].clientY;
      initialCenterX = centerX;
      initialCenterY = centerY;
    };

    const handleWindowTouchMove = (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = (e.touches[0].clientX - dragStartX) * (targetW / cropCanvas.clientWidth);
      const dy = (e.touches[0].clientY - dragStartY) * (targetH / cropCanvas.clientHeight);
      centerX = initialCenterX + dx;
      centerY = initialCenterY + dy;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    const handleWindowTouchEnd = () => {
      if (isDragging) {
        isDragging = false;
        scheduleSizeUpdate(true);
      }
    };

    window.addEventListener("touchmove", handleWindowTouchMove, { passive: true });
    window.addEventListener("touchend", handleWindowTouchEnd);

    // ホイールズーム
    cropCanvas.onwheel = (e) => {
      e.preventDefault();
      if (!selectedImg) return;
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      scale = Math.max(parseFloat(zoomSlider.min), Math.min(parseFloat(zoomSlider.max), scale * zoomFactor));
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    // スライダー操作
    zoomSlider.oninput = (e) => {
      scale = parseFloat(e.target.value);
      renderCanvas();
      scheduleSizeUpdate(false);
    };

    fitBtn.onclick = () => {
      if (!selectedImg) return;
      scale = baseScale;
      centerX = targetW / 2;
      centerY = targetH / 2;
      zoomSlider.value = scale;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    centerBtn.onclick = () => {
      if (!selectedImg) return;
      centerX = targetW / 2;
      centerY = targetH / 2;
      renderCanvas();
      scheduleSizeUpdate(true);
    };

    // ファイル選択処理
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase() || ".jpg";
      extLabel.textContent = ext;

      const baseName = file.name.substring(0, file.name.lastIndexOf(".")).replace(/[^a-zA-Z0-9_-]/g, "_");
      if (!nameInput.value) {
        nameInput.value = baseName || "shop_image";
      }

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const img = new Image();
        img.onload = () => {
          selectedImg = img;
          cropCanvas.width = targetW;
          cropCanvas.height = targetH;

          baseScale = Math.min(targetW / img.naturalWidth, targetH / img.naturalHeight);
          scale = baseScale;
          centerX = targetW / 2;
          centerY = targetH / 2;

          zoomSlider.min = (baseScale * 0.15).toFixed(4);
          zoomSlider.max = Math.max(baseScale * 5, 3.5).toFixed(4);
          zoomSlider.step = "0.002";
          zoomSlider.value = scale;

          renderCanvas();
          scheduleSizeUpdate(true);

          cropStage.style.display = "flex";
          checkUploadBtnState();
        };
        img.src = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    };

    nameInput.oninput = () => {
      const val = nameInput.value.trim();
      const isValid = /^[a-zA-Z0-9_-]+$/.test(val);
      if (val && !isValid) {
        nameError.style.display = "block";
      } else {
        nameError.style.display = "none";
      }
      checkUploadBtnState();
    };

    // アップロードボタン押下
    uploadBtn.onclick = async () => {
      const fileNameRaw = nameInput.value.trim();
      if (!fileNameRaw || !/^[a-zA-Z0-9_-]+$/.test(fileNameRaw)) {
        nameError.style.display = "block";
        return;
      }

      if (!isSizeValid || !currentBlob) {
        alert("容量が制限を超えています。縮小またはファイルサイズを調整してください。");
        return;
      }

      const ext = extLabel.textContent;
      const fullFileName = `${fileNameRaw}${ext}`;
      const uploadPath = `${cfg.uploadPath}/${fullFileName}`;

      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";

      try {
        const uploadResult = await api.uploadAsset(uploadPath, currentBlob);
        Toast.success(`「${fullFileName}」をアップロードしました`);

        if (!this.shopLibraryCache) {
          this.shopLibraryCache = [];
        }
        if (!this.shopLibraryCache.includes(fullFileName)) {
          this.shopLibraryCache.unshift(fullFileName);
        }

        cleanupListeners();
        Modal.close();

        // 復元してモーダル再オープン
        const updatedState = {
          ...savedState,
          merchandiseImage: fullFileName,
          image_mode: "library",
        };
        this.openShopModal(currentRecord, tags, updatedState);
      } catch (err) {
        console.error("[Upload Shop Error]:", err);
        Toast.error(`アップロードに失敗しました: ${err.message}`);
        uploadBtn.disabled = false;
        uploadBtn.textContent = "アップロード";
      }
    };

    const cleanupListeners = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
    };

    Modal.open({
      title: `${cfg.label} の画像アップロード`,
      content: wrap,
      footer: footer,
      isLarge: true,
      onClose: () => {
        cleanupListeners();
        this.openShopModal(currentRecord, tags, savedState);
      },
    });
  }

  /**
   * 編集・新規モーダル生成
   */
  async openEditModal(tableName, record) {
    if (tableName === "visual") {
      return this.openVisualModal(record);
    }
    if (tableName === "event") {
      return this.openEventModal(record);
    }
    if (tableName === "notice") {
      return this.openNoticeModal(record);
    }
    if (tableName === "schedule") {
      return this.openScheduleModal(record);
    }
    if (tableName === "gallery") {
      return this.openGalleryModal(record);
    }
    if (tableName === "movie") {
      return this.openMovieModal(record);
    }
    if (tableName === "shop") {
      return this.openShopModal(record);
    }

    const isNew = !record;
    const currentData = record ? { ...record } : {};

    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "14px";

    // レコードの各キーに応じた入力項目自動生成
    let keys;
    if (tableName === "linkList") {
      keys = isNew
        ? ["title", "buttonTextColor", "link", "buttonImage", "priority"]
        : ["id", "title", "buttonTextColor", "link", "buttonImage", "priority"];
    } else if (record) {
      keys = Object.keys(record).filter(k => k !== "created_at" && k !== "updated_at");
    } else if (tableName === "visual") {
      keys = ["costumeName", "visual", "defoemed", "thumbnail", "visualBackground", "characterDesign", "illustrator", "live2d", "3dModeling", "priority"];
    } else if (tableName === "notice") {
      keys = ["status", "scheduled_at", "message", "Image"];
    } else if (tableName === "gallery") {
      keys = ["name", "image"];
    } else {
      keys = ["name", "priority"];
    }

    const labelMap = {
      id: "id",
      name: "画像名",
      status: "ステータス",
      scheduled_at: "予約投稿時刻",
      message: "お知らせ本文",
      Image: "画像",
      image: "画像",
      title: "ボタンテキスト",
      buttonTextColor: "文字色",
      link: "リンク",
      buttonImage: "ボタン画像",
      priority: "表示順",
    };

    keys.forEach((key) => {
      const group = document.createElement("div");
      group.className = "admin-form-group";

      const label = document.createElement("label");
      label.className = "admin-form-label";
      label.textContent = labelMap[key] || key;
      group.appendChild(label);

      const val = currentData[key] ?? "";

      if (key === "id") {
        const input = document.createElement("input");
        input.className = "admin-form-input";
        input.type = "number";
        input.value = val;
        input.name = key;
        if (!isNew) input.disabled = true;
        group.appendChild(input);
      } else if (key === "status") {
        const select = document.createElement("select");
        select.className = "admin-form-input";
        select.name = key;
        const opts = [
          { value: "published", label: "公開 (published)" },
          { value: "scheduled", label: "予約 (scheduled)" },
          { value: "draft", label: "下書き (draft)" },
        ];
        opts.forEach((o) => {
          const opt = document.createElement("option");
          opt.value = o.value;
          opt.textContent = o.label;
          select.appendChild(opt);
        });
        select.value = val || "published";
        group.appendChild(select);
      } else if (key === "scheduled_at") {
        const input = document.createElement("input");
        input.className = "admin-form-input";
        input.type = "datetime-local";
        let dtVal = "";
        if (val) {
          const s = String(val).trim().replace(" ", "T");
          dtVal = s.substring(0, 16);
        }
        input.value = dtVal;
        input.name = key;
        group.appendChild(input);
      } else if (
        key.toLowerCase().includes("image") ||
        key === "banner" ||
        key === "topLine" ||
        key === "outLine" ||
        key === "sectionBackground" ||
        key === "visual" ||
        key === "defoemed" ||
        key === "deformed" ||
        key === "thumbnail" ||
        key === "visualBackground"
      ) {
        const input = document.createElement("input");
        input.className = "admin-form-input";
        input.type = "text";
        input.value = val;
        input.name = key;
        if (tableName === "linkList" && key === "buttonImage") {
          input.placeholder = "assets/link/defaultbutton_typeA.svg 等";
        } else {
          input.placeholder = "assets/... または sample.png";
        }
        group.appendChild(input);
        if (tableName === "linkList" && key === "buttonImage") {
          const hint = document.createElement("span");
          hint.className = "admin-form-hint";
          hint.style.cssText = "font-size: 0.78rem; color: #94a3b8; margin-top: 4px; display: block;";
          hint.textContent = "未入力の場合はデフォルト画像 (assets/link/defaultbutton_typeA.svg) が使用されます";
          group.appendChild(hint);

          const previewWrap = document.createElement("div");
          previewWrap.style.cssText = "margin-top: 8px; display: flex; align-items: center; gap: 10px; background: rgba(15, 23, 42, 0.5); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08);";

          const previewImg = document.createElement("img");
          previewImg.style.cssText = "width: 130px; height: 30px; aspect-ratio: 5 / 1; object-fit: contain; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.18); background: rgba(15, 23, 42, 0.7); display: block;";

          const previewText = document.createElement("span");
          previewText.style.cssText = "font-size: 0.76rem; color: #94a3b8;";

          const syncPreview = () => {
            const curVal = input.value.trim();
            const src = curVal || "assets/link/defaultbutton_typeA.svg";
            previewImg.src = api.resolveAssetUrl(src, "link");
            previewText.textContent = curVal ? "プレビュー (カスタム画像)" : "プレビュー (デフォルト画像)";
          };
          syncPreview();
          input.addEventListener("input", syncPreview);

          previewWrap.appendChild(previewImg);
          previewWrap.appendChild(previewText);
          group.appendChild(previewWrap);
        }
      } else if (key === "buttonTextColor" || key === "color") {
        const colorWrap = document.createElement("div");
        colorWrap.style.cssText = "display: flex; align-items: center; gap: 10px;";

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        const initialHex = val && /^#[0-9a-fA-F]{6}$/.test(String(val).trim()) ? String(val).trim() : "#ffffff";
        colorInput.value = initialHex;
        colorInput.style.cssText = "width: 44px; height: 38px; padding: 2px; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; background: #0f172a; cursor: pointer;";

        const textInput = document.createElement("input");
        textInput.className = "admin-form-input";
        textInput.type = "text";
        textInput.name = key;
        textInput.value = val || "#ffffff";
        textInput.placeholder = "#ffffff";
        textInput.style.flex = "1";

        colorInput.oninput = () => {
          textInput.value = colorInput.value;
        };
        textInput.oninput = () => {
          const raw = textInput.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
            colorInput.value = raw;
          }
        };

        colorWrap.appendChild(colorInput);
        colorWrap.appendChild(textInput);
        group.appendChild(colorWrap);
      } else if (key === "link") {
        const input = document.createElement("input");
        input.className = "admin-form-input";
        input.type = "url";
        input.value = val;
        input.name = key;
        input.placeholder = "https://...";
        group.appendChild(input);
      } else if (key === "isFeatured" || key === "is_active") {
        const switchLabel = document.createElement("label");
        switchLabel.className = "admin-switch-label";
        const sw = document.createElement("input");
        sw.type = "checkbox";
        sw.className = "admin-switch-input";
        sw.name = key;
        sw.checked = val === 1 || val === true;
        const slider = document.createElement("span");
        slider.className = "admin-switch-slider";
        switchLabel.appendChild(sw);
        switchLabel.appendChild(slider);
        switchLabel.appendChild(document.createTextNode(" 表示する"));
        group.appendChild(switchLabel);
      } else if (key === "message" || key === "detail" || key === "comment") {
        const textarea = document.createElement("textarea");
        textarea.className = "admin-form-textarea";
        textarea.name = key;
        textarea.value = val;
        group.appendChild(textarea);
      } else if (key === "sectionType") {
        const select = document.createElement("select");
        select.className = "admin-form-input";
        select.name = key;
        const optBanner = document.createElement("option");
        optBanner.value = "banner";
        optBanner.textContent = "バナー形式 (banner)";
        const optStanding = document.createElement("option");
        optStanding.value = "standing";
        optStanding.textContent = "立ち絵形式 (standing)";
        select.appendChild(optBanner);
        select.appendChild(optStanding);
        select.value = val || "banner";
        group.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.className = "admin-form-input";
        input.type = typeof val === "number" ? "number" : "text";
        input.value = val;
        input.name = key;
        group.appendChild(input);
      }

      form.appendChild(group);
    });

    // 送信ボタン
    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "app-btn app-btn-primary";
    submitBtn.textContent = isNew ? "新規作成" : "保存する";
    submitBtn.onclick = async () => {
      const formData = new FormData(form);
      const payload = {};
      for (const [k, v] of formData.entries()) {
        payload[k] = v;
      }
      // チェックボックスの補完
      keys.forEach((k) => {
        if (k === "isFeatured" || k === "is_active") {
          payload[k] = form.querySelector(`[name="${k}"]`)?.checked ? 1 : 0;
        }
      });

      // scheduled_at のフォーマット整形
      if (tableName === "notice" && payload.scheduled_at) {
        const str = String(payload.scheduled_at).trim();
        if (str.includes("T")) {
          const [d, t] = str.split("T");
          payload.scheduled_at = `${d} ${t.length === 5 ? t + ":00" : t}`;
        }
      } else if (tableName === "notice" && !payload.scheduled_at) {
        payload.scheduled_at = null;
      }

      if (tableName === "linkList") {
        if (payload.priority !== undefined && payload.priority !== "") {
          payload.priority = Number(payload.priority);
        }
      }

      try {
        await api.saveTable(tableName, payload, isNew ? null : record.id);
        Modal.close();
        await this.loadTab(this.currentTab);
      } catch (e) {
        // エラーは api.js でトースト通知される
      }
    };

    let modalTitleText = `${tableName} の${isNew ? "新規作成" : "編集"}`;
    if (tableName === "notice") modalTitleText = `お知らせの${isNew ? "新規作成" : "編集"}`;
    if (tableName === "gallery") modalTitleText = `ギャラリー画像の${isNew ? "新規作成" : "編集"}`;
    if (tableName === "linkList") modalTitleText = `リンクリストの${isNew ? "新規作成" : "編集"}`;

    Modal.open({
      title: modalTitleText,
      content: form,
      footer: submitBtn,
    });
  }

  /**
   * レコード削除
   */
  async deleteRecord(tableName, id) {
    if (tableName === "visual") {
      if (!confirm(`ID: ${id} の立ち絵・衣装データを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.visualState.currentRecords = this.visualState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.visualState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.loadTab("visual");
      return;
    }

    if (tableName === "event") {
      if (!confirm(`ID: ${id} のイベントバナーデータを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.eventState.currentRecords = this.eventState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.eventState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.loadTab("event");
      return;
    }

    if (tableName === "notice") {
      if (!confirm(`ID: ${id} のお知らせデータを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.noticeState.currentRecords = this.noticeState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.noticeState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.loadTab("notice");
      return;
    }

    if (tableName === "schedule") {
      if (!confirm(`ID: ${id} のスケジュールデータを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.scheduleState.currentRecords = this.scheduleState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.scheduleState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.renderScheduleTab();
      return;
    }

    if (tableName === "gallery") {
      if (!confirm(`ID: ${id} のギャラリー画像データを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.galleryState.currentRecords = this.galleryState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.galleryState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.loadTab("gallery");
      return;
    }

    if (tableName === "movie") {
      if (!confirm(`ID: ${id} の動画データを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.movieState.currentRecords = this.movieState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.movieState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.renderMovieTab();
      return;
    }

    if (tableName === "shop") {
      if (!confirm(`ID: ${id} のショップ商品データを一覧から削除しますか？\n\n※この操作は「更新反映」ボタンを押すまでD1には保存されません。`)) return;
      this.shopState.currentRecords = this.shopState.currentRecords.filter(
        (r) => Number(r.id) !== Number(id)
      );
      this.shopState.hasPendingChanges = true;
      Toast.info(`ID: ${id} を削除しました（※「更新反映」を押すまでD1には保存されません）`);
      await this.renderShopTab();
      return;
    }

    if (!confirm(`ID: ${id} のレコードを本当に削除しますか？`)) return;
    try {
      await api.deleteRecord(tableName, id);
      await this.loadTab(this.currentTab);
    } catch (e) {}
  }

  /**
   * 立ち絵・衣装 (visual) の未反映変更件数の算出
   */
  getVisualChangesCount() {
    if (!this.visualState || !this.visualState.isInitialized) return 0;
    const origMap = new Map(this.visualState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.visualState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => curr[k] !== orig[k]);
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * 立ち絵・衣装 (visual) の保留変更をD1に一括保存（更新反映）
   */
  async commitVisualChanges() {
    const count = this.getVisualChangesCount();
    if (!this.visualState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `立ち絵・衣装一覧の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.visualState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.visualState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.visualState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("visual", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.visualState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("visual", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => rec[k] !== orig[k]);
          if (hasDiff) {
            await api.saveTable("visual", rec, rec.id);
          }
        }
      }

      Toast.success("立ち絵・衣装一覧の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.visualState.hasPendingChanges = false;
      this.visualState.isInitialized = false;
      await this.loadTab("visual");
    } catch (err) {
      console.error("[Commit Visual Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * イベントバナー (event) の未反映変更件数の算出
   */
  getEventChangesCount() {
    if (!this.eventState || !this.eventState.isInitialized) return 0;
    const origMap = new Map(this.eventState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.eventState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => curr[k] !== orig[k]);
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * イベントバナー (event) の保留変更をD1に一括保存（更新反映）
   */
  async commitEventChanges() {
    const count = this.getEventChangesCount();
    if (!this.eventState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `イベントバナー管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.eventState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.eventState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.eventState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("event", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.eventState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("event", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => rec[k] !== orig[k]);
          if (hasDiff) {
            await api.saveTable("event", rec, rec.id);
          }
        }
      }

      Toast.success("イベントバナー管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.eventState.hasPendingChanges = false;
      this.eventState.isInitialized = false;
      await this.loadTab("event");
    } catch (err) {
      console.error("[Commit Event Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * お知らせ (notice) の未反映変更件数の算出
   */
  getNoticeChangesCount() {
    if (!this.noticeState || !this.noticeState.isInitialized) return 0;
    const origMap = new Map(this.noticeState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.noticeState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => curr[k] !== orig[k]);
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * お知らせ (notice) の保留変更をD1に一括保存（更新反映）
   */
  async commitNoticeChanges() {
    const count = this.getNoticeChangesCount();
    if (!this.noticeState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `お知らせ管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.noticeState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.noticeState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.noticeState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("notice", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.noticeState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("notice", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => rec[k] !== orig[k]);
          if (hasDiff) {
            await api.saveTable("notice", rec, rec.id);
          }
        }
      }

      Toast.success("お知らせ管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.noticeState.hasPendingChanges = false;
      this.noticeState.isInitialized = false;
      await this.loadTab("notice");
    } catch (err) {
      console.error("[Commit Notice Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * スケジュール (schedule) の未反映変更件数の算出
   */
  getScheduleChangesCount() {
    if (!this.scheduleState || !this.scheduleState.isInitialized) return 0;
    const origMap = new Map(this.scheduleState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.scheduleState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => curr[k] !== orig[k]);
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * スケジュール (schedule) の保留変更をD1に一括保存（更新反映）
   */
  async commitScheduleChanges() {
    const count = this.getScheduleChangesCount();
    if (!this.scheduleState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `スケジュール管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.scheduleState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.scheduleState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.scheduleState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("schedule", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.scheduleState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("schedule", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => rec[k] !== orig[k]);
          if (hasDiff) {
            await api.saveTable("schedule", rec, rec.id);
          }
        }
      }

      Toast.success("スケジュール管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.scheduleState.hasPendingChanges = false;
      this.scheduleState.isInitialized = false;
      await this.renderScheduleTab();
    } catch (err) {
      console.error("[Commit Schedule Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * ギャラリー (gallery) の未反映変更件数の算出
   */
  getGalleryChangesCount() {
    if (!this.galleryState || !this.galleryState.isInitialized) return 0;
    const origMap = new Map(this.galleryState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.galleryState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => curr[k] !== orig[k]);
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * ギャラリー (gallery) の保留変更をD1に一括保存（更新反映）
   */
  async commitGalleryChanges() {
    const count = this.getGalleryChangesCount();
    if (!this.galleryState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `ギャラリー管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.galleryState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.galleryState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.galleryState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("gallery", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.galleryState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("gallery", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => rec[k] !== orig[k]);
          if (hasDiff) {
            await api.saveTable("gallery", rec, rec.id);
          }
        }
      }

      Toast.success("ギャラリー管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.galleryState.hasPendingChanges = false;
      this.galleryState.isInitialized = false;
      await this.loadTab("gallery");
    } catch (err) {
      console.error("[Commit Gallery Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * 動画リスト (movie) の未反映変更件数の算出
   */
  getMovieChangesCount() {
    if (!this.movieState || !this.movieState.isInitialized) return 0;
    const origMap = new Map(this.movieState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.movieState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => {
          const vCurr = curr[k] === null || curr[k] === undefined ? "" : String(curr[k]);
          const vOrig = orig[k] === null || orig[k] === undefined ? "" : String(orig[k]);
          return vCurr !== vOrig;
        });
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * 動画リスト (movie) の保留変更をD1に一括保存（更新反映）
   */
  async commitMovieChanges() {
    const count = this.getMovieChangesCount();
    if (!this.movieState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `動画リスト管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.movieState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.movieState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.movieState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("movie", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.movieState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("movie", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => {
            const vCurr = rec[k] === null || rec[k] === undefined ? "" : String(rec[k]);
            const vOrig = orig[k] === null || orig[k] === undefined ? "" : String(orig[k]);
            return vCurr !== vOrig;
          });
          if (hasDiff) {
            await api.saveTable("movie", rec, rec.id);
          }
        }
      }

      Toast.success("動画リスト管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.movieState.hasPendingChanges = false;
      this.movieState.isInitialized = false;
      await this.loadTab("movie");
    } catch (err) {
      console.error("[Commit Movie Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * ショップグッズ (shop) の未反映変更件数の算出
   */
  getShopChangesCount() {
    if (!this.shopState || !this.shopState.isInitialized) return 0;
    const origMap = new Map(this.shopState.originalRecords.map((r) => [Number(r.id), r]));
    const currMap = new Map(this.shopState.currentRecords.map((r) => [Number(r.id), r]));

    let changes = 0;
    // 削除されたレコード
    for (const [id] of origMap) {
      if (!currMap.has(id)) changes++;
    }
    // 新規追加または変更されたレコード
    for (const [id, curr] of currMap) {
      const orig = origMap.get(id);
      if (!orig) {
        changes++;
      } else {
        const hasDiff = Object.keys(curr).some((k) => {
          const vCurr = curr[k] === null || curr[k] === undefined ? "" : String(curr[k]);
          const vOrig = orig[k] === null || orig[k] === undefined ? "" : String(orig[k]);
          return vCurr !== vOrig;
        });
        if (hasDiff) changes++;
      }
    }
    return changes;
  }

  /**
   * ショップグッズ (shop) の保留変更をD1に一括保存（更新反映）
   */
  async commitShopChanges() {
    const count = this.getShopChangesCount();
    if (!this.shopState?.hasPendingChanges || count === 0) {
      Toast.info("D1に反映する変更はありません");
      return;
    }

    const ok = confirm(
      `ショップグッズ管理の変更内容（${count}件）をD1データベースに更新反映しますか？\n\n※この操作によりD1データベースが最新の状態に保存されます。`
    );
    if (!ok) return;

    api.showLoading();
    try {
      const origMap = new Map(this.shopState.originalRecords.map((r) => [Number(r.id), r]));
      const currMap = new Map(this.shopState.currentRecords.map((r) => [Number(r.id), r]));

      // 1. 削除されたレコードの反映 (DELETE)
      const toDelete = this.shopState.originalRecords.filter((r) => !currMap.has(Number(r.id)));
      for (const rec of toDelete) {
        await api.deleteRecord("shop", rec.id);
      }

      // 2. 新規追加 (POST) および 更新 (PUT) の反映
      for (const rec of this.shopState.currentRecords) {
        const orig = origMap.get(Number(rec.id));
        if (!orig) {
          // 新規追加
          await api.saveTable("shop", rec, null);
        } else {
          // 変更の有無をチェック
          const hasDiff = Object.keys(rec).some((k) => {
            const vCurr = rec[k] === null || rec[k] === undefined ? "" : String(rec[k]);
            const vOrig = orig[k] === null || orig[k] === undefined ? "" : String(orig[k]);
            return vCurr !== vOrig;
          });
          if (hasDiff) {
            await api.saveTable("shop", rec, rec.id);
          }
        }
      }

      Toast.success("ショップグッズ管理の変更をD1データベースに反映しました");

      // 反映完了: ドラフト状態をリフレッシュしD1から最新データを再ロード
      this.shopState.hasPendingChanges = false;
      this.shopState.isInitialized = false;
      await this.loadTab("shop");
    } catch (err) {
      console.error("[Commit Shop Error]:", err);
      Toast.error(`更新反映に失敗しました: ${err.message}`);
    } finally {
      api.hideLoading();
    }
  }

  /**
   * 2. プロフィール管理タブ (アコーディオン開閉 & カスタムグリッド配置)
   */
  async renderProfileTab() {
    const profile = await api.getTable("profile", 1);

    // 配列データの正規化
    let platforms = Array.isArray(profile?.platforms) ? profile.platforms : [];
    if (typeof platforms === "string") {
      try { platforms = JSON.parse(platforms); } catch (e) { platforms = []; }
    }
    let moves = Array.isArray(profile?.moves) ? profile.moves : [];
    if (typeof moves === "string") {
      try { moves = JSON.parse(moves); } catch (e) { moves = []; }
    }

    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <div class="admin-card-title-group">
          <h2 class="admin-card-title">基本プロフィール設定</h2>
        </div>
        <div class="admin-card-actions">
          <button type="submit" form="admin-profile-form" class="app-btn app-btn-primary" style="padding: 8px 18px; font-size: 0.88rem; font-weight: 700;">
            プロフィール情報を更新
          </button>
        </div>
      </div>
    `;

    const form = document.createElement("form");
    form.id = "admin-profile-form";
    form.style.padding = "24px";
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "20px";

    // ドラム式ピッカー用ヘルパー
    const parseBirthdayParts = (val) => {
      if (!val) return { month: "01", day: "01" };
      const str = String(val).trim();
      const m = str.match(/^(\d{1,2})月(\d{1,2})日?$/);
      if (m) {
        return { month: m[1].padStart(2, "0"), day: m[2].padStart(2, "0") };
      }
      const mIso = str.match(/^\d{4}-(\d{2})-(\d{2})$/);
      if (mIso) {
        return { month: mIso[1], day: mIso[2] };
      }
      return { month: "01", day: "01" };
    };

    const parseStreamingParts = (val) => {
      if (!val) return { year: "2000", month: "01", day: "01" };
      const str = String(val).trim();
      const m = str.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
      if (m) {
        return { year: m[1], month: m[2].padStart(2, "0"), day: m[3].padStart(2, "0") };
      }
      const mIso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mIso) {
        return { year: mIso[1], month: mIso[2], day: mIso[3] };
      }
      const mSlash = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (mSlash) {
        return { year: mSlash[1], month: mSlash[2].padStart(2, "0"), day: mSlash[3].padStart(2, "0") };
      }
      return { year: "2000", month: "01", day: "01" };
    };

    const getDaysInMonth = (year, month) => {
      if (!month) return 31;
      const y = year ? Number(year) : 2024;
      return new Date(y, Number(month), 0).getDate();
    };

    const generateDayItems = (year, month) => {
      const days = getDaysInMonth(year, month);
      return Array.from({ length: days }, (_, i) => {
        const dStr = String(i + 1).padStart(2, "0");
        return { value: dStr, label: `${i + 1}日` };
      });
    };

    const monthItems = Array.from({ length: 12 }, (_, i) => {
      const mStr = String(i + 1).padStart(2, "0");
      return { value: mStr, label: `${i + 1}月` };
    });

    const yearItems = Array.from({ length: 36 }, (_, i) => {
      const yStr = String(2000 + i);
      return { value: yStr, label: `${yStr}年` };
    });

    const bParts = parseBirthdayParts(profile?.birthday);
    const sParts = parseStreamingParts(profile?.streaming);

    // YouTube動画ID抽出ヘルパー
    const extractYouTubeId = (url) => {
      if (!url || typeof url !== "string") return null;
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
      return match ? match[1] : null;
    };

    // プレビュー生成ヘルパー
    const renderPreviewHtml = (url) => {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}" class="admin-video-preview-iframe" allowfullscreen loading="lazy"></iframe>`;
      }
      return `
        <div class="admin-video-preview-empty">
          <span class="admin-video-preview-empty-icon">🎬</span>
          <span>動画URLを入力するとプレビューが表示されます</span>
        </div>
      `;
    };

    form.innerHTML = `
      <div class="admin-profile-accordion-list">
        
        <!-- # 基本プロフィール -->
        <details class="admin-profile-accordion" open>
          <summary class="admin-profile-accordion-summary">
            <div class="admin-profile-accordion-title">
              <span class="admin-profile-accordion-icon">👤</span>
              <span>基本プロフィール</span>
            </div>
            <span class="admin-profile-accordion-arrow">▼</span>
          </summary>
          <div class="admin-profile-accordion-body">
            <!-- 1行目: 名前｜ふりがな｜ローマ字 -->
            <div class="admin-grid-3">
              <div class="admin-form-group">
                <label class="admin-form-label">名前 <span class="admin-form-label-required">*必須</span></label>
                <input class="admin-form-input" name="name" value="${profile?.name || ""}" required placeholder="名前" />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">ふりがな</label>
                <input class="admin-form-input" name="pronunciation" value="${profile?.pronunciation || ""}" placeholder="ふりがな" />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">ローマ字</label>
                <input class="admin-form-input" name="romanization" value="${profile?.romanization || ""}" placeholder="ROMAJI" />
              </div>
            </div>

            <!-- 2行目: ニックネーム｜キャッチフレーズ -->
            <div class="admin-grid-2">
              <div class="admin-form-group">
                <label class="admin-form-label">ニックネーム</label>
                <input class="admin-form-input" name="nickname" value="${profile?.nickname || ""}" placeholder="ニックネーム" />
              </div>
              <div class="admin-form-group">
                <div class="admin-form-label-row">
                  <label class="admin-form-label" style="margin-bottom: 0;">キャッチフレーズ</label>
                  <span class="admin-form-counter" id="profile-comment-counter">0 / 75文字</span>
                </div>
                <input class="admin-form-input" id="profile-comment-input" name="comment" value="${profile?.comment || ""}" placeholder="キャッチフレーズ (75文字以内)" />
                <div class="admin-form-error-msg" id="profile-comment-error" style="display: none;"></div>
              </div>
            </div>

            <!-- 3行目: 自己紹介文 -->
            <div class="admin-form-group" style="margin-bottom: 0;">
              <div class="admin-form-label-row">
                <label class="admin-form-label" style="margin-bottom: 0;">自己紹介文</label>
                <span class="admin-form-counter" id="profile-message-counter">0 / 180文字 ｜ 0 / 5行</span>
              </div>
              <textarea class="admin-form-textarea" id="profile-message-input" name="message" rows="5" placeholder="自己紹介文を入力してください (180文字以内、最大5行)">${profile?.message || ""}</textarea>
              <div class="admin-form-error-msg" id="profile-message-error" style="display: none;"></div>
            </div>
          </div>
        </details>

        <!-- # ステータス -->
        <details class="admin-profile-accordion" open>
          <summary class="admin-profile-accordion-summary">
            <div class="admin-profile-accordion-title">
              <span class="admin-profile-accordion-icon">📊</span>
              <span>ステータス</span>
            </div>
            <span class="admin-profile-accordion-arrow">▼</span>
          </summary>
          <div class="admin-profile-accordion-body">
            <!-- 1行目: 誕生日｜年齢｜身長 -->
            <div class="admin-grid-3">
              <div class="admin-form-group">
                <label class="admin-form-label">誕生日</label>
                <div class="drum-picker-dropdown-wrapper" id="profile-birthday-wrapper">
                  <div class="drum-picker-input-wrap">
                    <input
                      type="text"
                      class="admin-form-input drum-picker-trigger"
                      id="profile-birthday-input"
                      name="birthday"
                      value="${profile?.birthday || ""}"
                      placeholder="月日を選択"
                      readonly
                    />
                    <span class="drum-picker-trigger-icon">📅</span>
                  </div>
                  <!-- プルダウンポップオーバー -->
                  <div class="drum-picker-popover" id="profile-birthday-popover" style="display: none;">
                    <div class="drum-picker-mount" id="profile-birthday-drum-mount"></div>
                    <div class="drum-picker-popover-footer">
                      <button type="button" class="app-btn app-btn-secondary" id="profile-birthday-close-btn" style="padding: 4px 14px; font-size: 0.8rem;">完了</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">年齢</label>
                <input class="admin-form-input" type="number" name="age" value="${profile?.age ?? ""}" placeholder="年齢 (数値)" />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">身長 (cm)</label>
                <input class="admin-form-input" type="number" step="0.1" name="height" value="${profile?.height ?? ""}" placeholder="身長 (数値)" />
              </div>
            </div>

            <!-- 2行目: 活動開始日｜ファンネーム -->
            <div class="admin-grid-2">
              <div class="admin-form-group" style="margin-bottom: 0;">
                <label class="admin-form-label">活動開始日</label>
                <div class="drum-picker-dropdown-wrapper" id="profile-streaming-wrapper">
                  <div class="drum-picker-input-wrap">
                    <input
                      type="text"
                      class="admin-form-input drum-picker-trigger"
                      id="profile-streaming-input"
                      name="streaming"
                      value="${profile?.streaming || ""}"
                      placeholder="年月日を選択"
                      readonly
                    />
                    <span class="drum-picker-trigger-icon">📅</span>
                  </div>
                  <!-- プルダウンポップオーバー -->
                  <div class="drum-picker-popover" id="profile-streaming-popover" style="display: none;">
                    <div class="drum-picker-mount" id="profile-streaming-drum-mount"></div>
                    <div class="drum-picker-popover-footer">
                      <button type="button" class="app-btn app-btn-secondary" id="profile-streaming-close-btn" style="padding: 4px 14px; font-size: 0.8rem;">完了</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="admin-form-group" style="margin-bottom: 0;">
                <label class="admin-form-label">ファンネーム</label>
                <input class="admin-form-input" name="fanName" value="${profile?.fanName || ""}" placeholder="ファンネーム" />
              </div>
            </div>
          </div>
        </details>

        <!-- # 活動プラットフォーム -->
        <details class="admin-profile-accordion" open>
          <summary class="admin-profile-accordion-summary">
            <div class="admin-profile-accordion-title">
              <span class="admin-profile-accordion-icon">🌐</span>
              <span>活動プラットフォーム</span>
            </div>
            <span class="admin-profile-accordion-arrow">▼</span>
          </summary>
          <div class="admin-profile-accordion-body">
            <!-- 1行目: YouTubeチャンネル｜𝕏 (旧Twitter) -->
            <div class="admin-grid-2">
              <div class="admin-form-group">
                <label class="admin-form-label">YouTubeチャンネルURL</label>
                <input class="admin-form-input" name="youtubeUrl" value="${profile?.youtubeUrl || ""}" placeholder="https://www.youtube.com/@..." />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label">𝕏 (旧Twitter) URL</label>
                <input class="admin-form-input" name="xUrl" value="${profile?.xUrl || ""}" placeholder="https://x.com/..." />
              </div>
            </div>

            <!-- 2行目: 追加プラットフォームURL -->
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">追加プラットフォームURL</label>
              <div class="admin-grid-3">
                ${[0, 1, 2].map((i) => `
                  <div class="admin-subcard">
                    <div class="admin-subcard-header">
                      <span>枠 ${i + 1}</span>
                    </div>
                    <div>
                      <span class="admin-form-sublabel">名称 (例: TikTok, Twitch)</span>
                      <input class="admin-form-input" id="platform-name-${i}" value="${platforms[i]?.name || ""}" placeholder="プラットフォーム名" />
                    </div>
                    <div>
                      <span class="admin-form-sublabel">URL (https://...)</span>
                      <input class="admin-form-input" id="platform-link-${i}" value="${platforms[i]?.link || ""}" placeholder="https://..." />
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </details>

        <!-- # 紹介動画 -->
        <details class="admin-profile-accordion" open>
          <summary class="admin-profile-accordion-summary">
            <div class="admin-profile-accordion-title">
              <span class="admin-profile-accordion-icon">🎬</span>
              <span>紹介動画</span>
            </div>
            <span class="admin-profile-accordion-arrow">▼</span>
          </summary>
          <div class="admin-profile-accordion-body">
            <!-- 紹介動画/プレビュー ※URL入力欄とプレビューで2段表示 -->
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">紹介動画</label>
              <div class="admin-grid-3">
                ${[0, 1, 2].map((i) => `
                  <div class="admin-subcard">
                    <div class="admin-subcard-header">
                      <span>動画枠 ${i + 1}</span>
                    </div>
                    <!-- 1段目: URL入力欄 -->
                    <div>
                      <span class="admin-form-sublabel">YouTube動画URL</span>
                      <input class="admin-form-input admin-move-input" data-index="${i}" id="move-url-${i}" value="${moves[i] || ""}" placeholder="https://www.youtube.com/watch?v=..." />
                    </div>
                    <!-- 2段目: プレビュー -->
                    <div>
                      <span class="admin-form-sublabel">プレビュー</span>
                      <div class="admin-video-preview-wrap" id="move-preview-${i}">
                        ${renderPreviewHtml(moves[i] || "")}
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </details>

      </div>
    `;

    // 紹介動画のリアルタイムプレビューバインド
    form.querySelectorAll(".admin-move-input").forEach((input) => {
      input.addEventListener("input", () => {
        const idx = input.getAttribute("data-index");
        const previewEl = document.getElementById(`move-preview-${idx}`);
        if (previewEl) {
          previewEl.innerHTML = renderPreviewHtml(input.value.trim());
        }
      });
    });

    // 誕生日のドラムロールマウント & ポップオーバー制御
    const birthdayInput = form.querySelector("#profile-birthday-input");
    const birthdayPopover = form.querySelector("#profile-birthday-popover");
    const birthdayCloseBtn = form.querySelector("#profile-birthday-close-btn");
    const birthdayMount = form.querySelector("#profile-birthday-drum-mount");
    let birthdayPicker = null;

    if (birthdayMount) {
      birthdayPicker = new DrumRollPicker({
        container: birthdayMount,
        columns: [
          { key: "month", items: monthItems },
          { key: "day", items: generateDayItems(null, bParts.month) }
        ],
        initialValues: {
          month: bParts.month,
          day: bParts.day
        },
        onChange: (key, newVal, vals) => {
          if (key === "month") {
            birthdayPicker.updateColumnItems("day", generateDayItems(null, newVal));
          }
          if (birthdayInput) {
            birthdayInput.value = `${vals.month}月${vals.day}日`;
          }
        }
      });
    }

    // 活動開始日のドラムロールマウント & ポップオーバー制御
    const streamingInput = form.querySelector("#profile-streaming-input");
    const streamingPopover = form.querySelector("#profile-streaming-popover");
    const streamingCloseBtn = form.querySelector("#profile-streaming-close-btn");
    const streamingMount = form.querySelector("#profile-streaming-drum-mount");
    let streamingPicker = null;

    if (streamingMount) {
      streamingPicker = new DrumRollPicker({
        container: streamingMount,
        columns: [
          { key: "year", items: yearItems },
          { key: "month", items: monthItems },
          { key: "day", items: generateDayItems(sParts.year, sParts.month) }
        ],
        initialValues: {
          year: sParts.year,
          month: sParts.month,
          day: sParts.day
        },
        onChange: (key, newVal, vals) => {
          if (key === "year" || key === "month") {
            streamingPicker.updateColumnItems("day", generateDayItems(vals.year, vals.month));
          }
          if (streamingInput) {
            streamingInput.value = `${vals.year}年${vals.month}月${vals.day}日`;
          }
        }
      });
    }

    const birthdayWrapper = form.querySelector("#profile-birthday-wrapper");
    const streamingWrapper = form.querySelector("#profile-streaming-wrapper");

    const closeAllPopovers = () => {
      if (birthdayPopover) birthdayPopover.style.display = "none";
      if (streamingPopover) streamingPopover.style.display = "none";
      if (birthdayWrapper) birthdayWrapper.classList.remove("is-open");
      if (streamingWrapper) streamingWrapper.classList.remove("is-open");
    };

    if (birthdayInput && birthdayPopover) {
      birthdayInput.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = birthdayPopover.style.display === "none" || !birthdayPopover.style.display;
        closeAllPopovers();
        if (willOpen) {
          birthdayPopover.style.display = "flex";
          if (birthdayWrapper) birthdayWrapper.classList.add("is-open");
          if (birthdayPicker) {
            const parts = parseBirthdayParts(birthdayInput.value);
            birthdayPicker.scrollToValue("month", parts.month, false);
            birthdayPicker.scrollToValue("day", parts.day, false);
          }
        }
      });

      if (birthdayCloseBtn) {
        birthdayCloseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          birthdayPopover.style.display = "none";
          if (birthdayWrapper) birthdayWrapper.classList.remove("is-open");
        });
      }

      birthdayPopover.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    if (streamingInput && streamingPopover) {
      streamingInput.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = streamingPopover.style.display === "none" || !streamingPopover.style.display;
        closeAllPopovers();
        if (willOpen) {
          streamingPopover.style.display = "flex";
          if (streamingWrapper) streamingWrapper.classList.add("is-open");
          if (streamingPicker) {
            const parts = parseStreamingParts(streamingInput.value);
            streamingPicker.scrollToValue("year", parts.year, false);
            streamingPicker.scrollToValue("month", parts.month, false);
            streamingPicker.scrollToValue("day", parts.day, false);
          }
        }
      });

      if (streamingCloseBtn) {
        streamingCloseBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          streamingPopover.style.display = "none";
          if (streamingWrapper) streamingWrapper.classList.remove("is-open");
        });
      }

      streamingPopover.addEventListener("click", (e) => {
        e.stopPropagation();
      });
    }

    // キャッチフレーズ & 自己紹介文のバリデーション制御
    const commentInput = form.querySelector("#profile-comment-input");
    const commentCounter = form.querySelector("#profile-comment-counter");
    const commentError = form.querySelector("#profile-comment-error");

    const messageInput = form.querySelector("#profile-message-input");
    const messageCounter = form.querySelector("#profile-message-counter");
    const messageError = form.querySelector("#profile-message-error");

    const validateComment = () => {
      const val = commentInput ? commentInput.value : "";
      const len = val.length;
      const maxLen = 75;
      const isOver = len > maxLen;

      if (commentCounter) {
        commentCounter.textContent = `${len} / ${maxLen}文字`;
        commentCounter.classList.toggle("is-error", isOver);
      }

      if (commentInput) {
        commentInput.classList.toggle("is-invalid", isOver);
      }

      if (commentError) {
        if (isOver) {
          commentError.textContent = `⚠️ キャッチフレーズは75文字以内で入力してください（${len - maxLen}文字超過）`;
          commentError.style.display = "flex";
        } else {
          commentError.textContent = "";
          commentError.style.display = "none";
        }
      }

      return !isOver;
    };

    const validateMessage = () => {
      const raw = messageInput ? messageInput.value : "";
      const normalized = raw.replace(/\r\n/g, "\n");
      const len = normalized.length;
      const maxLen = 180;
      const lines = normalized.length > 0 ? normalized.split("\n") : [];
      const lineCount = lines.length;
      const maxLines = 5;

      const isLenOver = len > maxLen;
      const isLinesOver = lineCount > maxLines;
      const isInvalid = isLenOver || isLinesOver;

      if (messageCounter) {
        messageCounter.textContent = `${len} / ${maxLen}文字 ｜ ${lineCount} / ${maxLines}行`;
        messageCounter.classList.toggle("is-error", isInvalid);
      }

      if (messageInput) {
        messageInput.classList.toggle("is-invalid", isInvalid);
      }

      if (messageError) {
        if (isLenOver && isLinesOver) {
          messageError.textContent = `⚠️ 文字数（${len - maxLen}文字超過）と行数（${lineCount - maxLines}行超過）が上限を超えています`;
          messageError.style.display = "flex";
        } else if (isLenOver) {
          messageError.textContent = `⚠️ 自己紹介文は180文字以内で入力してください（${len - maxLen}文字超過）`;
          messageError.style.display = "flex";
        } else if (isLinesOver) {
          messageError.textContent = `⚠️ 自己紹介文は最大5行以内で入力してください（${lineCount - maxLines}行超過）`;
          messageError.style.display = "flex";
        } else {
          messageError.textContent = "";
          messageError.style.display = "none";
        }
      }

      return !isInvalid;
    };

    if (commentInput) {
      commentInput.addEventListener("input", validateComment);
      validateComment();
    }

    if (messageInput) {
      messageInput.addEventListener("input", validateMessage);
      validateMessage();
    }

    // 画面外クリック時にポップオーバーを閉じる
    document.addEventListener("click", () => {
      closeAllPopovers();
    });

    // フォーム送信処理
    form.onsubmit = async (e) => {
      e.preventDefault();

      const isCommentValid = validateComment();
      const isMessageValid = validateMessage();

      if (!isCommentValid) {
        Toast.error("キャッチフレーズが75文字を超えています。修正してください。");
        commentInput?.focus();
        return;
      }

      if (!isMessageValid) {
        Toast.error("自己紹介文の文字数または行数が上限を超えています。修正してください。");
        messageInput?.focus();
        return;
      }

      const formData = new FormData(form);
      const payload = { ...profile };

      for (const [k, v] of formData.entries()) {
        payload[k] = v;
      }

      // 数値変換
      payload.age = payload.age ? Number(payload.age) : null;
      payload.height = payload.height ? Number(payload.height) : null;

      // 誕生日の整形 (MM月DD日)
      if (birthdayInput?.value) {
        payload.birthday = birthdayInput.value.trim();
      } else {
        payload.birthday = null;
      }

      // 活動開始日の整形 (YYYY年MM月DD日)
      if (streamingInput?.value) {
        payload.streaming = streamingInput.value.trim();
      } else {
        payload.streaming = null;
      }

      // platforms 配列の整形
      const updatedPlatforms = [];
      for (let i = 0; i < 3; i++) {
        const nameEl = document.getElementById(`platform-name-${i}`);
        const linkEl = document.getElementById(`platform-link-${i}`);
        const name = nameEl ? nameEl.value.trim() : "";
        const link = linkEl ? linkEl.value.trim() : "";
        if (link) {
          updatedPlatforms.push({ name: name || null, link });
        }
      }
      payload.platforms = updatedPlatforms;

      // moves 配列の整形
      const updatedMoves = [];
      for (let i = 0; i < 3; i++) {
        const moveEl = document.getElementById(`move-url-${i}`);
        const url = moveEl ? moveEl.value.trim() : "";
        if (url) {
          updatedMoves.push(url);
        }
      }
      payload.moves = updatedMoves;

      await api.saveTable("profile", payload, 1);
    };

    card.appendChild(form);

    this.container.innerHTML = "";
    this.container.appendChild(card);
  }

  /**
   * 3. ガイドライン管理タブ (リッチテキストエディタ)
   */
  async renderGuidelineTab() {
    const guideline = await api.getTable("guideline", 1);

    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <div class="admin-card-title-group">
          <h2 class="admin-card-title">二次創作ガイドライン管理</h2>
          <p class="admin-card-desc">Markdown構造化フォーマットによるリッチテキスト編集 (guideline テーブル)</p>
        </div>
      </div>
    `;

    const form = document.createElement("form");
    form.style.padding = "24px";
    form.innerHTML = `
      <div class="admin-form-group">
        <label class="admin-form-label">ページタイトル</label>
        <input class="admin-form-input" id="gl-edit-title" value="${guideline?.title || ""}" required />
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">制定日 / 更新日</label>
        <input class="admin-form-input" id="gl-edit-date" value="${guideline?.establishedDate || ""}" required />
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">制定者名 / サイン</label>
        <input class="admin-form-input" id="gl-edit-author" value="${guideline?.authorName || ""}" required />
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">ガイドライン本文 (リッチテキストツールバー)</label>
        <div id="gl-rte-mount"></div>
      </div>
      <div style="margin-top: 24px;">
        <button type="submit" class="app-btn app-btn-primary" style="padding: 12px 28px;">ガイドラインを保存する</button>
      </div>
    `;

    card.appendChild(form);
    this.container.innerHTML = "";
    this.container.appendChild(card);

    // リッチテキストエディタのマウント
    const rteMount = document.getElementById("gl-rte-mount");
    const editor = new RichTextEditor(rteMount, guideline?.comment || "");
    editor.render();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById("gl-edit-title").value,
        establishedDate: document.getElementById("gl-edit-date").value,
        authorName: document.getElementById("gl-edit-author").value,
        comment: editor.getValue(), // シリアライズされたMarkdown
      };
      await api.saveTable("guideline", payload, 1);
    };
  }

  /**
   * 4. テーマ設定管理タブ (themeConfig)
   */
  async renderThemeConfigTab() {
    const tc = await api.getTable("themeConfig", 1);

    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <div class="admin-card-title-group">
          <h2 class="admin-card-title">テーマ・外観カラー設定</h2>
          <p class="admin-card-desc">themeConfig テーブル (id=1)</p>
        </div>
      </div>
    `;

    const form = document.createElement("form");
    form.style.padding = "24px";
    form.innerHTML = `
      <div class="admin-form-group">
        <label class="admin-form-label">カード背景タイプ</label>
        <select class="admin-form-select" name="card_bg_type" id="tc-bg-type">
          <option value="single" ${tc?.card_bg_type === "single" ? "selected" : ""}>単色 (single)</option>
          <option value="gradient" ${tc?.card_bg_type === "gradient" ? "selected" : ""}>グラデーション (gradient)</option>
        </select>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="admin-form-group">
          <label class="admin-form-label">単色用カラー (HEX)</label>
          <input class="admin-form-input" name="card_bg_color" value="${tc?.card_bg_color || "#ffffff"}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">グラデーション角度 (0-360)</label>
          <input class="admin-form-input" type="number" name="card_bg_gradient_angle" value="${tc?.card_bg_gradient_angle ?? 0}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">グラデーション開始色 (HEX)</label>
          <input class="admin-form-input" name="card_bg_gradient_start" value="${tc?.card_bg_gradient_start || "#70cfff"}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">グラデーション終了色 (HEX)</label>
          <input class="admin-form-input" name="card_bg_gradient_end" value="${tc?.card_bg_gradient_end || "#f2f4fd"}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">カード内文字色 (HEX)</label>
          <input class="admin-form-input" name="card_text_color" value="${tc?.card_text_color || "#1e293b"}" />
        </div>
        <div class="admin-form-group">
          <label class="admin-form-label">セクション見出し文字色 (HEX)</label>
          <input class="admin-form-input" name="section_title_color" value="${tc?.section_title_color || "#1e293b"}" />
        </div>
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">ページ全体背景画像 (画面横幅100%フィット)</label>
        <input class="admin-form-input" name="background" value="${tc?.background || "assets/config/background.jpg"}" />
        <span class="admin-form-hint">assets/config/background.jpg 等</span>
      </div>
      <div style="margin-top: 20px;">
        <button type="submit" class="app-btn app-btn-primary">外観設定を保存</button>
      </div>
    `;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = { ...tc };
      for (const [k, v] of formData.entries()) {
        payload[k] = v;
      }
      await api.saveTable("themeConfig", payload, 1);
    };

    card.appendChild(form);
    this.container.innerHTML = "";
    this.container.appendChild(card);
  }

  /**
   * 5. GitHub PAT設定タブ (githubPAT)
   */
  async renderGithubPatTab() {
    let pat = {};
    try {
      pat = await api.getTable("githubPAT", 1);
    } catch (e) {
      // 認可保護
    }

    const card = document.createElement("div");
    card.className = "admin-card";
    card.innerHTML = `
      <div class="admin-card-header">
        <div class="admin-card-title-group">
          <h2 class="admin-card-title">GitHub PAT & アップロード設定</h2>
          <p class="admin-card-desc">githubPAT テーブル (id=1)</p>
        </div>
      </div>
    `;

    const form = document.createElement("form");
    form.style.padding = "24px";
    form.innerHTML = `
      <div class="admin-form-group">
        <label class="admin-form-label">リポジトリ所有者名 (Owner)</label>
        <input class="admin-form-input" name="github_repo_owner" value="${pat?.github_repo_owner || "elisafoster"}" required />
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">リポジトリ名 (Repo)</label>
        <input class="admin-form-input" name="github_repo_name" value="${pat?.github_repo_name || "elisafoster"}" required />
      </div>
      <div class="admin-form-group">
        <label class="admin-form-label">GitHub Personal Access Token (PAT)</label>
        <input class="admin-form-input" type="password" name="github_pat" value="${pat?.github_pat || ""}" placeholder="ghp_..." required />
        <span class="admin-form-hint">画像アップロード用トークン</span>
      </div>
      <div style="margin-top: 20px;">
        <button type="submit" class="app-btn app-btn-primary">設定を更新</button>
      </div>
    `;

    form.onsubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const payload = { ...pat };
      for (const [k, v] of formData.entries()) {
        payload[k] = v;
      }
      await api.saveTable("githubPAT", payload, 1);
    };

    card.appendChild(form);
    this.container.innerHTML = "";
    this.container.appendChild(card);
  }
}


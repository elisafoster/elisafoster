/**
 * Admin CRUD Controller
 * 各テーブルの一覧・編集・新規作成・削除ロジック
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";
import { Toast } from "../common/toast.js";
import { RichTextEditor } from "./richtext-editor.js";

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

    // 誤った離脱防止
    window.addEventListener("beforeunload", (e) => {
      if (this.visualState?.hasPendingChanges) {
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
          await this.renderTableListTab("event", "イベントバナー管理", ["id", "banner", "link", "start_at", "end_at"]);
          break;
        case "notice":
          await this.renderTableListTab("notice", "お知らせ管理", ["id", "created_at", "status", "message", "Image"]);
          break;
        case "schedule":
          await this.renderTableListTab("schedule", "スケジュール管理", ["id", "title", "schedule_at", "time", "is_active"]);
          break;
        case "gallery":
          await this.renderTableListTab("gallery", "画像（ギャラリー）管理", ["id", "name", "image"]);
          break;
        case "movie":
          await this.renderTableListTab("movie", "動画リスト管理", ["id", "movieUrl", "movieCategory_id", "is_active"]);
          break;
        case "shop":
          await this.renderTableListTab("shop", "ショップグッズ管理", ["id", "name", "price", "priority"]);
          break;
        case "linkList":
          await this.renderTableListTab("linkList", "リンクリスト管理", ["id", "title", "link", "priority"]);
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

    // 立ち絵・衣装 (visual) の場合は保留バッファ（ドラフト）を使用
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
      th.textContent = col.label;
      if (col.isAction) {
        th.className = "admin-table-col-actions";
      } else if (col.type === "image" || ["visual", "defoemed", "thumbnail", "visualBackground", "banner", "Image", "image"].includes(col.key)) {
        th.className = "admin-table-col-image";
      } else if (col.key === "id") {
        th.className = "admin-table-col-id";
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
            if (colCfg.type === "image" || ["visual", "defoemed", "thumbnail", "visualBackground", "banner", "Image", "image"].includes(colCfg.key)) {
              td.className = "admin-table-col-image";
            } else if (colCfg.key === "id") {
              td.className = "admin-table-col-id";
            } else if (colCfg.key === "costumeName") {
              td.className = "admin-table-col-costumeName";
            }
            let val = row[colCfg.key];
            if ((val === undefined || val === null || val === "") && colCfg.fallbackKey) {
              val = row[colCfg.fallbackKey];
            }

            const isImage = colCfg.type === "image" ||
              (typeof val === "string" && (val.endsWith(".png") || val.endsWith(".jpg") || val.endsWith(".jpeg") || val.endsWith(".webp")));

            if (isImage && val) {
              const category = colCfg.category || tableName;
              const imgUrl = api.resolveAssetUrl(val, category);
              const img = document.createElement("img");
              img.className = "admin-table-thumb";
              img.src = imgUrl;
              img.alt = colCfg.label;
              img.title = `${row.costumeName ? row.costumeName + " - " : ""}${colCfg.label} (クリックで拡大)`;
              img.onclick = () => {
                const modalTitle = `${row.costumeName ? row.costumeName + "：" : ""}${colCfg.label}`;
                this.openImageDetailModal(imgUrl, modalTitle, {
                  costumeName: row.costumeName,
                  columnLabel: colCfg.label,
                  path: val,
                });
              };
              td.appendChild(img);
            } else if (val === null || val === undefined || val === "") {
              td.innerHTML = '<span style="color:#64748b;">-</span>';
            } else if (typeof val === "boolean" || colCfg.key === "isFeatured" || colCfg.key === "is_active") {
              td.textContent = (val === 1 || val === true) ? "✓ 表示" : "✕ 非表示";
            } else {
              const str = String(val);
              td.textContent = str.length > 40 ? str.slice(0, 40) + "..." : str;
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
   * 編集・新規モーダル生成
   */
  async openEditModal(tableName, record) {
    if (tableName === "visual") {
      return this.openVisualModal(record);
    }

    const isNew = !record;
    const currentData = record ? { ...record } : {};

    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "14px";

    // レコードの各キーに応じた入力項目自動生成
    const keys = record
      ? Object.keys(record).filter(k => k !== "created_at" && k !== "updated_at")
      : (tableName === "visual"
          ? ["costumeName", "visual", "defoemed", "thumbnail", "visualBackground", "characterDesign", "illustrator", "live2d", "3dModeling", "priority"]
          : ["name", "priority"]);

    keys.forEach((key) => {
      const group = document.createElement("div");
      group.className = "admin-form-group";

      const label = document.createElement("label");
      label.className = "admin-form-label";
      label.textContent = key;
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
        input.placeholder = "assets/... または sample.png";
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

      try {
        await api.saveTable(tableName, payload, isNew ? null : record.id);
        Modal.close();
        await this.loadTab(this.currentTab);
      } catch (e) {
        // エラーは api.js でトースト通知される
      }
    };

    Modal.open({
      title: `${tableName} の${isNew ? "新規作成" : "編集"}`,
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
                <label class="admin-form-label">キャッチフレーズ</label>
                <input class="admin-form-input" name="comment" value="${profile?.comment || ""}" placeholder="キャッチフレーズ" />
              </div>
            </div>

            <!-- 3行目: 自己紹介文 -->
            <div class="admin-form-group" style="margin-bottom: 0;">
              <label class="admin-form-label">自己紹介文</label>
              <textarea class="admin-form-textarea" name="message" rows="4" placeholder="自己紹介文を入力してください">${profile?.message || ""}</textarea>
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

    // 画面外クリック時にポップオーバーを閉じる
    document.addEventListener("click", () => {
      closeAllPopovers();
    });

    // フォーム送信処理
    form.onsubmit = async (e) => {
      e.preventDefault();
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


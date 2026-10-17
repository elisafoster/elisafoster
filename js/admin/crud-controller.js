/**
 * Admin CRUD Controller
 * 各テーブルの一覧・編集・新規作成・削除ロジック
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";
import { Toast } from "../common/toast.js";
import { RichTextEditor } from "./richtext-editor.js";

export class CrudController {
  constructor(contentArea) {
    this.container = contentArea;
    this.currentTab = "profile";
  }

  async loadTab(tabKey) {
    this.currentTab = tabKey;
    if (!this.container) return;

    this.container.innerHTML = '<div style="text-align:center; padding: 40px;"><span class="app-spinner app-spinner-lg"></span></div>';

    try {
      switch (tabKey) {
        case "profile":
          await this.renderProfileTab();
          break;
        case "visual":
          await this.renderTableListTab("visual", "立ち絵・衣装一覧 (visual テーブル)", [
            "id",
            "costumeName",
            "visual",
            "defoemed",
            "costumeThumbnail",
            "outLine",
            "topLine",
            "priority"
          ]);
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
  async renderTableListTab(tableName, title, displayColumns) {
    const records = await api.getTable(tableName);
    const rows = Array.isArray(records) ? records : (records ? [records] : []);

    const card = document.createElement("div");
    card.className = "admin-card";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "admin-card-header";

    const titleGroup = document.createElement("div");
    titleGroup.className = "admin-card-title-group";
    const h2 = document.createElement("h2");
    h2.className = "admin-card-title";
    h2.textContent = title;
    const desc = document.createElement("p");
    desc.className = "admin-card-desc";
    desc.textContent = `テーブル: ${tableName} (${rows.length}件)`;
    titleGroup.appendChild(h2);
    titleGroup.appendChild(desc);
    header.appendChild(titleGroup);

    const actions = document.createElement("div");
    actions.className = "admin-card-actions";
    const addBtn = document.createElement("button");
    addBtn.className = "app-btn app-btn-primary";
    addBtn.innerHTML = "+ 新規追加";
    addBtn.onclick = () => this.openEditModal(tableName, null);
    actions.appendChild(addBtn);
    header.appendChild(actions);

    card.appendChild(header);

    // テーブル
    const tableContainer = document.createElement("div");
    tableContainer.className = "admin-table-container";

    const table = document.createElement("table");
    table.className = "admin-table";

    // THEAD
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    displayColumns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      headerRow.appendChild(th);
    });
    const thAction = document.createElement("th");
    thAction.textContent = "操作";
    headerRow.appendChild(thAction);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // TBODY
    const tbody = document.createElement("tbody");
    if (rows.length === 0) {
      const emptyRow = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = displayColumns.length + 1;
      td.style.textAlign = "center";
      td.style.color = "#94a3b8";
      td.textContent = "データがありません";
      emptyRow.appendChild(td);
      tbody.appendChild(emptyRow);
    } else {
      rows.forEach((row) => {
        const tr = document.createElement("tr");
        displayColumns.forEach((col) => {
          const td = document.createElement("td");
          let val = row[col];

          // 画像の場合サムネイル
          if (typeof val === "string" && (val.endsWith(".png") || val.endsWith(".jpg") || val.endsWith(".jpeg") || val.endsWith(".webp"))) {
            td.innerHTML = `<img class="admin-table-thumb" src="${api.resolveAssetUrl(val, tableName)}" alt="" />`;
          } else if (val === null || val === undefined) {
            td.innerHTML = '<span style="color:#cbd5e1;">-</span>';
          } else if (typeof val === "boolean" || col === "isFeatured" || col === "is_active") {
            td.textContent = (val === 1 || val === true) ? "✓ 表示" : "✕ 非表示";
          } else {
            const str = String(val);
            td.textContent = str.length > 40 ? str.slice(0, 40) + "..." : str;
          }
          tr.appendChild(td);
        });

        // 操作列
        const tdAct = document.createElement("td");
        tdAct.className = "admin-table-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "app-btn app-btn-secondary";
        editBtn.style.padding = "4px 10px";
        editBtn.style.fontSize = "0.8rem";
        editBtn.textContent = "編集";
        editBtn.onclick = () => this.openEditModal(tableName, row);
        tdAct.appendChild(editBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "app-btn app-btn-danger";
        delBtn.style.padding = "4px 10px";
        delBtn.style.fontSize = "0.8rem";
        delBtn.textContent = "削除";
        delBtn.onclick = () => this.deleteRecord(tableName, row.id);
        tdAct.appendChild(delBtn);

        tr.appendChild(tdAct);
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
   * 編集・新規モーダル生成
   */
  async openEditModal(tableName, record) {
    const isNew = !record;
    const currentData = record ? { ...record } : {};

    const form = document.createElement("form");
    form.style.display = "flex";
    form.style.flexDirection = "column";
    form.style.gap = "14px";

    // レコードの各キーに応じた入力項目自動生成
    const keys = record ? Object.keys(record).filter(k => k !== "created_at" && k !== "updated_at") : ["name", "priority"];

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
      } else if (key.toLowerCase().includes("image") || key === "banner" || key === "topLine" || key === "outLine" || key === "sectionBackground" || key === "visual") {
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
    if (!confirm(`ID: ${id} のレコードを本当に削除しますか？`)) return;
    try {
      await api.deleteRecord(tableName, id);
      await this.loadTab(this.currentTab);
    } catch (e) {}
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
                <input class="admin-form-input" name="birthday" value="${profile?.birthday || ""}" placeholder="01月01日" />
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
                <input class="admin-form-input" name="streaming" value="${profile?.streaming || ""}" placeholder="2024年01月01日" />
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


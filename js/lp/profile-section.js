/**
 * Profile Section Component
 * profile テーブル & visual テーブルのデータ描画
 * - 左右反転 (左: プロフィール / 右: 立ち絵)
 * - サムネイル画像のみの衣装切り替え
 * - visualBackground によるページ背景の動的切り替え
 */

import { api } from "../common/api-client.js";

export class ProfileSection {
  constructor(container, profileData, visualList, defaultPageBackground = "") {
    this.container = container;
    this.profile = profileData || {};
    this.visuals = Array.isArray(visualList) ? visualList : [];
    this.currentVisualIndex = 0;
    this.defaultPageBackground = defaultPageBackground || "";

    // 初期背景レイヤーの背景画像URLを記録（未指定時のフォールバック用）
    if (!this.defaultPageBackground && typeof document !== "undefined") {
      const pageBg = document.getElementById("lp-page-bg-layer");
      if (pageBg && pageBg.style.backgroundImage) {
        this.defaultPageBackground = pageBg.style.backgroundImage;
      }
    }
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "lp-profile-grid";

    // 現在選択中のビジュアル
    const currentVisual = this.visuals[this.currentVisualIndex] || this.visuals[0] || null;

    // 4. visual.visualBackground に応じたページ背景の動的切り替え
    this.updatePageBackground(currentVisual);

    // =========================================================================
    // 1. 画面左側: プロフィール詳細情報カード (order: 1)
    // =========================================================================
    const infoCol = document.createElement("div");
    infoCol.className = "lp-card lp-profile-info-card";

    // 名前
    const namesDiv = document.createElement("div");
    namesDiv.className = "lp-profile-names";
    if (this.profile.pronunciation) {
      const furi = document.createElement("div");
      furi.className = "lp-profile-furigana";
      furi.textContent = this.profile.pronunciation;
      namesDiv.appendChild(furi);
    }
    const mainName = document.createElement("h3");
    mainName.className = "lp-profile-main-name";
    mainName.textContent = this.profile.name || "ELISA";
    namesDiv.appendChild(mainName);

    if (this.profile.romanization) {
      const romaji = document.createElement("div");
      romaji.className = "lp-profile-romaji";
      romaji.textContent = this.profile.romanization;
      namesDiv.appendChild(romaji);
    }
    infoCol.appendChild(namesDiv);

    // キャッチフレーズ
    if (this.profile.comment) {
      const phrase = document.createElement("div");
      phrase.className = "lp-profile-catchphrase";
      phrase.textContent = this.profile.comment;
      infoCol.appendChild(phrase);
    }

    // 自己紹介
    if (this.profile.message) {
      const msg = document.createElement("div");
      msg.className = "lp-profile-message";
      msg.textContent = this.profile.message;
      infoCol.appendChild(msg);
    }

    // スペック情報（誕生日、身長など）
    const specs = [
      { label: "誕生日", value: this.profile.birthday },
      { label: "活動開始日", value: this.profile.streaming },
      { label: "年齢", value: this.profile.age ? `${this.profile.age}歳` : null },
      { label: "身長", value: this.profile.height ? `${this.profile.height}cm` : null },
      { label: "ファンネーム", value: this.profile.fanName },
      { label: "ニックネーム", value: this.profile.nickname },
    ].filter((s) => s.value);

    if (specs.length > 0) {
      const specsDiv = document.createElement("div");
      specsDiv.className = "lp-profile-specs";
      specs.forEach((s) => {
        const item = document.createElement("div");
        item.className = "lp-profile-spec-item";
        item.innerHTML = `
          <span class="lp-profile-spec-label">${s.label}</span>
          <span class="lp-profile-spec-value">${s.value}</span>
        `;
        specsDiv.appendChild(item);
      });
      infoCol.appendChild(specsDiv);
    }

    // SNS & プラットフォームリンク
    const snsGroup = document.createElement("div");
    snsGroup.className = "lp-profile-sns-group";

    if (this.profile.youtubeUrl) {
      const ytBtn = document.createElement("a");
      ytBtn.className = "lp-profile-sns-btn";
      ytBtn.href = this.profile.youtubeUrl;
      ytBtn.target = "_blank";
      ytBtn.rel = "noopener noreferrer";
      ytBtn.innerHTML = `<span>▶ YouTube</span>`;
      snsGroup.appendChild(ytBtn);
    }

    if (this.profile.xUrl) {
      const xBtn = document.createElement("a");
      xBtn.className = "lp-profile-sns-btn";
      xBtn.href = this.profile.xUrl;
      xBtn.target = "_blank";
      xBtn.rel = "noopener noreferrer";
      xBtn.innerHTML = `<span>𝕏 Official</span>`;
      snsGroup.appendChild(xBtn);
    }

    if (Array.isArray(this.profile.platforms)) {
      this.profile.platforms.forEach((p) => {
        if (!p.link) return;
        const pBtn = document.createElement("a");
        pBtn.className = "lp-profile-sns-btn";
        pBtn.href = p.link;
        pBtn.target = "_blank";
        pBtn.rel = "noopener noreferrer";
        pBtn.textContent = p.name || "Link";
        snsGroup.appendChild(pBtn);
      });
    }

    if (snsGroup.children.length > 0) {
      infoCol.appendChild(snsGroup);
    }

    grid.appendChild(infoCol);

    // =========================================================================
    // 2. 画面右側: 立ち絵・衣装切り替えサムネイル表示エリア (order: 2)
    // =========================================================================
    const visualCol = document.createElement("div");
    visualCol.className = "lp-profile-visual-container";

    if (currentVisual) {
      // 立ち絵ラッパー (セクション上下いっぱいに追従)
      const wrapper = document.createElement("div");
      wrapper.className = "lp-profile-visual-wrapper";

      // 立ち絵画像 (縦幅100%基準でアスペクト比維持、outLineより前面)
      const standingImg = document.createElement("img");
      standingImg.className = "lp-profile-standing-img";
      standingImg.src = api.resolveAssetUrl(currentVisual.visual, "visual/standing");
      standingImg.alt = currentVisual.costumeName || this.profile.name || "立ち絵";
      wrapper.appendChild(standingImg);

      // デフォルメイラスト（立ち絵の右下に配置）
      if (currentVisual.defoemed) {
        const defImg = document.createElement("img");
        defImg.className = "lp-profile-deformed-img";
        defImg.src = api.resolveAssetUrl(currentVisual.defoemed, "visual/deformed");
        defImg.alt = "デフォルメイラスト";
        wrapper.appendChild(defImg);
      }

      visualCol.appendChild(wrapper);

      // 3. 衣装切り替えサムネイル (テキスト非表示・画像アイコンのみ)
      if (this.visuals.length > 1) {
        const costumeTabs = document.createElement("div");
        costumeTabs.className = "lp-costume-tabs";

        this.visuals.forEach((v, idx) => {
          const btn = document.createElement("button");
          btn.className = `lp-costume-tab-btn ${idx === this.currentVisualIndex ? "is-active" : ""}`;
          btn.type = "button";
          btn.title = v.costumeName || `衣装 ${idx + 1}`;
          btn.setAttribute("aria-label", v.costumeName || `衣装 ${idx + 1}`);

          // テキストを一切含めずサムネイル画像のみ描画
          const thumbSrc = v.thumbnail
            ? api.resolveAssetUrl(v.thumbnail, "visual/thumbnail")
            : api.resolveAssetUrl(v.visual, "visual/standing");

          btn.innerHTML = `<img src="${thumbSrc}" alt="${v.costumeName || ""}" />`;

          btn.onclick = () => {
            this.currentVisualIndex = idx;
            this.render();
          };
          costumeTabs.appendChild(btn);
        });

        visualCol.appendChild(costumeTabs);
      }

      // クリエイタークレジット
      const creators = [];
      if (currentVisual.characterDesign) creators.push(`キャラデザ: ${currentVisual.characterDesign}`);
      if (currentVisual.illustrator) creators.push(`イラスト: ${currentVisual.illustrator}`);
      if (currentVisual.live2d) creators.push(`Live2D: ${currentVisual.live2d}`);
      if (currentVisual["3dModeling"]) creators.push(`3D: ${currentVisual["3dModeling"]}`);

      if (creators.length > 0) {
        const creatorEl = document.createElement("div");
        creatorEl.className = "lp-profile-creators";
        creators.forEach((c) => {
          const tag = document.createElement("span");
          tag.className = "lp-profile-creator-tag";
          tag.textContent = c;
          creatorEl.appendChild(tag);
        });
        visualCol.appendChild(creatorEl);
      }
    }

    grid.appendChild(visualCol);
    this.container.appendChild(grid);
  }

  /**
   * visual.visualBackground に応じたページ背景レイヤーの動的切り替え
   */
  updatePageBackground(visual) {
    if (typeof document === "undefined") return;
    const pageBgLayer = document.getElementById("lp-page-bg-layer");
    if (!pageBgLayer) return;

    if (visual && visual.visualBackground) {
      const bgUrl = api.resolveAssetUrl(visual.visualBackground, "visual/background");
      pageBgLayer.style.backgroundImage = `url("${bgUrl}")`;
      pageBgLayer.style.transition = "background-image 0.4s ease-in-out";
    } else if (this.defaultPageBackground) {
      if (this.defaultPageBackground.startsWith("url(")) {
        pageBgLayer.style.backgroundImage = this.defaultPageBackground;
      } else {
        pageBgLayer.style.backgroundImage = `url("${this.defaultPageBackground}")`;
      }
    }
  }
}

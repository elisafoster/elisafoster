/**
 * Profile Section Component
 * profile テーブル & visual テーブルのデータ描画
 */

import { api } from "../common/api-client.js";

export class ProfileSection {
  constructor(container, profileData, visualList) {
    this.container = container;
    this.profile = profileData || {};
    this.visuals = Array.isArray(visualList) ? visualList : [];
    this.currentVisualIndex = 0;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "lp-profile-grid";

    // 1. 左側: 立ち絵・ビジュアルエリア
    const visualCol = document.createElement("div");
    visualCol.className = "lp-profile-visual-container";

    if (this.visuals.length > 0) {
      const currentVisual = this.visuals[this.currentVisualIndex] || this.visuals[0];

      // ビジュアルラッパー
      const wrapper = document.createElement("div");
      wrapper.className = "lp-profile-visual-wrapper";

      if (currentVisual.visualBackground) {
        const bgImg = document.createElement("img");
        bgImg.className = "lp-profile-visual-bg";
        bgImg.src = api.resolveAssetUrl(currentVisual.visualBackground, "visual/background");
        bgImg.alt = "演出背景";
        wrapper.appendChild(bgImg);
      }

      const standingImg = document.createElement("img");
      standingImg.className = "lp-profile-standing-img";
      standingImg.src = api.resolveAssetUrl(currentVisual.visual, "visual/standing");
      standingImg.alt = this.profile.name || "立ち絵";
      wrapper.appendChild(standingImg);

      if (currentVisual.defoemed) {
        const defImg = document.createElement("img");
        defImg.className = "lp-profile-deformed-img";
        defImg.src = api.resolveAssetUrl(currentVisual.defoemed, "visual/deformed");
        defImg.alt = "デフォルメイラスト";
        wrapper.appendChild(defImg);
      }

      visualCol.appendChild(wrapper);

      // 複数衣装がある場合のタブ切り替え
      if (this.visuals.length > 1) {
        const costumeTabs = document.createElement("div");
        costumeTabs.className = "lp-costume-tabs";

        this.visuals.forEach((v, idx) => {
          const btn = document.createElement("button");
          btn.className = `lp-costume-tab-btn ${idx === this.currentVisualIndex ? "is-active" : ""}`;
          btn.innerHTML = `
            ${v.thumbnail ? `<img src="${api.resolveAssetUrl(v.thumbnail, "visual/thumbnail")}" alt="" />` : ""}
            <span>${v.costumeName || `衣装 ${idx + 1}`}</span>
          `;
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

    // 2. 右側: プロフィール詳細情報
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
    this.container.appendChild(grid);
  }
}

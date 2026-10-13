/**
 * Profile Section Component
 * profile テーブル & visual テーブルのデータ描画
 * - 左右反転 (左: プロフィール情報 & 紹介動画 / 右: 巨大立ち絵 & サムネイル)
 * - 立ち絵の拡大・はみ出し配置 (outLine の下に潜り込む)
 * - デフォルメキャラクターの透過・足元寄り添い配置
 * - profile.moves (自己紹介動画) の埋め込み・モーダル再生
 * - visualBackground によるページ背景の動的切り替え
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

function getYouTubeInfo(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  if (match) {
    return {
      videoId: match[1],
      thumbUrl: `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`,
    };
  }
  return null;
}

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

    // visual.visualBackground に応じたページ背景の動的切り替え
    this.updatePageBackground(currentVisual);

    // =========================================================================
    // 1. 画面左側: プロフィール詳細情報カード (order: 1 / z-index: 10 最前面)
    // =========================================================================
    const infoCol = document.createElement("div");
    infoCol.className = "lp-card lp-profile-info-card";

    // ① 名前・ふりがな・ローマ字
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

    // ② ニックネーム
    if (this.profile.nickname) {
      const nickBadge = document.createElement("div");
      nickBadge.className = "lp-profile-nickname-badge";
      nickBadge.innerHTML = `<span class="lp-nick-label">NICKNAME</span> <span class="lp-nick-val">${this.profile.nickname}</span>`;
      infoCol.appendChild(nickBadge);
    }

    // ③ キャッチフレーズ
    if (this.profile.comment) {
      const phrase = document.createElement("div");
      phrase.className = "lp-profile-catchphrase";
      phrase.textContent = this.profile.comment;
      infoCol.appendChild(phrase);
    }

    // ④ 自己紹介
    if (this.profile.message) {
      const msg = document.createElement("div");
      msg.className = "lp-profile-message";
      msg.textContent = this.profile.message;
      infoCol.appendChild(msg);
    }

    // ⑤ スペック情報（誕生日、身長等）
    const specs = [
      { label: "誕生日", value: this.profile.birthday },
      { label: "活動開始日", value: this.profile.streaming },
      { label: "年齢", value: this.profile.age ? `${this.profile.age}歳` : null },
      { label: "身長", value: this.profile.height ? `${this.profile.height}cm` : null },
      { label: "ファンネーム", value: this.profile.fanName },
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

    // ⑦ 公式チャンネル＆プラットフォームリンク
    const snsGroup = document.createElement("div");
    snsGroup.className = "lp-profile-sns-group";

    if (this.profile.youtubeUrl) {
      const ytBtn = document.createElement("a");
      ytBtn.className = "lp-profile-sns-btn lp-profile-btn-youtube";
      ytBtn.href = this.profile.youtubeUrl;
      ytBtn.target = "_blank";
      ytBtn.rel = "noopener noreferrer";
      ytBtn.innerHTML = `<span>▶ YouTube Channel</span>`;
      snsGroup.appendChild(ytBtn);
    }

    if (this.profile.xUrl) {
      const xBtn = document.createElement("a");
      xBtn.className = "lp-profile-sns-btn lp-profile-btn-x";
      xBtn.href = this.profile.xUrl;
      xBtn.target = "_blank";
      xBtn.rel = "noopener noreferrer";
      xBtn.innerHTML = `<span>𝕏 Official X</span>`;
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

    // ⑧ INTRO MOVIES (自己紹介動画: profile.moves)
    if (Array.isArray(this.profile.moves) && this.profile.moves.length > 0) {
      const movesContainer = document.createElement("div");
      movesContainer.className = "lp-profile-moves-container";

      const movesTitle = document.createElement("div");
      movesTitle.className = "lp-profile-moves-title";
      movesTitle.innerHTML = "<span>✦ INTRO MOVIES ✦</span>";
      movesContainer.appendChild(movesTitle);

      const movesList = document.createElement("div");
      movesList.className = "lp-profile-moves-list";

      this.profile.moves.forEach((videoUrl, idx) => {
        if (!videoUrl) return;
        const card = document.createElement("div");
        card.className = "lp-profile-movie-card";

        const ytInfo = getYouTubeInfo(videoUrl);
        const thumbSrc = ytInfo ? ytInfo.thumbUrl : "assets/movie/sample.png";

        card.innerHTML = `
          <div class="lp-profile-movie-thumb-wrapper">
            <img class="lp-profile-movie-thumb" src="${thumbSrc}" alt="自己紹介動画 #${idx + 1}" loading="lazy" />
            <div class="lp-profile-movie-play-btn">
              <div class="lp-profile-movie-play-icon">▶</div>
            </div>
          </div>
          <div class="lp-profile-movie-caption">活動者・配信者 紹介ムービー</div>
        `;

        card.onclick = () => {
          Modal.openVideo(videoUrl, `自己紹介ムービー`);
        };

        movesList.appendChild(card);
      });

      movesContainer.appendChild(movesList);
      infoCol.appendChild(movesContainer);
    }

    grid.appendChild(infoCol);

    // =========================================================================
    // 2. 画面右側: 立ち絵エリア & サムネイル・クレジットパネル
    // =========================================================================
    const visualCol = document.createElement("div");
    visualCol.className = "lp-profile-visual-container";

    if (currentVisual) {
      // 立ち絵ラッパー (巨大拡大・上下いっぱい・outLineの下に潜り込む z-index: 2)
      const standingWrapper = document.createElement("div");
      standingWrapper.className = "lp-profile-standing-wrapper";

      // 立ち絵画像本体
      const standingImg = document.createElement("img");
      standingImg.className = "lp-profile-standing-img";
      standingImg.src = api.resolveAssetUrl(currentVisual.visual, "visual/standing");
      standingImg.alt = currentVisual.costumeName || this.profile.name || "立ち絵";
      standingWrapper.appendChild(standingImg);

      // ④ デフォルメイラスト（白丸座布団なし・透過単体で足元手前に寄り添う z-index: 6）
      if (currentVisual.defoemed) {
        const defImg = document.createElement("img");
        defImg.className = "lp-profile-deformed-img";
        defImg.src = api.resolveAssetUrl(currentVisual.defoemed, "visual/deformed");
        defImg.alt = "デフォルメイラスト";
        standingWrapper.appendChild(defImg);
      }

      visualCol.appendChild(standingWrapper);

      // ⑨ COSTUME SELECT & クリエイタークレジット (outLineの上に浮いて操作可能 z-index: 10)
      const costumePanel = document.createElement("div");
      costumePanel.className = "lp-costume-select-panel";

      // サムネイル切り替え (テキストなし・画像アイコンのみ)
      if (this.visuals.length > 1) {
        const panelTitle = document.createElement("div");
        panelTitle.className = "lp-costume-panel-title";
        panelTitle.textContent = "✦ COSTUME SELECT ✦";
        costumePanel.appendChild(panelTitle);

        const costumeTabs = document.createElement("div");
        costumeTabs.className = "lp-costume-tabs";

        this.visuals.forEach((v, idx) => {
          const btn = document.createElement("button");
          btn.className = `lp-costume-tab-btn ${idx === this.currentVisualIndex ? "is-active" : ""}`;
          btn.type = "button";
          btn.title = v.costumeName || `衣装 ${idx + 1}`;
          btn.setAttribute("aria-label", v.costumeName || `衣装 ${idx + 1}`);

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

        costumePanel.appendChild(costumeTabs);
      }

      // クリエイタークレジット
      const creators = [];
      if (currentVisual.characterDesign) creators.push({ label: "キャラクターデザイン", val: currentVisual.characterDesign });
      if (currentVisual.illustrator) creators.push({ label: "イラストレーター", val: currentVisual.illustrator });
      if (currentVisual.live2d) creators.push({ label: "Live2Dモデラー", val: currentVisual.live2d });
      if (currentVisual["3dModeling"]) creators.push({ label: "3Dモデラー", val: currentVisual["3dModeling"] });

      if (creators.length > 0) {
        const creditEl = document.createElement("div");
        creditEl.className = "lp-profile-creators";
        creators.forEach((c) => {
          const tag = document.createElement("span");
          tag.className = "lp-profile-creator-tag";
          tag.innerHTML = `<strong>${c.label}:</strong> ${c.val}`;
          creditEl.appendChild(tag);
        });
        costumePanel.appendChild(creditEl);
      }

      visualCol.appendChild(costumePanel);
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

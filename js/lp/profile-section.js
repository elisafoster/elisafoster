/**
 * Profile Section Component
 * 画像配置仕様に完全対応:
 * ① 名前（ふりがな・ローマ字・メイン名）
 * ② NICKNAMEバッジ
 * ③ キャッチフレーズカード (themeConfig色)
 * ④ 自己紹介カード (themeConfig色)
 * ⑤ PROFILE SPECS & ⑥ CREATIVE CREDITS の2カラムカード (themeConfig色)
 * ⑦ OFFICIAL CHANNELS & PLATFORMS
 * ⑧ INTRO MOVIES (自己紹介動画: profile.moves)
 * ⑨ サムネイル: カード表示なし、単体表示、サイズ拡大、背景thumbnail_background.jpg
 * ⑩ 巨大立ち絵 & 透過デフォルメキャラ (outLineの下に潜り込む)
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

/**
 * 安全なHTMLエスケープ関数 (XSS対策)
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
  constructor(container, profileData, visualList, defaultPageBackground = "", sectionConfig = null) {
    this.container = container;
    this.profile = profileData || {};
    this.visuals = Array.isArray(visualList) ? visualList : [];
    this.currentVisualIndex = 0;
    this.defaultPageBackground = defaultPageBackground || "";
    this.sectionConfig = sectionConfig || {};
    this.sectionType = this.sectionConfig.sectionType || "standing";

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
    grid.className = `lp-profile-grid lp-profile-type-${this.sectionType}`;

    // 現在選択中のビジュアル
    const currentVisual = this.visuals[this.currentVisualIndex] || this.visuals[0] || null;

    // visual.visualBackground に応じたページ背景の動的切り替え
    this.updatePageBackground(currentVisual);

    // =========================================================================
    // 1. 画面左側: プロフィール詳細情報エリア (order: 1 / z-index: 10)
    // =========================================================================
    const leftCol = document.createElement("div");
    leftCol.className = "lp-profile-left-col";

    // 上部グループ (スマホ等の縦長画面時に立ち絵の上に配置: 名前・ニックネーム・キャッチフレーズ)
    const headerGroup = document.createElement("div");
    headerGroup.className = "lp-profile-header-group";

    // ① 名前ブロック (ふりがな・ローマ字バッジ & メイン名)
    const nameBlock = document.createElement("div");
    nameBlock.className = "lp-profile-name-block";

    if (this.profile.pronunciation || this.profile.romanization) {
      const badgePill = document.createElement("div");
      badgePill.className = "lp-profile-ruby-pill";
      if (this.profile.pronunciation) {
        const rubySpan = document.createElement("span");
        rubySpan.className = "lp-profile-ruby-furi";
        rubySpan.textContent = this.profile.pronunciation;
        badgePill.appendChild(rubySpan);
      }
      if (this.profile.romanization) {
        const romajiSpan = document.createElement("span");
        romajiSpan.className = "lp-profile-ruby-romaji";
        romajiSpan.textContent = this.profile.romanization;
        badgePill.appendChild(romajiSpan);
      }
      nameBlock.appendChild(badgePill);
    }

    const mainName = document.createElement("h2");
    mainName.className = "lp-profile-main-title";
    mainName.textContent = this.profile.name || "ELISA";
    nameBlock.appendChild(mainName);
    headerGroup.appendChild(nameBlock);

    // ② NICKNAME バッジ
    if (this.profile.nickname) {
      const nickBadge = document.createElement("div");
      nickBadge.className = "lp-profile-nick-badge";
      nickBadge.innerHTML = `<span class="lp-nick-label">NICKNAME</span> <span class="lp-nick-val">${escapeHtml(this.profile.nickname)}</span>`;
      headerGroup.appendChild(nickBadge);
    }

    // ③ キャッチフレーズ (引用表示)
    if (this.profile.comment) {
      const phraseQuote = document.createElement("blockquote");
      phraseQuote.className = "lp-profile-quote-block lp-profile-catchphrase-quote";
      phraseQuote.innerHTML = `
        <span class="lp-profile-quote-mark start">“</span>
        <span class="lp-profile-quote-text">${escapeHtml(this.profile.comment)}</span>
        <span class="lp-profile-quote-mark end">”</span>
      `;
      headerGroup.appendChild(phraseQuote);
    }

    leftCol.appendChild(headerGroup);

    // 下部グループ (スマホ等の縦長画面時に立ち絵の下に配置: 自己紹介・スペック＆クレジット・SNS・動画)
    const bodyGroup = document.createElement("div");
    bodyGroup.className = "lp-profile-body-group";

    // ④ 自己紹介 (引用表示)
    if (this.profile.message) {
      const msgQuote = document.createElement("blockquote");
      msgQuote.className = "lp-profile-quote-block lp-profile-message-quote";
      msgQuote.innerHTML = `
        <div class="lp-profile-message-quote-inner">
          <p class="lp-profile-message-quote-text">${escapeHtml(this.profile.message)}</p>
        </div>
      `;
      bodyGroup.appendChild(msgQuote);
    }

    // ⑤ & ⑥ 横並びの2カラムカード (SPECS & CREDITS)
    const twoColCards = document.createElement("div");
    twoColCards.className = "lp-profile-two-cards-grid";

    const formatDisplayBirthday = (val) => {
      if (!val) return "";
      const m = String(val).match(/^\d{4}-(\d{2})-(\d{2})$/);
      if (m) return `${m[1]}月${m[2]}日`;
      return val;
    };
    const formatDisplayStreaming = (val) => {
      if (!val) return "";
      const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[1]}年${m[2]}月${m[3]}日`;
      return val;
    };

    // ⑤ PROFILE SPECS（未設定項目は "---" で表示）
    const specs = [
      { icon: "🎂", label: "誕生日", value: formatDisplayBirthday(this.profile.birthday) || "---" },
      { icon: "🚀", label: "活動開始日", value: formatDisplayStreaming(this.profile.streaming) || "---" },
      { icon: "✨", label: "年齢", value: this.profile.age ? `${this.profile.age} 歳` : "---" },
      { icon: "📏", label: "身長", value: this.profile.height ? `${this.profile.height} cm` : "---" },
      { icon: "💫", label: "ファンネーム", value: this.profile.fanName || "---" },
    ];

    const specsCard = document.createElement("div");
    specsCard.className = "lp-profile-theme-card lp-profile-specs-card";
    specsCard.innerHTML = `<div class="lp-card-header-badge lp-badge-yellow">✦ PROFILE SPECS ✦</div>`;

    const specsList = document.createElement("div");
    specsList.className = "lp-specs-row-list";
    specs.forEach((s) => {
      const row = document.createElement("div");
      row.className = "lp-spec-row-item";
      row.innerHTML = `
        <span class="lp-spec-row-label"><i>${escapeHtml(s.icon)}</i> ${escapeHtml(s.label)}</span>
        <span class="lp-spec-row-val">${escapeHtml(s.value)}</span>
      `;
      specsList.appendChild(row);
    });
    specsCard.appendChild(specsList);
    twoColCards.appendChild(specsCard);

    // ⑥ CREATIVE CREDITS（未設定項目は "---" で表示）
    const credits = [
      { label: "キャラクターデザイン", val: currentVisual?.characterDesign || "---" },
      { label: "イラストレーター", val: currentVisual?.illustrator || "---" },
      { label: "Live2Dモデラー", val: currentVisual?.live2d || "---" },
      { label: "3Dモデラー", val: currentVisual?.["3dModeling"] || "---" },
    ];

    const creditsCard = document.createElement("div");
    creditsCard.className = "lp-profile-theme-card lp-profile-credits-card";
    creditsCard.innerHTML = `<div class="lp-card-header-badge lp-badge-purple">✦ CREATIVE CREDITS ✦</div>`;

    const creditsList = document.createElement("div");
    creditsList.className = "lp-credits-row-list";
    credits.forEach((c) => {
      const row = document.createElement("div");
      row.className = "lp-credit-row-item";
      row.innerHTML = `
        <span class="lp-credit-row-label">${escapeHtml(c.label)}</span>
        <span class="lp-credit-row-val">${escapeHtml(c.val)}</span>
      `;
      creditsList.appendChild(row);
    });
    creditsCard.appendChild(creditsList);
    twoColCards.appendChild(creditsCard);

    bodyGroup.appendChild(twoColCards);

    // ⑦ OFFICIAL CHANNELS & PLATFORMS
    const snsBlock = document.createElement("div");
    snsBlock.className = "lp-profile-sns-block";
    snsBlock.innerHTML = `<div class="lp-channels-badge-title">✦ OFFICIAL CHANNELS & PLATFORMS ✦</div>`;

    const snsBtns = document.createElement("div");
    snsBtns.className = "lp-channels-btn-group";

    const isSafeUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      const lower = url.trim().toLowerCase();
      return lower.startsWith("http://") || lower.startsWith("https://");
    };

    if (this.profile.youtubeUrl && isSafeUrl(this.profile.youtubeUrl)) {
      const ytBtn = document.createElement("a");
      ytBtn.className = "lp-channel-btn lp-btn-youtube";
      ytBtn.href = this.profile.youtubeUrl;
      ytBtn.target = "_blank";
      ytBtn.rel = "noopener noreferrer";
      ytBtn.innerHTML = `<span>▶ YouTube Channel</span>`;
      snsBtns.appendChild(ytBtn);
    }

    if (this.profile.xUrl && isSafeUrl(this.profile.xUrl)) {
      const xBtn = document.createElement("a");
      xBtn.className = "lp-channel-btn lp-btn-x";
      xBtn.href = this.profile.xUrl;
      xBtn.target = "_blank";
      xBtn.rel = "noopener noreferrer";
      xBtn.innerHTML = `<span>𝕏 Official X</span>`;
      snsBtns.appendChild(xBtn);
    }

    if (Array.isArray(this.profile.platforms)) {
      this.profile.platforms.forEach((p) => {
        if (!p.link || !isSafeUrl(p.link)) return;
        const pBtn = document.createElement("a");
        pBtn.className = "lp-channel-btn lp-btn-platform";
        pBtn.href = p.link;
        pBtn.target = "_blank";
        pBtn.rel = "noopener noreferrer";
        pBtn.textContent = p.name || "Platform";
        snsBtns.appendChild(pBtn);
      });
    }

    snsBlock.appendChild(snsBtns);
    bodyGroup.appendChild(snsBlock);

    // ⑧ INTRO MOVIES (自己紹介動画: 複数ある場合はスライダーで切り替え表示)
    if (Array.isArray(this.profile.moves)) {
      const validMoves = this.profile.moves.filter((url) => Boolean(url && String(url).trim()));
      if (validMoves.length > 0) {
        const movesBlock = document.createElement("div");
        movesBlock.className = "lp-profile-moves-block";
        movesBlock.innerHTML = `<div class="lp-moves-badge-title">✦ INTRO MOVIES ✦</div>`;

        const sliderContainer = document.createElement("div");
        sliderContainer.className = "lp-profile-moves-slider-container";

        const sliderViewport = document.createElement("div");
        sliderViewport.className = "lp-profile-moves-slider-viewport";

        const sliderTrack = document.createElement("div");
        sliderTrack.className = "lp-profile-moves-slider-track";

        validMoves.forEach((videoUrl, idx) => {
          const card = document.createElement("div");
          card.className = "lp-profile-movie-item";

          const ytInfo = getYouTubeInfo(videoUrl);
          const thumbSrc = ytInfo ? ytInfo.thumbUrl : "assets/movie/sample.png";

          card.innerHTML = `
            <div class="lp-profile-movie-thumb-wrapper">
              <img class="lp-profile-movie-thumb" src="${escapeHtml(thumbSrc)}" alt="自己紹介動画 #${idx + 1}" loading="lazy" />
              <div class="lp-profile-movie-play-btn">
                <div class="lp-profile-movie-play-icon">▶</div>
              </div>
            </div>
            <div class="lp-profile-movie-footer">活動者・配信者</div>
          `;

          card.onclick = () => {
            Modal.openVideo(videoUrl, `自己紹介ムービー`);
          };

          sliderTrack.appendChild(card);
        });

        sliderViewport.appendChild(sliderTrack);
        sliderContainer.appendChild(sliderViewport);

        // 複数動画がある場合のみスライダーコントロール (左右矢印・ドット・スワイプ) を追加
        if (validMoves.length > 1) {
          let currentIndex = 0;
          const totalSlides = validMoves.length;

          const updateSlide = (newIndex) => {
            currentIndex = (newIndex + totalSlides) % totalSlides;
            sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;

            // ドットの更新
            const dots = sliderContainer.querySelectorAll(".lp-moves-slider-dot");
            dots.forEach((dot, dIdx) => {
              dot.classList.toggle("is-active", dIdx === currentIndex);
            });
          };

          // 左右矢印ボタン
          const prevBtn = document.createElement("button");
          prevBtn.type = "button";
          prevBtn.className = "lp-moves-slider-arrow prev";
          prevBtn.setAttribute("aria-label", "前の動画");
          prevBtn.innerHTML = "‹";
          prevBtn.onclick = (e) => {
            e.stopPropagation();
            updateSlide(currentIndex - 1);
          };

          const nextBtn = document.createElement("button");
          nextBtn.type = "button";
          nextBtn.className = "lp-moves-slider-arrow next";
          nextBtn.setAttribute("aria-label", "次の動画");
          nextBtn.innerHTML = "›";
          nextBtn.onclick = (e) => {
            e.stopPropagation();
            updateSlide(currentIndex + 1);
          };

          sliderContainer.appendChild(prevBtn);
          sliderContainer.appendChild(nextBtn);

          // ドットインジケーター
          const dotsWrap = document.createElement("div");
          dotsWrap.className = "lp-moves-slider-dots";

          for (let i = 0; i < totalSlides; i++) {
            const dot = document.createElement("button");
            dot.type = "button";
            dot.className = `lp-moves-slider-dot${i === 0 ? " is-active" : ""}`;
            dot.setAttribute("aria-label", `動画 ${i + 1}`);
            dot.onclick = (e) => {
              e.stopPropagation();
              updateSlide(i);
            };
            dotsWrap.appendChild(dot);
          }
          sliderContainer.appendChild(dotsWrap);

          // タッチスワイプ対応
          let startX = 0;
          let currentX = 0;
          let isSwiping = false;

          sliderViewport.addEventListener("touchstart", (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
            isSwiping = true;
          }, { passive: true });

          sliderViewport.addEventListener("touchmove", (e) => {
            if (!isSwiping) return;
            currentX = e.touches[0].clientX;
          }, { passive: true });

          sliderViewport.addEventListener("touchend", () => {
            if (!isSwiping) return;
            isSwiping = false;
            const diffX = startX - currentX;
            if (Math.abs(diffX) > 40) {
              if (diffX > 0) {
                updateSlide(currentIndex + 1);
              } else {
                updateSlide(currentIndex - 1);
              }
            }
          });
        }

        movesBlock.appendChild(sliderContainer);
        bodyGroup.appendChild(movesBlock);
      }
    }

    leftCol.appendChild(bodyGroup);
    grid.appendChild(leftCol);

    // =========================================================================
    // 2. 画面右側: 巨大立ち絵 & サムネイル (カード枠なし・背景画像付き)
    // =========================================================================
    const visualCol = document.createElement("div");
    visualCol.className = "lp-profile-visual-container";

    if (currentVisual) {
      // ⑩ 立ち絵ラッパー (巨大拡大・上下いっぱい・outLineの背面に潜り込む z-index: 2)
      const standingWrapper = document.createElement("div");
      standingWrapper.className = "lp-profile-standing-wrapper";

      const standingImg = document.createElement("img");
      standingImg.className = "lp-profile-standing-img";
      standingImg.src = api.resolveAssetUrl(currentVisual.visual, "visual/standing");
      standingImg.alt = currentVisual.costumeName || this.profile.name || "立ち絵";
      standingWrapper.appendChild(standingImg);

      // 透過デフォルメキャラクター（白座布団なし・足元手前寄り添い配置 z-index: 8）
      const defUrl = currentVisual.deformed || currentVisual.defoemed;
      if (defUrl) {
        const defImg = document.createElement("img");
        defImg.className = "lp-profile-deformed-img";
        defImg.src = api.resolveAssetUrl(defUrl, "visual/deformed");
        defImg.alt = "デフォルメイラスト";
        standingWrapper.appendChild(defImg);
      }

      visualCol.appendChild(standingWrapper);

      // ⑨ サムネイルのみ表示 (外側カード表示なし・拡大サイズ・背景thumbnail_background.jpg)
      if (this.visuals.length > 0) {
        const costumeTabs = document.createElement("div");
        costumeTabs.className = "lp-costume-tabs-standalone";

        this.visuals.forEach((v, idx) => {
          const btn = document.createElement("button");
          btn.className = `lp-costume-thumb-btn ${idx === this.currentVisualIndex ? "is-active" : ""}`;
          btn.type = "button";
          btn.title = v.costumeName || `衣装 ${idx + 1}`;
          btn.setAttribute("aria-label", v.costumeName || `衣装 ${idx + 1}`);

          const thumbSrc = v.thumbnail
            ? api.resolveAssetUrl(v.thumbnail, "visual/thumbnail")
            : api.resolveAssetUrl(v.visual, "visual/standing");

          btn.innerHTML = `<img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(v.costumeName || "")}" />`;

          btn.onclick = () => {
            this.currentVisualIndex = idx;
            this.render();
          };
          costumeTabs.appendChild(btn);
        });

        visualCol.appendChild(costumeTabs);
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

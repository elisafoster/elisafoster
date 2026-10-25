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
  constructor(container, profileData, visualList, defaultPageBackground = "", sectionConfig = null, themeConfig = null) {
    this.container = container;
    this.profile = profileData || {};
    this.visuals = Array.isArray(visualList) ? visualList : [];
    this.currentVisualIndex = 0;
    this.defaultPageBackground = defaultPageBackground || "";
    this.sectionConfig = sectionConfig || {};
    this.themeConfig = themeConfig || {};
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

    if (this.sectionType === "banner") {
      // banner の時は visualBackground, deformed, thumbnail を一切参照しない
      this.resetPageBackground();
      this.renderBannerLayout();
    } else {
      // standing の時は現在選択中のビジュアル・背景・立ち絵・デフォルメ・サムネイルを表示
      const currentVisual = this.visuals[this.currentVisualIndex] || this.visuals[0] || null;
      this.updatePageBackground(currentVisual);
      this.renderStandingLayout(currentVisual);
    }
  }

  /**
   * ページ背景レイヤーをデフォルト背景にリセット (banner形式専用)
   */
  resetPageBackground() {
    if (typeof document === "undefined") return;
    const pageBgLayer = document.getElementById("lp-page-bg-layer");
    if (!pageBgLayer) return;

    if (this.defaultPageBackground) {
      if (this.defaultPageBackground.startsWith("url(")) {
        pageBgLayer.style.backgroundImage = this.defaultPageBackground;
      } else {
        pageBgLayer.style.backgroundImage = `url("${this.defaultPageBackground}")`;
      }
    } else {
      pageBgLayer.style.backgroundImage = "";
    }
  }

  /**
   * =========================================================================
   * ① バナー形式 (sectionType === "banner")
   * 仕様:
   * - 名前の横の画像は visual の id が 1 のビジュアル画像 (standing) を参照
   * - deformed, thumbnail, visualBackground は banner の時は一切参照しない
   * - キャッチフレーズ・自己紹介・動画・SNS・スペック・クレジットをカンプ通りに確実に表示
   * =========================================================================
   */
  renderBannerLayout() {
    // visual の id が 1 のビジュアルを厳密に検索 (フォールバック: 先頭ビジュアル)
    const visual1 =
      this.visuals.find((v) => Number(v.id) === 1 || String(v.id) === "1") ||
      this.visuals[0] ||
      null;

    const mainContainer = document.createElement("div");
    mainContainer.className = "lp-profile-banner-container";

    // 1. 上部ヒーローバナー
    const bannerHero = document.createElement("div");
    bannerHero.className = "lp-profile-banner-hero";

    // バナーカード背景設定:
    // visual の id が 1 の visualBackground が設定されている場合はカード背景画像に設定
    // 設定されていない場合は themeConfig のカード背景設定を参照
    if (visual1 && visual1.visualBackground && String(visual1.visualBackground).trim()) {
      const bgUrl = api.resolveAssetUrl(visual1.visualBackground, "visual/background");
      bannerHero.style.backgroundImage = `url("${bgUrl}")`;
      bannerHero.style.backgroundSize = "cover";
      bannerHero.style.backgroundPosition = "center center";
      bannerHero.style.backgroundRepeat = "no-repeat";
    } else {
      const tc = this.themeConfig;
      if (tc && tc.card_bg_type === "single" && tc.card_bg_color) {
        bannerHero.style.background = tc.card_bg_color;
      } else if (tc && tc.card_bg_gradient_start && tc.card_bg_gradient_end) {
        const angle = tc.card_bg_gradient_angle ?? 0;
        bannerHero.style.background = `linear-gradient(${angle}deg, ${tc.card_bg_gradient_start}, ${tc.card_bg_gradient_end})`;
      } else {
        bannerHero.style.background = "var(--theme-card-bg, linear-gradient(135deg, #38bdf8 0%, #60a5fa 55%, #38bdf8 100%))";
      }
    }

    const heroInner = document.createElement("div");
    heroInner.className = "lp-profile-banner-hero-inner";

    // 左側テキスト (ELISA + NICKNAME: 白い背景カードなし)
    const heroText = document.createElement("div");
    heroText.className = "lp-profile-banner-hero-text";

    const heroName = document.createElement("h2");
    heroName.className = "lp-profile-banner-name";
    heroName.textContent = this.profile.name || "ELISA";
    heroText.appendChild(heroName);

    const nickBadge = document.createElement("div");
    nickBadge.className = "lp-profile-nick-badge";
    const nickVal = (this.profile.nickname && String(this.profile.nickname).trim()) || "サンプル";
    nickBadge.innerHTML = `<span class="lp-nick-label">NICKNAME</span> <span class="lp-nick-val">${escapeHtml(nickVal)}</span>`;
    heroText.appendChild(nickBadge);

    heroInner.appendChild(heroText);

    // 右側キャラクター上半身 (visual の id が 1 の画像を参照)
    const visualWrap = document.createElement("div");
    visualWrap.className = "lp-profile-banner-hero-visual";

    const charImg = document.createElement("img");
    charImg.className = "lp-profile-banner-char-img";
    const standingSrc = visual1?.visual
      ? api.resolveAssetUrl(visual1.visual, "visual/standing")
      : "assets/visual/standing/sample.png";
    charImg.src = standingSrc;
    charImg.alt = visual1?.costumeName || this.profile.name || "キャラクター";
    charImg.onerror = () => {
      if (charImg.src !== "assets/visual/standing/sample.png") {
        charImg.src = "assets/visual/standing/sample.png";
      }
    };
    visualWrap.appendChild(charImg);
    heroInner.appendChild(visualWrap);

    bannerHero.appendChild(heroInner);
    mainContainer.appendChild(bannerHero);

    // 2. 下部2カラムコンテンツグリッド
    const contentGrid = document.createElement("div");
    contentGrid.className = "lp-profile-banner-content-grid";

    // --- 左カラム (キャッチフレーズ、自己紹介、2カラムカード) ---
    const leftCol = document.createElement("div");
    leftCol.className = "lp-profile-banner-left-col";

    // キャッチフレーズ (立ち絵表示形式と同じ: 一番左に縦線のみの引用表示)
    const phraseText = (this.profile.comment && String(this.profile.comment).trim()) || "サンプルキャッチフレーズ";
    const phraseQuote = document.createElement("blockquote");
    phraseQuote.className = "lp-profile-quote-block lp-profile-catchphrase-quote";
    phraseQuote.innerHTML = `
      <span class="lp-profile-quote-mark start">“</span>
      <span class="lp-profile-quote-text">${escapeHtml(phraseText)}</span>
      <span class="lp-profile-quote-mark end">”</span>
    `;
    leftCol.appendChild(phraseQuote);

    // 自己紹介 (立ち絵表示形式と同じ: 一番左に縦線のみの引用表示)
    const introText = (this.profile.message && String(this.profile.message).trim()) || "サンプル 自己紹介";
    const msgQuote = document.createElement("blockquote");
    msgQuote.className = "lp-profile-quote-block lp-profile-message-quote";
    msgQuote.innerHTML = `
      <div class="lp-profile-message-quote-inner">
        <p class="lp-profile-message-quote-text">${escapeHtml(introText)}</p>
      </div>
    `;
    leftCol.appendChild(msgQuote);

    // スペック＆クレジット (2カラムカード: visual1 の情報を渡す)
    const twoCardsGrid = this.createTwoColCards(visual1);
    leftCol.appendChild(twoCardsGrid);

    contentGrid.appendChild(leftCol);

    // --- 右カラム (SNSが上、動画が下) ---
    const rightCol = document.createElement("div");
    rightCol.className = "lp-profile-banner-right-col";

    // 1. OFFICIAL CHANNELS & PLATFORMS (上に配置)
    const snsBlock = this.createBannerSnsBlock();
    if (snsBlock) {
      rightCol.appendChild(snsBlock);
    }

    // 2. INTRO MOVIES (下に配置)
    const movesBlock = this.createBannerMovesBlock();
    if (movesBlock) {
      rightCol.appendChild(movesBlock);
    }

    contentGrid.appendChild(rightCol);
    mainContainer.appendChild(contentGrid);

    this.container.appendChild(mainContainer);
  }

  /**
   * =========================================================================
   * ② 立ち絵形式 (sectionType === "standing")
   * =========================================================================
   */
  renderStandingLayout(currentVisual) {
    const grid = document.createElement("div");
    grid.className = `lp-profile-grid lp-profile-type-${this.sectionType}`;

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
    const twoColCards = this.createTwoColCards(currentVisual);
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
        const costumeTabsWrapper = document.createElement("div");
        costumeTabsWrapper.className = `lp-costume-slider-wrapper${this.visuals.length <= 3 ? " no-scroll" : ""}`;

        // 上/左へスクロール矢印ボタン（PC時は◀、スマホ時は▲）
        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "lp-costume-arrow-btn prev";
        upBtn.setAttribute("aria-label", "前の衣装サムネイル");
        upBtn.innerHTML = `
          <svg class="lp-arrow-icon-desktop" viewBox="0 0 24 60" width="28" height="64" fill="currentColor" aria-hidden="true">
            <path d="M 22 4 L 4 30 L 22 56 Z" />
          </svg>
          <svg class="lp-arrow-icon-mobile" viewBox="0 0 36 14" width="34" height="13" fill="currentColor" aria-hidden="true">
            <path d="M 2 12 L 34 12 L 18 2 Z" />
          </svg>
        `;

        const costumeTabs = document.createElement("div");
        costumeTabs.className = "lp-costume-tabs-standalone";

        // 下/右へスクロール矢印ボタン（PC時は▶、スマホ時は▼）
        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "lp-costume-arrow-btn next";
        downBtn.setAttribute("aria-label", "次の衣装サムネイル");
        downBtn.innerHTML = `
          <svg class="lp-arrow-icon-desktop" viewBox="0 0 24 60" width="28" height="64" fill="currentColor" aria-hidden="true">
            <path d="M 2 4 L 20 30 L 2 56 Z" />
          </svg>
          <svg class="lp-arrow-icon-mobile" viewBox="0 0 36 14" width="34" height="13" fill="currentColor" aria-hidden="true">
            <path d="M 2 2 L 34 2 L 18 12 Z" />
          </svg>
        `;

        const isHorizontal = () => typeof window !== "undefined" && window.innerWidth > 900;

        upBtn.onclick = (e) => {
          e.stopPropagation();
          if (isHorizontal()) {
            costumeTabs.scrollBy({ left: -160, behavior: "smooth" });
          } else {
            const step = window.innerWidth <= 600 ? 66 : 74;
            costumeTabs.scrollBy({ top: -step, behavior: "smooth" });
          }
        };
        downBtn.onclick = (e) => {
          e.stopPropagation();
          if (isHorizontal()) {
            costumeTabs.scrollBy({ left: 160, behavior: "smooth" });
          } else {
            const step = window.innerWidth <= 600 ? 66 : 74;
            costumeTabs.scrollBy({ top: step, behavior: "smooth" });
          }
        };

        const updateArrows = () => {
          if (this.visuals.length <= 3) return;
          if (isHorizontal()) {
            const { scrollLeft, scrollWidth, clientWidth } = costumeTabs;
            upBtn.disabled = scrollLeft <= 2;
            downBtn.disabled = scrollLeft + clientWidth >= scrollWidth - 2;
          } else {
            const { scrollTop, scrollHeight, clientHeight } = costumeTabs;
            upBtn.disabled = scrollTop <= 2;
            downBtn.disabled = scrollTop + clientHeight >= scrollHeight - 2;
          }
        };
        costumeTabs.addEventListener("scroll", updateArrows, { passive: true });
        window.addEventListener("resize", updateArrows, { passive: true });

        // PC時のマウスホイールによる横スクロール対応
        costumeTabs.addEventListener(
          "wheel",
          (e) => {
            if (isHorizontal() && e.deltaY !== 0) {
              e.preventDefault();
              costumeTabs.scrollLeft += e.deltaY;
            }
          },
          { passive: false }
        );

        setTimeout(updateArrows, 60);

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

        costumeTabsWrapper.appendChild(upBtn);
        costumeTabsWrapper.appendChild(costumeTabs);
        costumeTabsWrapper.appendChild(downBtn);
        visualCol.appendChild(costumeTabsWrapper);
      }
    }

    grid.appendChild(visualCol);
    this.container.appendChild(grid);
  }

  /**
   * ⑤ & ⑥ 横並びの2カラムカード (SPECS & CREDITS)
   */
  createTwoColCards(currentVisual) {
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

    return twoColCards;
  }

  /**
   * バナー形式用 INTRO MOVIES ブロック (カンプ通り確実に表示)
   */
  createBannerMovesBlock() {
    const validMoves = Array.isArray(this.profile.moves)
      ? this.profile.moves.filter((url) => Boolean(url && String(url).trim()))
      : [];

    const block = document.createElement("div");
    block.className = "lp-profile-banner-movie-section";
    block.innerHTML = `<div class="lp-banner-moves-title">✦ INTRO MOVIES ✦</div>`;

    if (validMoves.length <= 1) {
      const videoUrl = validMoves[0] || "";
      const ytInfo = videoUrl ? getYouTubeInfo(videoUrl) : null;
      const thumbSrc = ytInfo ? ytInfo.thumbUrl : "assets/movie/sample.png";

      const card = document.createElement("div");
      card.className = "lp-profile-banner-movie-card";
      card.innerHTML = `
        <div class="lp-profile-banner-movie-thumb-wrap">
          <img class="lp-profile-banner-movie-thumb" src="${escapeHtml(thumbSrc)}" alt="自己紹介動画" onerror="this.src='assets/movie/sample.png'" loading="lazy" />
          <div class="lp-profile-banner-movie-play-btn">
            <div class="lp-profile-banner-play-icon">▶</div>
          </div>
        </div>
        <div class="lp-profile-banner-movie-title">活動者・配信者</div>
      `;
      card.onclick = () => {
        if (videoUrl) {
          Modal.openVideo(videoUrl, `自己紹介ムービー`);
        } else {
          Modal.openVideo("https://www.youtube.com/watch?v=sample", `自己紹介ムービー (サンプル)`);
        }
      };
      block.appendChild(card);
    } else {
      const sliderContainer = document.createElement("div");
      sliderContainer.className = "lp-profile-banner-moves-slider-container";

      const sliderViewport = document.createElement("div");
      sliderViewport.className = "lp-profile-banner-moves-slider-viewport";

      const sliderTrack = document.createElement("div");
      sliderTrack.className = "lp-profile-banner-moves-slider-track";

      validMoves.forEach((videoUrl, idx) => {
        const card = document.createElement("div");
        card.className = "lp-profile-movie-item lp-profile-banner-movie-card";

        const ytInfo = getYouTubeInfo(videoUrl);
        const thumbSrc = ytInfo ? ytInfo.thumbUrl : "assets/movie/sample.png";

        card.innerHTML = `
          <div class="lp-profile-banner-movie-thumb-wrap">
            <img class="lp-profile-banner-movie-thumb" src="${escapeHtml(thumbSrc)}" alt="自己紹介動画 #${idx + 1}" onerror="this.src='assets/movie/sample.png'" loading="lazy" />
            <div class="lp-profile-banner-movie-play-btn">
              <div class="lp-profile-banner-play-icon">▶</div>
            </div>
          </div>
          <div class="lp-profile-banner-movie-title">活動者・配信者</div>
        `;
        card.onclick = () => {
          Modal.openVideo(videoUrl, `自己紹介ムービー`);
        };
        sliderTrack.appendChild(card);
      });

      sliderViewport.appendChild(sliderTrack);
      sliderContainer.appendChild(sliderViewport);

      let currentIndex = 0;
      const totalSlides = validMoves.length;
      const updateSlide = (newIndex) => {
        currentIndex = (newIndex + totalSlides) % totalSlides;
        sliderTrack.style.transform = `translateX(-${currentIndex * 100}%)`;
        const dots = sliderContainer.querySelectorAll(".lp-banner-moves-slider-dot");
        dots.forEach((dot, dIdx) => {
          dot.classList.toggle("is-active", dIdx === currentIndex);
        });
      };

      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "lp-banner-moves-slider-arrow prev";
      prevBtn.setAttribute("aria-label", "前の動画");
      prevBtn.innerHTML = "‹";
      prevBtn.onclick = (e) => {
        e.stopPropagation();
        updateSlide(currentIndex - 1);
      };

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "lp-banner-moves-slider-arrow next";
      nextBtn.setAttribute("aria-label", "次の動画");
      nextBtn.innerHTML = "›";
      nextBtn.onclick = (e) => {
        e.stopPropagation();
        updateSlide(currentIndex + 1);
      };

      sliderContainer.appendChild(prevBtn);
      sliderContainer.appendChild(nextBtn);

      const dotsWrap = document.createElement("div");
      dotsWrap.className = "lp-banner-moves-slider-dots";
      for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `lp-banner-moves-slider-dot${i === 0 ? " is-active" : ""}`;
        dot.setAttribute("aria-label", `動画 ${i + 1}`);
        dot.onclick = (e) => {
          e.stopPropagation();
          updateSlide(i);
        };
        dotsWrap.appendChild(dot);
      }
      sliderContainer.appendChild(dotsWrap);
      block.appendChild(sliderContainer);
    }

    return block;
  }

  /**
   * バナー形式用 OFFICIAL CHANNELS & PLATFORMS ブロック (カンプ通り確実に表示)
   */
  createBannerSnsBlock() {
    const isSafeUrl = (url) => {
      if (!url || typeof url !== "string") return false;
      const lower = url.trim().toLowerCase();
      return lower.startsWith("http://") || lower.startsWith("https://");
    };

    const hasYt = this.profile.youtubeUrl && isSafeUrl(this.profile.youtubeUrl);
    const hasX = this.profile.xUrl && isSafeUrl(this.profile.xUrl);
    const platforms = Array.isArray(this.profile.platforms)
      ? this.profile.platforms.filter((p) => p && p.link && isSafeUrl(p.link))
      : [];

    const block = document.createElement("div");
    block.className = "lp-profile-banner-sns-section";
    block.innerHTML = `<div class="lp-banner-channels-title">✦ OFFICIAL CHANNELS & PLATFORMS ✦</div>`;

    const snsBtns = document.createElement("div");
    snsBtns.className = "lp-banner-channels-btn-group";

    // 1. YouTube ボタン (赤)
    const ytBtn = document.createElement("a");
    ytBtn.className = "lp-banner-channel-btn lp-btn-youtube";
    ytBtn.href = hasYt ? this.profile.youtubeUrl : "https://youtube.com";
    ytBtn.target = "_blank";
    ytBtn.rel = "noopener noreferrer";
    ytBtn.innerHTML = `<span>▶ YouTube Channel</span>`;
    snsBtns.appendChild(ytBtn);

    // 2. Official X ボタン (黒)
    const xBtn = document.createElement("a");
    xBtn.className = "lp-banner-channel-btn lp-btn-x";
    xBtn.href = hasX ? this.profile.xUrl : "https://x.com";
    xBtn.target = "_blank";
    xBtn.rel = "noopener noreferrer";
    xBtn.innerHTML = `<span>𝕏 Official X</span>`;
    snsBtns.appendChild(xBtn);

    // 3. プラットフォーム (設定がある場合はそれを表示、未設定ならカンプ通りTikTokボタンを表示)
    if (platforms.length > 0) {
      platforms.forEach((p) => {
        const pBtn = document.createElement("a");
        pBtn.className = "lp-banner-channel-btn lp-btn-platform";
        pBtn.href = p.link;
        pBtn.target = "_blank";
        pBtn.rel = "noopener noreferrer";
        pBtn.textContent = p.name || "Platform";
        snsBtns.appendChild(pBtn);
      });
    } else {
      const ttBtn = document.createElement("a");
      ttBtn.className = "lp-banner-channel-btn lp-btn-tiktok";
      ttBtn.href = "https://www.tiktok.com";
      ttBtn.target = "_blank";
      ttBtn.rel = "noopener noreferrer";
      ttBtn.textContent = "TikTok";
      snsBtns.appendChild(ttBtn);
    }

    block.appendChild(snsBtns);
    return block;
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

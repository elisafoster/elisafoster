/**
 * Movie Section Component (ANTIGRAVITY.md 規約準拠)
 * - カテゴリー別表示（デフォルト）: 各カテゴリーごとに1行スライド（左右矢印・ドラッグ・スワイプ対応）、wide/tall 比率対応、カテゴリー内動画に存在するタグのみ表示
 * - 一覧表示: 3列3行（最大9件/ページ）のグリッド + ページネーション、カテゴリー選択時はそのカテゴリー内の動画に存在するタグのみ表示
 * - サムネイル自動取得: YouTube / YouTube Shorts / TikTok（未設定時の自動フォールバックと非同期差し替え）
 * - 動画再生モーダル: YouTube Shorts / TikTok の縦長 embed 再生および外部リンク対応
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

// TikTok用 SVG プレースホルダー (Data URI)
const TIKTOK_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1280" width="720" height="1280"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23010101"/><stop offset="50%" stop-color="%23121212"/><stop offset="100%" stop-color="%231a1a1a"/></linearGradient><linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%2325F4EE"/><stop offset="100%" stop-color="%23FE2C55"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23bg)"/><circle cx="360" cy="560" r="160" fill="%2325F4EE" opacity="0.12"/><circle cx="380" cy="580" r="160" fill="%23FE2C55" opacity="0.12"/><g transform="translate(240, 430) scale(4)"><path fill="%2325F4EE" d="M38.5 13.5c-2.8-.5-5.2-1.9-6.9-4-1.2-1.5-1.9-3.3-2-5.3V4h-6v26.5c0 3-2.5 5.5-5.5 5.5s-5.5-2.5-5.5-5.5 2.5-5.5 5.5-5.5c.6 0 1.2.1 1.8.3v-6.2c-.6-.1-1.2-.1-1.8-.1-6.4 0-11.5 5.1-11.5 11.5S11.7 41.7 18.1 41.7s11.5-5.1 11.5-11.5V17.7c3 2.1 6.6 3.4 10.5 3.6v-6.2c-.5-.8-1-1.2-1.6-1.6z" opacity="0.85"/><path fill="%23FE2C55" d="M40.5 14.5c-2.8-.5-5.2-1.9-6.9-4-1.2-1.5-1.9-3.3-2-5.3V5h-6v26.5c0 3-2.5 5.5-5.5 5.5s-5.5-2.5-5.5-5.5 2.5-5.5 5.5-5.5c.6 0 1.2.1 1.8.3V20.6c-.6-.1-1.2-.1-1.8-.1-6.4 0-11.5 5.1-11.5 11.5S13.7 43.5 20.1 43.5s11.5-5.1 11.5-11.5V18.7c3 2.1 6.6 3.4 10.5 3.6v-6.2c-.5-.8-1-1.2-1.6-1.6z" opacity="0.85"/><path fill="%23ffffff" d="M39.5 14c-2.8-.5-5.2-1.9-6.9-4-1.2-1.5-1.9-3.3-2-5.3V4.5h-6V31c0 3-2.5 5.5-5.5 5.5s-5.5-2.5-5.5-5.5 2.5-5.5 5.5-5.5c.6 0 1.2.1 1.8.3v-6.2c-.6-.1-1.2-.1-1.8-.1-6.4 0-11.5 5.1-11.5 11.5s5.1 11.5 11.5 11.5 11.5-5.1 11.5-11.5V18.2c3 2.1 6.6 3.4 10.5 3.6v-6.2c-.5-.8-1-1.2-1.6-1.6z"/></g><text x="360" y="780" fill="%23ffffff" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="40" font-weight="bold" text-anchor="middle" letter-spacing="4">TikTok Video</text><rect x="260" y="830" width="200" height="4" rx="2" fill="url(%23accent)"/></svg>`;

// 汎用動画 SVG プレースホルダー (Data URI)
const GENERIC_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360"><rect width="100%" height="100%" fill="%231e293b"/><circle cx="320" cy="180" r="44" fill="%233b82f6" opacity="0.25"/><polygon points="312,162 338,180 312,198" fill="%23ffffff"/></svg>`;

// TikTok oEmbed キャッシュ
const tiktokOembedCache = new Map();

export class MovieSection {
  constructor(container, movieList, categoryList, tagList, playlistList) {
    this.container = container;
    this.movies = (Array.isArray(movieList) ? movieList : [])
      .filter((m) => m.is_active === 1 || m.is_active === true || m.is_active === undefined);
    this.categories = (Array.isArray(categoryList) ? categoryList : [])
      .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.playlists = Array.isArray(playlistList) ? playlistList : [];

    // 表示モード: デフォルトは「カテゴリー表示」
    this.viewMode = "category"; // "category" または "list"

    // カテゴリー表示モード用: 各カテゴリーの選択中タグ { [catId]: "ALL" | tagId }
    this.categoryTagFilters = {};

    // 一覧表示モード用: カテゴリー・タグ・ページ管理
    this.listSelectedCategoryId = "ALL";
    this.listSelectedTagId = "ALL";
    this.listCurrentPage = 1;
    this.itemsPerPage = 9; // 3列3行 = 最大9件
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.movies.length === 0) {
      this.container.innerHTML = '<p class="lp-movie-empty-msg">動画がありません</p>';
      return;
    }

    const mainWrapper = document.createElement("div");
    mainWrapper.className = "lp-movie-container";

    // 1. 表示形式切り替えヘッダーバー (カテゴリー別 / 一覧)
    const headerBar = document.createElement("div");
    headerBar.className = "lp-movie-header-bar";

    const switcher = document.createElement("div");
    switcher.className = "lp-movie-view-switcher";
    switcher.setAttribute("role", "tablist");
    switcher.setAttribute("aria-label", "表示形式切り替え");

    // カテゴリー別ボタン (デフォルト)
    const categoryBtn = document.createElement("button");
    categoryBtn.className = `lp-movie-view-btn ${this.viewMode === "category" ? "is-active" : ""}`;
    categoryBtn.type = "button";
    categoryBtn.setAttribute("role", "tab");
    categoryBtn.setAttribute("aria-selected", this.viewMode === "category" ? "true" : "false");
    categoryBtn.innerHTML = `
      <svg class="lp-movie-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
      <span>カテゴリー別</span>
    `;
    categoryBtn.onclick = () => {
      if (this.viewMode === "category") return;
      this.viewMode = "category";
      this.updateSwitcherState(categoryBtn, listBtn);
      this.renderContent(contentArea);
    };

    // 一覧ボタン
    const listBtn = document.createElement("button");
    listBtn.className = `lp-movie-view-btn ${this.viewMode === "list" ? "is-active" : ""}`;
    listBtn.type = "button";
    listBtn.setAttribute("role", "tab");
    listBtn.setAttribute("aria-selected", this.viewMode === "list" ? "true" : "false");
    listBtn.innerHTML = `
      <svg class="lp-movie-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span>一覧</span>
    `;
    listBtn.onclick = () => {
      if (this.viewMode === "list") return;
      this.viewMode = "list";
      this.updateSwitcherState(categoryBtn, listBtn);
      this.renderContent(contentArea);
    };

    switcher.appendChild(categoryBtn);
    switcher.appendChild(listBtn);
    headerBar.appendChild(switcher);
    mainWrapper.appendChild(headerBar);

    // 2. コンテンツ描画エリア
    const contentArea = document.createElement("div");
    contentArea.className = "lp-movie-content-area";
    mainWrapper.appendChild(contentArea);

    this.container.appendChild(mainWrapper);

    // 初回コンテンツ描画
    this.renderContent(contentArea);
  }

  updateSwitcherState(categoryBtn, listBtn) {
    if (this.viewMode === "category") {
      categoryBtn.classList.add("is-active");
      categoryBtn.setAttribute("aria-selected", "true");
      listBtn.classList.remove("is-active");
      listBtn.setAttribute("aria-selected", "false");
    } else {
      listBtn.classList.add("is-active");
      listBtn.setAttribute("aria-selected", "true");
      categoryBtn.classList.remove("is-active");
      categoryBtn.setAttribute("aria-selected", "false");
    }
  }

  renderContent(contentArea) {
    contentArea.innerHTML = "";

    if (this.viewMode === "category") {
      this.renderCategoryMode(contentArea);
    } else {
      this.renderListMode(contentArea);
    }
  }

  /**
   * 動画リストから使用されているタグのみを重複なく抽出
   */
  getTagsForMovies(movies) {
    const tagIdSet = new Set();
    movies.forEach((m) => {
      if (m.movieTag_id !== null && m.movieTag_id !== undefined && String(m.movieTag_id).trim() !== "") {
        tagIdSet.add(String(m.movieTag_id));
      }
    });

    return this.tags.filter((t) => tagIdSet.has(String(t.id)));
  }

  /**
   * =========================================================================
   * ① カテゴリー別表示モード (デフォルト)
   * - 全体カテゴリータブは非表示
   * - カテゴリー毎に1行スライド（wide/tall アスペクト比対応）
   * - タグ表示は各カテゴリーごとに、そのカテゴリーの動画に紐づくタグのみ表示
   * =========================================================================
   */
  renderCategoryMode(contentArea) {
    if (this.categories.length === 0) {
      contentArea.innerHTML = '<p class="lp-movie-empty-msg">カテゴリーが設定されていません</p>';
      return;
    }

    let renderedCount = 0;

    this.categories.forEach((cat) => {
      const catId = String(cat.id);
      const catMovies = this.movies.filter((m) => String(m.movieCategory_id) === catId);

      // 動画が0件のカテゴリーは表示をスキップ
      if (catMovies.length === 0) return;
      renderedCount++;

      const isTall = cat.aspectRatio === "tall";

      const groupEl = document.createElement("div");
      groupEl.className = "lp-movie-category-group";

      // カテゴリーヘッダー (見出し + そのカテゴリーの動画タグ)
      const headerEl = document.createElement("div");
      headerEl.className = "lp-movie-category-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "lp-movie-category-title-wrap";

      const titleEl = document.createElement("h3");
      titleEl.className = "lp-movie-category-title";
      titleEl.textContent = cat.categoryName;
      titleWrap.appendChild(titleEl);

      const countBadge = document.createElement("span");
      countBadge.className = "lp-movie-category-count-badge";
      countBadge.textContent = `${catMovies.length}本`;
      titleWrap.appendChild(countBadge);

      headerEl.appendChild(titleWrap);

      // カテゴリーに設定されている動画のタグのみを抽出
      const availableTags = this.getTagsForMovies(catMovies);

      // 初期化
      if (!this.categoryTagFilters[catId]) {
        this.categoryTagFilters[catId] = "ALL";
      }

      // タグが存在する場合のみタグフィルターバーを表示
      if (availableTags.length > 0) {
        const tagBar = document.createElement("div");
        tagBar.className = "lp-movie-category-tags";

        const allBtn = document.createElement("button");
        allBtn.className = `lp-movie-category-tag-btn ${this.categoryTagFilters[catId] === "ALL" ? "is-active" : ""}`;
        allBtn.type = "button";
        allBtn.textContent = "すべて";
        allBtn.onclick = () => {
          this.categoryTagFilters[catId] = "ALL";
          this.refreshCategorySlider(sliderContainer, cat, catMovies);
          this.updateCategoryTagButtons(tagBar, catId);
        };
        tagBar.appendChild(allBtn);

        availableTags.forEach((tag) => {
          const tId = String(tag.id);
          const btn = document.createElement("button");
          btn.className = `lp-movie-category-tag-btn ${this.categoryTagFilters[catId] === tId ? "is-active" : ""}`;
          btn.type = "button";
          btn.textContent = `#${tag.tagName}`;
          btn.onclick = () => {
            this.categoryTagFilters[catId] = tId;
            this.refreshCategorySlider(sliderContainer, cat, catMovies);
            this.updateCategoryTagButtons(tagBar, catId);
          };
          tagBar.appendChild(btn);
        });

        headerEl.appendChild(tagBar);
      }

      groupEl.appendChild(headerEl);

      // 1行スライダーコンテナ
      const sliderContainer = document.createElement("div");
      sliderContainer.className = "lp-movie-slider-container";
      this.refreshCategorySlider(sliderContainer, cat, catMovies);
      groupEl.appendChild(sliderContainer);

      contentArea.appendChild(groupEl);
    });

    if (renderedCount === 0) {
      contentArea.innerHTML = '<p class="lp-movie-empty-msg">該当する動画はありません</p>';
    }
  }

  updateCategoryTagButtons(tagBar, catId) {
    const activeVal = this.categoryTagFilters[catId] || "ALL";
    const buttons = tagBar.querySelectorAll(".lp-movie-category-tag-btn");
    buttons.forEach((btn, idx) => {
      if (idx === 0) {
        btn.classList.toggle("is-active", activeVal === "ALL");
      } else {
        const text = btn.textContent.replace(/^#/, "");
        const tag = this.tags.find((t) => t.tagName === text);
        if (tag) {
          btn.classList.toggle("is-active", activeVal === String(tag.id));
        }
      }
    });
  }

  /**
   * カテゴリー別スライダーのトラック再構築
   */
  refreshCategorySlider(container, category, categoryMovies) {
    container.innerHTML = "";

    const catId = String(category.id);
    const selectedTag = this.categoryTagFilters[catId] || "ALL";
    const isTall = category.aspectRatio === "tall";

    const filtered = selectedTag === "ALL"
      ? categoryMovies
      : categoryMovies.filter((m) => String(m.movieTag_id) === selectedTag);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "lp-movie-empty-msg";
      empty.textContent = "このタグに該当する動画はありません";
      container.appendChild(empty);
      return;
    }

    // 左右ナビゲーション矢印
    const prevBtn = document.createElement("button");
    prevBtn.className = "lp-movie-slider-arrow lp-movie-arrow-prev";
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "前へスクロール");
    prevBtn.innerHTML = `‹`;

    const nextBtn = document.createElement("button");
    nextBtn.className = "lp-movie-slider-arrow lp-movie-arrow-next";
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "次へスクロール");
    nextBtn.innerHTML = `›`;

    // 1行トラック
    const track = document.createElement("div");
    track.className = "lp-movie-slider-track";

    // スライダー操作の初期化（ドラッグ・スワイプ・矢印対応）
    const getHasDragged = this.setupSliderInteractions(track, prevBtn, nextBtn, isTall);

    filtered.forEach((movie) => {
      const card = this.createMovieCard(movie, category, { isSlide: true, getHasDragged });
      track.appendChild(card);
    });

    container.appendChild(prevBtn);
    container.appendChild(track);
    container.appendChild(nextBtn);
  }

  /**
   * =========================================================================
   * ② 一覧表示モード
   * - カテゴリータブを表示（すべて＋各カテゴリー）
   * - カテゴリータブ選択時は、選択カテゴリーの動画に紐づくタグのみを表示
   * - 3列3行（最大9件/ページ）のグリッド + ページネーション
   * =========================================================================
   */
  renderListMode(contentArea) {
    const listWrap = document.createElement("div");
    listWrap.className = "lp-movie-list-wrap";

    // 1. カテゴリー切り替えタブ
    const catBar = document.createElement("div");
    catBar.className = "lp-movie-list-categories";

    const allCatBtn = document.createElement("button");
    allCatBtn.className = `lp-movie-list-cat-btn ${this.listSelectedCategoryId === "ALL" ? "is-active" : ""}`;
    allCatBtn.type = "button";
    allCatBtn.textContent = "すべて";
    allCatBtn.onclick = () => {
      this.listSelectedCategoryId = "ALL";
      this.listSelectedTagId = "ALL";
      this.listCurrentPage = 1;
      this.renderListMode(contentArea);
    };
    catBar.appendChild(allCatBtn);

    this.categories.forEach((cat) => {
      const cId = String(cat.id);
      const btn = document.createElement("button");
      btn.className = `lp-movie-list-cat-btn ${this.listSelectedCategoryId === cId ? "is-active" : ""}`;
      btn.type = "button";
      btn.textContent = cat.categoryName;
      btn.onclick = () => {
        this.listSelectedCategoryId = cId;
        this.listSelectedTagId = "ALL";
        this.listCurrentPage = 1;
        this.renderListMode(contentArea);
      };
      catBar.appendChild(btn);
    });

    listWrap.appendChild(catBar);

    // 2. 選択中カテゴリーの動画に紐づくタグのみを抽出
    const targetMoviesForTags = this.listSelectedCategoryId === "ALL"
      ? this.movies
      : this.movies.filter((m) => String(m.movieCategory_id) === this.listSelectedCategoryId);

    const availableTags = this.getTagsForMovies(targetMoviesForTags);

    // もし現在選択中のタグが抽出タグに含まれていなければ "ALL" にリセット
    if (this.listSelectedTagId !== "ALL" && !availableTags.some((t) => String(t.id) === this.listSelectedTagId)) {
      this.listSelectedTagId = "ALL";
    }

    if (availableTags.length > 0) {
      const tagBar = document.createElement("div");
      tagBar.className = "lp-movie-list-filters";

      const allTagBtn = document.createElement("button");
      allTagBtn.className = `lp-movie-list-tag-btn ${this.listSelectedTagId === "ALL" ? "is-active" : ""}`;
      allTagBtn.type = "button";
      allTagBtn.textContent = "全タグ";
      allTagBtn.onclick = () => {
        this.listSelectedTagId = "ALL";
        this.listCurrentPage = 1;
        this.renderListItems(gridContainer, paginationContainer);
        this.updateListTagButtons(tagBar);
      };
      tagBar.appendChild(allTagBtn);

      availableTags.forEach((tag) => {
        const tId = String(tag.id);
        const btn = document.createElement("button");
        btn.className = `lp-movie-list-tag-btn ${this.listSelectedTagId === tId ? "is-active" : ""}`;
        btn.type = "button";
        btn.textContent = `#${tag.tagName}`;
        btn.onclick = () => {
          this.listSelectedTagId = tId;
          this.listCurrentPage = 1;
          this.renderListItems(gridContainer, paginationContainer);
          this.updateListTagButtons(tagBar);
        };
        tagBar.appendChild(btn);
      });

      listWrap.appendChild(tagBar);
    }

    // 3. 動画グリッドコンテナ
    const gridContainer = document.createElement("div");
    gridContainer.className = "lp-movie-grid";
    listWrap.appendChild(gridContainer);

    // 4. ページネーションコンテナ
    const paginationContainer = document.createElement("div");
    paginationContainer.className = "lp-movie-pagination-wrap";
    listWrap.appendChild(paginationContainer);

    contentArea.appendChild(listWrap);

    // アイテム描画
    this.renderListItems(gridContainer, paginationContainer);
  }

  updateListTagButtons(tagBar) {
    const buttons = tagBar.querySelectorAll(".lp-movie-list-tag-btn");
    buttons.forEach((btn, idx) => {
      if (idx === 0) {
        btn.classList.toggle("is-active", this.listSelectedTagId === "ALL");
      } else {
        const text = btn.textContent.replace(/^#/, "");
        const tag = this.tags.find((t) => t.tagName === text);
        if (tag) {
          btn.classList.toggle("is-active", this.listSelectedTagId === String(tag.id));
        }
      }
    });
  }

  /**
   * 一覧表示のアイテム描画（3列3行 = 最大9件 + ページネーション）
   */
  renderListItems(gridContainer, paginationContainer) {
    gridContainer.innerHTML = "";
    paginationContainer.innerHTML = "";

    let filtered = this.movies;
    if (this.listSelectedCategoryId !== "ALL") {
      filtered = filtered.filter((m) => String(m.movieCategory_id) === this.listSelectedCategoryId);
    }
    if (this.listSelectedTagId !== "ALL") {
      filtered = filtered.filter((m) => String(m.movieTag_id) === this.listSelectedTagId);
    }

    if (filtered.length === 0) {
      gridContainer.innerHTML = '<p class="lp-movie-empty-msg">該当する動画はありません</p>';
      return;
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

    if (this.listCurrentPage > totalPages) this.listCurrentPage = totalPages;
    if (this.listCurrentPage < 1) this.listCurrentPage = 1;

    const startIndex = (this.listCurrentPage - 1) * this.itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    pageItems.forEach((movie) => {
      const cat = this.categories.find((c) => String(c.id) === String(movie.movieCategory_id));
      const card = this.createMovieCard(movie, cat, { isSlide: false });
      gridContainer.appendChild(card);
    });

    // ページネーション（2ページ以上存在する場合のみ描画）
    if (totalPages > 1) {
      const pagination = document.createElement("nav");
      pagination.className = "lp-movie-pagination";
      pagination.setAttribute("aria-label", "動画一覧ページネーション");

      // 前へ
      const prevBtn = document.createElement("button");
      prevBtn.className = "lp-movie-page-btn lp-movie-page-prev";
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "前のページ");
      prevBtn.innerHTML = `‹`;
      prevBtn.disabled = this.listCurrentPage === 1;
      prevBtn.onclick = () => {
        if (this.listCurrentPage > 1) {
          this.listCurrentPage--;
          this.renderListItems(gridContainer, paginationContainer);
        }
      };
      pagination.appendChild(prevBtn);

      // ページ番号ボタン
      const pageNumbers = document.createElement("div");
      pageNumbers.className = "lp-movie-page-numbers";

      for (let p = 1; p <= totalPages; p++) {
        const numBtn = document.createElement("button");
        numBtn.className = `lp-movie-page-num ${p === this.listCurrentPage ? "is-active" : ""}`;
        numBtn.type = "button";
        numBtn.setAttribute("aria-label", `ページ ${p}`);
        numBtn.textContent = String(p);
        numBtn.onclick = () => {
          if (this.listCurrentPage !== p) {
            this.listCurrentPage = p;
            this.renderListItems(gridContainer, paginationContainer);
          }
        };
        pageNumbers.appendChild(numBtn);
      }
      pagination.appendChild(pageNumbers);

      // 次へ
      const nextBtn = document.createElement("button");
      nextBtn.className = "lp-movie-page-btn lp-movie-page-next";
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "次のページ");
      nextBtn.innerHTML = `›`;
      nextBtn.disabled = this.listCurrentPage === totalPages;
      nextBtn.onclick = () => {
        if (this.listCurrentPage < totalPages) {
          this.listCurrentPage++;
          this.renderListItems(gridContainer, paginationContainer);
        }
      };
      pagination.appendChild(nextBtn);

      paginationContainer.appendChild(pagination);
    }
  }

  /**
   * =========================================================================
   * カード要素生成（wide / tall 対応、サムネイル自動取得）
   * =========================================================================
   */
  createMovieCard(movie, category, { isSlide = false, getHasDragged = null } = {}) {
    const isTall = category?.aspectRatio === "tall";

    const card = document.createElement("div");
    card.className = [
      "lp-movie-card",
      isSlide ? "is-slide-item" : "",
      isTall ? "is-tall" : "is-wide",
    ].filter(Boolean).join(" ");

    // サムネイルラッパー
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = `lp-movie-thumb-wrapper ${isTall ? "is-tall" : "is-wide"}`;

    const thumbImg = document.createElement("img");
    thumbImg.className = "lp-movie-thumb-img";
    thumbImg.alt = "動画サムネイル";
    thumbImg.loading = "lazy";

    // サムネイルの自動取得とセット
    this.resolveAndApplyThumbnail(thumbImg, movie);
    thumbWrapper.appendChild(thumbImg);

    // 再生ボタン
    const playBtn = document.createElement("div");
    playBtn.className = "lp-movie-play-btn";
    playBtn.innerHTML = '<div class="lp-movie-play-icon">▶</div>';
    thumbWrapper.appendChild(playBtn);

    // クリックで動画再生モーダルを表示
    thumbWrapper.onclick = () => {
      if (typeof getHasDragged === "function" && getHasDragged()) return;
      Modal.openVideo(movie.movieUrl, category?.categoryName || "動画再生", {
        isTall,
        aspectRatio: category?.aspectRatio || "wide",
      });
    };

    card.appendChild(thumbWrapper);

    // メタ情報 (カテゴリーバッジ / タグバッジ)
    const info = document.createElement("div");
    info.className = "lp-movie-info";

    const tagsList = document.createElement("div");
    tagsList.className = "lp-movie-tags-list";

    if (category) {
      const catBadge = document.createElement("span");
      catBadge.className = "app-badge app-badge-primary";
      catBadge.textContent = category.categoryName;
      tagsList.appendChild(catBadge);
    }

    const tagObj = this.tags.find((t) => String(t.id) === String(movie.movieTag_id));
    if (tagObj) {
      const tagBadge = document.createElement("span");
      tagBadge.className = "app-badge app-badge-gray";
      tagBadge.textContent = `#${tagObj.tagName}`;
      tagsList.appendChild(tagBadge);
    }

    info.appendChild(tagsList);
    card.appendChild(info);

    return card;
  }

  /**
   * サムネイル画像の解決と設定（YouTube / Shorts / TikTok / エラーフォールバック）
   */
  resolveAndApplyThumbnail(imgEl, movie) {
    const rawImage = movie.movieImage;
    const url = movie.movieUrl || "";

    // 1. movieImage が直接指定されている場合
    if (rawImage && String(rawImage).trim() !== "") {
      imgEl.src = api.resolveAssetUrl(rawImage, "movie");
      imgEl.onerror = () => {
        imgEl.src = GENERIC_PLACEHOLDER_SVG;
      };
      return;
    }

    // 2. YouTube (通常 & Shorts)
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      imgEl.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      imgEl.onerror = () => {
        if (imgEl.src.includes("hqdefault.jpg")) {
          imgEl.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        } else {
          imgEl.src = GENERIC_PLACEHOLDER_SVG;
        }
      };
      return;
    }

    // 3. TikTok
    if (url.includes("tiktok.com")) {
      // 初期状態として美しい TikTok ブランドポスターを設定
      imgEl.src = TIKTOK_PLACEHOLDER_SVG;

      // キャッシュにあれば即時適用
      if (tiktokOembedCache.has(url)) {
        const cachedThumb = tiktokOembedCache.get(url);
        if (cachedThumb) imgEl.src = cachedThumb;
        return;
      }

      // 非同期で TikTok oEmbed API からサムネイル取得を試みる
      fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`)
        .then((res) => {
          if (!res.ok) throw new Error("oEmbed request failed");
          return res.json();
        })
        .then((data) => {
          if (data && data.thumbnail_url) {
            tiktokOembedCache.set(url, data.thumbnail_url);
            imgEl.src = data.thumbnail_url;
          }
        })
        .catch(() => {
          // 取得失敗時はプレースホルダーのまま維持
        });
      return;
    }

    // 4. その他/汎用フォールバック
    imgEl.src = GENERIC_PLACEHOLDER_SVG;
  }

  /**
   * スライダーのインタラクション制御（規約第6条: マウスドラッグ、スワイプ、矢印）
   */
  setupSliderInteractions(track, prevBtn, nextBtn, isTall) {
    const getScrollAmount = () => {
      const card = track.querySelector(".lp-movie-card");
      return card ? card.offsetWidth + 20 : (isTall ? 230 : 360);
    };

    prevBtn.onclick = () => {
      track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
    };

    nextBtn.onclick = () => {
      track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
    };

    const updateArrows = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 4) {
        prevBtn.classList.add("is-hidden");
        nextBtn.classList.add("is-hidden");
      } else {
        prevBtn.classList.remove("is-hidden");
        nextBtn.classList.remove("is-hidden");
        prevBtn.disabled = track.scrollLeft <= 5;
        nextBtn.disabled = track.scrollLeft >= maxScroll - 5;
      }
    };

    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows, { passive: true });
    setTimeout(updateArrows, 120);

    // マウスドラッグ操作
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    track.addEventListener("mousedown", (e) => {
      isDown = true;
      hasDragged = false;
      track.classList.add("is-dragging");
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
    });

    track.addEventListener("mouseleave", () => {
      isDown = false;
      track.classList.remove("is-dragging");
    });

    track.addEventListener("mouseup", () => {
      isDown = false;
      track.classList.remove("is-dragging");
    });

    track.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 1.5;
      if (Math.abs(walk) > 5) {
        hasDragged = true;
      }
      track.scrollLeft = scrollLeft - walk;
    });

    return () => hasDragged;
  }
}

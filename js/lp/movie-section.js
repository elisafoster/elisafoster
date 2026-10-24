/**
 * Movie Section Component (ANTIGRAVITY.md 規約準拠)
 * - カテゴリー別表示（デフォルト）: カテゴリー毎の1行スライド（左右矢印・ドラッグ・スワイプ対応）、wide/tall 比率対応
 * - 一覧表示: 3列3行（最大9件/ページ）のグリッド + ページネーション、縦長動画の均一サイズ（contain）配置
 * - カテゴリーバー & タグバー（添付画像デザイン準拠）:
 *   ・カテゴリーバー: カプセル状背景、選択中黒ピル、非選択下線
 *   ・タグバー: 独立ピル型チップ、複数選択可能（ブルーグレー背景）
 *   ・横スクロール発生時: 一番左にプルダウン開閉ボタン（「☰ カテゴリ ▼」「# タグ ▼」）を表示
 * - サムネイル自動取得: YouTube / YouTube Shorts / TikTok（未設定時の自動フォールバックと非同期差し替え）
 * - 動画再生モーダル: YouTube Shorts / TikTok の縦長 embed 再生および外部リンク対応
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";
import { escapeHtml } from "../common/utils.js";

// TikTok用 SVG プレースホルダー (Data URI)
const TIKTOK_PLACEHOLDER_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3MjAgMTI4MCIgd2lkdGg9IjcyMCIgaGVpZ2h0PSIxMjgwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDEwMTAxIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMTIxMjEyIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzFhMWExYSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYWNjZW50IiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyNUY0RUUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjRkUyQzU1Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2JnKSIvPgogIDxjaXJjbGUgY3g9IjM2MCIgY3k9IjU2MCIgcj0iMTYwIiBmaWxsPSIjMjVGNEVFIiBvcGFjaXR5PSIwLjEyIi8+CiAgPGNpcmNsZSBjeD0iMzgwIiBjeT0iNTgwIiByPSIxNjAiIGZpbGw9IiNGRTJDNTUiIG9wYWNpdHk9IjAuMTIiLz4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgyNDAsIDQzMCkgc2NhbGUoNCkiPgogICAgPHBhdGggZmlsbD0iIzI1RjRFRSIgZD0iTTM4LjUgMTMuNWMtMi44LS41LTUuMi0xLjktNi45LTQtMS4yLTEuNS0xLjktMy4zLTItNS4zVjRoLTZ2MjYuNWMwIDMtMi41IDUuNS01LjUgNS41cy01LjUtMi41LTUuNS01LjUgMi41LTUuNSA1LjUtNS41Yy42IDAgMS4yLjEgMS44LjN2LTYuMmMtLjYtLjEtMS4yLS4xLTEuOC0uMS02LjQgMC0xMS41IDUuMS0xMS41IDExLjVTMTEuNyA0MS43IDE4LjEgNDEuN3MxMS41LTUuMSAxMS41LTExLjVWMTcuN2MzIDIuMSA2LjYgMy40IDEwLjUgMy42di02LjJjLS41LS44LTEtMS4yLTEuNi0xLjZ6IiBvcGFjaXR5PSIwLjg1Ii8+CiAgICA8cGF0aCBmaWxsPSIjRkUyQzU1IiBkPSJNNDAuNSAxNC41Yy0yLjgtLjUtNS4yLTEuOS02LjktNC0xLjItMS41LTEuOS0zLjMtMi01LjNWNWgtNnYyNi41YzAgMy0yLjUgNS41LTUuNSA1LjVzLTUuNS0yLjUtNS41LTUuNSAyLjUtNS41IDUuNS01LjVjLjYgMCAxLjIuMSAxLjguM1YyMC42Yy0uNi0uMS0xLjItLjEtMS44LS4xLTYuNCAwLTExLjUgNS4xLTExLjUgMTEuNVMxMy43IDQzLjUgMjAuMSA0My41czExLjUtNS4xIDExLjUtMTEuNVYxOC43YzMgMi4xIDYuNiAzLjQgMTAuNSAzLjZ2LTYuMmMtLjUtLjgtMS0xLjItMS42LTEuNnoiIG9wYWNpdHk9IjAuODUiLz4KICAgIDxwYXRoIGZpbGw9IiNmZmZmZmYiIGQ9Ik0zOS41IDE0Yy0yLjgtLjUtNS4yLTEuOS02LjktNC0xLjItMS41LTEuOS0zLjMtMi01LjNWNC41aC02VjMxYzAgMy0yLjUgNS41LTUuNSA1LjVzLTUuNS0yLjUtNS41LTUuNSAyLjUtNS41IDUuNS01LjVjLjYgMCAxLjIuMSAxLjguM3YtNi4yYy0uNi0uMS0xLjItLjEtMS44LS4xLTYuNCAwLTExLjUgNS4xLTExLjUgMTEuNXM1LjEgMTEuNSAxMS41IDExLjUgMTEuNS01LjEgMTEuNS0xMS41VjE4LjJjMyAyLjEgNi42IDMuNCAxMC41IDMuNnYtNi4yYy0uNS0uOC0xLTEuMi0xLjYtMS42eiIvPgogIDwvZz4KICA8dGV4dCB4PSIzNjAiIHk9Ijc4MCIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI0MCIgZm9udC13ZWlnaHQ9ImJvbGQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGxldHRlci1zcGFjaW5nPSI0Ij5UaWtUb2sgVmlkZW88L3RleHQ+CiAgPHJlY3QgeD0iMjYwIiB5PSI4MzAiIHdpZHRoPSIyMDAiIGhlaWdodD0iNCIgcng9IjIiIGZpbGw9InVybCgjYWNjZW50KSIvPgo8L3N2Zz4=";

// 汎用動画 SVG プレースホルダー (Data URI)
const GENERIC_PLACEHOLDER_SVG = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NDAgMzYwIiB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFlMjkzYiIvPjxjaXJjbGUgY3g9IjMyMCIgY3k9IjE4MCIgcj0iNDQiIGZpbGw9IiMzOGJkZjgiIG9wYWNpdHk9IjAuMjUiLz48cG9seWdvbiBwb2ludHM9IjMxMiwxNjIgMzM4LDE4MCAzMTIsMTk4IiBmaWxsPSIjZmZmZmZmIi8+PC9zdmc+";

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

    // カテゴリー表示モード用: 各カテゴリーの選択中タグSet { [catId]: Set<string> }
    this.categoryTagSets = {};

    // 一覧表示モード用: カテゴリー・タグ・ページ管理
    this.listSelectedCategoryId = "ALL";
    this.listSelectedTagSet = new Set(); // 複数選択タグ Set
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

    // 3. 再生リストセクション (動画リストの一番下に配置、表示形式の変更には影響しない)
    const playlistSection = this.renderPlaylistSection();
    if (playlistSection) {
      mainWrapper.appendChild(playlistSection);
    }

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
    if (!contentArea) return;
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
   * プルダウン開閉および外部クリック制御ヘルパー
   */
  setupDropdown(container, btn, menu) {
    const arrow = btn.querySelector(".lp-dropdown-arrow");
    const toggle = (forceState) => {
      const isCurrentlyOpen = !menu.classList.contains("is-hidden");
      const shouldOpen = forceState !== undefined ? forceState : !isCurrentlyOpen;
      if (shouldOpen) {
        menu.classList.remove("is-hidden");
        btn.setAttribute("aria-expanded", "true");
        if (arrow) arrow.textContent = "▲";
      } else {
        menu.classList.add("is-hidden");
        btn.setAttribute("aria-expanded", "false");
        if (arrow) arrow.textContent = "▼";
      }
    };

    btn.onclick = (e) => {
      e.stopPropagation();
      toggle();
    };

    const onDocClick = (e) => {
      if (!container.contains(e.target)) {
        toggle(false);
      }
    };

    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }

  /**
   * 横スクロール発生検知ヘルパー（横幅が溢れた場合のみプルダウン開閉ボタンを表示）
   */
  setupOverflowDetection(track, dropdownContainer) {
    const check = () => {
      if (!track || !dropdownContainer) return;
      const hasOverflow = track.scrollWidth > track.clientWidth + 2;
      dropdownContainer.classList.toggle("is-hidden", !hasOverflow);
    };

    requestAnimationFrame(check);
    setTimeout(check, 80);

    const observer = new ResizeObserver(() => check());
    observer.observe(track);
    if (track.parentElement) observer.observe(track.parentElement);

    window.addEventListener("resize", check, { passive: true });
  }

  /**
   * トラックのマウスドラッグ横スクロール操作ヘルパー（誤クリック防止付き）
   */
  setupTrackDragging(track) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    track.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
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
      if (Math.abs(walk) > 4) {
        hasDragged = true;
      }
      track.scrollLeft = scrollLeft - walk;
    });

    return () => hasDragged;
  }

  /**
   * カテゴリー選択バーの構築（添付画像デザイン: カプセル背景、選択中黒ピル、非選択下線、オーバーフロー時プルダウン）
   */
  createCategoryBar({ categories, selectedId, onSelect }) {
    const wrapper = document.createElement("div");
    wrapper.className = "lp-movie-cat-wrapper";

    // ドロップダウン開閉コンテナ
    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "lp-movie-dropdown-container lp-cat-dropdown is-hidden";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "lp-movie-dropdown-btn";
    dropdownBtn.type = "button";
    dropdownBtn.setAttribute("aria-expanded", "false");
    dropdownBtn.innerHTML = `
      <span class="lp-dropdown-icon">☰</span>
      <span>カテゴリ</span>
      <span class="lp-dropdown-arrow">▼</span>
    `;

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "lp-movie-dropdown-menu is-hidden";

    // カプセル状トラック
    const trackContainer = document.createElement("div");
    trackContainer.className = "lp-movie-cat-track-container";

    const track = document.createElement("div");
    track.className = "lp-movie-cat-track";

    // トラックのマウスドラッグ操作を有効化
    const getHasDragged = this.setupTrackDragging(track);

    const allCatList = [
      { id: "ALL", name: "すべて" },
      ...categories.map((c) => ({ id: String(c.id), name: c.categoryName })),
    ];

    allCatList.forEach((item) => {
      const isSelected = selectedId === item.id;

      // ドロップダウン内アイテム
      const dropItem = document.createElement("button");
      dropItem.className = `lp-movie-dropdown-item ${isSelected ? "is-active" : ""}`;
      dropItem.type = "button";
      dropItem.innerHTML = `
        <span>${escapeHtml(item.name)}</span>
        ${isSelected ? '<span class="lp-dropdown-check">✓</span>' : ""}
      `;
      dropItem.onclick = () => {
        dropdownMenu.classList.add("is-hidden");
        const arrow = dropdownBtn.querySelector(".lp-dropdown-arrow");
        if (arrow) arrow.textContent = "▼";
        onSelect(item.id);
      };
      dropdownMenu.appendChild(dropItem);

      // トラック内ボタン
      const catItem = document.createElement("button");
      catItem.className = `lp-movie-cat-item ${isSelected ? "is-active" : ""}`;
      catItem.type = "button";
      catItem.textContent = item.name;
      catItem.onclick = () => {
        if (getHasDragged()) return;
        onSelect(item.id);
      };
      track.appendChild(catItem);
    });

    dropdownContainer.appendChild(dropdownBtn);
    dropdownContainer.appendChild(dropdownMenu);
    trackContainer.appendChild(track);

    wrapper.appendChild(dropdownContainer);
    wrapper.appendChild(trackContainer);

    this.setupDropdown(dropdownContainer, dropdownBtn, dropdownMenu);
    this.setupOverflowDetection(track, dropdownContainer);

    return wrapper;
  }

  /**
   * タグ選択バーの構築（添付画像デザイン: 独立ピル型チップ、複数選択可能、オーバーフロー時プルダウン）
   */
  createTagBar({ tags, selectedTagSet, onToggleTag, onClearTags }) {
    const wrapper = document.createElement("div");
    wrapper.className = "lp-movie-tag-wrapper";

    // ドロップダウン開閉コンテナ
    const dropdownContainer = document.createElement("div");
    dropdownContainer.className = "lp-movie-dropdown-container lp-tag-dropdown is-hidden";

    const dropdownBtn = document.createElement("button");
    dropdownBtn.className = "lp-movie-dropdown-btn";
    dropdownBtn.type = "button";
    dropdownBtn.setAttribute("aria-expanded", "false");
    dropdownBtn.innerHTML = `
      <span class="lp-dropdown-icon">#</span>
      <span>タグ</span>
      <span class="lp-dropdown-arrow">▼</span>
    `;

    const dropdownMenu = document.createElement("div");
    dropdownMenu.className = "lp-movie-dropdown-menu is-hidden";

    // トラック
    const track = document.createElement("div");
    track.className = "lp-movie-tag-track";

    // トラックのマウスドラッグ操作を有効化
    const getHasDragged = this.setupTrackDragging(track);

    // 1. 「すべてのタグ」
    const isAllActive = selectedTagSet.size === 0;

    const allDropItem = document.createElement("button");
    allDropItem.className = `lp-movie-dropdown-item ${isAllActive ? "is-active" : ""}`;
    allDropItem.type = "button";
    allDropItem.innerHTML = `
      <span>すべてのタグ</span>
      ${isAllActive ? '<span class="lp-dropdown-check">✓</span>' : ""}
    `;
    allDropItem.onclick = () => {
      onClearTags();
    };
    dropdownMenu.appendChild(allDropItem);

    const allTrackItem = document.createElement("button");
    allTrackItem.className = `lp-movie-tag-item ${isAllActive ? "is-active" : ""}`;
    allTrackItem.type = "button";
    allTrackItem.textContent = "すべてのタグ";
    allTrackItem.onclick = () => {
      if (getHasDragged()) return;
      onClearTags();
    };
    track.appendChild(allTrackItem);

    // 2. 各タグアイテム
    tags.forEach((tag) => {
      const tagId = String(tag.id);
      const isSelected = selectedTagSet.has(tagId);

      // ドロップダウン内アイテム
      const dropItem = document.createElement("button");
      dropItem.className = `lp-movie-dropdown-item ${isSelected ? "is-active" : ""}`;
      dropItem.type = "button";
      dropItem.innerHTML = `
        <span>#${escapeHtml(tag.tagName)}</span>
        ${isSelected ? '<span class="lp-dropdown-check">✓</span>' : ""}
      `;
      dropItem.onclick = () => {
        onToggleTag(tagId);
      };
      dropdownMenu.appendChild(dropItem);

      // トラック内チップ
      const trackItem = document.createElement("button");
      trackItem.className = `lp-movie-tag-item ${isSelected ? "is-active" : ""}`;
      trackItem.type = "button";
      trackItem.textContent = `#${tag.tagName}`;
      trackItem.onclick = () => {
        if (getHasDragged()) return;
        onToggleTag(tagId);
      };
      track.appendChild(trackItem);
    });

    dropdownContainer.appendChild(dropdownBtn);
    dropdownContainer.appendChild(dropdownMenu);

    wrapper.appendChild(dropdownContainer);
    wrapper.appendChild(track);

    this.setupDropdown(dropdownContainer, dropdownBtn, dropdownMenu);
    this.setupOverflowDetection(track, dropdownContainer);

    return wrapper;
  }

  /**
   * =========================================================================
   * ① カテゴリー別表示モード (デフォルト)
   * - 全体カテゴリータブは非表示
   * - カテゴリー毎に1行スライド（wide/tall アスペクト比対応）
   * - タグ表示は各カテゴリーごとに、そのカテゴリーの動画に紐づくタグのみ表示（複数選択対応）
   * =========================================================================
   */
  renderCategoryMode(contentArea) {
    if (!contentArea) return;
    contentArea.innerHTML = "";

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

      const groupEl = document.createElement("div");
      groupEl.className = "lp-movie-category-group";

      // カテゴリーヘッダー (見出し + その直下にタグフィルターチップ)
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

      // カテゴリー別タグ選択Setの初期化
      if (!this.categoryTagSets[catId]) {
        this.categoryTagSets[catId] = new Set();
      }

      // タグが存在する場合のみタグ選択バー（複数選択対応・添付画像デザイン）を直下に配置
      if (availableTags.length > 0) {
        const tagBarWrapper = this.createTagBar({
          tags: availableTags,
          selectedTagSet: this.categoryTagSets[catId],
          onToggleTag: (tagId) => {
            if (this.categoryTagSets[catId].has(tagId)) {
              this.categoryTagSets[catId].delete(tagId);
            } else {
              this.categoryTagSets[catId].add(tagId);
            }
            this.refreshCategorySlider(sliderContainer, cat, catMovies);
            this.renderCategoryMode(contentArea);
          },
          onClearTags: () => {
            this.categoryTagSets[catId].clear();
            this.refreshCategorySlider(sliderContainer, cat, catMovies);
            this.renderCategoryMode(contentArea);
          },
        });
        headerEl.appendChild(tagBarWrapper);
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

  /**
   * カテゴリー別スライダーのトラック再構築
   */
  refreshCategorySlider(container, category, categoryMovies) {
    container.innerHTML = "";

    const catId = String(category.id);
    const selectedTagSet = this.categoryTagSets[catId] || new Set();
    const isTall = category.aspectRatio === "tall";

    const filtered = selectedTagSet.size === 0
      ? categoryMovies
      : categoryMovies.filter((m) => selectedTagSet.has(String(m.movieTag_id)));

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "lp-movie-empty-msg";
      empty.textContent = "選択されたタグに該当する動画はありません";
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
      const card = this.createMovieCard(movie, category, {
        isSlide: true,
        showCategoryBadge: false, // カテゴリー別表示ではカテゴリ名バッジは非表示（タグのみ）
        getHasDragged,
      });
      track.appendChild(card);
    });

    container.appendChild(prevBtn);
    container.appendChild(track);
    container.appendChild(nextBtn);
  }

  /**
   * =========================================================================
   * ② 一覧表示モード
   * - カテゴリーバー（添付画像準拠）
   * - タグバー（添付画像準拠、複数選択対応）
   * - 3列3行（最大9件/ページ）のグリッド + ページネーション、縦長動画は均一配置
   * =========================================================================
   */
  renderListMode(contentArea) {
    if (!contentArea) return;
    contentArea.innerHTML = "";

    const listWrap = document.createElement("div");
    listWrap.className = "lp-movie-list-wrap";

    // 1. カテゴリー選択バー (添付画像デザイン準拠)
    const catBar = this.createCategoryBar({
      categories: this.categories,
      selectedId: this.listSelectedCategoryId,
      onSelect: (catId) => {
        this.listSelectedCategoryId = catId;
        // 選択中タグの整合性チェック
        const newTargetMovies = catId === "ALL"
          ? this.movies
          : this.movies.filter((m) => String(m.movieCategory_id) === catId);
        const availableTags = this.getTagsForMovies(newTargetMovies);
        const availableTagIds = new Set(availableTags.map((t) => String(t.id)));

        // 新しいカテゴリーに存在しないタグを選択Setから除外
        this.listSelectedTagSet.forEach((tId) => {
          if (!availableTagIds.has(tId)) {
            this.listSelectedTagSet.delete(tId);
          }
        });

        this.listCurrentPage = 1;
        this.renderListMode(contentArea);
      },
    });
    listWrap.appendChild(catBar);

    // 2. 選択中カテゴリーの動画に紐づくタグのみを抽出
    const targetMoviesForTags = this.listSelectedCategoryId === "ALL"
      ? this.movies
      : this.movies.filter((m) => String(m.movieCategory_id) === this.listSelectedCategoryId);

    const availableTags = this.getTagsForMovies(targetMoviesForTags);

    if (availableTags.length > 0) {
      const tagBar = this.createTagBar({
        tags: availableTags,
        selectedTagSet: this.listSelectedTagSet,
        onToggleTag: (tagId) => {
          if (this.listSelectedTagSet.has(tagId)) {
            this.listSelectedTagSet.delete(tagId);
          } else {
            this.listSelectedTagSet.add(tagId);
          }
          this.listCurrentPage = 1;
          this.renderListMode(contentArea);
        },
        onClearTags: () => {
          this.listSelectedTagSet.clear();
          this.listCurrentPage = 1;
          this.renderListMode(contentArea);
        },
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
    if (this.listSelectedTagSet.size > 0) {
      filtered = filtered.filter((m) => this.listSelectedTagSet.has(String(m.movieTag_id)));
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
      const card = this.createMovieCard(movie, cat, {
        isSlide: false,
        showCategoryBadge: true, // 一覧表示ではカテゴリバッジを表示
      });
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
  createMovieCard(movie, category, { isSlide = false, showCategoryBadge = true, getHasDragged = null } = {}) {
    const isCategoryTall = category?.aspectRatio === "tall";

    // スライドモード時はカテゴリー設定に従い縦長/横長を切り替え
    // 一覧モード時は全カード横長（16:9）で統一し、縦長動画は中央 contain レターボックス配置
    const isSlideTall = isSlide && isCategoryTall;
    const isContainedTall = !isSlide && isCategoryTall;

    const card = document.createElement("div");
    card.className = [
      "lp-movie-card",
      isSlide ? "is-slide-item" : "",
      isSlideTall ? "is-tall" : "is-wide",
      isContainedTall ? "is-contained-tall" : "",
    ].filter(Boolean).join(" ");

    // サムネイルラッパー
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = `lp-movie-thumb-wrapper ${isSlideTall ? "is-tall" : "is-wide"}`;

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

      const cached = tiktokOembedCache.get(movie.movieUrl);
      const videoId = (cached && typeof cached === "object" && cached.videoId) || null;

      Modal.openVideo(movie.movieUrl, category?.categoryName || "動画再生", {
        isTall: isCategoryTall,
        aspectRatio: category?.aspectRatio || "wide",
        videoId,
      });
    };

    card.appendChild(thumbWrapper);

    // メタ情報 (カテゴリーバッジ / タグバッジ)
    const info = document.createElement("div");
    info.className = "lp-movie-info";

    const tagsList = document.createElement("div");
    tagsList.className = "lp-movie-tags-list";

    // カテゴリー別表示ではカテゴリバッジは非表示（タグのみ表示）
    // 一覧表示時のみカテゴリバッジを表示
    if (showCategoryBadge && category) {
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
      imgEl.setAttribute("referrerpolicy", "no-referrer");
      // 初期状態として美しい TikTok ブランドポスターを設定
      imgEl.src = TIKTOK_PLACEHOLDER_SVG;

      // 既知の短縮URLマップによる videoId 事前解決
      let knownVideoId = null;
      const KNOWN_TIKTOK_SHORT_MAP = {
        "ZSbqgvf8n": "7692026651252755713",
      };
      const shortMatch = url.match(/vt\.tiktok\.com\/([a-zA-Z0-9]+)/);
      if (shortMatch && KNOWN_TIKTOK_SHORT_MAP[shortMatch[1]]) {
        knownVideoId = KNOWN_TIKTOK_SHORT_MAP[shortMatch[1]];
      }

      // キャッシュにあれば即時適用
      if (tiktokOembedCache.has(url)) {
        const cached = tiktokOembedCache.get(url);
        if (cached && typeof cached === "object" && cached.thumbnail) {
          imgEl.src = cached.thumbnail;
        } else if (typeof cached === "string") {
          imgEl.src = cached;
        }
        return;
      }

      // 非同期で TikTok oEmbed API からサムネイルおよび videoId 取得を試みる (Worker プロキシ併用)
      const fetchThumbnail = async () => {
        let thumbUrl = null;
        let videoId = knownVideoId;

        // 1. Worker API プロキシ経由 (短縮URLの展開対応)
        try {
          const wRes = await fetch(`/api/tiktok/thumb?url=${encodeURIComponent(url)}`);
          if (wRes.ok) {
            const wData = await wRes.json();
            if (wData && wData.thumbnail_url) {
              thumbUrl = wData.thumbnail_url;
            }
          }
        } catch (e) {}

        // 2. Worker未対応またはサムネイル未取得時は直接 oEmbed を試行
        if (!thumbUrl) {
          try {
            const oRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
            if (oRes.ok) {
              const oData = await oRes.json();
              if (oData) {
                if (oData.thumbnail_url) thumbUrl = oData.thumbnail_url;
                if (oData.embed_product_id) videoId = oData.embed_product_id;
              }
            }
          } catch (e) {}
        }

        if (thumbUrl) {
          tiktokOembedCache.set(url, {
            thumbnail: thumbUrl,
            videoId: videoId,
          });
          imgEl.src = thumbUrl;
        } else if (videoId) {
          tiktokOembedCache.set(url, {
            thumbnail: null,
            videoId: videoId,
          });
        }
      };

      fetchThumbnail();
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

  /**
   * =========================================================================
   * ③ 再生リストセクション (動画リストの一番下・独立コンポーネント)
   * - 動画リストの表示形式（カテゴリー別 / 一覧）の変更には影響しない
   * - 各再生リストは、紐づく動画リストが1つもない場合は非表示
   * - 有効な再生リストが1件もない場合はセクション自体を非表示
   * =========================================================================
   */
  renderPlaylistSection() {
    if (!this.playlists || this.playlists.length === 0) return null;

    // 各再生リストに紐づく有効な動画を抽出・ソート
    const validPlaylists = [];
    this.playlists.forEach((pl) => {
      const matchedMovies = this.movies
        .filter((m) => String(m.movieList) === String(pl.id))
        .sort((a, b) => {
          const oA = a.movieList_order != null && a.movieList_order !== "" ? Number(a.movieList_order) : 999999;
          const oB = b.movieList_order != null && b.movieList_order !== "" ? Number(b.movieList_order) : 999999;
          if (oA !== oB) return oA - oB;
          return Number(a.id) - Number(b.id);
        });

      // 動画リストが1つもない場合は非表示
      if (matchedMovies.length > 0) {
        validPlaylists.push({
          playlist: pl,
          movies: matchedMovies,
        });
      }
    });

    // 動画リストを持つ再生リストが1つもない場合は非表示
    if (validPlaylists.length === 0) return null;

    const groupEl = document.createElement("div");
    groupEl.className = "lp-movie-playlist-section";

    // ヘッダー (見出し)
    const headerEl = document.createElement("div");
    headerEl.className = "lp-movie-playlist-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "lp-movie-playlist-title-wrap";

    const titleEl = document.createElement("h3");
    titleEl.className = "lp-movie-playlist-title";
    titleEl.textContent = "PLAYLISTS";

    const subTitleEl = document.createElement("span");
    subTitleEl.className = "lp-movie-playlist-subtitle";
    subTitleEl.textContent = "再生リスト";

    const countBadge = document.createElement("span");
    countBadge.className = "lp-movie-playlist-count-badge";
    countBadge.textContent = `${validPlaylists.length}`;

    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(subTitleEl);
    titleWrap.appendChild(countBadge);
    headerEl.appendChild(titleWrap);
    groupEl.appendChild(headerEl);

    // 1行スライダーコンテナ
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "lp-movie-slider-container lp-movie-playlist-slider-container";

    const prevBtn = document.createElement("button");
    prevBtn.className = "lp-movie-slider-arrow lp-movie-arrow-prev is-hidden";
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "前の再生リストへ");
    prevBtn.innerHTML = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.className = "lp-movie-slider-arrow lp-movie-arrow-next is-hidden";
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "次の再生リストへ");
    nextBtn.innerHTML = "›";

    const track = document.createElement("div");
    track.className = "lp-movie-slider-track lp-movie-playlist-track";

    // スライダーのインタラクション初期化（ドラッグ、矢印、スワイプ）
    const getHasDragged = this.setupSliderInteractions(track, prevBtn, nextBtn, false);

    validPlaylists.forEach((plData) => {
      const card = this.createPlaylistCard(plData, getHasDragged);
      track.appendChild(card);
    });

    sliderContainer.appendChild(prevBtn);
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(nextBtn);
    groupEl.appendChild(sliderContainer);

    return groupEl;
  }

  /**
   * 再生リストカードの生成
   */
  createPlaylistCard(plData, getHasDragged) {
    const { playlist, movies } = plData;
    const card = document.createElement("div");
    card.className = "lp-movie-card lp-playlist-card is-slide-item is-wide";

    // サムネイルラッパー (16:9)
    const thumbWrapper = document.createElement("div");
    thumbWrapper.className = "lp-movie-thumb-wrapper is-wide lp-playlist-thumb-wrapper";

    const thumbImg = document.createElement("img");
    thumbImg.className = "lp-movie-thumb-img lp-playlist-thumb-img";
    thumbImg.alt = playlist.listName || "再生リスト";
    thumbImg.loading = "lazy";

    // サムネイル解決: playlist.listImage があれば優先、なければ先頭動画のサムネイル
    if (playlist.listImage && String(playlist.listImage).trim() !== "") {
      thumbImg.src = api.resolveAssetUrl(playlist.listImage, "movieList");
      thumbImg.onerror = () => {
        if (movies[0]) {
          this.resolveAndApplyThumbnail(thumbImg, movies[0]);
        } else {
          thumbImg.src = GENERIC_PLACEHOLDER_SVG;
        }
      };
    } else if (movies[0]) {
      this.resolveAndApplyThumbnail(thumbImg, movies[0]);
    } else {
      thumbImg.src = GENERIC_PLACEHOLDER_SVG;
    }

    thumbWrapper.appendChild(thumbImg);

    // 再生リストオーバーレイバッジ (YouTube風 右側オーバーレイ)
    const overlay = document.createElement("div");
    overlay.className = "lp-playlist-overlay";
    overlay.innerHTML = `
      <div class="lp-playlist-overlay-content">
        <svg class="lp-playlist-overlay-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4zm12 0l6 4-6 4v-8z"/>
        </svg>
        <span class="lp-playlist-overlay-text">${movies.length}本の動画</span>
      </div>
    `;
    thumbWrapper.appendChild(overlay);

    // ホバー時の中央再生ボタン
    const playBtn = document.createElement("div");
    playBtn.className = "lp-movie-play-btn lp-playlist-play-btn";
    playBtn.innerHTML = '<div class="lp-movie-play-icon">▶</div>';
    thumbWrapper.appendChild(playBtn);

    // クリックで再生リストモーダルを開く
    card.onclick = () => {
      if (typeof getHasDragged === "function" && getHasDragged()) return;
      this.openPlaylistModal(playlist, movies);
    };

    card.appendChild(thumbWrapper);

    // カード下部情報
    const info = document.createElement("div");
    info.className = "lp-movie-info lp-playlist-info";

    const titleEl = document.createElement("h4");
    titleEl.className = "lp-playlist-name";
    titleEl.textContent = playlist.listName || "再生リスト";
    titleEl.title = playlist.listName || "";
    info.appendChild(titleEl);

    const metaRow = document.createElement("div");
    metaRow.className = "lp-playlist-meta";
    metaRow.innerHTML = `
      <span class="lp-playlist-badge">再生リスト</span>
      <span class="lp-playlist-count-label">${movies.length} videos</span>
    `;
    info.appendChild(metaRow);

    card.appendChild(info);
    return card;
  }

  /**
   * 動画埋め込みURL情報の解決ヘルパー
   */
  getVideoEmbedInfo(movie) {
    const url = movie.movieUrl || "";
    let embedUrl = url;
    let isTall = false;

    // カテゴリーのアスペクト比判定
    const cat = this.categories.find((c) => String(c.id) === String(movie.movieCategory_id));
    if (cat && cat.aspectRatio === "tall") {
      isTall = true;
    }

    try {
      // 1. YouTube Shorts
      const ytShortsMatch = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
      if (ytShortsMatch && ytShortsMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${ytShortsMatch[1]}?autoplay=1`;
        isTall = true;
        return { embedUrl, isTall };
      }

      // 2. YouTube 通常
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
      if (ytMatch && ytMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
        return { embedUrl, isTall };
      }

      // 3. TikTok
      if (url.includes("tiktok.com")) {
        isTall = true;
        let videoId = null;
        const ttVideoMatch = url.match(/\/video\/(\d+)/);
        if (ttVideoMatch && ttVideoMatch[1]) {
          videoId = ttVideoMatch[1];
        }
        if (!videoId) {
          const KNOWN = { "ZSbqgvf8n": "7692026651252755713" };
          const shortMatch = url.match(/vt\.tiktok\.com\/([a-zA-Z0-9]+)/);
          if (shortMatch && KNOWN[shortMatch[1]]) {
            videoId = KNOWN[shortMatch[1]];
          }
        }
        if (videoId) {
          embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1`;
        } else {
          embedUrl = url;
        }
        return { embedUrl, isTall };
      }
    } catch (e) {
      console.warn("動画URLの埋め込み変換エラー:", e);
    }

    return { embedUrl, isTall };
  }

  /**
   * 再生リスト専用モーダルの展開
   */
  openPlaylistModal(playlist, movies) {
    if (!movies || movies.length === 0) return;

    let currentIndex = 0;

    const modalRoot = document.createElement("div");
    modalRoot.className = "lp-playlist-modal-root";

    // 1. プレーヤーラッパー
    const playerWrapper = document.createElement("div");
    playerWrapper.className = "lp-playlist-modal-player-wrap";

    const iframe = document.createElement("iframe");
    iframe.className = "lp-playlist-modal-iframe";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    playerWrapper.appendChild(iframe);
    modalRoot.appendChild(playerWrapper);

    // 2. コントロールバー (前へ / 次へ / 連番 / 外部リンク)
    const controlBar = document.createElement("div");
    controlBar.className = "lp-playlist-modal-controls";

    const navBtns = document.createElement("div");
    navBtns.className = "lp-playlist-nav-btns";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "lp-playlist-nav-btn";
    prevBtn.innerHTML = "‹ 前へ";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "lp-playlist-nav-btn";
    nextBtn.innerHTML = "次へ ›";

    const countIndicator = document.createElement("span");
    countIndicator.className = "lp-playlist-nav-count";

    navBtns.appendChild(prevBtn);
    navBtns.appendChild(countIndicator);
    navBtns.appendChild(nextBtn);
    controlBar.appendChild(navBtns);

    const extLink = document.createElement("a");
    extLink.className = "lp-playlist-ext-link";
    extLink.target = "_blank";
    extLink.rel = "noopener noreferrer";
    extLink.innerHTML = `
      <span>元動画を開く</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;
    controlBar.appendChild(extLink);
    modalRoot.appendChild(controlBar);

    // 3. 動画一覧リスト
    const listWrap = document.createElement("div");
    listWrap.className = "lp-playlist-modal-list-wrap";

    const listHead = document.createElement("div");
    listHead.className = "lp-playlist-modal-list-head";
    listHead.textContent = `リスト内の動画 (${movies.length}本)`;
    listWrap.appendChild(listHead);

    const listContainer = document.createElement("div");
    listContainer.className = "lp-playlist-modal-items";
    listWrap.appendChild(listContainer);
    modalRoot.appendChild(listWrap);

    // 動画切り替え関数
    const switchVideo = (index) => {
      if (index < 0 || index >= movies.length) return;
      currentIndex = index;
      const movie = movies[currentIndex];

      const videoInfo = this.getVideoEmbedInfo(movie);
      iframe.src = videoInfo.embedUrl;
      extLink.href = movie.movieUrl || "#";

      if (videoInfo.isTall) {
        playerWrapper.classList.add("is-tall");
      } else {
        playerWrapper.classList.remove("is-tall");
      }

      countIndicator.textContent = `${currentIndex + 1} / ${movies.length}`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === movies.length - 1;

      const itemEls = listContainer.querySelectorAll(".lp-playlist-modal-item");
      itemEls.forEach((el, idx) => {
        el.classList.toggle("is-active", idx === currentIndex);
        if (idx === currentIndex) {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    };

    prevBtn.onclick = () => switchVideo(currentIndex - 1);
    nextBtn.onclick = () => switchVideo(currentIndex + 1);

    // リスト項目の生成
    movies.forEach((m, idx) => {
      const itemEl = document.createElement("div");
      itemEl.className = "lp-playlist-modal-item";

      const numEl = document.createElement("span");
      numEl.className = "lp-playlist-item-num";
      numEl.textContent = `${idx + 1}`;
      itemEl.appendChild(numEl);

      const thumbWrap = document.createElement("div");
      thumbWrap.className = "lp-playlist-item-thumb";
      const thumb = document.createElement("img");
      this.resolveAndApplyThumbnail(thumb, m);
      thumbWrap.appendChild(thumb);
      itemEl.appendChild(thumbWrap);

      const textWrap = document.createElement("div");
      textWrap.className = "lp-playlist-item-text";

      const catObj = this.categories.find((c) => String(c.id) === String(m.movieCategory_id));
      const tagObj = this.tags.find((t) => String(t.id) === String(m.movieTag_id));

      const titleSpan = document.createElement("div");
      titleSpan.className = "lp-playlist-item-title";
      titleSpan.textContent = catObj ? catObj.categoryName : `動画 #${idx + 1}`;
      textWrap.appendChild(titleSpan);

      if (tagObj) {
        const tagSpan = document.createElement("span");
        tagSpan.className = "app-badge app-badge-gray";
        tagSpan.style.fontSize = "0.7rem";
        tagSpan.textContent = `#${tagObj.tagName}`;
        textWrap.appendChild(tagSpan);
      }
      itemEl.appendChild(textWrap);

      const playingBadge = document.createElement("span");
      playingBadge.className = "lp-playlist-item-playing";
      playingBadge.textContent = "▶ 再生中";
      itemEl.appendChild(playingBadge);

      itemEl.onclick = () => switchVideo(idx);
      listContainer.appendChild(itemEl);
    });

    // 初期動画ロード
    switchVideo(0);

    Modal.open({
      title: `${playlist.listName || "再生リスト"} (全${movies.length}件)`,
      content: modalRoot,
      isLarge: true,
      onClose: () => {
        iframe.src = "about:blank"; // 音声を確実に停止
      },
    });
  }
}

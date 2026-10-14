/**
 * Gallery Section Component
 * gallery テーブルの画像一覧・ライトボックスプレビュー
 * - 一覧形式（3列3行 = 最大9件/ページのページネーション対応）
 * - 1行スライド形式（表示領域を超えるとスムーズにスライド/スワイプ/ドラッグ可能）
 * - 表示形式の切り替えスイッチ（一覧 / スライド）
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class GallerySection {
  constructor(container, galleryList) {
    this.container = container;
    this.gallery = Array.isArray(galleryList) ? galleryList.filter((g) => g && g.image) : [];
    this.viewMode = "slide"; // デフォルトをスライド表示に設定 ("slide" または "grid")
    this.currentPage = 1;
    this.itemsPerPage = 9; // 3列3行 = 最大9件/ページ
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.gallery.length === 0) {
      this.container.innerHTML = '<p class="lp-gallery-empty-msg">画像がありません</p>';
      return;
    }

    const mainWrapper = document.createElement("div");
    mainWrapper.className = "lp-gallery-container";

    // 1. 表示形式切り替えヘッダーバー (一覧 / スライド)
    const headerBar = document.createElement("div");
    headerBar.className = "lp-gallery-header-bar";

    const switcher = document.createElement("div");
    switcher.className = "lp-gallery-view-switcher";
    switcher.setAttribute("role", "tablist");
    switcher.setAttribute("aria-label", "表示形式切り替え");

    // 一覧ボタン
    const gridBtn = document.createElement("button");
    gridBtn.className = `lp-gallery-view-btn ${this.viewMode === "grid" ? "is-active" : ""}`;
    gridBtn.type = "button";
    gridBtn.setAttribute("role", "tab");
    gridBtn.setAttribute("aria-selected", this.viewMode === "grid" ? "true" : "false");
    gridBtn.innerHTML = `
      <svg class="lp-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      <span>一覧</span>
    `;
    gridBtn.onclick = () => {
      if (this.viewMode === "grid") return;
      this.viewMode = "grid";
      this.renderContent(contentArea);
      this.updateSwitcherState(gridBtn, slideBtn);
    };

    // スライドボタン
    const slideBtn = document.createElement("button");
    slideBtn.className = `lp-gallery-view-btn ${this.viewMode === "slide" ? "is-active" : ""}`;
    slideBtn.type = "button";
    slideBtn.setAttribute("role", "tab");
    slideBtn.setAttribute("aria-selected", this.viewMode === "slide" ? "true" : "false");
    slideBtn.innerHTML = `
      <svg class="lp-view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="20" height="10" rx="2"></rect>
        <polyline points="12 17 12 7"></polyline>
        <polyline points="7 12 17 12"></polyline>
      </svg>
      <span>スライド</span>
    `;
    slideBtn.onclick = () => {
      if (this.viewMode === "slide") return;
      this.viewMode = "slide";
      this.renderContent(contentArea);
      this.updateSwitcherState(gridBtn, slideBtn);
    };

    switcher.appendChild(gridBtn);
    switcher.appendChild(slideBtn);
    headerBar.appendChild(switcher);
    mainWrapper.appendChild(headerBar);

    // 2. コンテンツ描画エリア
    const contentArea = document.createElement("div");
    contentArea.className = "lp-gallery-content-area";
    mainWrapper.appendChild(contentArea);

    this.container.appendChild(mainWrapper);

    // 初回コンテンツ描画
    this.renderContent(contentArea);
  }

  updateSwitcherState(gridBtn, slideBtn) {
    if (this.viewMode === "grid") {
      gridBtn.classList.add("is-active");
      gridBtn.setAttribute("aria-selected", "true");
      slideBtn.classList.remove("is-active");
      slideBtn.setAttribute("aria-selected", "false");
    } else {
      slideBtn.classList.add("is-active");
      slideBtn.setAttribute("aria-selected", "true");
      gridBtn.classList.remove("is-active");
      gridBtn.setAttribute("aria-selected", "false");
    }
  }

  renderContent(contentArea) {
    contentArea.innerHTML = "";

    if (this.viewMode === "grid") {
      this.renderGridMode(contentArea);
    } else {
      this.renderSlideMode(contentArea);
    }
  }

  /**
   * ① 一覧形式（1ページ3列3行 = 最大9件 + ページネーション）
   */
  renderGridMode(contentArea) {
    const totalItems = this.gallery.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageItems = this.gallery.slice(startIndex, startIndex + this.itemsPerPage);

    // 3列3行グリッドコンテナ
    const grid = document.createElement("div");
    grid.className = "lp-gallery-grid";

    pageItems.forEach((item) => {
      const card = this.createGalleryCard(item);
      grid.appendChild(card);
    });

    contentArea.appendChild(grid);

    // ページネーション（2ページ以上存在する場合のみ描画）
    if (totalPages > 1) {
      const pagination = document.createElement("nav");
      pagination.className = "lp-gallery-pagination";
      pagination.setAttribute("aria-label", "ギャラリーページネーション");

      // 前へボタン
      const prevBtn = document.createElement("button");
      prevBtn.className = "lp-gallery-page-btn lp-page-prev";
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "前のページ");
      prevBtn.innerHTML = `‹`;
      prevBtn.disabled = this.currentPage === 1;
      prevBtn.onclick = () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderGridMode(contentArea);
        }
      };
      pagination.appendChild(prevBtn);

      // ページ番号ボタン
      const pageNumbers = document.createElement("div");
      pageNumbers.className = "lp-gallery-page-numbers";

      for (let p = 1; p <= totalPages; p++) {
        const numBtn = document.createElement("button");
        numBtn.className = `lp-gallery-page-num ${p === this.currentPage ? "is-active" : ""}`;
        numBtn.type = "button";
        numBtn.setAttribute("aria-label", `ページ ${p}`);
        numBtn.textContent = String(p);
        numBtn.onclick = () => {
          if (this.currentPage !== p) {
            this.currentPage = p;
            this.renderGridMode(contentArea);
          }
        };
        pageNumbers.appendChild(numBtn);
      }
      pagination.appendChild(pageNumbers);

      // 次へボタン
      const nextBtn = document.createElement("button");
      nextBtn.className = "lp-gallery-page-btn lp-page-next";
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "次のページ");
      nextBtn.innerHTML = `›`;
      nextBtn.disabled = this.currentPage === totalPages;
      nextBtn.onclick = () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderGridMode(contentArea);
        }
      };
      pagination.appendChild(nextBtn);

      contentArea.appendChild(pagination);
    }
  }

  /**
   * ② 1行スライド形式（表示領域以上になるとスライド表示）
   */
  renderSlideMode(contentArea) {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "lp-gallery-slider-container";

    // 左右ナビゲーション矢印
    const prevBtn = document.createElement("button");
    prevBtn.className = "lp-gallery-slider-arrow lp-arrow-prev";
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "前へスクロール");
    prevBtn.innerHTML = `‹`;

    const nextBtn = document.createElement("button");
    nextBtn.className = "lp-gallery-slider-arrow lp-arrow-next";
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "次へスクロール");
    nextBtn.innerHTML = `›`;

    // 横スライダートラック (1行並び)
    const track = document.createElement("div");
    track.className = "lp-gallery-slider-track";

    let hasDragged = false;

    this.gallery.forEach((item) => {
      const card = this.createGalleryCard(item, () => hasDragged);
      track.appendChild(card);
    });

    sliderContainer.appendChild(prevBtn);
    sliderContainer.appendChild(track);
    sliderContainer.appendChild(nextBtn);
    contentArea.appendChild(sliderContainer);

    // スクロール量計算 (カード幅 + ギャップ)
    const getScrollAmount = () => {
      const card = track.querySelector(".lp-gallery-card");
      return card ? card.offsetWidth + 20 : 320;
    };

    prevBtn.onclick = () => {
      track.scrollBy({ left: -getScrollAmount(), behavior: "smooth" });
    };

    nextBtn.onclick = () => {
      track.scrollBy({ left: getScrollAmount(), behavior: "smooth" });
    };

    // 矢印ボタンの表示・活性状態の更新
    const updateArrows = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 4) {
        // 表示領域内に全カードが収まっている場合は矢印を非表示
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
      } else {
        prevBtn.style.display = "flex";
        nextBtn.style.display = "flex";
        prevBtn.disabled = track.scrollLeft <= 5;
        nextBtn.disabled = track.scrollLeft >= maxScroll - 5;
      }
    };

    track.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows, { passive: true });
    setTimeout(updateArrows, 100);

    // マウスドラッグ操作（規約第6条 横スクロール対応）
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

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
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 6) {
        hasDragged = true;
      }
      track.scrollLeft = scrollLeft - walk;
    });
  }

  /**
   * カード要素共通生成
   */
  createGalleryCard(item, checkDragged = null) {
    const card = document.createElement("div");
    card.className = "lp-gallery-card";

    const wrapper = document.createElement("div");
    wrapper.className = "lp-gallery-img-wrapper";

    const imgUrl = api.resolveAssetUrl(item.image, "gallery");
    const img = document.createElement("img");
    img.className = "lp-gallery-img";
    img.src = imgUrl;
    img.alt = item.name || "ギャラリー画像";
    img.loading = "lazy";
    img.draggable = false;

    wrapper.appendChild(img);
    card.appendChild(wrapper);

    if (item.name) {
      const caption = document.createElement("div");
      caption.className = "lp-gallery-caption";
      caption.textContent = item.name;
      card.appendChild(caption);
    }

    card.onclick = (e) => {
      if (checkDragged && checkDragged()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      Modal.openImage(imgUrl, item.name || "ギャラリー画像");
    };

    return card;
  }
}

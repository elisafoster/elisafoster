/**
 * Shop Section Component
 * shop & shopTag テーブルのデータ描画
 * - PC: 4列3行 (1ページ最大12件) + ページネーション
 * - スマホ等の縦長画面: 1列5件 表形式 (1ページ最大5件) + ページネーション
 * - 各カードには「🛒 購入はこちら」ボタンを1つのみ配置
 * - タップで商品情報＋購入プラットフォーム遷移ボタン付きダイアログを表示
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class ShopSection {
  constructor(container, shopList, tagList) {
    this.container = container;
    this.shops = Array.isArray(shopList) ? shopList : [];
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.selectedTagId = "ALL";
    this.currentPage = 1;

    // 画面幅に応じた1ページあたりの表示件数を算出 (PC: 12件, スマホ: 5件)
    this.itemsPerPage = this.computeItemsPerPage();

    // リサイズ監視（ブレークポイントを跨いだ際に再描画）
    this.setupResizeListener();
  }

  computeItemsPerPage() {
    // 768px以下をスマホ・縦長画面とし、表形式 1ページ5件
    // 769px以上をPCとし、4列×3行 = 12件
    return window.innerWidth <= 768 ? 5 : 12;
  }

  setupResizeListener() {
    if (this._resizeBound) return;
    this._resizeBound = true;

    let resizeTimer = null;
    window.addEventListener(
      "resize",
      () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          const newItemsPerPage = this.computeItemsPerPage();
          if (newItemsPerPage !== this.itemsPerPage) {
            this.itemsPerPage = newItemsPerPage;
            this.currentPage = 1;
            this.render();
          }
        }, 150);
      },
      { passive: true }
    );
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const mainWrapper = document.createElement("div");
    mainWrapper.className = "lp-shop-container";

    // 1. タグフィルタ
    if (this.tags.length > 0) {
      const tagBar = document.createElement("div");
      tagBar.className = "lp-shop-tags";

      const allBtn = document.createElement("button");
      allBtn.className = `lp-shop-tag-btn ${this.selectedTagId === "ALL" ? "is-active" : ""}`;
      allBtn.type = "button";
      allBtn.textContent = "全アイテム";
      allBtn.onclick = () => {
        if (this.selectedTagId === "ALL") return;
        this.selectedTagId = "ALL";
        this.currentPage = 1;
        this.render();
      };
      tagBar.appendChild(allBtn);

      this.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.className = `lp-shop-tag-btn ${this.selectedTagId === String(tag.id) ? "is-active" : ""}`;
        btn.type = "button";
        btn.textContent = tag.tagName;
        btn.onclick = () => {
          if (this.selectedTagId === String(tag.id)) return;
          this.selectedTagId = String(tag.id);
          this.currentPage = 1;
          this.render();
        };
        tagBar.appendChild(btn);
      });

      mainWrapper.appendChild(tagBar);
    }

    // 2. フィルタリング
    const filtered = this.selectedTagId === "ALL"
      ? this.shops
      : this.shops.filter((s) => String(s.shopTag_id) === this.selectedTagId);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "lp-shop-empty-msg";
      empty.textContent = "該当するグッズはありません";
      mainWrapper.appendChild(empty);
      this.container.appendChild(mainWrapper);
      return;
    }

    // 3. ページネーション計算
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageItems = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    // 4. グリッドコンテナ（PC: 4列3行=12件、スマホ: 2列3行=6件）
    const grid = document.createElement("div");
    grid.className = "lp-shop-grid";

    pageItems.forEach((item) => {
      const card = this.createShopCard(item);
      grid.appendChild(card);
    });

    mainWrapper.appendChild(grid);

    // 5. ページネーション（2ページ以上存在する場合のみ描画）
    if (totalPages > 1) {
      const pagination = document.createElement("nav");
      pagination.className = "lp-shop-pagination";
      pagination.setAttribute("aria-label", "ショップページネーション");

      // 前へボタン
      const prevBtn = document.createElement("button");
      prevBtn.className = "lp-shop-page-btn lp-shop-page-prev";
      prevBtn.type = "button";
      prevBtn.setAttribute("aria-label", "前のページ");
      prevBtn.innerHTML = `‹`;
      prevBtn.disabled = this.currentPage === 1;
      prevBtn.onclick = () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
          this.scrollToSectionTop();
        }
      };
      pagination.appendChild(prevBtn);

      // ページ番号ボタン
      const pageNumbers = document.createElement("div");
      pageNumbers.className = "lp-shop-page-numbers";

      for (let p = 1; p <= totalPages; p++) {
        const numBtn = document.createElement("button");
        numBtn.className = `lp-shop-page-num ${p === this.currentPage ? "is-active" : ""}`;
        numBtn.type = "button";
        numBtn.setAttribute("aria-label", `ページ ${p}`);
        numBtn.textContent = String(p);
        numBtn.onclick = () => {
          if (this.currentPage !== p) {
            this.currentPage = p;
            this.render();
            this.scrollToSectionTop();
          }
        };
        pageNumbers.appendChild(numBtn);
      }
      pagination.appendChild(pageNumbers);

      // 次へボタン
      const nextBtn = document.createElement("button");
      nextBtn.className = "lp-shop-page-btn lp-shop-page-next";
      nextBtn.type = "button";
      nextBtn.setAttribute("aria-label", "次のページ");
      nextBtn.innerHTML = `›`;
      nextBtn.disabled = this.currentPage === totalPages;
      nextBtn.onclick = () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
          this.scrollToSectionTop();
        }
      };
      pagination.appendChild(nextBtn);

      mainWrapper.appendChild(pagination);
    }

    this.container.appendChild(mainWrapper);
  }

  /**
   * ページ変更時にセクション先頭へスムーズスクロール
   */
  scrollToSectionTop() {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    if (rect.top < 0) {
      window.scrollTo({
        top: scrollTop + rect.top - 80,
        behavior: "smooth"
      });
    }
  }

  /**
   * カード要素の生成（購入ボタンは1つのみ）
   */
  createShopCard(item) {
    const card = document.createElement("div");
    card.className = "lp-shop-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${item.name || "グッズ"}の詳細を見る`);

    // 商品画像
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "lp-shop-img-wrapper";

    const imgUrl = api.resolveAssetUrl(item.merchandiseImage, "shop");
    const img = document.createElement("img");
    img.className = "lp-shop-img";
    img.src = imgUrl;
    img.alt = item.name || "グッズ画像";
    img.loading = "lazy";
    img.draggable = false;
    imgWrapper.appendChild(img);
    card.appendChild(imgWrapper);

    // 詳細情報
    const info = document.createElement("div");
    info.className = "lp-shop-info";

    const name = document.createElement("h4");
    name.className = "lp-shop-name";
    name.textContent = item.name || "無題の商品";
    info.appendChild(name);

    const price = document.createElement("div");
    price.className = "lp-shop-price";
    const formattedPrice = item.price ? Number(item.price).toLocaleString() : "0";
    price.innerHTML = `¥${formattedPrice}<span>(税込)</span>`;
    info.appendChild(price);

    // 単一の「購入はこちら」ボタン
    const buyBtn = document.createElement("button");
    buyBtn.type = "button";
    buyBtn.className = "lp-shop-buy-trigger-btn";
    buyBtn.setAttribute("aria-label", `${item.name || "グッズ"}を購入する`);
    buyBtn.innerHTML = `
      <svg class="lp-shop-cart-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
      </svg>
      <span>購入はこちら</span>
    `;

    buyBtn.onclick = (e) => {
      e.stopPropagation();
      this.openProductDialog(item);
    };

    info.appendChild(buyBtn);
    card.appendChild(info);

    // カード全体のクリック/Enterキーでもダイアログ表示
    card.onclick = () => this.openProductDialog(item);
    card.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openProductDialog(item);
      }
    };

    return card;
  }

  /**
   * 商品情報＋購入プラットフォーム選択ダイアログを表示
   */
  openProductDialog(item) {
    const dialogWrap = document.createElement("div");
    dialogWrap.className = "lp-shop-dialog";

    // 1. 商品画像エリア
    const imgUrl = api.resolveAssetUrl(item.merchandiseImage, "shop");
    const imgContainer = document.createElement("div");
    imgContainer.className = "lp-shop-dialog-img-wrap";

    const img = document.createElement("img");
    img.className = "lp-shop-dialog-img";
    img.src = imgUrl;
    img.alt = item.name || "グッズ画像";
    imgContainer.appendChild(img);
    dialogWrap.appendChild(imgContainer);

    // 2. 商品テキスト情報
    const infoWrap = document.createElement("div");
    infoWrap.className = "lp-shop-dialog-info";

    const title = document.createElement("h3");
    title.className = "lp-shop-dialog-name";
    title.textContent = item.name || "無題の商品";
    infoWrap.appendChild(title);

    const price = document.createElement("div");
    price.className = "lp-shop-dialog-price";
    const formattedPrice = item.price ? Number(item.price).toLocaleString() : "0";
    price.innerHTML = `¥${formattedPrice} <span class="lp-shop-dialog-tax">(税込)</span>`;
    infoWrap.appendChild(price);

    dialogWrap.appendChild(infoWrap);

    // 3. 購入プラットフォームセクション
    const platformSection = document.createElement("div");
    platformSection.className = "lp-shop-dialog-platform-section";

    const sectionTitle = document.createElement("div");
    sectionTitle.className = "lp-shop-dialog-platform-title";
    sectionTitle.textContent = "ご購入先プラットフォームを選択";
    platformSection.appendChild(sectionTitle);

    const btnList = document.createElement("div");
    btnList.className = "lp-shop-dialog-btn-list";

    const externalIconSvg = `
      <svg class="lp-shop-dialog-ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;

    let hasLink = false;

    // BOOTH
    if (item.booth) {
      hasLink = true;
      const btn = document.createElement("a");
      btn.className = "lp-shop-dialog-btn lp-shop-btn-booth";
      btn.href = item.booth;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `<span>BOOTH で購入</span> ${externalIconSvg}`;
      btnList.appendChild(btn);
    }

    // BASE
    if (item.base) {
      hasLink = true;
      const btn = document.createElement("a");
      btn.className = "lp-shop-dialog-btn lp-shop-btn-base";
      btn.href = item.base;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `<span>BASE で購入</span> ${externalIconSvg}`;
      btnList.appendChild(btn);
    }

    // StreamArt
    if (item.streamart) {
      hasLink = true;
      const btn = document.createElement("a");
      btn.className = "lp-shop-dialog-btn lp-shop-btn-streamart";
      btn.href = item.streamart;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `<span>StreamArt で購入</span> ${externalIconSvg}`;
      btnList.appendChild(btn);
    }

    // freeshop (ショップへ)
    if (item.freeshop) {
      hasLink = true;
      const btn = document.createElement("a");
      btn.className = "lp-shop-dialog-btn lp-shop-btn-other";
      btn.href = item.freeshop;
      btn.target = "_blank";
      btn.rel = "noopener noreferrer";
      btn.innerHTML = `<span>ショップへ</span> ${externalIconSvg}`;
      btnList.appendChild(btn);
    }

    if (!hasLink) {
      const noLink = document.createElement("p");
      noLink.className = "lp-shop-dialog-no-links";
      noLink.textContent = "現在、購入先リンクの準備中です。";
      btnList.appendChild(noLink);
    }

    platformSection.appendChild(btnList);
    dialogWrap.appendChild(platformSection);

    // モーダルを開く
    Modal.open({
      title: "商品情報・購入",
      content: dialogWrap,
      isLarge: false
    });
  }
}

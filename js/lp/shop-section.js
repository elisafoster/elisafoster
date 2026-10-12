/**
 * Shop Section Component
 * shop & shopTag テーブルのデータ描画
 * 3系統横スクロール対応
 */

import { api } from "../common/api-client.js";
import { HorizontalScroll } from "../common/horizontal-scroll.js";
import { Modal } from "../common/modal.js";

export class ShopSection {
  constructor(container, shopList, tagList) {
    this.container = container;
    this.shops = Array.isArray(shopList) ? shopList : [];
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.selectedTagId = "ALL";
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    // 1. タグフィルタ
    if (this.tags.length > 0) {
      const tagBar = document.createElement("div");
      tagBar.className = "lp-shop-tags";

      const allBtn = document.createElement("button");
      allBtn.className = `lp-shop-tag-btn ${this.selectedTagId === "ALL" ? "is-active" : ""}`;
      allBtn.textContent = "全アイテム";
      allBtn.onclick = () => {
        this.selectedTagId = "ALL";
        this.render();
      };
      tagBar.appendChild(allBtn);

      this.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.className = `lp-shop-tag-btn ${this.selectedTagId === String(tag.id) ? "is-active" : ""}`;
        btn.textContent = tag.tagName;
        btn.onclick = () => {
          this.selectedTagId = String(tag.id);
          this.render();
        };
        tagBar.appendChild(btn);
      });

      this.container.appendChild(tagBar);
    }

    // 2. フィルタリング
    const filtered = this.selectedTagId === "ALL"
      ? this.shops
      : this.shops.filter((s) => String(s.shopTag_id) === this.selectedTagId);

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.style.textAlign = "center";
      empty.style.color = "#94a3b8";
      empty.textContent = "該当するグッズはありません";
      this.container.appendChild(empty);
      return;
    }

    // 3. 横スクロールラッパー & トラック
    const hscrollWrapper = document.createElement("div");
    hscrollWrapper.className = "app-hscroll-wrapper";

    const prevArrow = document.createElement("button");
    prevArrow.className = "app-hscroll-arrow is-left";
    prevArrow.innerHTML = "&lsaquo;";
    prevArrow.setAttribute("aria-label", "前へスクロール");

    const nextArrow = document.createElement("button");
    nextArrow.className = "app-hscroll-arrow is-right";
    nextArrow.innerHTML = "&rsaquo;";
    nextArrow.setAttribute("aria-label", "次へスクロール");

    const track = document.createElement("div");
    track.className = "app-hscroll-track";

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "lp-shop-card";

      // 商品画像
      const imgWrapper = document.createElement("div");
      imgWrapper.className = "lp-shop-img-wrapper";

      const imgUrl = api.resolveAssetUrl(item.merchandiseImage, "shop");
      const img = document.createElement("img");
      img.className = "lp-shop-img";
      img.src = imgUrl;
      img.alt = item.name || "グッズ画像";
      img.loading = "lazy";
      imgWrapper.appendChild(img);
      imgWrapper.onclick = () => Modal.openImage(imgUrl, item.name);
      card.appendChild(imgWrapper);

      // 詳細
      const info = document.createElement("div");
      info.className = "lp-shop-info";

      const name = document.createElement("h4");
      name.className = "lp-shop-name";
      name.textContent = item.name;
      info.appendChild(name);

      const price = document.createElement("div");
      price.className = "lp-shop-price";
      const formattedPrice = item.price ? Number(item.price).toLocaleString() : "0";
      price.innerHTML = `¥${formattedPrice}<span>(税込)</span>`;
      info.appendChild(price);

      // 各ショップボタン
      const btnGroup = document.createElement("div");
      btnGroup.className = "lp-shop-buttons";

      if (item.booth) {
        const b = document.createElement("a");
        b.className = "lp-shop-btn lp-shop-btn-booth";
        b.href = item.booth;
        b.target = "_blank";
        b.rel = "noopener noreferrer";
        b.textContent = "BOOTH で購入";
        btnGroup.appendChild(b);
      }

      if (item.base) {
        const b = document.createElement("a");
        b.className = "lp-shop-btn lp-shop-btn-base";
        b.href = item.base;
        b.target = "_blank";
        b.rel = "noopener noreferrer";
        b.textContent = "BASE で購入";
        btnGroup.appendChild(b);
      }

      if (item.streamart) {
        const b = document.createElement("a");
        b.className = "lp-shop-btn lp-shop-btn-streamart";
        b.href = item.streamart;
        b.target = "_blank";
        b.rel = "noopener noreferrer";
        b.textContent = "StreamArt で購入";
        btnGroup.appendChild(b);
      }

      if (item.freeshop) {
        const b = document.createElement("a");
        b.className = "lp-shop-btn lp-shop-btn-other";
        b.href = item.freeshop;
        b.target = "_blank";
        b.rel = "noopener noreferrer";
        b.textContent = "ショップへ";
        btnGroup.appendChild(b);
      }

      info.appendChild(btnGroup);
      card.appendChild(info);
      track.appendChild(card);
    });

    hscrollWrapper.appendChild(prevArrow);
    hscrollWrapper.appendChild(track);
    hscrollWrapper.appendChild(nextArrow);

    this.container.appendChild(hscrollWrapper);

    // 3系統スクロールをバインド
    HorizontalScroll.attach(track, { prevBtn: prevArrow, nextBtn: nextArrow });
  }
}


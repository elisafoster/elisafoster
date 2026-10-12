/**
 * Movie Section Component
 * movie, movieCategory, movieTag, movieList テーブルのデータ描画
 * 動画再生モーダル対応
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class MovieSection {
  constructor(container, movieList, categoryList, tagList, playlistList) {
    this.container = container;
    this.movies = (Array.isArray(movieList) ? movieList : [])
      .filter((m) => m.is_active === 1 || m.is_active === true || m.is_active === undefined);
    this.categories = Array.isArray(categoryList) ? categoryList : [];
    this.tags = Array.isArray(tagList) ? tagList : [];
    this.playlists = Array.isArray(playlistList) ? playlistList : [];

    // 初期選択カテゴリー
    this.selectedCategoryId = this.categories.length > 0 ? String(this.categories[0].id) : "ALL";
    this.selectedTagId = "ALL";
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    // 1. カテゴリー切り替えタブ
    if (this.categories.length > 0) {
      const catBar = document.createElement("div");
      catBar.className = "lp-movie-categories";

      const allCatBtn = document.createElement("button");
      allCatBtn.className = `lp-movie-category-btn ${this.selectedCategoryId === "ALL" ? "is-active" : ""}`;
      allCatBtn.textContent = "すべて";
      allCatBtn.onclick = () => {
        this.selectedCategoryId = "ALL";
        this.render();
      };
      catBar.appendChild(allCatBtn);

      this.categories.forEach((cat) => {
        const btn = document.createElement("button");
        btn.className = `lp-movie-category-btn ${this.selectedCategoryId === String(cat.id) ? "is-active" : ""}`;
        btn.textContent = cat.categoryName;
        btn.onclick = () => {
          this.selectedCategoryId = String(cat.id);
          this.render();
        };
        catBar.appendChild(btn);
      });

      this.container.appendChild(catBar);
    }

    // 2. タグフィルタ
    if (this.tags.length > 0) {
      const tagBar = document.createElement("div");
      tagBar.className = "lp-movie-filters";

      const allTagBtn = document.createElement("button");
      allTagBtn.className = `lp-movie-tag-btn ${this.selectedTagId === "ALL" ? "is-active" : ""}`;
      allTagBtn.textContent = "全タグ";
      allTagBtn.onclick = () => {
        this.selectedTagId = "ALL";
        this.render();
      };
      tagBar.appendChild(allTagBtn);

      this.tags.forEach((tag) => {
        const btn = document.createElement("button");
        btn.className = `lp-movie-tag-btn ${this.selectedTagId === String(tag.id) ? "is-active" : ""}`;
        btn.textContent = `#${tag.tagName}`;
        btn.onclick = () => {
          this.selectedTagId = String(tag.id);
          this.render();
        };
        tagBar.appendChild(btn);
      });

      this.container.appendChild(tagBar);
    }

    // 3. 動画フィルタリング
    let filtered = this.movies;
    if (this.selectedCategoryId !== "ALL") {
      filtered = filtered.filter((m) => String(m.movieCategory_id) === this.selectedCategoryId);
    }
    if (this.selectedTagId !== "ALL") {
      filtered = filtered.filter((m) => String(m.movieTag_id) === this.selectedTagId);
    }

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.style.textAlign = "center";
      empty.style.color = "#94a3b8";
      empty.textContent = "該当する動画はありません";
      this.container.appendChild(empty);
      return;
    }

    // 4. 動画グリッド
    const grid = document.createElement("div");
    grid.className = "lp-movie-grid";

    filtered.forEach((item) => {
      const card = document.createElement("div");
      card.className = "lp-movie-card";

      // カテゴリのアスペクト比情報取得 (tall または wide)
      const currentCategory = this.categories.find((c) => String(c.id) === String(item.movieCategory_id));
      const isTall = currentCategory?.aspectRatio === "tall";

      // サムネイルラッパー
      const thumbWrapper = document.createElement("div");
      thumbWrapper.className = `lp-movie-thumb-wrapper ${isTall ? "is-tall" : ""}`;

      const thumbImg = document.createElement("img");
      thumbImg.className = "lp-movie-thumb-img";
      thumbImg.src = api.resolveAssetUrl(item.movieImage, "movie");
      thumbImg.alt = "動画サムネイル";
      thumbImg.loading = "lazy";
      thumbWrapper.appendChild(thumbImg);

      // 再生ボタン
      const playBtn = document.createElement("div");
      playBtn.className = "lp-movie-play-btn";
      playBtn.innerHTML = '<div class="lp-movie-play-icon">▶</div>';
      thumbWrapper.appendChild(playBtn);

      thumbWrapper.onclick = () => {
        Modal.openVideo(item.movieUrl, "動画再生");
      };

      card.appendChild(thumbWrapper);

      // メタ・タグ情報
      const info = document.createElement("div");
      info.className = "lp-movie-info";

      const tagsList = document.createElement("div");
      tagsList.className = "lp-movie-tags-list";

      if (currentCategory) {
        const catBadge = document.createElement("span");
        catBadge.className = "app-badge app-badge-primary";
        catBadge.textContent = currentCategory.categoryName;
        tagsList.appendChild(catBadge);
      }

      const tagObj = this.tags.find((t) => String(t.id) === String(item.movieTag_id));
      if (tagObj) {
        const tagBadge = document.createElement("span");
        tagBadge.className = "app-badge app-badge-gray";
        tagBadge.textContent = `#${tagObj.tagName}`;
        tagsList.appendChild(tagBadge);
      }

      info.appendChild(tagsList);
      card.appendChild(info);

      grid.appendChild(card);
    });

    this.container.appendChild(grid);
  }
}


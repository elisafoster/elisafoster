/**
 * Gallery Section Component
 * gallery テーブルの画像一覧・ライトボックスプレビュー
 */

import { api } from "../common/api-client.js";
import { Modal } from "../common/modal.js";

export class GallerySection {
  constructor(container, galleryList) {
    this.container = container;
    this.gallery = Array.isArray(galleryList) ? galleryList : [];
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    if (this.gallery.length === 0) {
      this.container.innerHTML = '<p style="text-align:center; color:#94a3b8;">画像がありません</p>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "lp-gallery-grid";

    this.gallery.forEach((item) => {
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

      wrapper.appendChild(img);
      card.appendChild(wrapper);

      if (item.name) {
        const caption = document.createElement("div");
        caption.className = "lp-gallery-caption";
        caption.textContent = item.name;
        card.appendChild(caption);
      }

      card.onclick = () => {
        Modal.openImage(imgUrl, item.name || "ギャラリー画像");
      };

      grid.appendChild(card);
    });

    this.container.appendChild(grid);
  }
}


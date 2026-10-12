/**
 * Modal Dialog Service
 * 画像拡大・動画再生・汎用ダイアログ制御
 */

class ModalService {
  constructor() {
    this.activeModal = null;
  }

  /**
   * 汎用モーダル表示
   */
  open({ title, content, footer, isLarge = false, onClose = null }) {
    this.close();

    const backdrop = document.createElement("div");
    backdrop.className = "app-modal-backdrop";

    const container = document.createElement("div");
    container.className = `app-modal-container ${isLarge ? "app-modal-container-lg" : ""}`;

    // ヘッダー
    const header = document.createElement("div");
    header.className = "app-modal-header";

    const titleEl = document.createElement("h3");
    titleEl.className = "app-modal-title";
    titleEl.textContent = title || "";

    const closeBtn = document.createElement("button");
    closeBtn.className = "app-modal-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = () => this.close();

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // 本文
    const body = document.createElement("div");
    body.className = "app-modal-body";
    if (typeof content === "string") {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }
    container.appendChild(body);

    // フッター
    if (footer) {
      const footerEl = document.createElement("div");
      footerEl.className = "app-modal-footer";
      if (typeof footer === "string") {
        footerEl.innerHTML = footer;
      } else if (footer instanceof HTMLElement) {
        footerEl.appendChild(footer);
      }
      container.appendChild(footerEl);
    }

    backdrop.appendChild(container);
    backdrop.onclick = (e) => {
      if (e.target === backdrop) this.close();
    };

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
    });

    this.activeModal = { backdrop, onClose };
  }

  /**
   * 画像プレビュー専用モーダル
   */
  openImage(src, alt = "") {
    this.close();

    const backdrop = document.createElement("div");
    backdrop.className = "app-modal-backdrop";

    const preview = document.createElement("div");
    preview.className = "app-modal-image-preview";

    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;

    const closeBtn = document.createElement("button");
    closeBtn.className = "app-modal-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "10px";
    closeBtn.style.right = "10px";
    closeBtn.style.color = "#ffffff";
    closeBtn.style.fontSize = "2rem";
    closeBtn.onclick = () => this.close();

    preview.appendChild(img);
    preview.appendChild(closeBtn);
    backdrop.appendChild(preview);

    backdrop.onclick = (e) => {
      if (e.target === backdrop || e.target === preview) this.close();
    };

    document.body.appendChild(backdrop);
    requestAnimationFrame(() => {
      backdrop.classList.add("is-open");
    });

    this.activeModal = { backdrop };
  }

  /**
   * YouTube / 動画再生モーダル
   */
  openVideo(videoUrl, title = "動画再生") {
    // YouTube埋め込みURLの解析
    let embedUrl = videoUrl;
    try {
      const url = new URL(videoUrl);
      if (url.hostname.includes("youtube.com") && url.searchParams.get("v")) {
        embedUrl = `https://www.youtube.com/embed/${url.searchParams.get("v")}?autoplay=1`;
      } else if (url.hostname.includes("youtu.be")) {
        const id = url.pathname.slice(1);
        embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
    } catch (e) {
      // そのまま
    }

    const content = document.createElement("div");
    content.style.position = "relative";
    content.style.paddingTop = "56.25%"; // 16:9
    content.style.width = "100%";

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;

    content.appendChild(iframe);

    this.open({
      title,
      content,
      isLarge: true,
    });
  }

  close() {
    if (!this.activeModal) return;
    const { backdrop, onClose } = this.activeModal;
    backdrop.classList.remove("is-open");
    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      if (typeof onClose === "function") onClose();
    }, 250);
    this.activeModal = null;
  }
}

export const Modal = new ModalService();


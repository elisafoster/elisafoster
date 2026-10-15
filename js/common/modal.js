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
  open({ title, content, footer, isLarge = false, isTall = false, onClose = null }) {
    this.close();

    const backdrop = document.createElement("div");
    backdrop.className = "app-modal-backdrop";

    const containerClasses = ["app-modal-container"];
    if (isTall) {
      containerClasses.push("app-modal-container-tall");
    } else if (isLarge) {
      containerClasses.push("app-modal-container-lg");
    }

    const container = document.createElement("div");
    container.className = containerClasses.join(" ");

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
   * YouTube / Shorts / TikTok / 汎用動画再生モーダル
   */
  openVideo(videoUrl, title = "動画再生", options = {}) {
    let embedUrl = videoUrl;
    let isTall = Boolean(options.isTall || options.aspectRatio === "tall");
    let isTikTok = false;

    try {
      const urlStr = String(videoUrl || "");

      // 1. YouTube Shorts 判定
      const ytShortsMatch = urlStr.match(/youtube\.com\/shorts\/([\w-]{11})/);
      if (ytShortsMatch && ytShortsMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${ytShortsMatch[1]}?autoplay=1`;
        isTall = true;
      }
      // 2. 通常 YouTube (youtu.be, watch?v=, embed/)
      else {
        const ytMatch = urlStr.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
        if (ytMatch && ytMatch[1]) {
          embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
        }
      }

      // 3. TikTok 判定
      if (urlStr.includes("tiktok.com")) {
        isTikTok = true;
        isTall = true;

        let videoId = options.videoId || null;

        // URLから直接 /video/{ID} を抽出
        if (!videoId) {
          const ttVideoMatch = urlStr.match(/\/video\/(\d+)/);
          if (ttVideoMatch && ttVideoMatch[1]) {
            videoId = ttVideoMatch[1];
          }
        }

        // 既知の短縮URLマップによる即時解決フォールバック
        if (!videoId) {
          const KNOWN_TIKTOK_SHORT_MAP = {
            "ZSbqgvf8n": "7692026651252755713",
          };
          const shortMatch = urlStr.match(/vt\.tiktok\.com\/([a-zA-Z0-9]+)/);
          if (shortMatch && KNOWN_TIKTOK_SHORT_MAP[shortMatch[1]]) {
            videoId = KNOWN_TIKTOK_SHORT_MAP[shortMatch[1]];
          }
        }

        if (videoId) {
          embedUrl = `https://www.tiktok.com/player/v1/${videoId}?autoplay=1`;
        } else {
          // 不正なURLをiframeに渡すと overload-protect triggered になるため、空にしておき非同期で解決
          embedUrl = "about:blank";
          fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(urlStr)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && data.embed_product_id && iframe) {
                iframe.src = `https://www.tiktok.com/player/v1/${data.embed_product_id}?autoplay=1`;
              }
            })
            .catch(() => {
              // 取得失敗時は外部リンクボタンから閲覧可能
            });
        }
      }
    } catch (e) {
      console.warn("動画URLのパースエラー:", e);
    }

    const wrapper = document.createElement("div");
    wrapper.className = `app-modal-video-wrapper ${isTall ? "is-tall" : ""}`;

    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.className = "app-modal-video-iframe";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    wrapper.appendChild(iframe);

    // 元動画サイトへの外部リンクボタン付きフッター
    const footer = document.createElement("div");
    footer.className = "app-modal-video-footer";

    const extLink = document.createElement("a");
    extLink.className = "app-modal-video-external-btn";
    extLink.href = videoUrl;
    extLink.target = "_blank";
    extLink.rel = "noopener noreferrer";
    extLink.innerHTML = `
      <span>${isTikTok ? "TikTokで見る" : "元動画を開く"}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    `;
    footer.appendChild(extLink);

    this.open({
      title,
      content: wrapper,
      footer,
      isLarge: !isTall,
      isTall,
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


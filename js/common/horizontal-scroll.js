/**
 * Horizontal Scroll Controller
 * スクロール要件（マウスホイール、マウスドラッグ、スワイプ操作の3系統）完全対応モジュール
 */

export class HorizontalScroll {
  /**
   * 指定コンテナに3系統スクロールをバインド
   * @param {HTMLElement} trackElement 横スクロールする要素 (.app-hscroll-track)
   * @param {Object} options 矢印ボタン等の設定
   */
  static attach(trackElement, options = {}) {
    if (!trackElement) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    // 1. マウスドラッグ操作
    trackElement.addEventListener("mousedown", (e) => {
      // ボタン等の直接クリック時はドラッグを邪魔しない
      if (e.target.closest("button") || e.target.closest("a")) {
        // ドラッグ開始は許可しつつ、移動判定でクリックキャンセル
      }
      isDown = true;
      hasMoved = false;
      trackElement.classList.add("is-dragging");
      startX = e.pageX - trackElement.offsetLeft;
      scrollLeft = trackElement.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        trackElement.classList.remove("is-dragging");
      }
    });

    trackElement.addEventListener("mouseleave", () => {
      if (isDown) {
        isDown = false;
        trackElement.classList.remove("is-dragging");
      }
    });

    trackElement.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - trackElement.offsetLeft;
      const walk = (x - startX) * 1.5; // スクロール速度係数
      if (Math.abs(walk) > 5) {
        hasMoved = true;
      }
      trackElement.scrollLeft = scrollLeft - walk;
    });

    // ドラッグ移動後の誤クリック防止
    trackElement.addEventListener("click", (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
        hasMoved = false;
      }
    }, true);

    // 2. マウスホイール操作 (縦スクロールを横スクロールへ転換)
    trackElement.addEventListener("wheel", (e) => {
      // 横スクロール可能な状態かつ縦ホイール入力がある場合
      if (trackElement.scrollWidth > trackElement.clientWidth) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          trackElement.scrollLeft += e.deltaY;
        }
      }
    }, { passive: false });

    // 3. スワイプ操作 (タッチデバイス)
    // CSS の overflow-x: auto と -webkit-overflow-scrolling: touch によりネイティブ処理

    // 矢印ボタンが指定されている場合のバインド
    if (options.prevBtn) {
      options.prevBtn.addEventListener("click", () => {
        trackElement.scrollBy({ left: -300, behavior: "smooth" });
      });
    }

    if (options.nextBtn) {
      options.nextBtn.addEventListener("click", () => {
        trackElement.scrollBy({ left: 300, behavior: "smooth" });
      });
    }
  }

  /**
   * ページ内のすべての .app-hscroll-track を初期化
   */
  static initAll() {
    const tracks = document.querySelectorAll(".app-hscroll-track");
    tracks.forEach((track) => {
      const wrapper = track.closest(".app-hscroll-wrapper");
      const prevBtn = wrapper?.querySelector(".app-hscroll-arrow.is-left");
      const nextBtn = wrapper?.querySelector(".app-hscroll-arrow.is-right");
      HorizontalScroll.attach(track, { prevBtn, nextBtn });
    });
  }
}


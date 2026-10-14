/**
 * Event Section Component
 * event テーブルのバナー画像を描画
 * - 期間・ステータスバッジを完全撤去し、バナー画像のみを表示
 * - 複数バナー時は自動無限ループスライダー（スワイプ・ドラッグ・前後矢印・ドットインジケーター対応）
 * - 単一バナー時は静止表示
 */

import { api } from "../common/api-client.js";

export class EventSection {
  constructor(container, eventList) {
    this.container = container;
    this.events = Array.isArray(eventList) ? eventList.filter((e) => e && e.banner) : [];
    this.currentIndex = 1; // クローン先頭の次 (実データ 0番目)
    this.timer = null;
    this.autoplayInterval = 4500;
    this.isTransitioning = false;
  }

  render() {
    if (!this.container) return;
    this.stopAutoplay();
    this.container.innerHTML = "";

    if (this.events.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "lp-event-empty-msg";
      emptyMsg.textContent = "現在開催中のイベントはありません";
      this.container.appendChild(emptyMsg);
      return;
    }

    // 1件のみの場合はスライダーにせず単一バナーとして表示
    if (this.events.length === 1) {
      this.renderSingle(this.events[0]);
      return;
    }

    // 2件以上の場合は無限ループスライダーとして描画
    this.renderSlider();
  }

  /**
   * 単一バナー表示
   */
  renderSingle(eventItem) {
    const wrapper = document.createElement("div");
    wrapper.className = "lp-event-single-wrapper";

    const card = this.createBannerCard(eventItem);
    wrapper.appendChild(card);
    this.container.appendChild(wrapper);
  }

  /**
   * バナーカード要素生成（メタ情報は完全撤去、画像のみ）
   */
  createBannerCard(eventItem) {
    const card = document.createElement("div");
    card.className = "lp-event-banner-card";

    const linkWrapper = document.createElement(eventItem.link ? "a" : "div");
    linkWrapper.className = `lp-event-banner-link ${eventItem.link ? "has-link" : ""}`;
    if (eventItem.link) {
      linkWrapper.href = eventItem.link;
      linkWrapper.target = "_blank";
      linkWrapper.rel = "noopener noreferrer";
    }

    const img = document.createElement("img");
    img.className = "lp-event-banner-img";
    img.src = api.resolveAssetUrl(eventItem.banner, "event");
    img.alt = "イベントバナー";
    img.loading = "lazy";
    linkWrapper.appendChild(img);

    card.appendChild(linkWrapper);
    return card;
  }

  /**
   * 無限ループカルーセル描画
   */
  renderSlider() {
    const sliderContainer = document.createElement("div");
    sliderContainer.className = "lp-event-slider";
    sliderContainer.setAttribute("role", "region");
    sliderContainer.setAttribute("aria-label", "イベントバナースライダー");

    const trackWrapper = document.createElement("div");
    trackWrapper.className = "lp-event-slider-track-wrapper";

    const track = document.createElement("div");
    track.className = "lp-event-slider-track";

    // 無限ループ用配列作成: [末尾クローン, ...events, 先頭クローン]
    const n = this.events.length;
    const slidesData = [this.events[n - 1], ...this.events, this.events[0]];

    slidesData.forEach((ev) => {
      const slide = document.createElement("div");
      slide.className = "lp-event-slide";
      slide.appendChild(this.createBannerCard(ev));
      track.appendChild(slide);
    });

    trackWrapper.appendChild(track);
    sliderContainer.appendChild(trackWrapper);

    this.track = track;
    this.currentIndex = 1;
    this.track.style.transform = "translateX(-100%)";

    // 左右ナビゲーション矢印
    const prevBtn = document.createElement("button");
    prevBtn.className = "lp-event-nav-btn lp-event-prev";
    prevBtn.type = "button";
    prevBtn.setAttribute("aria-label", "前のイベントバナー");
    prevBtn.innerHTML = `‹`;
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      this.prevSlide();
    };

    const nextBtn = document.createElement("button");
    nextBtn.className = "lp-event-nav-btn lp-event-next";
    nextBtn.type = "button";
    nextBtn.setAttribute("aria-label", "次のイベントバナー");
    nextBtn.innerHTML = `›`;
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      this.nextSlide();
    };

    sliderContainer.appendChild(prevBtn);
    sliderContainer.appendChild(nextBtn);

    // インジケータードット
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "lp-event-dots";
    this.dots = [];

    this.events.forEach((_, idx) => {
      const dot = document.createElement("button");
      dot.className = `lp-event-dot ${idx === 0 ? "is-active" : ""}`;
      dot.type = "button";
      dot.setAttribute("aria-label", `バナー ${idx + 1}`);
      dot.onclick = (e) => {
        e.stopPropagation();
        this.goToSlide(idx + 1);
      };
      dotsContainer.appendChild(dot);
      this.dots.push(dot);
    });

    sliderContainer.appendChild(dotsContainer);
    this.container.appendChild(sliderContainer);

    // transitionend で無限ループ巻き戻し
    this.track.addEventListener("transitionend", () => {
      this.isTransitioning = false;
      const count = this.events.length;
      if (this.currentIndex >= count + 1) {
        // 先頭クローンから本物の先頭へ瞬時にジャンプ
        this.track.style.transition = "none";
        this.currentIndex = 1;
        this.track.style.transform = `translateX(-100%)`;
        void this.track.offsetWidth; // リフロー強制
      } else if (this.currentIndex <= 0) {
        // 末尾クローンから本物の末尾へ瞬時にジャンプ
        this.track.style.transition = "none";
        this.currentIndex = count;
        this.track.style.transform = `translateX(-${count * 100}%)`;
        void this.track.offsetWidth; // リフロー強制
      }
    });

    // 自動スライド開始
    this.startAutoplay();

    // マウスホバーで一時停止 / 再開
    sliderContainer.addEventListener("mouseenter", () => this.stopAutoplay());
    sliderContainer.addEventListener("mouseleave", () => this.startAutoplay());

    // タッチスワイプ / マウスドラッグ対応
    this.setupGestureControls(sliderContainer);
  }

  updateSlidePosition(animate = true) {
    if (!this.track) return;
    if (animate) {
      this.track.style.transition = "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)";
    } else {
      this.track.style.transition = "none";
    }
    this.track.style.transform = `translateX(-${this.currentIndex * 100}%)`;

    // ドット状態更新
    const n = this.events.length;
    let activeDotIdx = this.currentIndex - 1;
    if (activeDotIdx < 0) activeDotIdx = n - 1;
    if (activeDotIdx >= n) activeDotIdx = 0;

    if (this.dots) {
      this.dots.forEach((dot, idx) => {
        dot.classList.toggle("is-active", idx === activeDotIdx);
      });
    }
  }

  nextSlide() {
    if (this.isTransitioning || this.events.length <= 1) return;
    this.isTransitioning = true;
    this.currentIndex++;
    this.updateSlidePosition(true);
  }

  prevSlide() {
    if (this.isTransitioning || this.events.length <= 1) return;
    this.isTransitioning = true;
    this.currentIndex--;
    this.updateSlidePosition(true);
  }

  goToSlide(index) {
    if (this.isTransitioning || this.currentIndex === index) return;
    this.isTransitioning = true;
    this.currentIndex = index;
    this.updateSlidePosition(true);
    this.restartAutoplay();
  }

  startAutoplay() {
    this.stopAutoplay();
    if (this.events.length <= 1) return;
    this.timer = setInterval(() => {
      this.nextSlide();
    }, this.autoplayInterval);
  }

  stopAutoplay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restartAutoplay() {
    this.stopAutoplay();
    this.startAutoplay();
  }

  setupGestureControls(container) {
    let startX = 0;
    let deltaX = 0;
    let isDragging = false;

    const onStart = (clientX) => {
      this.stopAutoplay();
      startX = clientX;
      deltaX = 0;
      isDragging = true;
    };

    const onMove = (clientX) => {
      if (!isDragging) return;
      deltaX = clientX - startX;
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      if (deltaX < -45) {
        this.nextSlide();
      } else if (deltaX > 45) {
        this.prevSlide();
      }
      this.startAutoplay();
    };

    // タッチイベント (SP)
    container.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 0) {
        onStart(e.touches[0].clientX);
      }
    }, { passive: true });

    container.addEventListener("touchmove", (e) => {
      if (e.touches && e.touches.length > 0) {
        onMove(e.touches[0].clientX);
      }
    }, { passive: true });

    container.addEventListener("touchend", onEnd);

    // マウスドラッグイベント (PC)
    container.addEventListener("mousedown", (e) => {
      onStart(e.clientX);
    });

    container.addEventListener("mousemove", (e) => {
      if (isDragging) {
        onMove(e.clientX);
        e.preventDefault();
      }
    });

    container.addEventListener("mouseup", onEnd);

    // ドラッグスワイプ中の誤クリック抑止
    container.addEventListener("click", (e) => {
      if (Math.abs(deltaX) > 10) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }
}

/**
 * LP Main Controller
 * - themeConfig の適用 (4層背景レイヤー最背面 & カラー変数)
 * - section テーブルに基づく動的セクション生成 & 4層レイヤー構築
 * - スムーズスクロールナビゲーション
 * - フッターリンク
 */

import { api } from "../common/api-client.js";
import { ProfileSection } from "./profile-section.js";
import { EventSection } from "./event-section.js";
import { NoticeSection } from "./notice-section.js";
import { ScheduleSection } from "./schedule-section.js";
import { GallerySection } from "./gallery-section.js";
import { MovieSection } from "./movie-section.js";
import { ShopSection } from "./shop-section.js";
import { LinkSection } from "./link-section.js";

class LpApp {
  constructor() {
    this.themeConfig = null;
    this.sections = [];
    this.allData = {};
  }

  async init() {
    try {
      // 1. themeConfig と section テーブルの取得
      const [themeRes, sectionRes] = await Promise.all([
        api.getTable("themeConfig", 1),
        api.getTable("section"),
      ]);

      this.themeConfig = themeRes || {};
      this.sections = (Array.isArray(sectionRes) ? sectionRes : [])
        .filter((s) => s.isFeatured === 1 || s.isFeatured === true)
        .sort((a, b) => (a.priority || 0) - (b.priority || 0));

      // 2. テーマ外観設定の適用
      this.applyThemeConfig();

      // 3. 各セクションデータの並行取得
      await this.loadAllSectionData();

      // 4. ヘッダーナビゲーション生成
      this.buildHeaderNav();

      // 5. 各セクションの 4層レイヤー構造の描画
      this.buildSections();

      // 6. フッター生成
      this.buildFooter();

      // 7. スクロール監視 (ヘッダーの背景変化など)
      this.setupScrollWatcher();
    } catch (err) {
      console.error("[LpApp Initialization Error]:", err);
    }
  }

  /**
   * Layer 1: 最背面背景 & CSS変数の適用
   */
  applyThemeConfig() {
    const root = document.documentElement;
    const tc = this.themeConfig;

    // カード背景 (single または gradient)
    if (tc.card_bg_type === "single" && tc.card_bg_color) {
      root.style.setProperty("--theme-card-bg", tc.card_bg_color);
    } else if (tc.card_bg_gradient_start && tc.card_bg_gradient_end) {
      const angle = tc.card_bg_gradient_angle ?? 0;
      root.style.setProperty(
        "--theme-card-bg",
        `linear-gradient(${angle}deg, ${tc.card_bg_gradient_start}, ${tc.card_bg_gradient_end})`
      );
    }

    // 文字色
    if (tc.card_text_color) {
      root.style.setProperty("--theme-card-text-color", tc.card_text_color);
    }
    if (tc.section_title_color) {
      root.style.setProperty("--theme-section-title-color", tc.section_title_color);
    }

    // 最背面背景画像 (画面横幅100%フィット)
    const pageBgLayer = document.getElementById("lp-page-bg-layer");
    if (pageBgLayer && tc.background) {
      const bgUrl = api.resolveAssetUrl(tc.background, "config");
      pageBgLayer.style.backgroundImage = `url("${bgUrl}")`;
    }
  }

  /**
   * 各セクションにバインドするデータの取得
   */
  async loadAllSectionData() {
    const promises = [
      api.getTable("profile", 1).then((d) => (this.allData.profile = d)),
      api.getTable("visual").then((d) => (this.allData.visual = d)),
      api.getTable("event").then((d) => (this.allData.event = d)),
      api.getTable("notice").then((d) => (this.allData.notice = d)),
      api.getTable("schedule").then((d) => (this.allData.schedule = d)),
      api.getTable("scheduleTag").then((d) => (this.allData.scheduleTag = d)),
      api.getTable("gallery").then((d) => (this.allData.gallery = d)),
      api.getTable("movieCategory").then((d) => (this.allData.movieCategory = d)),
      api.getTable("movieTag").then((d) => (this.allData.movieTag = d)),
      api.getTable("movieList").then((d) => (this.allData.movieList = d)),
      api.getTable("movie").then((d) => (this.allData.movie = d)),
      api.getTable("shopTag").then((d) => (this.allData.shopTag = d)),
      api.getTable("shop").then((d) => (this.allData.shop = d)),
      api.getTable("linkList").then((d) => (this.allData.linkList = d)),
    ];

    await Promise.allSettled(promises);
  }

  /**
   * ヘッダーのジャンプナビゲーション生成
   */
  buildHeaderNav() {
    const navList = document.getElementById("lp-header-nav-list");
    const mobileList = document.getElementById("lp-mobile-nav-list");
    if (!navList) return;

    navList.innerHTML = "";
    if (mobileList) mobileList.innerHTML = "";

    this.sections.forEach((sec) => {
      if (!sec.headerName) return;
      const targetId = `section-${sec.id}`;

      // PC ナビ
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = "lp-header-nav-link";
      a.href = `#${targetId}`;
      a.textContent = sec.headerName;
      a.onclick = (e) => this.smoothScrollTo(e, targetId);
      li.appendChild(a);
      navList.appendChild(li);

      // モバイル ナビ
      if (mobileList) {
        const mLi = document.createElement("li");
        const mA = document.createElement("a");
        mA.className = "lp-header-mobile-nav-link";
        mA.href = `#${targetId}`;
        mA.textContent = sec.headerName;
        mA.onclick = (e) => {
          this.smoothScrollTo(e, targetId);
          this.closeMobileDrawer();
        };
        mLi.appendChild(mA);
        mobileList.appendChild(mLi);
      }
    });

    // モバイルハンバーガー制御
    const hamburger = document.getElementById("lp-hamburger-btn");
    const drawer = document.getElementById("lp-mobile-drawer");
    if (hamburger && drawer) {
      hamburger.onclick = () => {
        const isOpen = drawer.classList.contains("is-open");
        if (isOpen) {
          this.closeMobileDrawer();
        } else {
          hamburger.classList.add("is-active");
          drawer.classList.add("is-open");
        }
      };
    }
  }

  closeMobileDrawer() {
    const hamburger = document.getElementById("lp-hamburger-btn");
    const drawer = document.getElementById("lp-mobile-drawer");
    if (hamburger) hamburger.classList.remove("is-active");
    if (drawer) drawer.classList.remove("is-open");
  }

  smoothScrollTo(e, elementId) {
    e.preventDefault();
    const el = document.getElementById(elementId);
    if (!el) return;
    const headerHeight = 72;
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  }

  /**
   * 4層背景レイヤー構造による各セクションの構築
   */
  buildSections() {
    const main = document.getElementById("lp-main-container");
    if (!main) return;
    main.innerHTML = "";

    this.sections.forEach((sec) => {
      const sectionEl = document.createElement("section");
      sectionEl.id = `section-${sec.id}`;
      sectionEl.className = `lp-section lp-section-${sec.headerName?.toLowerCase() || sec.id}`;

      // Layer 2: 中面 - セクション背景 (section.sectionBackground)
      if (sec.sectionBackground) {
        const bgLayer = document.createElement("div");
        bgLayer.className = "lp-section-bg-layer";
        bgLayer.style.backgroundImage = `url("${api.resolveAssetUrl(sec.sectionBackground, "section/sectionBackground")}")`;
        sectionEl.appendChild(bgLayer);
      }

      // Layer 3: 前面 - ライン装飾 (topLine)
      if (sec.topLine) {
        const topLine = document.createElement("div");
        topLine.className = "lp-section-topline";
        const topImg = document.createElement("img");
        topImg.src = api.resolveAssetUrl(sec.topLine, "section/topLine");
        topImg.alt = "";
        topLine.appendChild(topImg);
        sectionEl.appendChild(topLine);
      }

      // Layer 4: 最前面 - 各セクションのコンテンツ
      const contentLayer = document.createElement("div");
      contentLayer.className = "app-container lp-section-content";

      // セクション見出し (id 1, 2 はタイトル不要設定可能)
      if (sec.sectionName) {
        const headerEl = document.createElement("div");
        headerEl.className = "lp-section-header";

        const titleEl = document.createElement("h2");
        titleEl.className = "lp-section-title";
        titleEl.textContent = sec.sectionName;
        headerEl.appendChild(titleEl);

        if (sec.comment) {
          const descEl = document.createElement("p");
          descEl.className = "lp-section-desc";
          descEl.textContent = sec.comment;
          headerEl.appendChild(descEl);
        }

        contentLayer.appendChild(headerEl);
      }

      // コンポーネントマウント用コンテナ
      const compContainer = document.createElement("div");
      compContainer.className = "lp-section-body";
      contentLayer.appendChild(compContainer);
      sectionEl.appendChild(contentLayer);

      // Layer 3: 前面 - ライン装飾 (outLine)
      if (sec.outLine) {
        const outLine = document.createElement("div");
        outLine.className = "lp-section-outline";
        const outImg = document.createElement("img");
        outImg.src = api.resolveAssetUrl(sec.outLine, "section/outLine");
        outImg.alt = "";
        outLine.appendChild(outImg);
        sectionEl.appendChild(outLine);
      }

      main.appendChild(sectionEl);

      // セクション固有のコンポーネントマウント
      this.mountComponent(sec, compContainer);
    });
  }

  /**
   * セクションID / ヘッダー名に応じたコンポーネントの初期化
   */
  mountComponent(sec, container) {
    const key = (sec.headerName || "").toUpperCase();

    switch (key) {
      case "PROFILE":
        new ProfileSection(container, this.allData.profile, this.allData.visual).render();
        break;
      case "EVENT":
        new EventSection(container, this.allData.event).render();
        break;
      case "NOTICE":
        new NoticeSection(container, this.allData.notice).render();
        break;
      case "SCHEDULE":
        new ScheduleSection(container, this.allData.schedule, this.allData.scheduleTag).render();
        break;
      case "GALLERY":
        new GallerySection(container, this.allData.gallery).render();
        break;
      case "MOVIE":
        new MovieSection(
          container,
          this.allData.movie,
          this.allData.movieCategory,
          this.allData.movieTag,
          this.allData.movieList
        ).render();
        break;
      case "SHOP":
        new ShopSection(container, this.allData.shop, this.allData.shopTag).render();
        break;
      case "LINK":
        new LinkSection(container, this.allData.linkList).render();
        break;
      default:
        console.warn(`未対応のセクション: ${key}`);
        break;
    }
  }

  /**
   * フッターリンク (コピーライトおよび guideline.html への導線)
   */
  buildFooter() {
    const footerLinkContainer = document.getElementById("lp-footer-links");
    const copyrightEl = document.getElementById("lp-footer-copyright");

    if (footerLinkContainer) {
      footerLinkContainer.innerHTML = `
        <a href="guideline.html" class="lp-footer-link">ガイドライン・二次創作規約</a>
        <a href="admin.html" class="lp-footer-link" style="opacity: 0.6;">管理者ログイン</a>
      `;
    }

    if (copyrightEl) {
      const year = new Date().getFullYear();
      const author = this.allData.profile?.name || "ELISA";
      copyrightEl.textContent = `© ${year} ${author}. All Rights Reserved.`;
    }
  }

  /**
   * スクロールヘッダー背景エフェクト
   */
  setupScrollWatcher() {
    const header = document.querySelector(".lp-header");
    if (!header) return;

    window.addEventListener("scroll", () => {
      if (window.scrollY > 30) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    });
  }
}

// 起動
document.addEventListener("DOMContentLoaded", () => {
  const app = new LpApp();
  app.init();
});


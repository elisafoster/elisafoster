/**
 * Rich Text Editor Component (WYSIWYG)
 * guideline 本文用リッチテキストエディタ
 * Googleドキュメント風の直接編集インターフェース
 * 常にプレビュー形式で直接編集でき、D1保存時にMarkdown記法（# 項目, > 注意書き, - 箇条書き, **太字**等）へ自動変換
 */

import { MarkdownParser } from "../common/markdown-parser.js";

export class RichTextEditor {
  constructor(container, initialMarkdown = "") {
    this.container = container;
    this.initialMarkdown = initialMarkdown || "";
    this.editor = null;
    this.blockSelect = null;
    this.boldBtn = null;
    this.italicBtn = null;
    this.listBtn = null;
    this.quoteBtn = null;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "admin-rte-container";

    // 1. ツールバー (Googleドキュメント風)
    const toolbar = document.createElement("div");
    toolbar.className = "admin-rte-toolbar";

    // [本文 / 項目] スタイル切り替えセレクトボックス
    const blockSelect = document.createElement("select");
    blockSelect.className = "admin-rte-select";
    blockSelect.innerHTML = `
      <option value="p">本文 (通常の段落)</option>
      <option value="h2">項目 (大見出し)</option>
    `;
    blockSelect.onchange = (e) => {
      this.setBlockType(e.target.value);
    };
    this.blockSelect = blockSelect;
    toolbar.appendChild(blockSelect);

    const div1 = document.createElement("div");
    div1.className = "admin-rte-divider";
    toolbar.appendChild(div1);

    // B 太字ボタン (太字 ⇔ 通常のトグル)
    const boldBtn = document.createElement("button");
    boldBtn.type = "button";
    boldBtn.className = "admin-rte-btn";
    boldBtn.innerHTML = "<strong>B</strong> 太字";
    boldBtn.title = "太字装飾の適用・解除（トグル）";
    boldBtn.onmousedown = (e) => e.preventDefault();
    boldBtn.onclick = () => this.formatDoc("bold");
    this.boldBtn = boldBtn;
    toolbar.appendChild(boldBtn);

    // I 斜体ボタン (斜体 ⇔ 通常のトグル)
    const italicBtn = document.createElement("button");
    italicBtn.type = "button";
    italicBtn.className = "admin-rte-btn";
    italicBtn.innerHTML = "<em>I</em> 斜体";
    italicBtn.title = "斜体装飾の適用・解除（トグル）";
    italicBtn.onmousedown = (e) => e.preventDefault();
    italicBtn.onclick = () => this.formatDoc("italic");
    this.italicBtn = italicBtn;
    toolbar.appendChild(italicBtn);

    const div2 = document.createElement("div");
    div2.className = "admin-rte-divider";
    toolbar.appendChild(div2);

    // • 箇条書きボタン (箇条書き ⇔ 通常のトグル)
    const listBtn = document.createElement("button");
    listBtn.type = "button";
    listBtn.className = "admin-rte-btn";
    listBtn.innerHTML = "• 箇条書き";
    listBtn.title = "箇条書きリストの適用・解除（トグル）";
    listBtn.onmousedown = (e) => e.preventDefault();
    listBtn.onclick = () => this.toggleList();
    this.listBtn = listBtn;
    toolbar.appendChild(listBtn);

    // 💬 注意書きボタン (注意書き ⇔ 通常のトグル)
    const quoteBtn = document.createElement("button");
    quoteBtn.type = "button";
    quoteBtn.className = "admin-rte-btn";
    quoteBtn.innerHTML = "💬 注意書き";
    quoteBtn.title = "注意書き（引用枠）の適用・解除（トグル）";
    quoteBtn.onmousedown = (e) => e.preventDefault();
    quoteBtn.onclick = () => this.toggleQuote();
    this.quoteBtn = quoteBtn;
    toolbar.appendChild(quoteBtn);

    const div3 = document.createElement("div");
    div3.className = "admin-rte-divider";
    toolbar.appendChild(div3);

    // 🔗 リンクボタン
    const linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.className = "admin-rte-btn";
    linkBtn.innerHTML = "🔗 リンク";
    linkBtn.title = "リンクの挿入";
    linkBtn.onmousedown = (e) => e.preventDefault();
    linkBtn.onclick = () => this.formatLink();
    toolbar.appendChild(linkBtn);

    // 右側のリアルタイムWYSIWYG案内バッジ
    const hint = document.createElement("div");
    hint.className = "admin-rte-live-badge";
    hint.style.cssText = "margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #94a3b8;";
    hint.innerHTML = `<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span><span>WYSIWYG プレビュー直接編集</span>`;
    toolbar.appendChild(hint);

    wrapper.appendChild(toolbar);

    // 2. プレビュー形式のまま直接編集できる contenteditable エディタ本体
    const editor = document.createElement("div");
    editor.className = "admin-rte-editor";
    editor.contentEditable = "true";
    editor.spellcheck = false;

    // 初期値の適用 (MarkdownをHTMLに展開してプレビュー表示で流し込む)
    const initialHtml = MarkdownParser.toHtml(this.initialMarkdown);
    editor.innerHTML = initialHtml || "<p class=\"gl-paragraph\">ガイドラインの本文を入力してください...</p>";

    // キャレット・選択範囲移動時にツールバーボタン・セレクトの状態を更新
    editor.addEventListener("keyup", () => this.updateToolbarState());
    editor.addEventListener("mouseup", () => this.updateToolbarState());
    editor.addEventListener("click", () => this.updateToolbarState());
    editor.addEventListener("input", () => this.updateToolbarState());
    editor.addEventListener("focus", () => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {}
      this.updateToolbarState();
    });

    // Googleドキュメント風のEnterキー挙動（見出し末尾でのEnterで自動的に通常本文段落を生成）
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        const heading = this.getClosestTag("h2") || this.getClosestTag("h1") || this.getClosestTag("h3");
        if (heading) {
          const sel = window.getSelection();
          if (sel && sel.isCollapsed && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const headingRange = document.createRange();
            headingRange.selectNodeContents(heading);
            headingRange.collapse(false);
            if (range.compareBoundaryPoints(Range.END_TO_END, headingRange) === 0) {
              e.preventDefault();
              const p = document.createElement("p");
              p.className = "gl-paragraph";
              p.innerHTML = "<br>";
              if (heading.nextSibling) {
                heading.parentNode.insertBefore(p, heading.nextSibling);
              } else {
                heading.parentNode.appendChild(p);
              }
              const newRange = document.createRange();
              newRange.setStart(p, 0);
              newRange.collapse(true);
              sel.removeAllRanges();
              sel.addRange(newRange);
              this.updateToolbarState();
              return;
            }
          }
        }
      }
    });

    this.editor = editor;
    wrapper.appendChild(editor);

    this.container.appendChild(wrapper);

    // 初回ツールバー状態更新
    setTimeout(() => this.updateToolbarState(), 50);
  }

  /**
   * 現在のキャレット位置にある最も近いブロック要素を取得
   */
  getCurrentBlockElement() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && node !== this.editor) {
      const tag = node.tagName.toLowerCase();
      if (["p", "h1", "h2", "h3", "blockquote", "li", "ul", "ol", "div"].includes(tag)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  /**
   * キャレット位置の祖先にある特定タグを取得
   */
  getClosestTag(tagName) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    let node = selection.getRangeAt(0).commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const target = tagName.toLowerCase();
    while (node && node !== this.editor) {
      if (node.tagName.toLowerCase() === target) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  /**
   * 本文 (p) / 項目 (h2) の上書き切り替え
   */
  setBlockType(tag) {
    if (!this.editor) return;
    this.editor.focus();

    // もしリスト内 (li) にいる場合はリストを解除してからブロック化
    if (this.getClosestTag("li")) {
      document.execCommand("insertUnorderedList");
    }

    // もし引用 (blockquote) 内にいる場合は引用を解除
    const bq = this.getClosestTag("blockquote");
    if (bq) {
      const targetTag = tag === "h2" ? "h2" : "p";
      const el = document.createElement(targetTag);
      el.className = targetTag === "h2" ? "gl-heading" : "gl-paragraph";
      el.innerHTML = bq.innerHTML;
      bq.parentNode.replaceChild(el, bq);

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      this.updateToolbarState();
      return;
    }

    try {
      document.execCommand("formatBlock", false, `<${tag}>`);
      const block = this.getCurrentBlockElement();
      if (block) {
        if (tag === "h2") {
          block.className = "gl-heading";
        } else {
          block.className = "gl-paragraph";
        }
      }
    } catch (err) {
      console.warn("[RichTextEditor setBlockType Error]:", err);
    }
    this.updateToolbarState();
  }

  /**
   * document.execCommand による安全な書式適用・トグル
   */
  formatDoc(command, value = null) {
    if (!this.editor) return;
    this.editor.focus();
    try {
      document.execCommand(command, false, value);
    } catch (e) {
      console.warn("[RichTextEditor execCommand Error]:", e);
    }
    this.updateToolbarState();
  }

  /**
   * 箇条書き（リスト）のトグル
   */
  toggleList() {
    if (!this.editor) return;
    this.editor.focus();

    // もし引用 (blockquote) 内にいる場合は引用を解除してからリスト化
    const bq = this.getClosestTag("blockquote");
    if (bq) {
      const p = document.createElement("p");
      p.className = "gl-paragraph";
      p.innerHTML = bq.innerHTML;
      bq.parentNode.replaceChild(p, bq);

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    try {
      document.execCommand("insertUnorderedList");
      const ul = this.getClosestTag("ul");
      if (ul) {
        ul.className = "gl-list";
      }
    } catch (e) {
      console.warn("[RichTextEditor toggleList Error]:", e);
    }
    this.updateToolbarState();
  }

  /**
   * 注意書き（引用枠）のトグル
   */
  toggleQuote() {
    if (!this.editor) return;
    this.editor.focus();

    const existingQuote = this.getClosestTag("blockquote");
    if (existingQuote) {
      // 解除: blockquote を p に変換してアンラップ
      const p = document.createElement("p");
      p.className = "gl-paragraph";
      p.innerHTML = existingQuote.innerHTML;
      existingQuote.parentNode.replaceChild(p, existingQuote);

      // キャレット復元
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(p);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // もしリスト内にいる場合はリストを解除してから注意書き化
      if (this.getClosestTag("li")) {
        document.execCommand("insertUnorderedList");
      }

      // 注意書き化
      try {
        document.execCommand("formatBlock", false, "<blockquote>");
        const bq = this.getClosestTag("blockquote");
        if (bq) {
          bq.className = "gl-alert";
        }
      } catch (e) {
        console.warn("[RichTextEditor toggleQuote Error]:", e);
      }
    }
    this.updateToolbarState();
  }

  /**
   * リンク挿入
   */
  formatLink() {
    if (!this.editor) return;
    this.editor.focus();

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";

    const url = prompt("リンク先URLを入力してください (例: https://example.com)", "https://");
    if (!url || url === "https://") return;

    if (!selectedText) {
      // 選択テキストがない場合はリンクHTMLを直接挿入
      const linkHtml = `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    } else {
      document.execCommand("createLink", false, url);
      // 生成された a タグに target="_blank" を付与
      if (selection && selection.anchorNode) {
        let parent = selection.anchorNode.parentElement;
        if (parent && parent.tagName.toLowerCase() === "a") {
          parent.target = "_blank";
          parent.rel = "noopener noreferrer";
        }
      }
    }
    this.updateToolbarState();
  }

  /**
   * ツールバーボタン（太字・斜体・リスト・引用・ブロック種別）の状態をキャレット位置に応じて更新
   */
  updateToolbarState() {
    try {
      // 1. 太字ボタン
      if (this.boldBtn) {
        if (document.queryCommandState("bold")) {
          this.boldBtn.classList.add("is-active");
        } else {
          this.boldBtn.classList.remove("is-active");
        }
      }

      // 2. 斜体ボタン
      if (this.italicBtn) {
        if (document.queryCommandState("italic")) {
          this.italicBtn.classList.add("is-active");
        } else {
          this.italicBtn.classList.remove("is-active");
        }
      }

      // 3. 箇条書きボタン
      if (this.listBtn) {
        const isList = document.queryCommandState("insertUnorderedList") || !!this.getClosestTag("li");
        if (isList) {
          this.listBtn.classList.add("is-active");
        } else {
          this.listBtn.classList.remove("is-active");
        }
      }

      // 4. 注意書きボタン
      if (this.quoteBtn) {
        const isQuote = !!this.getClosestTag("blockquote");
        if (isQuote) {
          this.quoteBtn.classList.add("is-active");
        } else {
          this.quoteBtn.classList.remove("is-active");
        }
      }

      // 5. 本文 / 項目 セレクトボックス連動
      if (this.blockSelect) {
        const heading = this.getClosestTag("h2") || this.getClosestTag("h1") || this.getClosestTag("h3");
        if (heading) {
          this.blockSelect.value = "h2";
        } else {
          this.blockSelect.value = "p";
        }
      }
    } catch (e) {
      console.warn("[RichTextEditor updateToolbarState Error]:", e);
    }
  }

  /**
   * D1保存用のシリアライズされたMarkdown文字列の取得
   */
  getValue() {
    if (!this.editor) return "";
    return MarkdownParser.htmlToMarkdown(this.editor);
  }

  /**
   * 読み込み
   */
  setValue(newMarkdown) {
    this.initialMarkdown = newMarkdown || "";
    if (this.editor) {
      this.editor.innerHTML = MarkdownParser.toHtml(this.initialMarkdown);
      this.updateToolbarState();
    }
  }
}

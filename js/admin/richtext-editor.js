/**
 * Rich Text Editor Component (WYSIWYG)
 * guideline 本文用リッチテキストエディタ
 * 常にプレビュー形式で直接編集でき、D1保存時にMarkdown記法（**太字**等）へ自動変換
 */

import { MarkdownParser } from "../common/markdown-parser.js";

export class RichTextEditor {
  constructor(container, initialMarkdown = "") {
    this.container = container;
    this.initialMarkdown = initialMarkdown || "";
    this.editor = null;
    this.boldBtn = null;
    this.italicBtn = null;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "admin-rte-container";

    // 1. ツールバー
    const toolbar = document.createElement("div");
    toolbar.className = "admin-rte-toolbar";

    // ブロック種別切り替え (見出し / 本文 / 引用 / 箇条書き)
    const blockSelect = document.createElement("select");
    blockSelect.className = "admin-rte-select";
    blockSelect.innerHTML = `
      <option value="p">本文 (通常の段落)</option>
      <option value="h2">項目 (大見出し)</option>
      <option value="blockquote">注意書き (引用ブロック)</option>
      <option value="ul">箇条書き (リスト)</option>
    `;
    blockSelect.onchange = (e) => {
      const val = e.target.value;
      if (val === "ul") {
        this.formatDoc("insertUnorderedList");
      } else {
        this.formatDoc("formatBlock", `<${val}>`);
      }
      e.target.value = "p"; // 選択後にリセット
    };
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
    // ボタンクリック時にエディタの選択範囲が解除されないよう onmousedown で preventDefault
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
    editor.innerHTML = initialHtml || "<p>ガイドラインの本文を入力してください...</p>";

    // キャレット・選択範囲移動時にツールバーボタンのアクティブ状態を更新
    editor.addEventListener("keyup", () => this.updateToolbarState());
    editor.addEventListener("mouseup", () => this.updateToolbarState());
    editor.addEventListener("focus", () => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {}
      this.updateToolbarState();
    });

    this.editor = editor;
    wrapper.appendChild(editor);

    this.container.appendChild(wrapper);
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
   * ツールバーボタン（太字・斜体）のアクティブ状態をキャレット位置に応じて更新
   */
  updateToolbarState() {
    try {
      if (this.boldBtn) {
        if (document.queryCommandState("bold")) {
          this.boldBtn.classList.add("is-active");
        } else {
          this.boldBtn.classList.remove("is-active");
        }
      }
      if (this.italicBtn) {
        if (document.queryCommandState("italic")) {
          this.italicBtn.classList.add("is-active");
        } else {
          this.italicBtn.classList.remove("is-active");
        }
      }
    } catch (e) {}
  }

  /**
   * D1保存用のシリアライズされたMarkdown文字列の取得
   * (エディタ内の太字 <b> / <strong> は **テキスト** 形式に変換される)
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
    }
  }
}



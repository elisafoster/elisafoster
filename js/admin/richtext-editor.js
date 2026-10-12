/**
 * Rich Text Editor Component
 * guideline 本文編集用ツールバー & 構造化Markdownシリアライズ/デシリアライズ
 */

import { MarkdownParser } from "../common/markdown-parser.js";

export class RichTextEditor {
  constructor(container, initialMarkdown = "") {
    this.container = container;
    this.markdown = initialMarkdown || "";
    this.textarea = null;
    this.previewArea = null;
    this.mode = "edit"; // "edit" | "preview"
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "admin-rte-container";

    // 1. ツールバー
    const toolbar = document.createElement("div");
    toolbar.className = "admin-rte-toolbar";

    // ブロック種別切り替え (見出し / 本文 / 引用 / リスト)
    const blockSelect = document.createElement("select");
    blockSelect.className = "admin-rte-select";
    blockSelect.innerHTML = `
      <option value="paragraph">本文 (通常の段落)</option>
      <option value="heading">項目 (見出し: # )</option>
      <option value="alert">注意書き (引用: > )</option>
      <option value="list">箇条書き (リスト: - )</option>
    `;
    blockSelect.onchange = (e) => {
      this.applyBlockFormat(e.target.value);
      e.target.value = "paragraph"; // リセット
    };
    toolbar.appendChild(blockSelect);

    const div1 = document.createElement("div");
    div1.className = "admin-rte-divider";
    toolbar.appendChild(div1);

    // インライン装飾ボタン群
    const boldBtn = document.createElement("button");
    boldBtn.type = "button";
    boldBtn.className = "admin-rte-btn";
    boldBtn.innerHTML = "<strong>B</strong> 太字";
    boldBtn.title = "太字装飾 (**テキスト**)";
    boldBtn.onclick = () => this.applyInlineFormat("bold");
    toolbar.appendChild(boldBtn);

    const italicBtn = document.createElement("button");
    italicBtn.type = "button";
    italicBtn.className = "admin-rte-btn";
    italicBtn.innerHTML = "<em>I</em> 斜体";
    italicBtn.title = "斜体装飾 (*テキスト*)";
    italicBtn.onclick = () => this.applyInlineFormat("italic");
    toolbar.appendChild(italicBtn);

    const linkBtn = document.createElement("button");
    linkBtn.type = "button";
    linkBtn.className = "admin-rte-btn";
    linkBtn.innerHTML = "🔗 リンク";
    linkBtn.title = "リンク挿入 ([テキスト](URL))";
    linkBtn.onclick = () => this.applyLinkFormat();
    toolbar.appendChild(linkBtn);

    // 編集 / プレビュー切り替えタブ
    const tabs = document.createElement("div");
    tabs.className = "admin-rte-tabs";

    const editTab = document.createElement("button");
    editTab.type = "button";
    editTab.className = "admin-rte-tab-btn is-active";
    editTab.textContent = "エディタ";
    editTab.onclick = () => this.switchMode("edit", editTab, prevTab);

    const prevTab = document.createElement("button");
    prevTab.type = "button";
    prevTab.className = "admin-rte-tab-btn";
    prevTab.textContent = "プレビュー";
    prevTab.onclick = () => this.switchMode("preview", editTab, prevTab);

    tabs.appendChild(editTab);
    tabs.appendChild(prevTab);
    toolbar.appendChild(tabs);

    wrapper.appendChild(toolbar);

    // 2. テキストエリア本体
    const textarea = document.createElement("textarea");
    textarea.className = "admin-rte-textarea";
    textarea.value = this.markdown;
    textarea.placeholder = "ガイドラインの本文を入力してください...";
    textarea.oninput = (e) => {
      this.markdown = e.target.value;
    };
    this.textarea = textarea;
    wrapper.appendChild(textarea);

    // 3. リアルタイムプレビュー領域
    const previewArea = document.createElement("div");
    previewArea.className = "admin-rte-preview";
    this.previewArea = previewArea;
    wrapper.appendChild(previewArea);

    this.container.appendChild(wrapper);
  }

  switchMode(mode, editTab, prevTab) {
    this.mode = mode;
    if (mode === "edit") {
      editTab.classList.add("is-active");
      prevTab.classList.remove("is-active");
      this.textarea.style.display = "block";
      this.previewArea.classList.remove("is-active");
    } else {
      prevTab.classList.add("is-active");
      editTab.classList.remove("is-active");
      this.textarea.style.display = "none";
      this.previewArea.classList.add("is-active");
      this.previewArea.innerHTML = MarkdownParser.toHtml(this.markdown);
    }
  }

  /**
   * ブロックフォーマットの適用
   */
  applyBlockFormat(type) {
    const ta = this.textarea;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = ta.value;

    // カーソル位置の行全体を検出
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = text.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = text.length;

    const currentLine = text.slice(lineStart, lineEnd);
    // 既存のプレフィックスを除去
    const cleanLine = currentLine.replace(/^(#+\s*|>\s*|[-*]\s*)/, "");

    let newLine = cleanLine;
    if (type === "heading") {
      newLine = `# ${cleanLine}`;
    } else if (type === "alert") {
      newLine = `> ${cleanLine}`;
    } else if (type === "list") {
      newLine = `- ${cleanLine}`;
    }

    ta.value = text.slice(0, lineStart) + newLine + text.slice(lineEnd);
    this.markdown = ta.value;
    ta.focus();
    ta.setSelectionRange(lineStart + newLine.length, lineStart + newLine.length);
  }

  /**
   * インラインフォーマット（太字・斜体）の適用
   */
  applyInlineFormat(type) {
    const ta = this.textarea;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end);

    const marker = type === "bold" ? "**" : "*";
    const defaultText = type === "bold" ? "太字テキスト" : "斜体テキスト";
    const insertion = `${marker}${selected || defaultText}${marker}`;

    ta.setRangeText(insertion, start, end, "select");
    this.markdown = ta.value;
    ta.focus();
  }

  /**
   * リンクフォーマットの適用
   */
  applyLinkFormat() {
    const ta = this.textarea;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.substring(start, end) || "リンクテキスト";

    const url = prompt("リンク先URLを入力してください (例: https://example.com)", "https://");
    if (!url) return;

    const insertion = `[${selected}](${url})`;
    ta.setRangeText(insertion, start, end, "select");
    this.markdown = ta.value;
    ta.focus();
  }

  /**
   * シリアライズされたMarkdown文字列の取得
   */
  getValue() {
    return MarkdownParser.normalizeMarkdown(this.markdown);
  }

  /**
   * 読み込み
   */
  setValue(newMarkdown) {
    this.markdown = newMarkdown || "";
    if (this.textarea) {
      this.textarea.value = this.markdown;
    }
  }
}


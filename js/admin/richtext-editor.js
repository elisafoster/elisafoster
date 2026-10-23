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
    this.savedRange = null; // ドロップダウン選択等でキャレットが外れた際の退避用
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

    // セレクトボックスをクリックした瞬間に現在の選択範囲を退避
    blockSelect.onmousedown = () => this.saveSelection();
    blockSelect.onfocus = () => this.saveSelection();
    blockSelect.onchange = (e) => {
      this.applyBlockType(e.target.value);
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

    // キャレット・選択範囲移動時にツールバーボタン・セレクトの状態を更新 & Rangeを保存
    const onSelectionChange = () => {
      this.saveSelection();
      this.updateToolbarState();
    };

    editor.addEventListener("keyup", onSelectionChange);
    editor.addEventListener("mouseup", onSelectionChange);
    editor.addEventListener("click", onSelectionChange);
    editor.addEventListener("input", onSelectionChange);
    editor.addEventListener("focus", () => {
      try {
        document.execCommand("defaultParagraphSeparator", false, "p");
      } catch (e) {}
      onSelectionChange();
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
              this.savedRange = newRange.cloneRange();
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
    setTimeout(() => {
      this.saveSelection();
      this.updateToolbarState();
    }, 50);
  }

  /**
   * 選択範囲（Selection Range）の保存
   */
  saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (this.editor && (this.editor === range.commonAncestorContainer || this.editor.contains(range.commonAncestorContainer))) {
        this.savedRange = range.cloneRange();
      }
    }
  }

  /**
   * 選択範囲の復元
   */
  restoreSelection() {
    if (!this.savedRange) return null;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(this.savedRange);
    return this.savedRange;
  }

  /**
   * 最も近いブロック要素を取得 (h1, h2, h3, p, blockquote, li, ul, ol)
   */
  findNearestBlock(node) {
    if (!node) return null;
    let curr = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    while (curr && curr !== this.editor) {
      const tag = curr.tagName ? curr.tagName.toLowerCase() : "";
      if (["h1", "h2", "h3", "p", "blockquote", "li", "ul", "ol"].includes(tag)) {
        return curr;
      }
      curr = curr.parentNode;
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
   * 本文 (p) / 項目 (h2) の上書き切り替え・自動改行ブロック分割
   * 1行内で項目と本文が混在しないよう、選択テキスト部分を独立した行として分割生成
   */
  applyBlockType(targetTag) {
    if (!this.editor) return;
    this.editor.focus();

    let range = this.restoreSelection();
    if (!range) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) range = sel.getRangeAt(0);
    }
    if (!range) return;

    const targetClass = targetTag === "h2" ? "gl-heading" : "gl-paragraph";

    // 1. テキスト選択がない（キャレットのみ）場合
    if (range.collapsed) {
      let block = this.findNearestBlock(range.startContainer);
      if (!block || block === this.editor) {
        try {
          document.execCommand("formatBlock", false, `<${targetTag}>`);
        } catch (e) {}
        this.saveSelection();
        this.updateToolbarState();
        return;
      }

      const currentTag = block.tagName.toLowerCase();
      if (currentTag === targetTag) return;

      if (currentTag === "li") {
        document.execCommand("insertUnorderedList");
        block = this.findNearestBlock(window.getSelection()?.anchorNode) || block;
      }

      const newEl = document.createElement(targetTag);
      newEl.className = targetClass;
      newEl.innerHTML = block.innerHTML;
      block.parentNode.replaceChild(newEl, block);

      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.selectNodeContents(newEl);
      newRange.collapse(false);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.savedRange = newRange.cloneRange();
      this.updateToolbarState();
      return;
    }

    // 2. テキストが選択されている場合
    let startBlock = this.findNearestBlock(range.startContainer);
    let endBlock = this.findNearestBlock(range.endContainer);

    if (startBlock && startBlock === endBlock && startBlock !== this.editor) {
      const currentBlock = startBlock;
      const currentTag = currentBlock.tagName.toLowerCase();

      // 前の部分の Range
      const beforeRange = document.createRange();
      beforeRange.setStart(currentBlock, 0);
      beforeRange.setEnd(range.startContainer, range.startOffset);

      // 選択部分の Fragment
      const selectedFragment = range.cloneContents();

      // 後の部分の Range
      const afterRange = document.createRange();
      afterRange.setStart(range.endContainer, range.endOffset);
      afterRange.setEnd(currentBlock, currentBlock.childNodes.length);

      const beforeFrag = beforeRange.cloneContents();
      const afterFrag = afterRange.cloneContents();

      const hasBefore = (beforeFrag.textContent || "").trim().length > 0;
      const hasAfter = (afterFrag.textContent || "").trim().length > 0;

      // 前も後もない場合（ブロック全体が選択されている）
      if (!hasBefore && !hasAfter) {
        if (currentTag === "li") {
          const ul = currentBlock.closest("ul") || currentBlock.parentNode;
          const newEl = document.createElement(targetTag);
          newEl.className = targetClass;
          newEl.appendChild(selectedFragment);
          ul.parentNode.insertBefore(newEl, ul.nextSibling);
          currentBlock.remove();
          if (!ul.children.length) ul.remove();

          const sel = window.getSelection();
          const newRange = document.createRange();
          newRange.selectNodeContents(newEl);
          sel.removeAllRanges();
          sel.addRange(newRange);
          this.savedRange = newRange.cloneRange();
          this.updateToolbarState();
          return;
        }

        const newEl = document.createElement(targetTag);
        newEl.className = targetClass;
        newEl.appendChild(selectedFragment);
        currentBlock.parentNode.replaceChild(newEl, currentBlock);

        const sel = window.getSelection();
        const newRange = document.createRange();
        newRange.selectNodeContents(newEl);
        sel.removeAllRanges();
        sel.addRange(newRange);
        this.savedRange = newRange.cloneRange();
        this.updateToolbarState();
        return;
      }

      // 前または後がある場合：1行内で混在しないよう独立行へ分割（改行）！
      // 例: <p>テキスト1テキスト2テキスト3</p> の テキスト2 を h2 にした場合:
      // <p>テキスト1</p>
      // <h2>テキスト2</h2>
      // <p>テキスト3</p>
      const parent = currentBlock.parentNode;
      const createdNodes = [];

      // 前ブロック (元の currentTag と同じ形式を維持)
      if (hasBefore) {
        const beforeEl = document.createElement(currentTag);
        beforeEl.className = currentBlock.className;
        beforeEl.appendChild(beforeFrag);
        createdNodes.push(beforeEl);
      }

      // 中ブロック (選択された targetTag)
      const midEl = document.createElement(targetTag);
      midEl.className = targetClass;
      midEl.appendChild(selectedFragment);
      createdNodes.push(midEl);

      // 後ブロック (元の currentTag と同じ形式を維持)
      if (hasAfter) {
        const afterEl = document.createElement(currentTag);
        afterEl.className = currentBlock.className;
        afterEl.appendChild(afterFrag);
        createdNodes.push(afterEl);
      }

      // リスト要素内の場合の親ブロック配置
      if (currentTag === "li") {
        const ul = currentBlock.closest("ul") || parent;
        if (hasBefore) {
          const beforeLi = document.createElement("li");
          beforeLi.appendChild(beforeFrag);
          ul.insertBefore(beforeLi, currentBlock);
        }
        ul.parentNode.insertBefore(midEl, ul.nextSibling);
        if (hasAfter) {
          const newUl = document.createElement("ul");
          newUl.className = "gl-list";
          const afterLi = document.createElement("li");
          afterLi.appendChild(afterFrag);
          newUl.appendChild(afterLi);
          midEl.parentNode.insertBefore(newUl, midEl.nextSibling);
        }
        currentBlock.remove();
        if (!ul.children.length) ul.remove();
      } else {
        for (const node of createdNodes) {
          parent.insertBefore(node, currentBlock);
        }
        parent.removeChild(currentBlock);
      }

      // 変換された中央の要素 (midEl) を選択状態にする
      const sel = window.getSelection();
      const newRange = document.createRange();
      newRange.selectNodeContents(midEl);
      sel.removeAllRanges();
      sel.addRange(newRange);
      this.savedRange = newRange.cloneRange();
      this.updateToolbarState();
      return;
    }

    // 複数ブロックにまたがって選択されている場合
    const blocksToConvert = [];
    for (const child of Array.from(this.editor.children)) {
      if (range.intersectsNode(child)) {
        blocksToConvert.push(child);
      }
    }

    for (const blk of blocksToConvert) {
      if (blk.tagName.toLowerCase() === targetTag) continue;
      const newEl = document.createElement(targetTag);
      newEl.className = targetClass;
      newEl.innerHTML = blk.innerHTML;
      blk.parentNode.replaceChild(newEl, blk);
    }

    this.saveSelection();
    this.updateToolbarState();
  }

  /**
   * document.execCommand による安全な書式適用・トグル
   */
  formatDoc(command, value = null) {
    if (!this.editor) return;
    this.editor.focus();
    this.restoreSelection();
    try {
      document.execCommand(command, false, value);
    } catch (e) {
      console.warn("[RichTextEditor execCommand Error]:", e);
    }
    this.saveSelection();
    this.updateToolbarState();
  }

  /**
   * 箇条書き（リスト）のトグル
   */
  toggleList() {
    if (!this.editor) return;
    this.editor.focus();
    this.restoreSelection();

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
    this.saveSelection();
    this.updateToolbarState();
  }

  /**
   * 注意書き（引用枠）のトグル
   */
  toggleQuote() {
    if (!this.editor) return;
    this.editor.focus();
    this.restoreSelection();

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
    this.saveSelection();
    this.updateToolbarState();
  }

  /**
   * リンク挿入
   */
  formatLink() {
    if (!this.editor) return;
    this.editor.focus();
    this.restoreSelection();

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";

    const url = prompt("リンク先URLを入力してください (例: https://example.com)", "https://");
    if (!url || url === "https://") return;

    if (!selectedText) {
      const linkHtml = `<a href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      document.execCommand("insertHTML", false, linkHtml);
    } else {
      document.execCommand("createLink", false, url);
      if (selection && selection.anchorNode) {
        let parent = selection.anchorNode.parentElement;
        if (parent && parent.tagName.toLowerCase() === "a") {
          parent.target = "_blank";
          parent.rel = "noopener noreferrer";
        }
      }
    }
    this.saveSelection();
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
      this.saveSelection();
      this.updateToolbarState();
    }
  }
}

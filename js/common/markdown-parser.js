/**
 * Safe Markdown Parser & Serializer
 * guideline テーブル用 構造化フォーマット（Markdown）の安全なパース・変換
 */

export class MarkdownParser {
  /**
   * HTMLエスケープ (XSS対策)
   */
  static escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * インライン装飾（太字、斜体、リンク）のパース
   */
  static parseInline(text) {
    let html = this.escapeHtml(text);

    // 太字: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // 斜体: *text*
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // リンク: [text](url)
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, linkText, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    });

    return html;
  }

  /**
   * Markdownテキストから安全なHTML文字列へ変換
   */
  static toHtml(markdownText) {
    if (!markdownText) return "";

    const lines = markdownText.split(/\r?\n/);
    const resultHtml = [];
    let currentList = [];

    const flushList = () => {
      if (currentList.length > 0) {
        resultHtml.push(`<ul class="gl-list">${currentList.join("")}</ul>`);
        currentList = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // 空行
      if (!line) {
        flushList();
        continue;
      }

      // 見出し (# 見出し)
      if (line.startsWith("#")) {
        flushList();
        const headingContent = line.replace(/^#+\s*/, "");
        resultHtml.push(`<h2 class="gl-heading">${this.parseInline(headingContent)}</h2>`);
        continue;
      }

      // 引用 / 注意書き (> 注意書き)
      if (line.startsWith(">")) {
        flushList();
        const alertContent = line.replace(/^>\s*/, "");
        resultHtml.push(`<blockquote class="gl-alert">${this.parseInline(alertContent)}</blockquote>`);
        continue;
      }

      // 箇条書きリスト (- 項目)
      if (line.startsWith("- ") || line.startsWith("* ")) {
        const itemContent = line.replace(/^[-*]\s*/, "");
        currentList.push(`<li>${this.parseInline(itemContent)}</li>`);
        continue;
      }

      // 通常段落
      flushList();
      resultHtml.push(`<p class="gl-paragraph">${this.parseInline(line)}</p>`);
    }

    flushList();
    return resultHtml.join("\n");
  }

  /**
   * HTML要素またはHTML文字列から安全にMarkdown文字列へ逆変換
   * (太字: **テキスト**, 斜体: *テキスト*, リンク: [テキスト](URL), 見出し: # 見出し, リスト: - 項目)
   */
  static htmlToMarkdown(htmlOrNode) {
    if (!htmlOrNode) return "";

    let root;
    if (typeof htmlOrNode === "string") {
      const div = document.createElement("div");
      div.innerHTML = htmlOrNode;
      root = div;
    } else {
      root = htmlOrNode;
    }

    const processInline = (node) => {
      let res = "";
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          res += child.nodeValue;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          const inner = processInline(child);
          if (!inner && tag !== "br") continue;

          const isBold = tag === "strong" || tag === "b" || child.style?.fontWeight === "bold" || parseInt(child.style?.fontWeight, 10) >= 600;
          const isItalic = tag === "em" || tag === "i" || child.style?.fontStyle === "italic";

          if (isBold) {
            const trimmed = inner.trim();
            if (trimmed) {
              res += `**${trimmed}**`;
            }
          } else if (isItalic) {
            const trimmed = inner.trim();
            if (trimmed) {
              res += `*${trimmed}*`;
            }
          } else if (tag === "a") {
            const href = child.getAttribute("href") || "";
            res += `[${inner.trim() || href}](${href})`;
          } else if (tag === "br") {
            res += "\n";
          } else {
            res += inner;
          }
        }
      }
      return res;
    };

    const blocks = [];
    for (const child of root.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.nodeValue.trim();
        if (t) blocks.push(t);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (tag === "h1" || tag === "h2" || tag === "h3") {
          const text = processInline(child).trim();
          if (text) blocks.push(`# ${text}`);
        } else if (tag === "blockquote") {
          const lines = processInline(child)
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          if (lines.length > 0) {
            blocks.push(lines.map((l) => `> ${l}`).join("\n"));
          }
        } else if (tag === "ul" || tag === "ol") {
          for (const li of child.querySelectorAll("li")) {
            const text = processInline(li).trim();
            if (text) blocks.push(`- ${text}`);
          }
        } else if (tag === "p" || tag === "div") {
          const text = processInline(child).trim();
          if (text) blocks.push(text);
        } else {
          const text = processInline(child).trim();
          if (text) blocks.push(text);
        }
      }
    }

    return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /**
   * 編集用テキストから構造化Markdownへ正規化
   */
  static normalizeMarkdown(text) {
    return (text || "").replace(/\r\n/g, "\n").trim();
  }
}


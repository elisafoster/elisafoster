import unittest
import re

def escape_html(text):
    if not text:
        return ""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#039;"))

def parse_inline(text):
    html = escape_html(text)
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
    html = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', html)
    return html

def to_html(markdown_text):
    if not markdown_text:
        return ""
    lines = markdown_text.splitlines()
    result_html = []
    current_list = []

    def flush_list():
        nonlocal current_list
        if current_list:
            result_html.append(f'<ul class="gl-list">{"".join(current_list)}</ul>')
            current_list = []

    for line in lines:
        line_stripped = line.strip()
        if not line_stripped:
            flush_list()
            continue
        if line_stripped.startswith("#"):
            flush_list()
            heading = re.sub(r'^#+\s*', '', line_stripped)
            result_html.append(f'<h2 class="gl-heading">{parse_inline(heading)}</h2>')
            continue
        if line_stripped.startswith(">"):
            flush_list()
            alert = re.sub(r'^>\s*', '', line_stripped)
            result_html.append(f'<blockquote class="gl-alert">{parse_inline(alert)}</blockquote>')
            continue
        if line_stripped.startswith("- ") or line_stripped.startswith("* "):
            item = re.sub(r'^[-*]\s*', '', line_stripped)
            current_list.append(f'<li>{parse_inline(item)}</li>')
            continue
        flush_list()
        result_html.append(f'<p class="gl-paragraph">{parse_inline(line_stripped)}</p>')

    flush_list()
    return "\n".join(result_html)

class TestMarkdownParser(unittest.TestCase):
    def test_heading_and_paragraph(self):
        md = "# 1. 見出しタイトル\n通常の段落テキストです。"
        html = to_html(md)
        self.assertIn('<h2 class="gl-heading">1. 見出しタイトル</h2>', html)
        self.assertIn('<p class="gl-paragraph">通常の段落テキストです。</p>', html)

    def test_bold_and_link(self):
        md = "これは **太字** と [リンク](https://example.com) です。"
        html = to_html(md)
        self.assertIn('<strong>太字</strong>', html)
        self.assertIn('<a href="https://example.com" target="_blank" rel="noopener noreferrer">リンク</a>', html)

    def test_alert_quote(self):
        md = "> 注意事項です。"
        html = to_html(md)
        self.assertIn('<blockquote class="gl-alert">注意事項です。</blockquote>', html)

    def test_bullet_list(self):
        md = "- 項目1\n- 項目2"
        html = to_html(md)
        self.assertIn('<ul class="gl-list"><li>項目1</li><li>項目2</li></ul>', html)

    def test_xss_escape(self):
        md = "<script>alert('xss')</script>"
        html = to_html(md)
        self.assertNotIn('<script>', html)
        self.assertIn('&lt;script&gt;', html)

if __name__ == "__main__":
    unittest.main()

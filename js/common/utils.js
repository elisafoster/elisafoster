/**
 * 共通ユーティリティ (セキュリティ・ヘルパー関数)
 */

/**
 * 安全なHTMLエスケープ関数 (XSS対策)
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


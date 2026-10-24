/**
 * GitHub Repository & API Configuration
 * githubPAT.yaml 準拠
 */

export const GITHUB_CONFIG = {
  // デフォルト対象リポジトリ情報 (githubPAT.yaml 初期値)
  DEFAULT_OWNER: "elisafoster",
  DEFAULT_REPO: "elisafoster",
  BRANCH: "main",

  // GitHub REST API
  API_BASE_URL: "https://api.github.com",

  // リポジトリ推奨上限 (GitHub Pages / Recommended limit: 1.0 GB)
  MAX_STORAGE_KB: 1024 * 1024,
  MAX_STORAGE_LABEL: "1.0 GB",

  // ローカルストレージキー
  STORAGE_KEYS: {
    TOKEN: "elisafoster_github_token",
    OWNER: "elisafoster_github_repo_owner",
    REPO: "elisafoster_github_repo_name",
    MEDIA_CACHE: "elisafoster_github_media_cache",
  },
};

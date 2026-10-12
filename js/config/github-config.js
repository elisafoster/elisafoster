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

  // ローカルストレージキー
  STORAGE_KEYS: {
    TOKEN: "elisafoster_github_token",
    OWNER: "elisafoster_github_repo_owner",
    REPO: "elisafoster_github_repo_name",
    MEDIA_CACHE: "elisafoster_github_media_cache",
  },
};

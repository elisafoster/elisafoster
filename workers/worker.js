/**
 * 配信者向けポートフォリオ D1 バックエンドAPI
 * バインディング名: DB (Cloudflare D1)
 */

// 19テーブルの定義
const ALL_TABLES = [
  "profile", "guideline", "event", "gallery", "linkList",
  "movieCategory", "movieTag", "movieList", "movie", "notice",
  "scheduleTag", "schedule", "shopTag", "shop", "section",
  "themeConfig", "visual", "whitelist", "githubPAT"
];

// 単一レコード（id=1固定）テーブル
const SINGLETON_TABLES = ["profile", "guideline", "themeConfig", "githubPAT"];

// 機密テーブル（読み込みにも認可が必要）
const PROTECTED_TABLES = ["whitelist", "githubPAT"];

// 各ロールごとの書き込み許可テーブルマッピング
const ROLE_WRITE_PERMISSIONS = {
  owner: [
    "profile", "guideline", "event", "gallery", "linkList",
    "movieCategory", "movieTag", "movieList", "movie", "notice",
    "scheduleTag", "schedule", "shopTag", "shop", "section",
    "themeConfig", "visual", "whitelist", "githubPAT"
  ],
  admin: [
    "profile", "guideline", "event", "gallery", "linkList",
    "movieCategory", "movieTag", "movieList", "movie", "notice",
    "scheduleTag", "schedule", "shopTag", "shop", "section",
    "themeConfig", "visual", "whitelist"
  ],
  editor: [
    "event", "notice", "scheduleTag", "schedule", "gallery",
    "movieCategory", "movieTag", "movieList", "movie",
    "shopTag", "shop", "linkList"
  ],
  writer: [
    "event", "notice", "scheduleTag", "schedule"
  ]
};

// レスポンスヘルパー
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-email",
};

const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

const notFoundResponse = () => {
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

const forbiddenResponse = (message = "権限がありません (Forbidden)") => {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

// メールアドレスのマスク化ヘルパー (例: elisafoster867@gmail.com -> e***7@gmail.com)
const maskEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  const atIdx = email.indexOf("@");
  if (atIdx === -1) {
    return email.length <= 2 ? "**" : email[0] + "***" + email.slice(-1);
  }
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  if (local.length <= 2) {
    return local[0] + "***" + domain;
  }
  return local[0] + "***" + local.slice(-1) + domain;
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean); // e.g. ["api", "tables", "profile"]

    // ユーザー認可チェック関数 (リクエスト内キャッシュ付き)
    let cachedAuthUser = undefined;
    const isAuthorized = async () => {
      if (cachedAuthUser !== undefined) return cachedAuthUser;
      const email = request.headers.get("x-user-email") || 
                    url.searchParams.get("mail") ||
                    url.searchParams.get("email") ||
                    (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!email) {
        cachedAuthUser = null;
        return false;
      }

      const user = await env.DB.prepare(
        "SELECT id, name, mail, role FROM whitelist WHERE mail = ?"
      ).bind(email).first();

      cachedAuthUser = user || null;
      return cachedAuthUser;
    };

    // ============================================================
    // 0. 認証チェック (/api/auth/check)
    // ============================================================
    if (pathParts[0] === "api" && pathParts[1] === "auth" && pathParts[2] === "check") {
      const user = await isAuthorized();
      if (!user) {
        return notFoundResponse(); // 未登録は404
      }
      return jsonResponse({ authorized: true, user });
    }

    // ============================================================
    // 0-2. 全テーブル一括取得 (/api/all)
    // ============================================================
    if (pathParts[0] === "api" && pathParts[1] === "all") {
      const allData = {};
      for (const t of ALL_TABLES) {
        if (PROTECTED_TABLES.includes(t)) continue;
        if (SINGLETON_TABLES.includes(t)) {
          const row = await env.DB.prepare(`SELECT * FROM ${t} WHERE id = 1`).first();
          allData[t] = row || null;
        } else {
          let query = `SELECT * FROM ${t}`;
          if (["movieCategory", "linkList", "shop", "visual", "section"].includes(t)) {
            query += " ORDER BY priority ASC";
          } else if (t === "notice") {
            query += " ORDER BY created_at DESC";
          } else {
            query += " ORDER BY id ASC";
          }
          const { results } = await env.DB.prepare(query).all();
          allData[t] = results || [];
        }
      }
      return jsonResponse(allData);
    }

    // ============================================================
    // 0-3. 保守用エクスポート (/api/export/json, /api/export/sql)
    // ============================================================
    if (pathParts[0] === "api" && pathParts[1] === "export") {
      const authUser = await isAuthorized();
      if (!authUser || authUser.role !== "owner") {
        return forbiddenResponse("管理者（owner）権限が必要です");
      }

      const format = pathParts[2]; // "json" または "sql"
      const dump = {};
      for (const t of ALL_TABLES) {
        const { results } = await env.DB.prepare(`SELECT * FROM ${t} ORDER BY id ASC`).all();
        dump[t] = results || [];
      }

      if (format === "json") {
        return jsonResponse({ exported_at: new Date().toISOString(), tables: dump });
      }

      if (format === "sql") {
        let sqlDump = `-- D1 Database Export (${new Date().toISOString()})\n\n`;
        for (const [t, rows] of Object.entries(dump)) {
          sqlDump += `-- Table: ${t}\n`;
          for (const row of rows) {
            const keys = Object.keys(row);
            const cols = keys.map(k => `\`${k}\``).join(", ");
            const vals = keys.map(k => {
              const val = row[k];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "number") return val;
              return `'${String(val).replace(/'/g, "''")}'`;
            }).join(", ");
            sqlDump += `INSERT OR REPLACE INTO \`${t}\` (${cols}) VALUES (${vals});\n`;
          }
          sqlDump += "\n";
        }
        return new Response(sqlDump, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/sql",
            "Content-Disposition": `attachment; filename="d1-export-${Date.now()}.sql"`
          }
        });
      }

      return notFoundResponse();
    }

    // /api/tables/:tableName 形式のルーティング
    if (pathParts[0] !== "api" || pathParts[1] !== "tables" || !pathParts[2]) {
      return notFoundResponse();
    }

    const tableName = pathParts[2];
    const recordId = pathParts[3] ? parseInt(pathParts[3], 10) : null;

    if (!ALL_TABLES.includes(tableName)) {
      return notFoundResponse();
    }

    const method = request.method;

    // ============================================================
    // 1. 読み込み (GET)
    // ============================================================
    if (method === "GET") {
      // 機密テーブルの場合は認可チェック
      if (PROTECTED_TABLES.includes(tableName)) {
        const authorized = await isAuthorized();
        if (!authorized) {
          return notFoundResponse(); // 存在を悟らせないため404
        }
        // admin は githubPAT の参照不可
        if (tableName === "githubPAT" && authorized.role !== "owner") {
          return forbiddenResponse("GitHub PAT 設定へのアクセス権限がありません");
        }
        // editor / writer は whitelist, githubPAT などの管理テーブル参照不可
        if (tableName === "whitelist" && !["owner", "admin"].includes(authorized.role)) {
          return forbiddenResponse("アカウント管理へのアクセス権限がありません");
        }
      }

      // 単一レコードテーブル または ID指定の場合
      if (SINGLETON_TABLES.includes(tableName) || recordId) {
        const targetId = SINGLETON_TABLES.includes(tableName) ? 1 : recordId;
        const record = await env.DB.prepare(
          `SELECT * FROM ${tableName} WHERE id = ?`
        ).bind(targetId).first();

        if (!record) return notFoundResponse();

        // profileのJSON文字列パース
        if (tableName === "profile") {
          if (record.platforms) try { record.platforms = JSON.parse(record.platforms); } catch (e) {}
          if (record.moves) try { record.moves = JSON.parse(record.moves); } catch (e) {}
        }

        // アカウント管理 (whitelist): admin権限の閲覧者には admin以上の権限アカウントのmailをマスク化
        if (tableName === "whitelist") {
          const authorized = await isAuthorized();
          if (authorized && authorized.role === "admin") {
            const roleStr = (record.role || "").toLowerCase();
            if (roleStr === "owner" || roleStr === "admin") {
              record.mail = maskEmail(record.mail);
            }
          }
        }

        return jsonResponse(record);
      }

      // 一覧取得（優先度やIDでソート）
      let query = `SELECT * FROM ${tableName}`;
      if (["movieCategory", "linkList", "shop", "visual", "section"].includes(tableName)) {
        query += " ORDER BY priority ASC";
      } else if (tableName === "notice") {
        query += " ORDER BY created_at DESC";
      } else {
        query += " ORDER BY id ASC";
      }

      const { results } = await env.DB.prepare(query).all();
      let rows = results || [];

      // アカウント管理 (whitelist): admin権限の閲覧者には admin以上の権限アカウントのmailをマスク化
      if (tableName === "whitelist") {
        const authorized = await isAuthorized();
        if (authorized && authorized.role === "admin") {
          rows = rows.map((r) => {
            const roleStr = (r.role || "").toLowerCase();
            if (roleStr === "owner" || roleStr === "admin") {
              return {
                ...r,
                mail: maskEmail(r.mail),
              };
            }
            return r;
          });
        }
      }

      return jsonResponse(rows);
    }

    // ============================================================
    // 2. 書き込み・削除 (POST / PUT / DELETE)
    // ============================================================
    // すべての書き込みは whitelist に登録されているユーザーのみ許可
    const authorized = await isAuthorized();
    if (!authorized) {
      return notFoundResponse(); // 改ざん・不正アクセスを404で遮断
    }

    const userRole = authorized.role || "writer";
    const allowedTables = ROLE_WRITE_PERMISSIONS[userRole] || [];

    // ロールごとのテーブル書き込み権限チェック
    if (!allowedTables.includes(tableName)) {
      return forbiddenResponse(`ロール「${userRole}」にはテーブル「${tableName}」の変更権限がありません`);
    }

    // アカウント管理 (whitelist) に対する admin ロールの追加制約
    if (tableName === "whitelist" && userRole === "admin") {
      if (method === "DELETE" && recordId) {
        const target = await env.DB.prepare(
          "SELECT role FROM whitelist WHERE id = ?"
        ).bind(recordId).first();
        if (target && (target.role === "owner" || target.role === "admin")) {
          return forbiddenResponse("admin権限ではownerまたはadminアカウントを削除できません");
        }
      }
    }

    // --- DELETE ---
    if (method === "DELETE") {
      if (!recordId || SINGLETON_TABLES.includes(tableName)) {
        return notFoundResponse(); // 固定レコードの削除は不可
      }
      const res = await env.DB.prepare(
        `DELETE FROM ${tableName} WHERE id = ?`
      ).bind(recordId).run();

      return jsonResponse({ success: res.success });
    }

    // --- POST / PUT (作成・更新) ---
    if (method === "POST" || method === "PUT") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return notFoundResponse();
      }

      // アカウント管理 (whitelist) に対する admin ロールの追加制約
      if (tableName === "whitelist" && userRole === "admin") {
        if (body.role === "owner" || body.role === "admin") {
          return forbiddenResponse("admin権限ではownerまたはadmin権限を付与・設定できません");
        }
        if (method === "PUT" && recordId) {
          const target = await env.DB.prepare(
            "SELECT role FROM whitelist WHERE id = ?"
          ).bind(recordId).first();
          if (target && (target.role === "owner" || target.role === "admin")) {
            return forbiddenResponse("admin権限ではownerまたはadminアカウントを変更できません");
          }
        }
      }

      // 単一レコードテーブル (id=1) のUPSERT処理
      if (SINGLETON_TABLES.includes(tableName)) {
        body.id = 1;
        if (tableName === "profile") {
          if (body.comment && typeof body.comment === "string" && body.comment.length > 75) {
            return jsonResponse({ error: "キャッチフレーズは75文字以内で入力してください" }, 400);
          }
          if (body.message && typeof body.message === "string") {
            const norm = body.message.replace(/\r\n/g, "\n");
            if (norm.length > 180) {
              return jsonResponse({ error: "自己紹介文は180文字以内で入力してください" }, 400);
            }
            const lines = norm.length > 0 ? norm.split("\n") : [];
            if (lines.length > 5) {
              return jsonResponse({ error: "自己紹介文は最大5行以内で入力してください" }, 400);
            }
          }
          if (typeof body.platforms === "object") body.platforms = JSON.stringify(body.platforms);
          if (typeof body.moves === "object") body.moves = JSON.stringify(body.moves);
        }

        const keys = Object.keys(body).filter(k => k !== "created_at" && k !== "updated_at");
        const columns = keys.map(k => `\`${k}\``).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const updateSets = keys.filter(k => k !== "id").map(k => `\`${k}\` = excluded.\`${k}\``).join(", ");

        const sql = `
          INSERT INTO ${tableName} (${columns}, updated_at)
          VALUES (${placeholders}, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            ${updateSets},
            updated_at = datetime('now')
        `;

        const values = keys.map(k => body[k]);
        await env.DB.prepare(sql).bind(...values).run();
        return jsonResponse({ success: true, id: 1 });
      }

      // 通常テーブルの更新 (PUT)
      if (method === "PUT" && recordId) {
        const keys = Object.keys(body).filter(k => k !== "id" && k !== "created_at" && k !== "updated_at");
        const setClause = keys.map(k => `\`${k}\` = ?`).join(", ") + ", updated_at = datetime('now')";
        const values = [...keys.map(k => body[k]), recordId];

        await env.DB.prepare(
          `UPDATE ${tableName} SET${setClause} WHERE id = ?`
        ).bind(...values).run();

        return jsonResponse({ success: true, id: recordId });
      }

      // 通常テーブルの新規挿入 (POST)
      const keys = Object.keys(body).filter(k => k !== "created_at" && k !== "updated_at");
      const columns = keys.map(k => `\`${k}\``).join(", ");
      const placeholders = keys.map(() => "?").join(", ");
      const values = keys.map(k => body[k]);

      const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
      const res = await env.DB.prepare(sql).bind(...values).run();

      return jsonResponse({ success: true, id: res.meta.last_row_id || body.id });
    }

    return notFoundResponse();
  }
};

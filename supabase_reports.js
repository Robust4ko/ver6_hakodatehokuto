// community_reports の読み込み・追加・投稿者本人による更新用。公開用キーのみ使用する。
// このキーはブラウザ用。アクセス範囲はSupabase側のRLSで制限する。
const COMMUNITY_REPORTS_URL = "https://xafotdtdulstkaftkorb.supabase.co/rest/v1/community_reports";
const COMMUNITY_REPORTS_PUBLISHABLE_KEY = "sb_publishable_LcZJSd8Y0syiYwoYUEbMwQ_dJTlko3O";
const COMMUNITY_SUPABASE_URL = "https://xafotdtdulstkaftkorb.supabase.co";
let communitySupabaseClient = null;
let communitySessionPromise = null;

function getCommunitySupabaseClient() {
  if (!globalThis.supabase?.createClient) throw new Error("supabase_client_unavailable");
  if (!communitySupabaseClient) {
    communitySupabaseClient = globalThis.supabase.createClient(
      COMMUNITY_SUPABASE_URL,
      COMMUNITY_REPORTS_PUBLISHABLE_KEY,
      { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }
    );
  }
  return communitySupabaseClient;
}

async function ensureCommunitySession() {
  if (!communitySessionPromise) {
    communitySessionPromise = (async () => {
      const client = getCommunitySupabaseClient();
      const current = await client.auth.getSession();
      if (current.error) throw current.error;
      if (current.data.session?.user?.id) return current.data.session;

      const created = await client.auth.signInAnonymously();
      if (created.error || !created.data.session?.user?.id) {
        throw created.error || new Error("anonymous_sign_in_failed");
      }
      return created.data.session;
    })().catch((error) => {
      communitySessionPromise = null;
      throw error;
    });
  }
  return communitySessionPromise;
}

async function getCommunityUserId() {
  const session = await ensureCommunitySession();
  return session.user.id;
}

// 理由の保存コード。意味が変わる項目は既存コードを流用せず、新しいコードを追加する。
// 新しい投稿で表示する理由。旧コードは過去データ用として下の一覧に残す。
const COMMUNITY_REPORT_REASON_OPTIONS = Object.freeze({
  use: Object.freeze(["wide_road", "smooth_surface", "gentle_slope", "good_visibility", "low_congestion", "other"]),
  avoid: Object.freeze(["narrow_road", "uneven_surface", "steep_slope", "poor_visibility", "high_congestion", "other"]),
  depends: Object.freeze([]),
});
const COMMUNITY_REPORT_REASON_CODES = Object.freeze([
  "road_width", "surface", "slope", "visibility", "congestion", "other",
  ...COMMUNITY_REPORT_REASON_OPTIONS.use, ...COMMUNITY_REPORT_REASON_OPTIONS.avoid,
]);

// 暫定の条件コード。表示名と区別し、過去の投稿の意味を変えない。
const COMMUNITY_REPORT_CONDITION_CODES = Object.freeze([
  "daylight", "not_crowded", "not_flooded", "no_obstacles", "companion_support", "other",
]);

// 投稿地点マーカーと詳細表示に必要な列だけを取得する。
async function loadCommunityReportLocations() {
  const session = await ensureCommunitySession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const query = "?select=id,latitude,longitude,evaluation,reason_codes,condition_codes,comment,contributor_user_id&target_type=eq.road_point&order=created_at.asc&limit=1000";
    const response = await fetch(COMMUNITY_REPORTS_URL + query, {
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error("report_locations_rejected");
      error.status = response.status;
      throw error;
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error("invalid_report_locations");
    return rows.filter((row) =>
      typeof row.id === "string" &&
      Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90 &&
      Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180 &&
      ["use", "depends", "avoid"].includes(row.evaluation)
    ).map((row) => ({
      ...row,
      reason_codes: Array.isArray(row.reason_codes)
        ? row.reason_codes.filter((code) => COMMUNITY_REPORT_REASON_CODES.includes(code))
        : [],
      condition_codes: Array.isArray(row.condition_codes)
        ? row.condition_codes.filter((code) => COMMUNITY_REPORT_CONDITION_CODES.includes(code))
        : [],
      comment: typeof row.comment === "string" ? row.comment.slice(0, 500) : null,
      contributor_user_id: typeof row.contributor_user_id === "string" ? row.contributor_user_id : null,
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function saveCommunityReport(payload) {
  // 必須の位置・回答を送信前にも確認する。
  if (!payload || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.id) ||
      payload.target_type !== "road_point" || !["use", "depends", "avoid"].includes(payload.evaluation) ||
      !Number.isFinite(payload.latitude) || Math.abs(payload.latitude) > 90 ||
      !Number.isFinite(payload.longitude) || Math.abs(payload.longitude) > 180 ||
      (payload.comment != null && (typeof payload.comment !== "string" || payload.comment.length > 500)) ||
      (payload.reason_codes != null && (!Array.isArray(payload.reason_codes) ||
        payload.reason_codes.some(code => !COMMUNITY_REPORT_REASON_CODES.includes(code)) ||
        new Set(payload.reason_codes).size !== payload.reason_codes.length)) ||
      (payload.condition_codes != null && (!Array.isArray(payload.condition_codes) ||
        payload.condition_codes.some(code => !COMMUNITY_REPORT_CONDITION_CODES.includes(code)) ||
        new Set(payload.condition_codes).size !== payload.condition_codes.length ||
        (payload.evaluation !== "depends" && payload.condition_codes.length > 0)))) {
    throw new Error("invalid_report");
  }

  // 同じIDの再送は無視し、既存行を更新しない（INSERTのみ）。
  const session = await ensureCommunitySession();
  const ownedPayload = { ...payload, contributor_user_id: session.user.id };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(COMMUNITY_REPORTS_URL + "?on_conflict=id", {
      method: "POST",
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
        Prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(ownedPayload),
      signal: controller.signal,
    });
    if (!response.ok) {
      // サーバーの詳細やキーを画面・ログへ出さず、呼び出し側で案内する。
      const error = new Error("report_rejected");
      error.status = response.status;
      throw error;
    }
    return ownedPayload;
  } finally {
    clearTimeout(timer);
  }
}

async function updateCommunityReport(id, changes) {
  const evaluation = changes?.evaluation;
  const reasonCodes = Array.isArray(changes?.reason_codes) ? [...new Set(changes.reason_codes)] : [];
  const conditionCodes = Array.isArray(changes?.condition_codes) ? [...new Set(changes.condition_codes)] : [];
  const comment = changes?.comment == null ? null : String(changes.comment).trim() || null;
  const allowedReasons = COMMUNITY_REPORT_REASON_OPTIONS[evaluation] || [];
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["use", "depends", "avoid"].includes(evaluation) ||
      reasonCodes.some((code) => !allowedReasons.includes(code)) ||
      conditionCodes.some((code) => !COMMUNITY_REPORT_CONDITION_CODES.includes(code)) ||
      (evaluation !== "depends" && conditionCodes.length > 0) ||
      (evaluation === "depends" && reasonCodes.length > 0) ||
      (comment && comment.length > 500)) {
    throw new Error("invalid_report_update");
  }

  const session = await ensureCommunitySession();
  const payload = {
    evaluation,
    reason_codes: reasonCodes,
    condition_codes: evaluation === "depends" ? conditionCodes : [],
    comment,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const query = "?id=eq." + encodeURIComponent(id) +
      "&contributor_user_id=eq." + encodeURIComponent(session.user.id);
    const response = await fetch(COMMUNITY_REPORTS_URL + query, {
      method: "PATCH",
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error("report_update_rejected");
      error.status = response.status;
      throw error;
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("report_not_owned");
    return { ...rows[0], ...payload, contributor_user_id: session.user.id };
  } finally {
    clearTimeout(timer);
  }
}

async function deleteCommunityReport(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("invalid_report_delete");
  const session = await ensureCommunitySession();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const query = "?id=eq." + encodeURIComponent(id) +
      "&contributor_user_id=eq." + encodeURIComponent(session.user.id);
    const response = await fetch(COMMUNITY_REPORTS_URL + query, {
      method: "DELETE",
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        Prefer: "return=representation",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error("report_delete_rejected");
      error.status = response.status;
      throw error;
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("report_not_owned");
    return id;
  } finally {
    clearTimeout(timer);
  }
}

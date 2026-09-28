// ver4.1：JA/ENトグル + 二段フッター対応 + ボタン見た目分離 + name_en 将来対応（未定義は name をコピー）
// SVGアイコン / 欠け対策 / 当たり判定最適化 / 700m→500mフォールバック
// ポップアップは足元一致＋★アイコン高さに応じて自動オフセット（lift）

/* ========== グローバル ========== */
let map;
let directionsService;
let directionsRenderer;
let distanceMatrixService;
let startMarker = null;
let destinations = [];   // { name, name_en?, location:{lat,lng} }
let latestDestination = null;

let appMode = "evacuation";
const IS_BUILDING_ADMIN_VIEW =
  new URLSearchParams(window.location.search).get("admin") === "1";
let isSelectingBuildingLocation = false;
let buildingLocation = null;
let buildingLocationMarker = null;
let reportMarker = null; // 投稿対象の仮ピン（保存しない）
let communityReportMarkers = []; // Supabaseに保存済みの投稿地点
let communityReportInfoWindow = null;
let touristSpots = [];
let touristSpotMarkers = [];
let touristSpotInfoWindow = null;
let activeTouristCategory = "all";
let communityCurrentUserId = null;
let reportDraft = null; // 確認中の地点・回答。投稿するまではページ内だけで保持する。
let reportSubmitState = "idle"; // idle / sending / success / error / uncertain
let reportSubmitPayload = null; // 通信結果が不明な場合も同じID・内容で再試行する。

let infoWindow = null;
let lastDistanceMeters = null;
let lastDurationText = null;

const PRIMARY_RADIUS_M = 700;
const FALLBACK_RADIUS_M = 500;
const DESTINATION_LIMIT = 25;
const USER_BUILDINGS_KEY = "userAddedBuildings";

/* ========== i18n ========== */
const I18N = {
  ja: {
    go_here: "ここに行く",
    need_start: "出発地点が未設定です。地図をタップするか「現在地から避難」を押してください。",
    rerun_fallback: "候補が多すぎるため、{radius}m で再検索します…",
    too_many_limit: "候補が非常に多いため、近い {limit} 件で評価します…",
    none_in_radius: "{radius}m以内に避難場所がありません。",
    route_error: "経路描画エラー: {status}",
    error_status: "エラー: {status}",
    nearest_fmt: "{name}（{meters} m、約 {duration}）",
    nearest_fmt_with_type: "{name}［{type}］（{meters} m、約 {duration}）",
    drawing_fmt: "{name} へ経路を表示中…",
    // UIラベル
    header_title: "津波避難支援アプリ　逃げるーと",
    header_subtext: "📍 地図をクリックすると避難経路を表示します",
    header_report_subtext: "📍 投稿する地点をタップしてください",
    header_tourism_subtext: "📍 函館の主な観光地を地図で確認します",
    info_title: "最短の避難先：",
    info_hint: "クリックして確認してください",
    btn_use_current: "現在地から避難",
    btn_open_gmaps: "Googleマップで開く",
    mode_evacuate: "避難する",
    mode_report: "地域情報を投稿",
    mode_tourism: "観光マップ",
    tourism_filter_all: "すべて",
    tourism_filter_history: "歴史・文化",
    tourism_filter_scenery: "景観・街歩き",
    tourism_filter_shopping: "買い物・グルメ",
    tourism_filter_nature: "自然・体験",
    tourism_legend_title: "観光地マーカー",
    tourism_marker_label: "観光地",
    tourism_popup_area: "エリア",
    tourism_popup_category: "種類",
    tourism_popup_official: "函館市公式観光サイトで見る",
    tourism_popup_google_maps: "Googleマップで開く",
    tourism_popup_find_evacuation: "この場所から避難先を探す",
    tourism_load_error: "観光地データを読み込めませんでした。",
    report_question: "津波避難時、この地点付近の道を使いたいですか？",
    report_note: "「投稿する」を押すと、地点・回答・理由・条件・コメントを保存します。",
    report_comment: "補足コメント",
    report_reasons: "理由",
    report_reasons_label: "理由（任意・複数選択可）",
    report_no_reasons: "未選択",
    report_conditions: "利用したい条件",
    report_conditions_label: "利用したい条件（任意・複数選択可）",
    report_no_conditions: "未選択",
    report_condition_daylight: "明るい時間帯なら",
    report_condition_not_crowded: "混雑していなければ",
    report_condition_not_flooded: "冠水していなければ",
    report_condition_no_obstacles: "障害物がなければ",
    report_condition_companion_support: "同行者の支援があれば",
    report_condition_other: "その他",
    report_reason_road_width: "道幅",
    report_reason_surface: "段差・路面",
    report_reason_slope: "坂道",
    report_reason_visibility: "見通し",
    report_reason_congestion: "混雑",
    report_reason_other: "その他",
    report_reason_wide_road: "道幅が広い",
    report_reason_smooth_surface: "段差が少なく、路面が歩きやすい",
    report_reason_gentle_slope: "坂が緩やか",
    report_reason_good_visibility: "見通しがよい",
    report_reason_low_congestion: "混雑が少ない",
    report_reason_narrow_road: "道幅が狭い",
    report_reason_uneven_surface: "段差や路面の凹凸がある",
    report_reason_steep_slope: "坂が急",
    report_reason_poor_visibility: "見通しが悪い",
    report_reason_high_congestion: "混雑が多い",
    report_comment_label: "補足コメント（任意・500文字まで）",
    report_comment_placeholder: "例：道幅が狭く、すれ違いにくい場所があります。",
    report_no_comment: "なし",
    report_submit: "投稿する",
    report_sending: "送信中…",
    report_sent: "投稿済み",
    report_retry: "再試行する",
    report_success: "投稿を保存しました。ご協力ありがとうございます。",
    report_failed: "保存できませんでした。回答は残っています。時間をおいて再試行してください。",
    report_uncertain: "通信が途切れ、保存結果を確認できませんでした。「再試行する」で同じ投稿を重複させずに再送できます。",
    report_close: "閉じる",
    report_location: "投稿対象の地点（仮）",
    report_unselected: "回答を選んでください。",
    report_selected: "選択した回答：{answer}",
    report_review: "内容を確認",
    report_review_title: "投稿内容の確認",
    report_review_location: "地点（緯度・経度）",
    report_review_answer: "回答",
    report_edit: "修正する",
    report_use: "使いたい",
    report_depends: "状況による",
    report_avoid: "できれば避けたい",
    report_cancel: "キャンセル",
    report_saved_marker: "投稿地点：{answer}",
    report_popup_title: "この地点の投稿",
    report_popup_answer: "回答",
    report_owner_edit: "この投稿を編集",
    report_update: "変更を保存",
    report_update_saving: "保存中…",
    report_update_failed: "変更を保存できませんでした。",
    report_delete: "この投稿を削除",
    report_delete_confirm: "この投稿を削除しますか？元に戻せません。",
    report_delete_deleting: "削除中…",
    report_delete_failed: "投稿を削除できませんでした。",
    report_legend_title: "投稿マーカー",
    report_refresh: "最新の投稿を更新",
    report_refreshing: "更新中…",
    report_refresh_done: "投稿マーカーを更新しました（{count}件）。",
    report_refresh_failed: "投稿マーカーを更新できませんでした。",
    building_list_title: "避難先一覧",
    building_list_count: "{count}件の避難先",
    building_list_filtered_count: "{visible} / {total}件の避難先",
    destination_filter_label: "種類で絞り込む",
    destination_filter_all: "すべて",
    destination_filter_user_added: "利用者が追加",
    destination_guide_title: "避難先の種類",
    destination_guide_tsunami_building: "オレンジ：津波から緊急的・一時的に避難する津波避難ビルです。",
    destination_guide_emergency: "青：津波に対応する指定緊急避難場所です。",
    destination_guide_shelter: "緑：指定避難所も兼ねる施設です。危険が去った後などに一定期間滞在できます。",
    destination_guide_shared: "紫：利用者が追加した、公式未確認の共有投稿です。",
    destination_guide_notice: "灰色：「区分確認中」の施設です。現行の公式情報との再確認が必要です。",
    destination_map_legend_title: "避難先マーカー",
    destination_marker_all: "避難先",
    destination_marker_shelter: "黄色の太枠：津波後も利用できる避難所",
    destination_guide_all_green: "緑：津波から避難するための避難先です。",
    destination_guide_shelter_border: "黄色の太枠：津波の危険が去った後も、指定避難所として一定期間滞在できる施設です。",
    building_type_tsunami_building: "津波避難ビル",
    building_type_emergency_place: "指定緊急避難場所",
    building_type_also_shelter: "指定避難所を兼ねる",
    building_type_review_needed: "区分確認中",
    building_list_official: "公式",
    building_list_local: "このブラウザで追加",
    building_list_shared: "共有投稿（公式未確認）",
    building_refresh: "共有情報を更新",
    building_refreshing: "更新中…",
    building_refresh_done: "共有避難ビルを更新しました（{count}件）。",
    building_refresh_failed: "共有情報を更新できませんでした。",
    building_list_show_map: "地図で見る",
    building_list_empty: "避難先がありません。",
    building_list_edit: "編集",
    building_list_edit_name: "施設名",
    building_list_save: "保存",
    building_list_edit_cancel: "キャンセル",
    building_list_name_required: "施設名を入力してください。",
    building_list_name_duplicate: "同じ施設名の避難先があります。",
    building_list_save_failed: "保存できませんでした。元の施設名に戻しました。",
    building_list_delete: "削除",
    building_list_delete_confirm: "「{name}」を削除しますか？",
    building_list_delete_failed: "削除を保存できませんでした。",
    building_form_title: "避難ビルの追加",
    building_form_tap_map_title: "地図をタップ",
    building_form_name: "施設名",
    building_form_name_placeholder: "例：○○市民会館",
    building_form_pick_location: "地図で位置を選ぶ",
    building_form_repick_location: "地図で位置を選び直す",
    building_form_cancel_location: "位置選択をやめる",
    building_form_location_unselected: "位置は未選択です。",
    building_form_location_selecting: "追加したい位置を地図上でタップしてください。",
    building_form_location_selected: "位置を選択しました。施設名を確認して「避難ビルを追加」を押してください。",
    building_form_add: "避難ビルを追加",
    building_form_marker_title: "追加する避難ビルの位置",
    building_form_name_required: "施設名を入力してください。",
    building_form_location_required: "「地図で位置を選ぶ」を押して、追加する位置を選んでください。",
    building_form_location_invalid: "緯度または経度の範囲が正しくありません。",
    building_form_duplicate: "同じ施設名、またはほぼ同じ位置の避難先があります。",
    building_form_saving: "共有データへ保存中…",
    building_form_save_failed: "共有データへの保存に失敗しました。入力を残しています。",
    building_form_saved: "{name}を共有避難ビルとして追加しました。"
  },
  en: {
    go_here: "Go here",
    need_start: "No start point set. Tap the map or press “Evacuate from current location”.",
    rerun_fallback: "Too many candidates. Retrying with {radius} m…",
    too_many_limit: "Too many candidates. Evaluating the nearest {limit} only…",
    none_in_radius: "No shelters within {radius} m.",
    route_error: "Route drawing error: {status}",
    error_status: "Error: {status}",
    nearest_fmt: "{name} ({meters} m, about {duration})",
    nearest_fmt_with_type: "{name} [{type}] ({meters} m, about {duration})",
    drawing_fmt: "Showing route to {name}…",
    // UI labels
    header_title: "Tsunami Evacuation Support App: NigeRoute",
    header_subtext: "📍 Click the map to show an evacuation route",
    header_report_subtext: "📍 Tap a location to report",
    header_tourism_subtext: "📍 View major tourist spots in Hakodate",
    info_title: "Nearest shelter:",
    info_hint: "Tap the map to start",
    btn_use_current: "Evacuate from current location",
    btn_open_gmaps: "Open in Google Maps",
    mode_evacuate: "Evacuate",
    mode_report: "Report local info",
    mode_tourism: "Tourism map",
    tourism_filter_all: "All",
    tourism_filter_history: "History & culture",
    tourism_filter_scenery: "Scenery & walking",
    tourism_filter_shopping: "Shopping & food",
    tourism_filter_nature: "Nature & leisure",
    tourism_legend_title: "Tourist spot markers",
    tourism_marker_label: "Tourist spot",
    tourism_popup_area: "Area",
    tourism_popup_category: "Category",
    tourism_popup_official: "View on the official Hakodate tourism site",
    tourism_popup_google_maps: "Open in Google Maps",
    tourism_popup_find_evacuation: "Find an evacuation destination from here",
    tourism_load_error: "Could not load tourist spot data.",
    report_question: "Would you want to use the roads near this point during a tsunami evacuation?",
    report_note: "Press Submit to save this location, answer, reasons, conditions and comment.",
    report_comment: "Additional comment",
    report_reasons: "Reasons",
    report_reasons_label: "Reasons (optional, select all that apply)",
    report_no_reasons: "None selected",
    report_conditions: "Conditions for using this road",
    report_conditions_label: "Conditions (optional, select all that apply)",
    report_no_conditions: "None selected",
    report_condition_daylight: "During daylight",
    report_condition_not_crowded: "If not crowded",
    report_condition_not_flooded: "If not flooded",
    report_condition_no_obstacles: "If there are no obstacles",
    report_condition_companion_support: "With support from a companion",
    report_condition_other: "Other",
    report_reason_road_width: "Road width",
    report_reason_surface: "Steps / road surface",
    report_reason_slope: "Slope",
    report_reason_visibility: "Visibility",
    report_reason_congestion: "Crowding",
    report_reason_other: "Other",
    report_reason_wide_road: "Wide road",
    report_reason_smooth_surface: "Few steps and easy-to-walk surface",
    report_reason_gentle_slope: "Gentle slope",
    report_reason_good_visibility: "Good visibility",
    report_reason_low_congestion: "Less crowded",
    report_reason_narrow_road: "Narrow road",
    report_reason_uneven_surface: "Steps or uneven surface",
    report_reason_steep_slope: "Steep slope",
    report_reason_poor_visibility: "Poor visibility",
    report_reason_high_congestion: "More crowded",
    report_comment_label: "Additional comment (optional, up to 500 characters)",
    report_comment_placeholder: "Example: Parts of the road are too narrow to pass others easily.",
    report_no_comment: "None",
    report_submit: "Submit",
    report_sending: "Sending…",
    report_sent: "Submitted",
    report_retry: "Retry",
    report_success: "Your report has been saved. Thank you.",
    report_failed: "Could not save your report. Your answer is retained. Please try again later.",
    report_uncertain: "The connection was interrupted, so saving could not be confirmed. Retry to resend the same report without duplicating it.",
    report_close: "Close",
    report_location: "Temporary report location",
    report_unselected: "Please select an answer.",
    report_selected: "Selected answer: {answer}",
    report_review: "Review details",
    report_review_title: "Review your report",
    report_review_location: "Location (latitude, longitude)",
    report_review_answer: "Answer",
    report_edit: "Edit answer",
    report_use: "I would use them",
    report_depends: "It depends",
    report_avoid: "I would prefer to avoid them",
    report_cancel: "Cancel",
    report_saved_marker: "Reported location: {answer}",
    report_popup_title: "Report at this location",
    report_popup_answer: "Answer",
    report_owner_edit: "Edit this report",
    report_update: "Save changes",
    report_update_saving: "Saving…",
    report_update_failed: "Could not save the changes.",
    report_delete: "Delete this report",
    report_delete_confirm: "Delete this report? This cannot be undone.",
    report_delete_deleting: "Deleting…",
    report_delete_failed: "Could not delete the report.",
    report_legend_title: "Report markers",
    report_refresh: "Refresh latest reports",
    report_refreshing: "Refreshing…",
    report_refresh_done: "Report markers updated ({count}).",
    report_refresh_failed: "Could not refresh report markers.",
    building_list_title: "Evacuation destination list",
    building_list_count: "{count} evacuation destinations",
    building_list_filtered_count: "{visible} of {total} evacuation destinations",
    destination_filter_label: "Filter by type",
    destination_filter_all: "All",
    destination_filter_user_added: "User-added",
    destination_guide_title: "Types of evacuation destination",
    destination_guide_tsunami_building: "Orange: A tsunami evacuation building for urgent, temporary escape from a tsunami.",
    destination_guide_emergency: "Blue: A designated emergency evacuation place for tsunami evacuation.",
    destination_guide_shelter: "Green: A facility that also serves as a designated shelter for a period after the immediate danger has passed.",
    destination_guide_shared: "Purple: A user-added shared submission that has not been officially verified.",
    destination_guide_notice: "Gray: Classification under review. Current official information still needs to be confirmed.",
    destination_map_legend_title: "Evacuation markers",
    destination_marker_all: "Evacuation destination",
    destination_marker_shelter: "Yellow border: shelter available after the tsunami",
    destination_guide_all_green: "Green: an evacuation destination for escaping a tsunami.",
    destination_guide_shelter_border: "Yellow border: a designated shelter where people can stay after the tsunami danger has passed.",
    building_type_tsunami_building: "Tsunami evacuation building",
    building_type_emergency_place: "Designated emergency evacuation place",
    building_type_also_shelter: "Also a designated shelter",
    building_type_review_needed: "Classification under review",
    building_list_official: "Official",
    building_list_local: "Added in this browser",
    building_list_shared: "Shared submission (not officially verified)",
    building_refresh: "Refresh shared data",
    building_refreshing: "Refreshing…",
    building_refresh_done: "Shared evacuation buildings updated ({count}).",
    building_refresh_failed: "Could not refresh shared data.",
    building_list_show_map: "View on map",
    building_list_empty: "No evacuation destinations found.",
    building_list_edit: "Edit",
    building_list_edit_name: "Facility name",
    building_list_save: "Save",
    building_list_edit_cancel: "Cancel",
    building_list_name_required: "Enter a facility name.",
    building_list_name_duplicate: "A destination with the same name already exists.",
    building_list_save_failed: "Could not save. The original name has been restored.",
    building_list_delete: "Delete",
    building_list_delete_confirm: "Delete “{name}”?",
    building_list_delete_failed: "Could not save the deletion.",
    building_form_title: "Add an evacuation building",
    building_form_tap_map_title: "Tap the map",
    building_form_name: "Facility name",
    building_form_name_placeholder: "Example: Community Center",
    building_form_pick_location: "Choose location on map",
    building_form_repick_location: "Choose another location",
    building_form_cancel_location: "Cancel location selection",
    building_form_location_unselected: "No location selected.",
    building_form_location_selecting: "Tap the map where you want to add the building.",
    building_form_location_selected: "Location selected. Check the facility name and press “Add evacuation building”.",
    building_form_add: "Add evacuation building",
    building_form_marker_title: "Location of the evacuation building to add",
    building_form_name_required: "Enter a facility name.",
    building_form_location_required: "Press “Choose location on map” and select the location to add.",
    building_form_location_invalid: "The latitude or longitude is outside the valid range.",
    building_form_duplicate: "A destination with the same name or nearly the same location already exists.",
    building_form_saving: "Saving to shared data…",
    building_form_save_failed: "Could not save to shared data. Your input has been retained.",
    building_form_saved: "{name} was added as a shared evacuation building."
  }
};

let LANG = (localStorage.getItem("lang") || ((navigator.language||"").startsWith("en") ? "en" : "ja"));
function setLanguage(lang) {
  LANG = (lang === "en") ? "en" : "ja";
  localStorage.setItem("lang", LANG);
  applyI18nToUI();
}
window.setLanguage = setLanguage;

function t(key, vars = {}) {
  const dict = I18N[LANG] || I18N.ja;
  let s = dict[key] || I18N.ja[key] || key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}
function fmtNum(n){ try { return new Intl.NumberFormat(LANG).format(n); } catch { return n; } }
function getDestinationTypeText(dest) {
  if (!dest || dest.markerType !== "building" || dest.source !== "official") return "";
  const labels = [];
  if (dest.evacuation_category === "tsunami_evacuation_building") {
    labels.push(t("building_type_tsunami_building"));
  } else if (dest.evacuation_category === "designated_emergency_place_tsunami") {
    labels.push(t("building_type_emergency_place"));
  }
  if (dest.is_designated_shelter === true) labels.push(t("building_type_also_shelter"));
  if (dest.classification_status === "review_needed") labels.push(t("building_type_review_needed"));
  return labels.join(" / ");
}

function showNearestMessage(dest, meters, durationText) {
  const name = getDisplayNameFor(dest);
  const type = getDestinationTypeText(dest);
  const formatKey = type ? "nearest_fmt_with_type" : "nearest_fmt";
  displayMessage(t(formatKey, { name, type, meters: fmtNum(meters), duration: durationText }));
}
function applyI18nToUI(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key = el.getAttribute("data-i18n");
    const txt = t(key);
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      el.setAttribute("placeholder", txt);
    } else {
      el.textContent = txt;
    }
  });
  updateModeGuidance();
  updateReportSelection();
  updateBuildingLocationUI();
  renderBuildingList();
  updateTouristSpotLanguage();
  const btn = document.getElementById("lang-toggle");
  if (btn){
    btn.textContent = (LANG === "ja" ? "EN" : "日");
    btn.setAttribute("aria-label", LANG === "ja" ? "Switch to English" : "日本語に切り替え");
  }
}

/* ========== Utils ========== */
function displayMessage(message) {
  const el = document.getElementById("nearest-destination");
  if (el) el.textContent = message;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDistanceInMeters(loc1, loc2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(loc2.lat - loc1.lat);
  const dLng = toRad(loc2.lng - loc1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(loc1.lat)) *
      Math.cos(toRad(loc2.lat)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function collectCandidates(originLatLng, radiusMeters, sortByStraightDist = true) {
  const origin = { lat: originLatLng.lat(), lng: originLatLng.lng() };
  const withDist = destinations
    .map((dest) => {
      const d = getDistanceInMeters(origin, dest.location);
      return { ...dest, __straightDist: d };
    })
    .filter((x) => x.__straightDist <= radiusMeters);

  if (sortByStraightDist) {
    withDist.sort((a, b) => a.__straightDist - b.__straightDist);
  }
  return withDist;
}

// 表示名（LANGに応じてname / name_en）
function getDisplayNameFor(dest) {
  if (!dest) return "";
  const name = dest.name || "";
  const name_en = dest.name_en || name; // json未対応時は name を流用
  return (LANG === "en") ? (name_en || name) : name;
}

/* ========== 地図初期化 ========== */
function initMap() {
  const center = { lat: 41.775271, lng: 140.7257441 };

  map = new google.maps.Map(document.getElementById("map"), {
    zoom: 15,
    center: center,
    clickableIcons: false,
    mapTypeControl: false,
  });

  // 初期i18n & トグル
  applyI18nToUI();
  const langBtn = document.getElementById("lang-toggle");
  if (langBtn){
    langBtn.addEventListener("click", () => {
      setLanguage(LANG === "ja" ? "en" : "ja");
      if (latestDestination && lastDistanceMeters != null && lastDurationText != null) {
        showNearestMessage(latestDestination, lastDistanceMeters, lastDurationText);
      }
    });
  }

  // 津波浸水想定域（GeoJSON）
  map.data.loadGeoJson("./tsunami.geojson");
  map.data.setStyle({
    fillColor: "#5c9ee7",
    fillOpacity: 0.3,
    strokeColor: "#5c9ee7",
    strokeWeight: 1,
    clickable: false,
  });

  // 経路系サービス
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  // 距離行列
  distanceMatrixService = new google.maps.DistanceMatrixService();

  // 避難先データと、ブラウザに保存した追加ビルをまとめて読み込む
  loadAllDestinations();
  loadCommunityReportMarkers();
  loadTouristSpots();

  // 避難ビル追加フォームのボタンを有効にする
  setupBuildingForm();
  const destinationTypeFilter = document.getElementById("destination-type-filter");
  destinationTypeFilter?.addEventListener("change", renderBuildingList);

  // 避難モード / 地域情報投稿モードを有効にする
  setupModeSwitch();
  setupTouristCategoryFilter();
  setupReportDialog();

  // 地図クリック
  map.addListener("click", (event) => {
    if (isSelectingBuildingLocation && appMode === "evacuation") {
      selectBuildingLocation(event.latLng);
      return;
    }

    // 避難モード
    if (appMode === "evacuation") {
      setStartPoint(event.latLng);
      return;
    }

    // 地域情報投稿モード
    if (appMode === "report") {
      openReportQuestion(event.latLng);

      return;
    }

  });
}

/* ========== データ読み込み ========== */
function loadDestinations() {
  fetch("./destinations.json?v=20260911-2")
    .then((r) => r.json())
    .then((data) => {
      destinations = data.map(d => ({
        ...d,
        name_en: d.name_en ?? d.name   // 将来移行のために同値で補完
      }));
      destinations.forEach((dest) => {
        addCustomMarker(dest.location, getDisplayNameFor(dest), "building", "official", dest);
      });
    })
    .catch((error) => displayMessage("避難ビルの読み込みエラー: " + error));
}

function loadEvacPoints() {
  fetch("./evac_points.json")
    .then((r) => r.json())
    .then((data) => {
      data.forEach((point) => {
        const structured = {
          name: point.name,
          name_en: point.name_en ?? point.name,  // 同値で補完
          location: {
            lat: point.location?.lat ?? point.lat,
            lng: point.location?.lng ?? point.lng,
          },
        };
        destinations.push(structured);
        addCustomMarker(structured.location, getDisplayNameFor(structured), "point");
      });
    })
    .catch((error) => displayMessage("水平避難ポイントの読み込みエラー: " + error));
}

/* ========== 観光地データとマーカー ========== */
function getTouristSpotText(spot, field) {
  if (!spot) return "";
  const japanese = spot[field] || "";
  const english = spot[field + "_en"] || japanese;
  return LANG === "en" ? english : japanese;
}

function getTouristSpotIconUrl(spot) {
  const icons = {
    history_culture: "./tourist_spot_history.svg",
    scenery_walk: "./tourist_spot_scenery.svg",
    shopping_food: "./tourist_spot_shopping.svg",
    nature_leisure: "./tourist_spot_nature.svg",
  };
  return icons[spot?.category_group] || "./tourist_spot.svg";
}

async function loadTouristSpots() {
  try {
    const response = await fetch("./tourist_spots.json?v=20260927-1");
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    touristSpots = data.filter((spot) =>
      spot &&
      spot.location &&
      Number.isFinite(Number(spot.location.lat)) &&
      Number.isFinite(Number(spot.location.lng))
    );

    touristSpotMarkers.forEach((marker) => marker.setMap(null));
    touristSpotMarkers = touristSpots.map((spot) => {
      const marker = new google.maps.Marker({
        position: {
          lat: Number(spot.location.lat),
          lng: Number(spot.location.lng),
        },
        map: appMode === "tourism" && touristSpotMatchesActiveCategory(spot) ? map : null,
        title: getTouristSpotText(spot, "name"),
        clickable: true,
        icon: {
          url: getTouristSpotIconUrl(spot),
          size: new google.maps.Size(32, 38),
          scaledSize: new google.maps.Size(32, 38),
          origin: new google.maps.Point(0, 0),
          anchor: new google.maps.Point(16, 36),
        },
        optimized: false,
        zIndex: 850,
      });
      marker.__touristSpot = spot;
      marker.addListener("click", () => {
        if (appMode === "tourism") openTouristSpotPopup(spot, marker);
      });
      return marker;
    });
    if (appMode === "tourism") fitTouristSpotsToMap();
  } catch (error) {
    console.error("観光地データの読み込みエラー:", error);
    if (appMode === "tourism") displayMessage(t("tourism_load_error"));
  }
}

function setTouristSpotMarkersVisible(visible) {
  touristSpotMarkers.forEach((marker) => {
    const showMarker = visible && touristSpotMatchesActiveCategory(marker.__touristSpot);
    marker.setMap(showMarker ? map : null);
  });
  if (visible) {
    fitTouristSpotsToMap();
  } else {
    touristSpotInfoWindow?.close();
  }
}

function fitTouristSpotsToMap() {
  if (!map || touristSpotMarkers.length === 0) return;
  const bounds = new google.maps.LatLngBounds();
  const visibleMarkers = touristSpotMarkers.filter((marker) => marker.getMap());
  if (visibleMarkers.length === 0) return;
  visibleMarkers.forEach((marker) => bounds.extend(marker.getPosition()));
  map.fitBounds(bounds, { top: 110, right: 35, bottom: 170, left: 35 });
}

function touristSpotMatchesActiveCategory(spot) {
  return activeTouristCategory === "all" ||
    spot?.category_group === activeTouristCategory;
}

function setTouristCategory(category) {
  const allowedCategories = [
    "all",
    "history_culture",
    "scenery_walk",
    "shopping_food",
    "nature_leisure",
  ];
  activeTouristCategory = allowedCategories.includes(category) ? category : "all";
  document.querySelectorAll(".tourism-category-button").forEach((button) => {
    const isActive = button.dataset.tourismCategory === activeTouristCategory;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  touristSpotInfoWindow?.close();
  if (appMode === "tourism") setTouristSpotMarkersVisible(true);
}

function setupTouristCategoryFilter() {
  document.querySelectorAll(".tourism-category-button").forEach((button) => {
    button.addEventListener("click", () => {
      setTouristCategory(button.dataset.tourismCategory || "all");
    });
  });
  setTouristCategory("all");
}

function updateTouristSpotLanguage() {
  touristSpotMarkers.forEach((marker) => {
    marker.setTitle(getTouristSpotText(marker.__touristSpot, "name"));
  });
  touristSpotInfoWindow?.close();
}

function openTouristSpotPopup(spot, marker) {
  const name = getTouristSpotText(spot, "name");
  const area = getTouristSpotText(spot, "area");
  const category = getTouristSpotText(spot, "category");
  const address = getTouristSpotText(spot, "address");
  const sourceUrl = /^https:\/\/www\.hakobura\.jp\//.test(spot.source_url || "")
    ? spot.source_url
    : "https://www.hakobura.jp/map";
  const destination = spot.location;
  const googleMapsUrl = "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination.lat + "," + destination.lng) + "&travelmode=walking";
  const headerContent = document.createElement("strong");
  headerContent.textContent = name;
  headerContent.style.fontSize = "1rem";
  headerContent.style.lineHeight = "1.35";

  const content = document.createElement("div");
  content.style.maxWidth = "260px";
  content.style.lineHeight = "1.5";
  content.innerHTML = [
    '<div>' + escapeHtml(t("tourism_popup_area")) + ': ' + escapeHtml(area) + '</div>',
    '<div>' + escapeHtml(t("tourism_popup_category")) + ': ' + escapeHtml(category) + '</div>',
    '<div>' + escapeHtml(address) + '</div>',
    '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(t("tourism_popup_official")) + '</a>',
    '<a href="' + escapeHtml(googleMapsUrl) + '" target="_blank" rel="noopener noreferrer" style="display:block;margin-top:8px;padding:8px 10px;border-radius:6px;background:#28a745;color:#fff;text-align:center;text-decoration:none;font-weight:700">' + escapeHtml(t("tourism_popup_google_maps")) + '</a>',
    '<button type="button" class="tourism-popup-evacuation" style="display:block;width:100%;margin-top:8px;padding:8px 10px;border:0;border-radius:6px;background:#006fd6;color:#fff;text-align:center;font:inherit;font-weight:700;cursor:pointer">' + escapeHtml(t("tourism_popup_find_evacuation")) + '</button>',
  ].join("");
  content.querySelector(".tourism-popup-evacuation")?.addEventListener("click", () => {
    startEvacuationFromTouristSpot(spot);
  });

  touristSpotInfoWindow?.close();
  touristSpotInfoWindow = new google.maps.InfoWindow({ content, headerContent });
  touristSpotInfoWindow.open({ map, anchor: marker });
}

function startEvacuationFromTouristSpot(spot) {
  const lat = Number(spot?.location?.lat);
  const lng = Number(spot?.location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  touristSpotInfoWindow?.close();
  setAppMode("evacuation");
  const location = new google.maps.LatLng(lat, lng);
  map.panTo(location);
  setStartPoint(location);
}

/* ========== マーカー（SVG） ========== */
// size と scaledSize を表示サイズに統一し、透明な領域での誤クリックを防ぐ。
// 当たり判定：point は小さめ、shape で円領域。anchor は足元（下辺中央）。
function addCustomMarker(position, title, type = "building", source = "official", details = null) {
  let iconUrl = "./evacuation_destination.svg";
  if (type === "point") {
    iconUrl = "./HP.svg";
  } else if (details?.is_designated_shelter === true) {
    iconUrl = "./evacuation_destination_shelter.svg";
  }

  const sizeByType = appMode === "tourism"
    ? { building: 22, point: 14 }
    : { building: 34, point: 20 };
  const w = sizeByType[type] || 30;
  const h = w;
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);
  const r  = Math.max(6, Math.floor(w / 2) - 2);

  const marker = new google.maps.Marker({
    position: new google.maps.LatLng(position.lat, position.lng),
    map: map,
    title: title,
    clickable: true,
    icon: {
      url: iconUrl,
      size: new google.maps.Size(w, h), // 透明な領域も表示サイズに合わせる
      scaledSize: new google.maps.Size(w, h),
      origin: new google.maps.Point(0, 0),
      anchor: new google.maps.Point(cx, h - 2)   // 足元
    },
    shape: { type: "circle", coords: [cx, cy, r] },
    opacity: appMode === "tourism" ? 0.35 : 1,
    zIndex: appMode === "tourism" ? 100 : undefined,
    optimized: false
  });

  marker.addListener("click", () => {
    if (isSelectingBuildingLocation && appMode === "evacuation") {
      selectBuildingLocation(marker.getPosition());
      return;
    }
    // 投稿モードでは、マーカーを押しても地域情報の質問を開く。
    if (appMode === "report") {
      openReportQuestion(marker.getPosition());
      return;
    }

    const dest = destinations.find(d => Math.abs(d.location.lat - position.lat)<1e-9 && Math.abs(d.location.lng - position.lng)<1e-9) || { name: title, name_en: title, location: position };
    openDestinationPopup(dest, marker);
  });

  return marker;
}

// 観光モードでは避難先を補助情報として小さく薄くし、観光地を見やすくする。
function setEvacuationMarkerEmphasisForMode(isTourismMode) {
  const sizeByType = isTourismMode
    ? { building: 22, point: 14 }
    : { building: 34, point: 20 };

  destinations.forEach((dest) => {
    const marker = dest.marker;
    if (!marker) return;

    const w = sizeByType[dest.markerType] || (isTourismMode ? 20 : 30);
    const h = w;
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const r = Math.max(5, Math.floor(w / 2) - 2);
    const currentIcon = marker.getIcon();

    if (currentIcon && typeof currentIcon === "object") {
      marker.setIcon({
        ...currentIcon,
        size: new google.maps.Size(w, h),
        scaledSize: new google.maps.Size(w, h),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(cx, h - 2),
      });
    }
    marker.setShape({ type: "circle", coords: [cx, cy, r] });
    marker.setOpacity(isTourismMode ? 0.35 : 1);
    marker.setZIndex(isTourismMode ? 100 : undefined);
  });
}

/* ========== ポップアップ（InfoWindow） ========== */
// 矢印先端＝足元（marker.getPosition()）に一致。
// ★変更：アイコン高さを読み取り、pixelOffset を 6〜18px の範囲で自動計算（基準 h*0.35）
function openDestinationPopup(dest, marker) {
  latestDestination = dest;

  // ★ここが可変オフセット（lift）の計算
  let lift = 20; // デフォは +10px
  try {
    const icon = marker.getIcon && marker.getIcon();
    const h = (icon && icon.scaledSize && Number(icon.scaledSize.height)) || 0;
    if (h > 0) {
      lift = Math.round(Math.min(30, Math.max(18, h * 0.8)));
    }
  } catch (_) {}

  const linkId = "goto-" + Math.random().toString(36).slice(2);
  const displayName = getDisplayNameFor(dest);
  const sourceKey = dest.markerType === "building"
    ? (dest.source === "community"
        ? "building_list_shared"
        : dest.source === "user" ? "building_list_local" : "building_list_official")
    : null;
  const displayTitle = sourceKey ? displayName + " — " + t(sourceKey) : displayName;
  const typeLabels = [];
  if (dest.markerType === "building" && dest.source === "official") {
    if (dest.evacuation_category === "tsunami_evacuation_building") {
      typeLabels.push(t("building_type_tsunami_building"));
    } else if (dest.evacuation_category === "designated_emergency_place_tsunami") {
      typeLabels.push(t("building_type_emergency_place"));
    }
    if (dest.is_designated_shelter === true) {
      typeLabels.push(t("building_type_also_shelter"));
    }
    if (dest.classification_status === "review_needed") {
      typeLabels.push(t("building_type_review_needed"));
    }
  }
  const typeHtml = typeLabels.length > 0
    ? `<div style="font-size:12px; color:#444; margin-bottom:6px;">${typeLabels.map(escapeHtml).join(" / ")}</div>`
    : "";
  const html = `
    <div style="font-size:14px; line-height:1.5; background:#fff; color:#000; padding:2px 0;">
      <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(displayTitle)}</div>
      ${typeHtml}
      <a id="${linkId}" href="#" style="color:#007bff; text-decoration:underline;">${t("go_here")}</a>
    </div>
  `;

  if (!infoWindow) {
    infoWindow = new google.maps.InfoWindow({
      maxWidth: 260,
      pixelOffset: new google.maps.Size(0, -lift)  // ★自動計算した持ち上げ量を適用
    });
  } else {
    infoWindow.setOptions({
      maxWidth: 260,
      pixelOffset: new google.maps.Size(0, -lift)  // ★更新
    });
  }

  infoWindow.setContent(html);
  infoWindow.setPosition(marker.getPosition()); // 足元に一致
  infoWindow.open(map);

  google.maps.event.addListenerOnce(infoWindow, "domready", () => {
    const el = document.getElementById(linkId);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (!startMarker) {
        displayMessage(t("need_start"));
        map.panTo(marker.getPosition());
        return;
      }
      const origin = startMarker.getPosition();
      drawRoute(origin, dest.location);
    });
  });
}

/* ========== 出発地点 & 探索 ========== */
function setStartPoint(location) {
  if (startMarker) startMarker.setMap(null);
  startMarker = new google.maps.Marker({
    position: location,
    map: map,
    title: "Start",
  });
  findClosestPoint(location);
}

function findClosestPoint(originLatLng) {
  attemptWithRadius(originLatLng, PRIMARY_RADIUS_M, /*isFallback*/ false);
}

function attemptWithRadius(originLatLng, radiusMeters, isFallback) {
  const origin = originLatLng;
  const nearby = collectCandidates(origin, radiusMeters, /*sort*/ true);

  if (nearby.length === 0) {
    displayMessage(t("none_in_radius", { radius: radiusMeters }));
    directionsRenderer.setDirections({ routes: [] });
    lastDistanceMeters = null;
    lastDurationText = null;
    latestDestination = null;
    return;
  }

  if (nearby.length > DESTINATION_LIMIT) {
    if (!isFallback) {
      displayMessage(t("rerun_fallback", { radius: FALLBACK_RADIUS_M }));
      attemptWithRadius(origin, FALLBACK_RADIUS_M, /*isFallback*/ true);
      return;
    } else {
      displayMessage(t("too_many_limit", { limit: DESTINATION_LIMIT }));
    }
  }

  const candidates = (nearby.length > DESTINATION_LIMIT && isFallback)
    ? nearby.slice(0, DESTINATION_LIMIT)
    : nearby;

  const destinationLocations = candidates.map(d => d.location);

  distanceMatrixService.getDistanceMatrix(
    {
      origins: [origin],
      destinations: destinationLocations,
      travelMode: google.maps.TravelMode.WALKING,
    },
    (response, status) => {
      if (appMode !== "evacuation") return;
      const statusStr = String(status);
      const isMaxErr =
        statusStr === "MAX_DIMENSIONS_EXCEEDED" ||
        statusStr === "MAX_ELEMENTS_EXCEEDED" ||
        status === google.maps.DistanceMatrixStatus.MAX_ELEMENTS_EXCEEDED ||
        status === google.maps.DistanceMatrixStatus.MAX_DIMENSIONS_EXCEEDED;

      if (isMaxErr && !isFallback) {
        displayMessage(t("rerun_fallback", { radius: FALLBACK_RADIUS_M }));
        attemptWithRadius(origin, FALLBACK_RADIUS_M, /*isFallback*/ true);
        return;
      }

      if (status === google.maps.DistanceMatrixStatus.OK) {
        const distances = response.rows[0].elements;

        let closestIndex = 0;
        let minDistance = distances[0].distance.value;
        for (let i = 1; i < distances.length; i++) {
          if (distances[i].status === "OK" && distances[i].distance.value < minDistance) {
            minDistance = distances[i].distance.value;
            closestIndex = i;
          }
        }

        latestDestination = candidates[closestIndex];
        lastDistanceMeters = distances[closestIndex].distance.value;
        lastDurationText  = distances[closestIndex].duration.text;

        showNearestMessage(latestDestination, lastDistanceMeters, lastDurationText);
        drawRoute(origin, latestDestination.location);
      } else {
        displayMessage(t("error_status", { status: statusStr }));
      }
    }
  );
}

/* ========== 経路描画 ========== */
function drawRoute(origin, destination) {
  directionsService.route(
    {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode.WALKING,
    },
    (result, status) => {
      if (appMode !== "evacuation") return;
      if (status === google.maps.DirectionsStatus.OK) {
        directionsRenderer.setDirections(result);
        if (latestDestination && lastDistanceMeters != null && lastDurationText != null) {
          showNearestMessage(latestDestination, lastDistanceMeters, lastDurationText);
        } else if (latestDestination) {
          displayMessage(t("drawing_fmt", { name: getDisplayNameFor(latestDestination) }));
        }
      } else {
        displayMessage(t("route_error", { status }));
      }
    }
  );
}

/* ========== 外部起動 / 現在地 ========== */
function openInGoogleMaps(origin, destination) {
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=walking`;
  window.open(url, "_blank");
}

function launchGoogleMap() {
  if (!startMarker || !latestDestination) {
    displayMessage(t("need_start"));
    return;
  }
  const origin = startMarker.getPosition();
  openInGoogleMaps(
    { lat: origin.lat(), lng: origin.lng() },
    latestDestination.location
  );
}

function useCurrentLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latLng = new google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        setStartPoint(latLng);
      },
      (error) => {
        displayMessage("Geolocation error: " + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  } else {
    displayMessage("This browser does not support Geolocation.");
  }
}

/* ========== 地域情報の質問・確認・投稿 ========== */
// 送信状態に応じて操作と案内を更新する。
function updateReportSubmitUI() {
  const dialog = document.getElementById("report-dialog");
  if (!dialog) return;
  const sending = reportSubmitState === "sending";
  const success = reportSubmitState === "success";
  const uncertain = reportSubmitState === "uncertain";
  dialog.setAttribute("aria-busy", String(sending));
  dialog.querySelectorAll("button").forEach(button => { button.disabled = sending; });
  dialog.querySelectorAll("[data-report-choice]").forEach(button => {
    button.disabled = sending || success || uncertain;
  });
  const comment = document.getElementById("report-comment");
  if (comment) comment.disabled = sending || success || uncertain;
  const reasons = document.getElementById("report-reasons");
  if (reasons) reasons.disabled = sending || success || uncertain;
  const conditions = document.getElementById("report-conditions");
  if (conditions) conditions.disabled = sending || success || uncertain || reportDraft?.answer !== "depends";
  const review = document.getElementById("report-review-button");
  const submit = document.getElementById("report-submit-button");
  const edit = document.getElementById("report-edit-button");
  const cancel = document.getElementById("report-cancel");
  if (review) review.disabled = sending || success || !reportDraft?.answer;
  if (edit) edit.disabled = sending || success || uncertain;
  if (submit) {
    submit.disabled = sending || success || !reportDraft?.answer;
    submit.textContent = t(sending ? "report_sending" : success ? "report_sent" :
      (uncertain || reportSubmitState === "error") ? "report_retry" : "report_submit");
  }
  if (cancel) cancel.textContent = t(success ? "report_close" : "report_cancel");
  const status = document.getElementById("report-submit-status");
  const key = { sending: "report_sending", success: "report_success",
    error: "report_failed", uncertain: "report_uncertain" }[reportSubmitState];
  if (status) status.textContent = key ? t(key) : "";
  const note = document.getElementById("report-note");
  if (note) note.hidden = success;
}

async function submitReport() {
  const dialog = document.getElementById("report-dialog");
  const review = document.getElementById("report-review-step");
  if (!dialog?.open || review?.hidden || appMode !== "report" || !reportDraft?.answer ||
      reportSubmitState === "sending" || reportSubmitState === "success") return;
  reportSubmitState = "sending";
  updateReportSubmitUI();
  try {
    if (!reportSubmitPayload) {
      reportSubmitPayload = {
        id: crypto.randomUUID(),
        target_type: "road_point",
        latitude: reportDraft.location.lat,
        longitude: reportDraft.location.lng,
        evaluation: reportDraft.answer,
        comment: reportDraft.comment.trim() || null,
        reason_codes: [...reportDraft.reason_codes],
        condition_codes: reportDraft.answer === "depends" ? [...reportDraft.condition_codes] : [],
      };
    }
    const savedReport = await saveCommunityReport(reportSubmitPayload);
    communityCurrentUserId = savedReport.contributor_user_id;
    reportSubmitPayload = savedReport;
    reportSubmitState = "success";
    addCommunityReportMarker(savedReport);
    clearReportMarker();
  } catch (error) {
    // 4xxは拒否が確定。通信切断や5xxは保存済みの可能性があるため内容を固定する。
    const rejected = (error.status >= 400 && error.status < 500) ||
      error.message === "invalid_report" || !reportSubmitPayload;
    reportSubmitState = rejected ? "error" : "uncertain";
    if (rejected) reportSubmitPayload = null;
  } finally {
    updateReportSubmitUI();
    document.getElementById("report-submit-status")?.focus();
  }
}

function clearReportMarker() {
  if (reportMarker) {
    reportMarker.setMap(null);
    reportMarker = null;
  }
}

function getCommunityReportMarkerIcon(evaluation) {
  const colors = { use: "#16833b", depends: "#e68a00", avoid: "#c62828" };
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 7,
    fillColor: colors[evaluation],
    fillOpacity: 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}

function addCommunityReportMarker(report) {
  const id = String(report?.id || "");
  const lat = Number(report?.latitude);
  const lng = Number(report?.longitude);
  const evaluation = report?.evaluation;
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      !["use", "depends", "avoid"].includes(evaluation) ||
      communityReportMarkers.some((entry) => entry.id === id)) return;

  const marker = new google.maps.Marker({
    position: { lat, lng },
    map: appMode === "report" ? map : null,
    title: t("report_saved_marker", { answer: t("report_" + evaluation) }),
    clickable: true,
    zIndex: 600,
    icon: getCommunityReportMarkerIcon(evaluation),
  });
  marker.addListener("click", () => {
    if (appMode === "report") openCommunityReportPopup(report, marker);
  });
  communityReportMarkers.push({ id, marker, report });
}

function openCommunityReportPopup(report, marker) {
  const content = document.createElement("div");
  content.className = "community-report-popup";
  const title = document.createElement("h3");
  title.textContent = t("report_popup_title");
  const details = document.createElement("dl");
  const addDetail = (label, value) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    details.append(term, description);
  };

  addDetail(t("report_popup_answer"), t("report_" + report.evaluation));
  const separator = LANG === "ja" ? "、" : ", ";
  if (report.evaluation === "depends") {
    const conditions = (report.condition_codes || []).map((code) => t("report_condition_" + code));
    addDetail(t("report_conditions"), conditions.join(separator) || t("report_no_conditions"));
  } else {
    const reasons = (report.reason_codes || []).map((code) => t("report_reason_" + code));
    addDetail(t("report_reasons"), reasons.join(separator) || t("report_no_reasons"));
  }
  addDetail(t("report_comment"), String(report.comment || "").trim() || t("report_no_comment"));

  content.append(title, details);
  if (communityCurrentUserId && report.contributor_user_id === communityCurrentUserId) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "community-report-popup-edit";
    editButton.textContent = t("report_owner_edit");
    editButton.addEventListener("click", () => openCommunityReportEditor(report, marker));
    content.appendChild(editButton);
  }
  if (!communityReportInfoWindow) {
    communityReportInfoWindow = new google.maps.InfoWindow({ maxWidth: 300 });
  }
  communityReportInfoWindow.setContent(content);
  communityReportInfoWindow.open(map, marker);
}

function openCommunityReportEditor(report, marker) {
  const content = document.createElement("div");
  content.className = "community-report-popup community-report-editor";
  const title = document.createElement("h3");
  title.textContent = t("report_owner_edit");

  const evaluationLabel = document.createElement("label");
  evaluationLabel.textContent = t("report_popup_answer");
  const evaluationSelect = document.createElement("select");
  ["use", "depends", "avoid"].forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = t("report_" + value);
    option.selected = report.evaluation === value;
    evaluationSelect.appendChild(option);
  });
  evaluationLabel.appendChild(evaluationSelect);

  const choices = document.createElement("fieldset");
  const choicesLegend = document.createElement("legend");
  const choicesBody = document.createElement("div");
  choices.append(choicesLegend, choicesBody);

  const renderChoices = () => {
    choicesBody.replaceChildren();
    const evaluation = evaluationSelect.value;
    const isDepends = evaluation === "depends";
    choicesLegend.textContent = t(isDepends ? "report_conditions_label" : "report_reasons_label");
    const codes = isDepends
      ? COMMUNITY_REPORT_CONDITION_CODES
      : (COMMUNITY_REPORT_REASON_OPTIONS[evaluation] || []);
    const selected = evaluation === report.evaluation
      ? (isDepends ? report.condition_codes : report.reason_codes) || []
      : [];
    codes.forEach((code) => {
      const label = document.createElement("label");
      label.className = "community-report-editor-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = code;
      input.checked = selected.includes(code);
      const text = document.createElement("span");
      text.textContent = t((isDepends ? "report_condition_" : "report_reason_") + code);
      label.append(input, text);
      choicesBody.appendChild(label);
    });
  };
  evaluationSelect.addEventListener("change", renderChoices);
  renderChoices();

  const commentLabel = document.createElement("label");
  commentLabel.textContent = t("report_comment_label");
  const comment = document.createElement("textarea");
  comment.maxLength = 500;
  comment.rows = 3;
  comment.value = report.comment || "";
  commentLabel.appendChild(comment);

  const actions = document.createElement("div");
  actions.className = "community-report-editor-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "community-report-editor-save";
  saveButton.textContent = t("report_update");
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = t("report_cancel");
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "community-report-editor-delete";
  deleteButton.textContent = t("report_delete");
  const status = document.createElement("p");
  status.className = "community-report-editor-status";
  status.setAttribute("role", "status");

  saveButton.addEventListener("click", async () => {
    const evaluation = evaluationSelect.value;
    const selectedCodes = Array.from(choicesBody.querySelectorAll("input:checked"), (input) => input.value);
    const changes = {
      evaluation,
      reason_codes: evaluation === "depends" ? [] : selectedCodes,
      condition_codes: evaluation === "depends" ? selectedCodes : [],
      comment: comment.value.trim() || null,
    };
    saveButton.disabled = true;
    cancelButton.disabled = true;
    deleteButton.disabled = true;
    saveButton.textContent = t("report_update_saving");
    status.textContent = "";
    try {
      const updated = await updateCommunityReport(report.id, changes);
      Object.assign(report, updated);
      marker.setIcon(getCommunityReportMarkerIcon(report.evaluation));
      marker.setTitle(t("report_saved_marker", { answer: t("report_" + report.evaluation) }));
      openCommunityReportPopup(report, marker);
    } catch (_) {
      status.textContent = t("report_update_failed");
      saveButton.disabled = false;
      cancelButton.disabled = false;
      deleteButton.disabled = false;
      saveButton.textContent = t("report_update");
    }
  });
  cancelButton.addEventListener("click", () => openCommunityReportPopup(report, marker));
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(t("report_delete_confirm"))) return;
    saveButton.disabled = true;
    cancelButton.disabled = true;
    deleteButton.disabled = true;
    deleteButton.textContent = t("report_delete_deleting");
    status.textContent = "";
    try {
      await deleteCommunityReport(report.id);
      marker.setMap(null);
      communityReportMarkers = communityReportMarkers.filter((item) => item.id !== report.id);
      communityReportInfoWindow.close();
    } catch (_) {
      status.textContent = t("report_delete_failed");
      saveButton.disabled = false;
      cancelButton.disabled = false;
      deleteButton.disabled = false;
      deleteButton.textContent = t("report_delete");
    }
  });

  actions.append(saveButton, cancelButton);
  content.append(title, evaluationLabel, choices, commentLabel, actions, deleteButton, status);
  communityReportInfoWindow.setContent(content);
  communityReportInfoWindow.open(map, marker);
}

async function loadCommunityReportMarkers() {
  const refreshButton = document.getElementById("refresh-community-reports");
  try {
    communityCurrentUserId = await getCommunityUserId();
    const reports = await loadCommunityReportLocations();
    reports.forEach(addCommunityReportMarker);
  } catch (error) {
    console.warn("投稿地点を読み込めませんでした。", error?.message || "unknown_error");
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function refreshCommunityReportMarkers() {
  const button = document.getElementById("refresh-community-reports");
  const status = document.getElementById("community-report-refresh-status");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = t("report_refreshing");
  }
  if (status) status.textContent = "";
  try {
    const reports = await loadCommunityReportLocations();
    communityReportInfoWindow?.close();
    communityReportMarkers.forEach(({ marker }) => marker.setMap(null));
    communityReportMarkers = [];
    reports.forEach(addCommunityReportMarker);
    setCommunityReportMarkersVisible(appMode === "report");
    if (status) status.textContent = t("report_refresh_done", { count: fmtNum(reports.length) });
  } catch (_) {
    if (status) status.textContent = t("report_refresh_failed");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = t("report_refresh");
    }
  }
}

function setCommunityReportMarkersVisible(visible) {
  communityReportMarkers.forEach(({ marker }) => marker.setMap(visible ? map : null));
  if (!visible) communityReportInfoWindow?.close();
}

// ボタンの選択状態を、文章でも確認できるようにする。
function updateReportSelection() {
  const summary = document.getElementById("report-selection");
  if (!summary) return;
  const answer = reportDraft?.answer;
  summary.textContent = answer
    ? t("report_selected", { answer: t("report_" + answer) })
    : t("report_unselected");
  const reviewButton = document.getElementById("report-review-button");
  if (reviewButton) reviewButton.disabled = !answer;
  const reviewAnswer = document.getElementById("report-review-answer");
  const availableReasons = COMMUNITY_REPORT_REASON_OPTIONS[answer] || [];
  const reasons = document.getElementById("report-reasons");
  if (reasons) reasons.hidden = availableReasons.length === 0;
  const reasonCodes = reportDraft?.reason_codes || [];
  document.querySelectorAll("[data-report-reason]").forEach(input => {
    input.checked = reasonCodes.includes(input.value);
    input.closest("label").hidden = !availableReasons.includes(input.value);
  });
  // 回答ごとの順番で並べ直し、「その他」を常に最後にする。
  const reasonOptions = document.getElementById("report-reason-options");
  availableReasons.forEach(code => {
    const input = document.querySelector('[data-report-reason="' + code + '"]');
    if (input && reasonOptions) reasonOptions.append(input.closest("label"));
  });
  const reviewReasons = document.getElementById("report-review-reasons");
  const reviewReasonsLabel = document.getElementById("report-review-reasons-label");
  if (reviewReasonsLabel) reviewReasonsLabel.hidden = availableReasons.length === 0;
  if (reviewReasons) reviewReasons.hidden = availableReasons.length === 0;
  if (reviewReasons) reviewReasons.textContent = reasonCodes.length
    ? reasonCodes.map(code => t("report_reason_" + code)).join(LANG === "ja" ? "、" : ", ")
    : t("report_no_reasons");
  const depends = answer === "depends";
  const conditionCodes = depends ? (reportDraft?.condition_codes || []) : [];
  const conditions = document.getElementById("report-conditions");
  if (conditions) conditions.hidden = !depends;
  document.querySelectorAll("[data-report-condition]").forEach(input => {
    input.checked = conditionCodes.includes(input.value);
  });
  const reviewConditions = document.getElementById("report-review-conditions");
  const reviewConditionsLabel = document.getElementById("report-review-conditions-label");
  if (reviewConditionsLabel) reviewConditionsLabel.hidden = !depends;
  if (reviewConditions) {
    reviewConditions.hidden = !depends;
    reviewConditions.textContent = conditionCodes.length
      ? conditionCodes.map(code => t("report_condition_" + code)).join(LANG === "ja" ? "、" : ", ")
      : t("report_no_conditions");
  }
  const reviewComment = document.getElementById("report-review-comment");
  if (reviewComment) reviewComment.textContent = reportDraft?.comment?.trim() || t("report_no_comment");
  const reviewLocation = document.getElementById("report-review-location");
  if (reviewAnswer) reviewAnswer.textContent = answer ? t("report_" + answer) : "";
  if (reviewLocation) reviewLocation.textContent = reportDraft
    ? `${reportDraft.location.lat.toFixed(6)}, ${reportDraft.location.lng.toFixed(6)}`
    : "";
  updateReportSubmitUI();
}

// 同じダイアログ内で切り替え、確認・修正の間は下書きと仮ピンを保持する。
function setReportReview(showReview, moveFocus = true) {
  if (["sending", "success", "uncertain"].includes(reportSubmitState)) return;
  const dialog = document.getElementById("report-dialog");
  const answerStep = document.getElementById("report-answer-step");
  const reviewStep = document.getElementById("report-review-step");
  if (!dialog || !answerStep || !reviewStep) return;
  const reviewing = Boolean(showReview && reportDraft?.answer);
  answerStep.hidden = reviewing;
  reviewStep.hidden = !reviewing;
  dialog.setAttribute("aria-labelledby", reviewing ? "report-review-title" : "report-question");
  if (moveFocus && dialog.open) {
    const target = reviewing
      ? document.getElementById("report-review-title")
      : dialog.querySelector('[data-report-choice][aria-pressed="true"]');
    target?.focus();
  }
}

// 質問を終了したら、下書き・仮ピン・選択表示をまとめて破棄する。
function clearReportDraft() {
  reportSubmitState = "idle";
  reportSubmitPayload = null;
  reportDraft = null;
  const comment = document.getElementById("report-comment");
  if (comment) comment.value = "";
  setReportReview(false, false);
  clearReportMarker();
  document.querySelectorAll("#report-dialog [data-report-choice]").forEach(button => {
    button.setAttribute("aria-pressed", "false");
  });
  updateReportSelection();
}

function openReportQuestion(location) {
  const dialog = document.getElementById("report-dialog");
  if (!dialog || appMode !== "report" || !location || reportSubmitState === "sending") return;

  const lat = typeof location.lat === "function" ? location.lat() : location.lat;
  const lng = typeof location.lng === "function" ? location.lng() : location.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  // 新しい地点の下書きを作る。以前の回答は引き継がない。
  reportSubmitState = "idle";
  reportSubmitPayload = null;
  reportDraft = { location: { lat, lng }, answer: null, comment: "", reason_codes: [], condition_codes: [] };
  const comment = document.getElementById("report-comment");
  if (comment) comment.value = "";

  // 避難用の出発ピンとは別に、投稿対象の位置だけを示す。
  clearReportMarker();
  reportMarker = new google.maps.Marker({
    position: location,
    map: map,
    title: t("report_location"),
    label: "?",
    clickable: false,
    zIndex: 1000,
  });

  // 地図をタップするたびに、前回の選択をリセットする。
  dialog.querySelectorAll("[data-report-choice]").forEach(button => {
    button.setAttribute("aria-pressed", "false");
  });
  updateReportSelection();
  setReportReview(false, false);
  if (!dialog.open) dialog.showModal();
}

function setupReportDialog() {
  const dialog = document.getElementById("report-dialog");
  if (!dialog) return;

  const choices = dialog.querySelectorAll("[data-report-choice]");
  choices.forEach(button => {
    button.addEventListener("click", () => {
      if (!reportDraft || appMode !== "report" || !dialog.open ||
          ["sending", "success", "uncertain"].includes(reportSubmitState)) return;
      reportSubmitState = "idle";
      reportSubmitPayload = null;
      const nextAnswer = button.getAttribute("data-report-choice");
      if (reportDraft.answer !== nextAnswer) reportDraft.reason_codes = [];
      reportDraft.answer = nextAnswer;
      // 条件は「状況による」専用。他の回答へ変えたら解除する。
      if (reportDraft.answer !== "depends") reportDraft.condition_codes = [];
      // 下書きに合わせて選択状態と確認文を更新する。通信・保存は行わない。
      choices.forEach(choice => {
        choice.setAttribute("aria-pressed", String(choice === button));
      });
      updateReportSelection();
    });
  });
  // 保存コードと表示名を分ける。表示名だけの変更では過去のコードを変えない。
  const reasonOptions = document.getElementById("report-reason-options");
  [...new Set(Object.values(COMMUNITY_REPORT_REASON_OPTIONS).flat())].forEach(code => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = code;
    input.setAttribute("data-report-reason", code);
    const text = document.createElement("span");
    text.setAttribute("data-i18n", "report_reason_" + code);
    text.textContent = t("report_reason_" + code);
    label.append(input, text);
    reasonOptions.append(label);
    input.addEventListener("change", () => {
      if (!reportDraft || !dialog.open || appMode !== "report" ||
          ["sending", "success", "uncertain"].includes(reportSubmitState)) return;
      const available = COMMUNITY_REPORT_REASON_OPTIONS[reportDraft.answer] || [];
      reportDraft.reason_codes = Array.from(reasonOptions.querySelectorAll("input:checked"), item => item.value)
        .filter(code => available.includes(code));
      reportSubmitPayload = null;
      reportSubmitState = "idle";
      updateReportSelection();
    });
  });
  const conditionOptions = document.getElementById("report-condition-options");
  COMMUNITY_REPORT_CONDITION_CODES.forEach(code => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = code;
    input.setAttribute("data-report-condition", code);
    const text = document.createElement("span");
    text.setAttribute("data-i18n", "report_condition_" + code);
    text.textContent = t("report_condition_" + code);
    label.append(input, text);
    conditionOptions.append(label);
    input.addEventListener("change", () => {
      if (!reportDraft || !dialog.open || appMode !== "report" || reportDraft.answer !== "depends" ||
          ["sending", "success", "uncertain"].includes(reportSubmitState)) return;
      reportDraft.condition_codes = Array.from(conditionOptions.querySelectorAll("input:checked"), item => item.value);
      reportSubmitPayload = null;
      reportSubmitState = "idle";
      updateReportSelection();
    });
  });
  document.getElementById("report-comment").addEventListener("input", event => {
    if (!reportDraft || !dialog.open || appMode !== "report" ||
        ["sending", "success", "uncertain"].includes(reportSubmitState)) return;
    reportDraft.comment = event.target.value;
    reportSubmitPayload = null;
    reportSubmitState = "idle";
    updateReportSelection();
  });
  document.getElementById("report-review-button").addEventListener("click", () => {
    if (appMode !== "report" || !dialog.open || !reportDraft?.answer) return;
    updateReportSelection();
    setReportReview(true);
  });
  document.getElementById("report-edit-button").addEventListener("click", () => {
    setReportReview(false);
  });
  document.getElementById("report-submit-button").addEventListener("click", submitReport);
  dialog.addEventListener("cancel", event => {
    if (reportSubmitState === "sending") event.preventDefault();
  });
  document.getElementById("report-cancel").addEventListener("click", () => {
    if (reportSubmitState === "sending") return;
    dialog.close();
  });
  // キャンセルボタン・Escキーなど、質問を閉じたときに仮ピンを消す。
  dialog.addEventListener("close", () => {
    if (!dialog.open) clearReportDraft();
  });
}

/* ========== アプリモード切り替え ========== */

// 現在のモードと言語に合わせて、ヘッダーの操作案内だけを更新する。
function updateModeGuidance() {
  const hint = document.querySelector('#app-header [data-i18n="header_subtext"]');
  const guidanceKey = appMode === "report"
    ? "header_report_subtext"
    : appMode === "tourism" ? "header_tourism_subtext" : "header_subtext";
  if (hint) hint.textContent = t(guidanceKey);
  // 文の折り返しで高さが変わった場合も、地図がヘッダーに隠れないようにする。
  if (typeof updateLayoutHeightVars === "function") updateLayoutHeightVars();
}

function setAppMode(mode) {
  if (reportSubmitState === "sending") return;
  appMode = ["report", "tourism"].includes(mode) ? mode : "evacuation";
  setEvacuationMarkerEmphasisForMode(appMode === "tourism");
  setCommunityReportMarkersVisible(appMode === "report");
  setTouristSpotMarkersVisible(appMode === "tourism");
  const tourismLegend = document.getElementById("tourism-map-legend");
  if (tourismLegend) tourismLegend.hidden = appMode !== "tourism";
  const tourismCategoryFilter = document.getElementById("tourism-category-filter");
  if (tourismCategoryFilter) tourismCategoryFilter.hidden = appMode !== "tourism";
  const reportLegend = document.getElementById("community-report-legend");
  if (reportLegend) reportLegend.hidden = appMode !== "report";
  const destinationLegend = document.getElementById("destination-map-legend");
  if (destinationLegend) {
    destinationLegend.hidden = !["evacuation", "tourism"].includes(appMode);
  }
  if (appMode !== "evacuation") {
    clearBuildingLocation();
    if (startMarker) startMarker.setMap(null);
    startMarker = null;
    directionsRenderer?.setDirections({ routes: [] });
    latestDestination = null;
    lastDistanceMeters = null;
    lastDurationText = null;
    infoWindow?.close();
    displayMessage(t("info_hint"));
  }
  // 投稿時は地図を広く使う。入力値や折りたたみ状態は保持する。
  const buildingForm = document.getElementById("building-form");
  if (buildingForm) {
    buildingForm.hidden = !IS_BUILDING_ADMIN_VIEW || appMode !== "evacuation";
  }
  updateModeGuidance();
  if (appMode !== "report") {
    clearReportDraft();
    const dialog = document.getElementById("report-dialog");
    if (dialog && dialog.open) dialog.close();
  }

  const evacuationButton =
    document.getElementById("evacuation-mode-button");

  const reportButton =
    document.getElementById("report-mode-button");

  const tourismButton =
    document.getElementById("tourism-mode-button");

  if (!evacuationButton || !reportButton || !tourismButton) return;

  const isEvacuationMode = appMode === "evacuation";
  const isReportMode = appMode === "report";
  const isTourismMode = appMode === "tourism";

  evacuationButton.classList.toggle(
    "active",
    isEvacuationMode
  );

  reportButton.classList.toggle(
    "active",
    isReportMode
  );

  tourismButton.classList.toggle(
    "active",
    isTourismMode
  );

  evacuationButton.setAttribute(
    "aria-pressed",
    String(isEvacuationMode)
  );

  reportButton.setAttribute(
    "aria-pressed",
    String(isReportMode)
  );

  tourismButton.setAttribute(
    "aria-pressed",
    String(isTourismMode)
  );
}


function setupModeSwitch() {
  const evacuationButton =
    document.getElementById("evacuation-mode-button");

  const reportButton =
    document.getElementById("report-mode-button");

  const tourismButton =
    document.getElementById("tourism-mode-button");

  if (!evacuationButton || !reportButton || !tourismButton) {
    console.warn("モード切替ボタンが見つかりません。");
    return;
  }

  evacuationButton.addEventListener("click", () => {
    setAppMode("evacuation");
  });

  reportButton.addEventListener("click", () => {
    setAppMode("report");
  });

  tourismButton.addEventListener("click", () => {
    setAppMode("tourism");
  });

  // 起動時は避難モード
  setAppMode("evacuation");
}

/* ========== 避難ビル追加機能 ========== */
// 公式データ、Supabaseの共有投稿、ブラウザ保存データをまとめて読み込む。
// 既存の loadDestinations() / loadEvacPoints() は残しているが、initMap() からはこの関数を使う。
async function loadAllDestinations() {
  try {
    const sharedBuildingsPromise = typeof loadCommunityBuildings === "function"
      ? loadCommunityBuildings().catch((error) => {
          console.warn("共有避難ビルを読み込めませんでした。", error?.message || "unknown_error");
          return [];
        })
      : Promise.resolve([]);
    const currentUserPromise = typeof getCommunityUserId === "function"
      ? getCommunityUserId().catch(() => null)
      : Promise.resolve(null);
    const [buildingResponse, pointResponse, communityBuildingData, currentUserId] = await Promise.all([
      fetch("./destinations.json?v=20260911-2"),
      fetch("./evac_points.json"),
      sharedBuildingsPromise,
      currentUserPromise,
    ]);
    if (currentUserId) communityCurrentUserId = currentUserId;

    if (!buildingResponse.ok) {
      throw new Error(`destinations.json: HTTP ${buildingResponse.status}`);
    }
    if (!pointResponse.ok) {
      throw new Error(`evac_points.json: HTTP ${pointResponse.status}`);
    }

    const buildingData = await buildingResponse.json();
    const pointData = await pointResponse.json();

    const officialBuildings = buildingData.map((dest) => ({
      ...dest,
      name_en: dest.name_en ?? dest.name,
      source: "official",
      markerType: "building",
    }));

    const evacuationPoints = pointData.map((point) => ({
      name: point.name,
      name_en: point.name_en ?? point.name,
      location: {
        lat: point.location?.lat ?? point.lat,
        lng: point.location?.lng ?? point.lng,
      },
      source: "official",
      markerType: "point",
    }));

    const userBuildings = loadUserBuildings().map((dest) => ({
      ...dest,
      markerType: "building",
    }));

    const communityBuildings = communityBuildingData.map((building) => ({
      id: building.id,
      name: building.name,
      name_en: building.name,
      location: { lat: building.latitude, lng: building.longitude },
      source: "community",
      contributor_user_id: building.contributor_user_id,
      markerType: "building",
    }));

    destinations = [
      ...officialBuildings,
      ...evacuationPoints,
      ...communityBuildings,
      ...userBuildings,
    ];

    destinations.forEach((dest) => {
      dest.marker = addCustomMarker(
        dest.location,
        getDisplayNameFor(dest),
        dest.markerType || "building",
        dest.source || "official",
        dest
      );
    });
    renderBuildingList();
  } catch (error) {
    console.error(error);
    displayMessage("避難先データの読み込みエラー: " + error.message);
  }
}

async function refreshCommunityBuildings() {
  const button = document.getElementById("refresh-community-buildings");
  const status = document.getElementById("building-refresh-status");
  if (button?.disabled) return;
  if (button) {
    button.disabled = true;
    button.textContent = t("building_refreshing");
  }
  if (status) status.textContent = "";

  try {
    const rows = await loadCommunityBuildings();
    const previous = destinations.filter((dest) => dest.source === "community");
    previous.forEach((building) => building.marker?.setMap(null));
    destinations = destinations.filter((dest) => dest.source !== "community");

    if (latestDestination?.source === "community") {
      latestDestination = null;
      lastDistanceMeters = null;
      lastDurationText = null;
      infoWindow?.close();
      directionsRenderer?.setDirections({ routes: [] });
      displayMessage(t("info_hint"));
    }

    const refreshed = rows.map((building) => ({
      id: building.id,
      name: building.name,
      name_en: building.name,
      location: { lat: building.latitude, lng: building.longitude },
      source: "community",
      contributor_user_id: building.contributor_user_id,
      markerType: "building",
    }));
    refreshed.forEach((building) => {
      building.marker = addCustomMarker(building.location, getDisplayNameFor(building), "building", "community");
    });
    destinations.push(...refreshed);
    renderBuildingList();
    if (status) status.textContent = t("building_refresh_done", { count: fmtNum(refreshed.length) });
  } catch (_) {
    if (status) status.textContent = t("building_refresh_failed");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = t("building_refresh");
    }
  }
}

// 水平避難ポイントを除き、避難ビルだけを一覧へ表示する。
function renderBuildingList() {
  const listElement = document.getElementById("building-list");
  const countElement = document.getElementById("building-list-count");
  if (!listElement || !countElement) return;

  const allBuildings = destinations
    .filter((dest) => dest.markerType === "building")
    .slice()
    .sort((a, b) => getDisplayNameFor(a).localeCompare(getDisplayNameFor(b), LANG));
  const filterValue = document.getElementById("destination-type-filter")?.value || "all";
  const buildings = allBuildings.filter((building) => {
    if (filterValue === "tsunami_building") return building.source === "official" && building.evacuation_category === "tsunami_evacuation_building";
    if (filterValue === "emergency_place") return building.source === "official" && building.evacuation_category === "designated_emergency_place_tsunami";
    if (filterValue === "shelter") return building.source === "official" && building.is_designated_shelter === true;
    if (filterValue === "review") return building.source === "official" && building.classification_status === "review_needed";
    if (filterValue === "user_added") return building.source === "community" || building.source === "user";
    return true;
  });

  countElement.textContent = filterValue === "all"
    ? t("building_list_count", { count: fmtNum(buildings.length) })
    : t("building_list_filtered_count", { visible: fmtNum(buildings.length), total: fmtNum(allBuildings.length) });
  listElement.replaceChildren();

  if (buildings.length === 0) {
    const empty = document.createElement("p");
    empty.className = "building-list-empty";
    empty.textContent = t("building_list_empty");
    listElement.appendChild(empty);
    return;
  }

  buildings.forEach((building) => {
    const item = document.createElement("article");
    item.className = "building-list-item";

    const name = document.createElement("p");
    name.className = "building-list-name";
    name.textContent = getDisplayNameFor(building);

    const source = document.createElement("span");
    source.className = "building-list-source";
    const sourceKey = building.source === "user"
      ? "building_list_local"
      : building.source === "community" ? "building_list_shared" : "building_list_official";
    source.textContent = t(sourceKey);

    const typeBadges = document.createElement("div");
    typeBadges.className = "building-list-tags";
    if (building.source === "official") {
      const categoryKey = building.evacuation_category === "tsunami_evacuation_building"
        ? "building_type_tsunami_building"
        : building.evacuation_category === "designated_emergency_place_tsunami"
          ? "building_type_emergency_place"
          : null;
      if (categoryKey) {
        const categoryBadge = document.createElement("span");
        categoryBadge.className = "building-list-type";
        categoryBadge.textContent = t(categoryKey);
        typeBadges.appendChild(categoryBadge);
      }
      if (building.is_designated_shelter === true) {
        const shelterBadge = document.createElement("span");
        shelterBadge.className = "building-list-type shelter";
        shelterBadge.textContent = t("building_type_also_shelter");
        typeBadges.appendChild(shelterBadge);
      }
      if (building.classification_status === "review_needed") {
        const reviewBadge = document.createElement("span");
        reviewBadge.className = "building-list-type review";
        reviewBadge.textContent = t("building_type_review_needed");
        typeBadges.appendChild(reviewBadge);
      }
    }

    const showButton = document.createElement("button");
    showButton.type = "button";
    showButton.className = "building-list-map-button";
    showButton.textContent = t("building_list_show_map");
    showButton.addEventListener("click", () => {
      if (!map || !building.location) return;
      map.panTo(building.location);
      map.setZoom(Math.max(map.getZoom() || 15, 17));
      document.getElementById("building-list-panel")?.removeAttribute("open");
    });

    item.append(name, source);
    if (typeBadges.childElementCount > 0) item.appendChild(typeBadges);
    if (canManageBuilding(building)) {
      const actions = document.createElement("div");
      actions.className = "building-list-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "building-list-edit-button";
      editButton.textContent = t("building_list_edit");
      editButton.addEventListener("click", () => showBuildingNameEditor(building, item));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "building-list-delete-button";
      deleteButton.textContent = t("building_list_delete");
      deleteButton.addEventListener("click", () => deleteUserBuilding(building));
      actions.append(showButton, editButton, deleteButton);
      item.appendChild(actions);
    } else {
      item.appendChild(showButton);
    }
    listElement.appendChild(item);
  });
}

function canManageBuilding(building) {
  if (!IS_BUILDING_ADMIN_VIEW) return false;
  return building?.source === "user" ||
    (building?.source === "community" && communityCurrentUserId &&
      building.contributor_user_id === communityCurrentUserId);
}

// 自分で追加した避難ビルの施設名だけを、一覧内で編集する。
function showBuildingNameEditor(building, item) {
  if (!canManageBuilding(building)) return;
  item.replaceChildren();

  const label = document.createElement("label");
  label.className = "building-list-edit-label";
  label.textContent = t("building_list_edit_name");
  const input = document.createElement("input");
  input.className = "building-list-edit-input";
  input.type = "text";
  input.value = building.name;
  input.maxLength = 100;
  label.appendChild(input);

  const status = document.createElement("p");
  status.className = "building-list-edit-status";
  status.setAttribute("role", "status");

  const actions = document.createElement("div");
  actions.className = "building-list-actions";
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "building-list-save-button";
  saveButton.textContent = t("building_list_save");
  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "building-list-cancel-button";
  cancelButton.textContent = t("building_list_edit_cancel");

  saveButton.addEventListener("click", async () => {
    const newName = input.value.trim();
    if (!newName) {
      status.textContent = t("building_list_name_required");
      input.focus();
      return;
    }
    const duplicate = destinations.some((dest) =>
      dest !== building && String(dest.name || "").trim() === newName
    );
    if (duplicate) {
      status.textContent = t("building_list_name_duplicate");
      input.focus();
      return;
    }

    if (building.source === "community") {
      saveButton.disabled = true;
      cancelButton.disabled = true;
      try {
        await updateCommunityBuilding(building.id, newName);
      } catch (_) {
        status.textContent = t("building_list_save_failed");
        saveButton.disabled = false;
        cancelButton.disabled = false;
        return;
      }
    }

    const previousName = building.name;
    const previousNameEn = building.name_en;
    building.name = newName;
    building.name_en = newName;
    if (building.source === "user") {
      try {
        saveUserBuildings();
      } catch (_) {
        building.name = previousName;
        building.name_en = previousNameEn;
        status.textContent = t("building_list_save_failed");
        return;
      }
    }
    if (building.marker?.setTitle) building.marker.setTitle(newName);
    renderBuildingList();
  });
  cancelButton.addEventListener("click", renderBuildingList);

  actions.append(saveButton, cancelButton);
  item.append(label, actions, status);
  input.focus();
  input.select();
}

// 自分で追加した避難ビルを、確認後に一覧・地図・保存データから削除する。
async function deleteUserBuilding(building) {
  if (!canManageBuilding(building)) return;
  if (!window.confirm(t("building_list_delete_confirm", { name: getDisplayNameFor(building) }))) return;

  if (building.source === "community") {
    try {
      await deleteCommunityBuilding(building.id);
    } catch (_) {
      window.alert(t("building_list_delete_failed"));
      return;
    }
  }

  const index = destinations.indexOf(building);
  if (index < 0) return;
  const wasLatestDestination = latestDestination === building;
  destinations.splice(index, 1);
  if (building.source === "user") {
    try {
      saveUserBuildings();
    } catch (_) {
      destinations.splice(index, 0, building);
      window.alert(t("building_list_delete_failed"));
      return;
    }
  }

  if (building.marker?.setMap) building.marker.setMap(null);
  if (wasLatestDestination) {
    latestDestination = null;
    lastDistanceMeters = null;
    lastDurationText = null;
    infoWindow?.close();
    directionsRenderer?.setDirections({ routes: [] });
    displayMessage(t("info_hint"));
  }
  renderBuildingList();
}

// ブラウザに保存されている追加ビルを配列として返す。
function loadUserBuildings() {
  try {
    const saved = localStorage.getItem(USER_BUILDINGS_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((building) => ({
        id: building.id || `user-${Date.now()}`,
        name: String(building.name || "").trim(),
        name_en: String(building.name_en || building.name || "").trim(),
        location: {
          lat: Number(building.location?.lat),
          lng: Number(building.location?.lng),
        },
        source: "user",
      }))
      .filter((building) =>
        building.name &&
        Number.isFinite(building.location.lat) &&
        Number.isFinite(building.location.lng)
      );
  } catch (error) {
    console.error("追加避難ビルの読み込みエラー:", error);
    return [];
  }
}

// destinations 配列のうち、画面から追加したビルだけを保存する。
function saveUserBuildings() {
  const userBuildings = destinations
    .filter((dest) => dest.source === "user")
    .map((dest) => ({
      id: dest.id,
      name: dest.name,
      name_en: dest.name_en || dest.name,
      location: {
        lat: dest.location.lat,
        lng: dest.location.lng,
      },
      source: "user",
    }));

  localStorage.setItem(USER_BUILDINGS_KEY, JSON.stringify(userBuildings));
}

// 地図で避難ビルの位置を選ぶ。確定前の位置は保存しない。
function updateBuildingLocationUI() {
  const pick = document.getElementById("pick-building-location");
  const cancel = document.getElementById("cancel-building-location");
  const add = document.getElementById("add-building-button");
  const status = document.getElementById("building-location-status");
  const formSummary = document.querySelector("#building-form > summary");
  document.body.classList.toggle("building-location-selecting", isSelectingBuildingLocation);
  if (formSummary) {
    formSummary.textContent = isSelectingBuildingLocation
      ? t("building_form_tap_map_title")
      : t("building_form_title");
  }
  if (pick) {
    pick.setAttribute("aria-pressed", String(isSelectingBuildingLocation));
    pick.textContent = buildingLocation
      ? t("building_form_repick_location")
      : t("building_form_pick_location");
  }
  if (cancel) cancel.hidden = !isSelectingBuildingLocation && !buildingLocation;
  if (add) add.disabled = !buildingLocation || isSelectingBuildingLocation;
  if (status) status.textContent = isSelectingBuildingLocation
    ? t("building_form_location_selecting")
    : buildingLocation
      ? t("building_form_location_selected")
      : t("building_form_location_unselected");
}

function clearBuildingLocation() {
  isSelectingBuildingLocation = false;
  buildingLocation = null;
  if (buildingLocationMarker) buildingLocationMarker.setMap(null);
  buildingLocationMarker = null;
  updateBuildingLocationUI();
}

function selectBuildingLocation(location) {
  if (!IS_BUILDING_ADMIN_VIEW ||
      !isSelectingBuildingLocation || appMode !== "evacuation" || !location) return;
  const lat = location.lat();
  const lng = location.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  buildingLocation = { lat, lng };
  if (buildingLocationMarker) buildingLocationMarker.setMap(null);
  buildingLocationMarker = new google.maps.Marker({
    position: buildingLocation, map, label: "+", title: t("building_form_marker_title"), clickable: false,
  });
  isSelectingBuildingLocation = false;
  updateBuildingLocationUI();
  if (window.matchMedia("(max-width: 768px)").matches) {
    document.getElementById("building-form").open = true;
  }
}

// 施設名と地図で選んだ位置から、共有避難ビルを追加する。
async function addEvacuationBuilding() {
  if (!IS_BUILDING_ADMIN_VIEW) return;
  const nameElement = document.getElementById("building-name");
  const statusElement = document.getElementById("building-status");

  if (!nameElement) {
    console.error("避難ビル追加フォームが index.html にありません。");
    return;
  }

  const name = nameElement.value.trim();
  if (appMode !== "evacuation" || isSelectingBuildingLocation) return;
  const lat = buildingLocation?.lat;
  const lng = buildingLocation?.lng;

  const setStatus = (message) => {
    if (statusElement) statusElement.textContent = message;
  };

  if (!name) {
    setStatus(t("building_form_name_required"));
    return;
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setStatus(t("building_form_location_required"));
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    setStatus(t("building_form_location_invalid"));
    return;
  }

  const location = { lat, lng };
  const duplicate = destinations.some((dest) => {
    if (!dest.location) return false;
    const sameName = String(dest.name || "").trim() === name;
    const nearSamePosition = getDistanceInMeters(dest.location, location) <= 3;
    return sameName || nearSamePosition;
  });
  if (duplicate) {
    setStatus(t("building_form_duplicate"));
    return;
  }

  const newBuilding = {
    id: (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : "user-" + Date.now(),
    name,
    name_en: name,
    location,
    source: "community",
    markerType: "building",
  };

  const addButton = document.getElementById("add-building-button");
  if (addButton) addButton.disabled = true;
  setStatus(t("building_form_saving"));
  try {
    const saved = await saveCommunityBuilding({
      id: newBuilding.id,
      name,
      latitude: lat,
      longitude: lng,
    });
    newBuilding.contributor_user_id = saved.contributor_user_id;
    communityCurrentUserId = saved.contributor_user_id;
  } catch (_) {
    setStatus(t("building_form_save_failed"));
    updateBuildingLocationUI();
    return;
  }

  destinations.push(newBuilding);
  newBuilding.marker = addCustomMarker(
    newBuilding.location,
    getDisplayNameFor(newBuilding),
    "building",
    "community"
  );
  renderBuildingList();
  clearBuildingLocation();

  map.panTo(newBuilding.location);
  map.setZoom(Math.max(map.getZoom() || 15, 17));

  setStatus(t("building_form_saved", { name }));
  nameElement.value = "";
}

// index.html の追加ボタンを JavaScript の処理につなぐ。
function setupBuildingForm() {
  const button = document.getElementById("add-building-button");
  if (!button) {
    console.warn("add-building-button が見つかりません。index.html に追加フォームを貼り付けてください。");
    return;
  }

  document.getElementById("pick-building-location").addEventListener("click", () => {
    if (!IS_BUILDING_ADMIN_VIEW || appMode !== "evacuation") return;
    isSelectingBuildingLocation = true;
    const status = document.getElementById("building-status");
    if (status) status.textContent = "";
    updateBuildingLocationUI();
    if (window.matchMedia("(max-width: 768px)").matches) {
      document.getElementById("building-form").open = false;
    }
  });
  document.getElementById("cancel-building-location").addEventListener("click", clearBuildingLocation);
  document.getElementById("refresh-community-buildings")?.addEventListener("click", refreshCommunityBuildings);
  document.getElementById("refresh-community-reports")?.addEventListener("click", refreshCommunityReportMarkers);
  updateBuildingLocationUI();
  button.addEventListener("click", addEvacuationBuilding);
}

/* ========== 公開 ========== */
window.initMap = initMap;
window.useCurrentLocation = useCurrentLocation;
window.launchGoogleMap = launchGoogleMap;


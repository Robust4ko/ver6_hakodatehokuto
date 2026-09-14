// 共有避難ビルの読み込み・追加・投稿者本人による編集と削除。
const COMMUNITY_BUILDINGS_URL = COMMUNITY_SUPABASE_URL + "/rest/v1/community_evacuation_buildings";

function validateCommunityBuildingId(id) {
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);
}
function validateCommunityBuildingName(name) {
  return typeof name === "string" && name.trim().length >= 1 && name.trim().length <= 100;
}

async function loadCommunityBuildings() {
  const session = await ensureCommunitySession();
  const response = await fetch(
    COMMUNITY_BUILDINGS_URL +
      "?select=id,name,latitude,longitude,contributor_user_id&order=created_at.asc&limit=1000",
    { headers: {
      apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.access_token,
      Accept: "application/json",
    }}
  );
  if (!response.ok) {
    const error = new Error("community_buildings_load_rejected");
    error.status = response.status;
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("invalid_community_buildings");
  return rows.filter((row) =>
    validateCommunityBuildingId(row.id) &&
    validateCommunityBuildingName(row.name) &&
    Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90 &&
    Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180
  ).map((row) => ({
    id: row.id,
    name: row.name.trim(),
    latitude: row.latitude,
    longitude: row.longitude,
    contributor_user_id: typeof row.contributor_user_id === "string"
      ? row.contributor_user_id : null,
  }));
}

async function saveCommunityBuilding(building) {
  if (!validateCommunityBuildingId(building?.id) ||
      !validateCommunityBuildingName(building?.name) ||
      !Number.isFinite(building?.latitude) || Math.abs(building.latitude) > 90 ||
      !Number.isFinite(building?.longitude) || Math.abs(building.longitude) > 180) {
    throw new Error("invalid_community_building");
  }
  const session = await ensureCommunitySession();
  const payload = {
    id: building.id,
    name: building.name.trim(),
    latitude: building.latitude,
    longitude: building.longitude,
    contributor_user_id: session.user.id,
  };
  const response = await fetch(COMMUNITY_BUILDINGS_URL, {
    method: "POST",
    headers: {
      apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = new Error("community_building_save_rejected");
    error.status = response.status;
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("community_building_not_saved");
  return { ...payload, ...rows[0], contributor_user_id: session.user.id };
}

async function updateCommunityBuilding(id, name) {
  if (!validateCommunityBuildingId(id) || !validateCommunityBuildingName(name)) {
    throw new Error("invalid_community_building_update");
  }
  const session = await ensureCommunitySession();
  const response = await fetch(
    COMMUNITY_BUILDINGS_URL + "?id=eq." + encodeURIComponent(id) +
      "&contributor_user_id=eq." + encodeURIComponent(session.user.id),
    {
      method: "PATCH",
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ name: name.trim() }),
    }
  );
  if (!response.ok) {
    const error = new Error("community_building_update_rejected");
    error.status = response.status;
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("community_building_not_owned");
  return rows[0];
}

async function deleteCommunityBuilding(id) {
  if (!validateCommunityBuildingId(id)) throw new Error("invalid_community_building_delete");
  const session = await ensureCommunitySession();
  const response = await fetch(
    COMMUNITY_BUILDINGS_URL + "?id=eq." + encodeURIComponent(id) +
      "&contributor_user_id=eq." + encodeURIComponent(session.user.id),
    {
      method: "DELETE",
      headers: {
        apikey: COMMUNITY_REPORTS_PUBLISHABLE_KEY,
        Authorization: "Bearer " + session.access_token,
        Prefer: "return=representation",
      },
    }
  );
  if (!response.ok) {
    const error = new Error("community_building_delete_rejected");
    error.status = response.status;
    throw error;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length !== 1) throw new Error("community_building_not_owned");
  return id;
}

// 避難訓練のGPSログをSupabaseへ保存する。
// 接続先と公開用キー、匿名認証処理は supabase_reports.js のものを共用する。
async function saveGpsTrainingLog(training) {
  const idPattern = /^training-\d{14}-[a-z0-9]{6}$/;
  if (!training || !idPattern.test(training.trainingId) ||
      !Number.isFinite(training.elapsedSeconds) || training.elapsedSeconds < 0 ||
      !Number.isFinite(training.distanceMeters) || training.distanceMeters < 0 ||
      !Array.isArray(training.points) || training.points.length < 1 ||
      training.points.length > 10000) {
    throw new Error("invalid_gps_training");
  }

  const points = training.points.map((point, index) => {
    if (!Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
        !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 ||
        !Number.isFinite(point.timestamp)) {
      throw new Error("invalid_gps_training_point");
    }
    return {
      point_index: index + 1,
      recorded_at: new Date(point.timestamp).toISOString(),
      latitude: point.latitude,
      longitude: point.longitude,
      accuracy_m: Number.isFinite(point.accuracy) ? point.accuracy : null,
      altitude_m: Number.isFinite(point.altitude) ? point.altitude : null,
      heading_deg: Number.isFinite(point.heading) ? point.heading : null,
      speed_mps: Number.isFinite(point.speed) ? point.speed : null,
    };
  });

  await ensureCommunitySession();
  const client = getCommunitySupabaseClient();
  const { error } = await client.rpc("save_gps_training", {
    p_training_id: training.trainingId,
    p_started_at: training.startedAt,
    p_ended_at: training.endedAt,
    p_elapsed_seconds: Math.round(training.elapsedSeconds),
    p_distance_m: training.distanceMeters,
    p_points: points,
  });
  if (error) throw new Error("gps_training_save_rejected");
}
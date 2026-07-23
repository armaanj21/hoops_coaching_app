import { supabase } from "./supabaseClient";
import type { GameFilmAnalysisResult, ReferenceProfile, Upload } from "../types";
import type { NormalizedBox } from "./analysis/frameExtraction";
import { buildStorageObjectPath } from "./storagePath";

export interface GameFilmUploadWithAnalysis extends Upload {
  analysis_results: GameFilmAnalysisResult[];
  users: { name: string } | null;
}

export async function getReferenceProfiles(): Promise<ReferenceProfile[]> {
  const { data, error } = await supabase
    .from("reference_profiles")
    .select("id, name, position, signature_moves, key_stats, summary")
    .order("position")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as ReferenceProfile[];
}

export async function setMyReferenceProfile(playerId: string, referenceProfileId: string): Promise<void> {
  const { error } = await supabase.from("users").update({ reference_profile_id: referenceProfileId }).eq("id", playerId);
  if (error) throw new Error(error.message);
}

export async function uploadGameFilm(
  playerId: string,
  file: File,
  jerseyNumber: string,
  jerseyColor: string
): Promise<Upload> {
  const path = buildStorageObjectPath(playerId, file);
  const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(path);

  const { data, error } = await supabase
    .from("uploads")
    .insert({
      player_id: playerId,
      drill_id: null,
      upload_type: "game_film",
      video_url: publicUrlData.publicUrl,
      jersey_number: jerseyNumber,
      jersey_color: jerseyColor,
    })
    .select("id, player_id, drill_id, video_url, created_at, upload_type, jersey_number, jersey_color")
    .single();
  if (error) throw new Error(error.message);
  return data as Upload;
}

export async function saveMarker(
  uploadId: string,
  markerFrameTime: number,
  box: NormalizedBox
): Promise<void> {
  const { error } = await supabase
    .from("uploads")
    .update({
      marker_frame_time: markerFrameTime,
      marker_x: box.x,
      marker_y: box.y,
      marker_width: box.width,
      marker_height: box.height,
    })
    .eq("id", uploadId);
  if (error) throw new Error(error.message);
}

export async function getGameFilmUploads(): Promise<GameFilmUploadWithAnalysis[]> {
  const { data, error } = await supabase
    .from("uploads")
    .select(
      "id, player_id, drill_id, video_url, created_at, upload_type, jersey_number, jersey_color, marker_frame_time, marker_x, marker_y, marker_width, marker_height, analysis_results(*), users(name)"
    )
    .eq("upload_type", "game_film")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as GameFilmUploadWithAnalysis[];
}

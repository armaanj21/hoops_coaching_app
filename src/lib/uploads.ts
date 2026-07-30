import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { AnalysisResult, Upload } from "../types";
import { buildStorageObjectPath } from "./storagePath";

export interface UploadWithAnalysis extends Upload {
  analysis_results: AnalysisResult[];
  users: { name: string } | null;
}

export async function uploadDrillVideo(playerId: string, drillId: string, file: File): Promise<Upload> {
  const path = buildStorageObjectPath(playerId, file);
  const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file);
  if (uploadError) throw new Error(friendlyError(uploadError, "Couldn't upload your video. Please try again."));

  const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(path);

  const { data, error } = await supabase
    .from("uploads")
    .insert({ player_id: playerId, drill_id: drillId, upload_type: "drill", video_url: publicUrlData.publicUrl })
    .select("id, player_id, drill_id, video_url, created_at, upload_type, jersey_number, jersey_color")
    .single();
  if (error) throw new Error(friendlyError(error, "Couldn't save your upload. Please try again."));
  return data as Upload;
}

export async function getUploadsForDrill(drillId: string): Promise<UploadWithAnalysis[]> {
  const { data, error } = await supabase
    .from("uploads")
    .select(
      "id, player_id, drill_id, video_url, created_at, upload_type, jersey_number, jersey_color, analysis_results(*), users(name)"
    )
    .eq("drill_id", drillId)
    .eq("upload_type", "drill")
    .order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error, "Couldn't load uploads for this drill."));
  return (data ?? []) as unknown as UploadWithAnalysis[];
}

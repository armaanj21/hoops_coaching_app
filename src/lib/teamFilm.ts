import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import { buildStorageObjectPath } from "./storagePath";
import type { TeamFilmAnalysisResult, TeamFilmUpload } from "../types";

export interface TeamFilmUploadWithAnalysis extends TeamFilmUpload {
  team_film_analysis_results: TeamFilmAnalysisResult[];
}

export async function uploadTeamFilm(teamId: string, coachId: string, file: File): Promise<TeamFilmUpload> {
  const path = buildStorageObjectPath(coachId, file, "team-film");
  const { error: uploadError } = await supabase.storage.from("uploads").upload(path, file);
  if (uploadError) throw new Error(friendlyError(uploadError, "Couldn't upload the team film. Please try again."));

  const { data: publicUrlData } = supabase.storage.from("uploads").getPublicUrl(path);

  const { data, error } = await supabase
    .from("team_film_uploads")
    .insert({ team_id: teamId, coach_id: coachId, video_url: publicUrlData.publicUrl })
    .select("id, team_id, coach_id, video_url, created_at")
    .single();
  if (error) throw new Error(friendlyError(error, "Couldn't save the team film upload. Please try again."));
  return data as TeamFilmUpload;
}

export async function getTeamFilmUploads(teamId: string): Promise<TeamFilmUploadWithAnalysis[]> {
  const { data, error } = await supabase
    .from("team_film_uploads")
    .select("id, team_id, coach_id, video_url, created_at, team_film_analysis_results(*)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error, "Couldn't load team film. Please try again."));
  return (data ?? []) as unknown as TeamFilmUploadWithAnalysis[];
}

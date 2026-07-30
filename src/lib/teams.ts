import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { Assignment, Drill, Profile, SkillCategory, Team } from "../types";

export async function getMyTeam(profile: Profile): Promise<Team | null> {
  if (!profile.team_id) return null;
  const { data, error } = await supabase
    .from("teams")
    .select("id, coach_id, name, invite_code")
    .eq("id", profile.team_id)
    .maybeSingle();
  if (error) throw new Error(friendlyError(error, "Couldn't load your team. Please try again."));
  return data;
}

export async function getRoster(teamId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, role, name, team_id")
    .eq("team_id", teamId)
    .eq("role", "player");
  if (error) throw new Error(friendlyError(error, "Couldn't load your roster. Please try again."));
  return (data ?? []) as Profile[];
}

export async function getDrills(): Promise<Drill[]> {
  const { data, error } = await supabase
    .from("drills")
    .select("id, title, description, skill_category, reference_video_url, correct_form_description")
    .order("skill_category");
  if (error) throw new Error(friendlyError(error, "Couldn't load the drill library. Please try again."));
  return (data ?? []) as Drill[];
}

export async function assignDrill(params: {
  drillId: string;
  teamId: string;
  playerIds: string[];
}): Promise<{ id: string }[]> {
  const { drillId, teamId, playerIds } = params;
  const rows: { drill_id: string; team_id: string | null; player_id: string | null }[] =
    playerIds.length > 0
      ? playerIds.map((playerId) => ({ drill_id: drillId, team_id: null, player_id: playerId }))
      : [{ drill_id: drillId, team_id: teamId, player_id: null }];
  const { data, error } = await supabase.from("assignments").insert(rows).select("id");
  if (error) throw new Error(friendlyError(error, "Couldn't assign the drill. Please try again."));
  return data ?? [];
}

export interface AssignmentWithDrill extends Assignment {
  drills: { title: string; skill_category: SkillCategory } | null;
}

export async function getMyAssignments(profile: Profile): Promise<AssignmentWithDrill[]> {
  const orFilter = profile.team_id
    ? `player_id.eq.${profile.id},team_id.eq.${profile.team_id}`
    : `player_id.eq.${profile.id}`;
  const { data, error } = await supabase
    .from("assignments")
    .select("id, status, drill_id, team_id, player_id, drills(title, skill_category)")
    .or(orFilter);
  if (error) throw new Error(friendlyError(error, "Couldn't load your assignments. Please try again."));
  return (data ?? []) as unknown as AssignmentWithDrill[];
}

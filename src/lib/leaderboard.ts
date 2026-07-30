import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { LeaderboardEntry } from "../types";

interface LeaderboardRow {
  player_id: string;
  player_name: string;
  completions_this_week: number | string;
  completions_this_month: number | string;
  total_completions: number | string;
}

// Backed by the get_team_leaderboard SQL function rather than a direct table query — it exposes
// only aggregated counts, not raw drill_feedback rows, so a player can see the team's standing
// without also seeing teammates' individual notes/difficulty ratings (which stay coach + owner
// only, per the existing drill_feedback RLS).
export async function getTeamLeaderboard(teamId: string): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_team_leaderboard", { p_team_id: teamId });
  if (error) throw new Error(friendlyError(error, "Couldn't load the leaderboard. Please try again."));
  return ((data ?? []) as LeaderboardRow[]).map((row) => ({
    playerId: row.player_id,
    playerName: row.player_name,
    completionsThisWeek: Number(row.completions_this_week),
    completionsThisMonth: Number(row.completions_this_month),
    totalCompletions: Number(row.total_completions),
  }));
}

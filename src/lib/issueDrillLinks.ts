import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { IssueDrillLink } from "../types";

export async function createIssueDrillLink(params: {
  analysisResultId: string;
  assignmentId: string;
  issueDescription: string;
}): Promise<void> {
  const { error } = await supabase.from("issue_drill_links").insert({
    analysis_result_id: params.analysisResultId,
    assignment_id: params.assignmentId,
    issue_description: params.issueDescription,
  });
  if (error) throw new Error(friendlyError(error, "Drill was assigned, but linking it to the issue failed."));
}

interface IssueDrillLinkRow {
  id: string;
  analysis_result_id: string;
  assignment_id: string;
  issue_description: string;
  created_at: string;
  assignments: { drills: { title: string } | null } | null;
}

// Filters by player through analysis_results -> uploads, same join pattern as
// getPlayerAnalysisHistory, so a link only shows up for the player it actually belongs to.
export async function getIssueDrillLinksForPlayer(playerId: string): Promise<IssueDrillLink[]> {
  const { data, error } = await supabase
    .from("issue_drill_links")
    .select(
      "id, analysis_result_id, assignment_id, issue_description, created_at, analysis_results!inner(upload_id, uploads!inner(player_id)), assignments(drills(title))"
    )
    .eq("analysis_results.uploads.player_id", playerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(friendlyError(error, "Couldn't load drill-to-issue links. Please try again."));

  return ((data ?? []) as unknown as IssueDrillLinkRow[]).map((row) => ({
    id: row.id,
    analysisResultId: row.analysis_result_id,
    assignmentId: row.assignment_id,
    issueDescription: row.issue_description,
    createdAt: row.created_at,
    drillTitle: row.assignments?.drills?.title ?? "Unknown drill",
  }));
}

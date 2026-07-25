import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { AssignmentStatus, DrillDifficulty, DrillFeedback, DrillFeedbackSummary } from "../types";

// Assignment ids this player has already submitted feedback for — a whole-team assignment is one
// shared row, so "completed" can't live on assignments.status for those (marking it complete would
// falsely complete it for every teammate too). Presence of a drill_feedback row is the real
// per-player completion signal; assignments.status is only updated for player-specific rows, where
// mutating it is unambiguous.
export async function getMyCompletedAssignmentIds(playerId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("drill_feedback").select("assignment_id").eq("player_id", playerId);
  if (error) throw new Error(friendlyError(error, "Couldn't load your completed drills."));
  return new Set((data ?? []).map((row) => row.assignment_id as string));
}

export async function completeAssignment(params: {
  assignmentId: string;
  drillId: string;
  playerId: string;
  isPlayerSpecific: boolean;
  difficulty: DrillDifficulty;
  note: string;
}): Promise<void> {
  const { assignmentId, drillId, playerId, isPlayerSpecific, difficulty, note } = params;

  const { error: feedbackError } = await supabase.from("drill_feedback").insert({
    assignment_id: assignmentId,
    drill_id: drillId,
    player_id: playerId,
    difficulty,
    note: note.trim() || null,
  });
  if (feedbackError) throw new Error(friendlyError(feedbackError, "Couldn't save your feedback. Please try again."));

  if (isPlayerSpecific) {
    const completedStatus: AssignmentStatus = "completed";
    const { error: statusError } = await supabase
      .from("assignments")
      .update({ status: completedStatus })
      .eq("id", assignmentId);
    if (statusError) throw new Error(friendlyError(statusError, "Feedback saved, but couldn't update the assignment status."));
  }
}

export async function getDrillFeedbackSummary(teamId: string): Promise<DrillFeedbackSummary[]> {
  const { data, error } = await supabase
    .from("drill_feedback")
    .select("drill_id, difficulty, note, drills(title), users!drill_feedback_player_id_fkey!inner(name, team_id)")
    .eq("users.team_id", teamId);
  if (error) throw new Error(friendlyError(error, "Couldn't load drill feedback. Please try again."));

  const rows = (data ?? []) as unknown as (Pick<DrillFeedback, "drill_id" | "difficulty" | "note"> & {
    drills: { title: string } | null;
    users: { name: string; team_id: string | null } | null;
  })[];

  const byDrill = new Map<string, DrillFeedbackSummary>();
  for (const row of rows) {
    // Supabase's `.eq("users.team_id", ...)` filters the join, but rows whose join didn't match
    // still come back with users: null rather than being dropped — skip those explicitly.
    if (!row.users) continue;
    const drillId = row.drill_id;
    if (!byDrill.has(drillId)) {
      byDrill.set(drillId, {
        drillId,
        drillTitle: row.drills?.title ?? "Unknown drill",
        tooEasy: 0,
        justRight: 0,
        tooHard: 0,
        recentNotes: [],
      });
    }
    const summary = byDrill.get(drillId)!;
    if (row.difficulty === "too_easy") summary.tooEasy++;
    else if (row.difficulty === "just_right") summary.justRight++;
    else if (row.difficulty === "too_hard") summary.tooHard++;
    if (row.note) summary.recentNotes.push({ playerName: row.users.name, note: row.note });
  }

  return [...byDrill.values()];
}

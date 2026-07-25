import { supabase } from "../supabaseClient";
import { friendlyError } from "../errorMessages";
import { extractFrames } from "./frameExtraction";
import { callClaudeAnalysis } from "./claudeAnalysisProxy";
import type { PlayerUtilizationNote, TeamFilmAnalysisResult } from "../../types";

// Broad team footage has no single marked player to track (unlike gameFilmAnalysisClient), so this
// reuses the plain evenly-spaced extractFrames rather than the marker-based frame helpers.
const TEAM_FILM_SCHEMA = {
  type: "object" as const,
  properties: {
    team_strategy_notes: { type: "string" as const },
    player_utilization_notes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          // No jersey marking step in this flow — Claude has to identify players descriptively
          // (jersey color/number if legible, position on court, role observed) rather than by name.
          player_descriptor: { type: "string" as const },
          note: { type: "string" as const },
        },
        required: ["player_descriptor", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["team_strategy_notes", "player_utilization_notes"],
  additionalProperties: false,
};

export async function analyzeTeamFilm(uploadId: string, videoUrl: string): Promise<TeamFilmAnalysisResult> {
  const frames = await extractFrames(videoUrl, 6);

  const parsed = await callClaudeAnalysis<{
    team_strategy_notes: string;
    player_utilization_notes: PlayerUtilizationNote[];
  }>("claude-opus-4-8", 2048, TEAM_FILM_SCHEMA, [
    {
      role: "user",
      content: [
        ...frames.map((data) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
        })),
        {
          type: "text" as const,
          text: `These are frames from a team's game or practice footage — not a single player's clip, and no specific player has been marked. Analyze the team as a unit.

Return structured feedback:
- team_strategy_notes: how the team should play together given what's visible — spacing, ball movement, transition, defensive shape, and what set of principles would raise the ceiling of this specific group (not generic advice divorced from the footage).
- player_utilization_notes: an array of observations about specific individual players and how the team could better use them, based on their visible skills, tendencies, or role in these frames. Identify each player descriptively (e.g. "the player in the white #10 jersey", "the tall player crashing the offensive glass") since no roster marking is available here — do not invent jersey numbers or names you can't actually see. Include one entry per player you can meaningfully say something about, not a fixed count.`,
        },
      ],
    },
  ]);

  const { data: inserted, error } = await supabase
    .from("team_film_analysis_results")
    .insert({
      upload_id: uploadId,
      team_strategy_notes: parsed.team_strategy_notes,
      player_utilization_notes: parsed.player_utilization_notes,
    })
    .select("id, upload_id, team_strategy_notes, player_utilization_notes, created_at")
    .single();
  if (error) throw new Error(friendlyError(error, "Analysis finished, but saving it failed. Please try again."));

  return inserted as TeamFilmAnalysisResult;
}

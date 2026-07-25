import type { GameFilmAnalysisResult, GameFilmFeedback } from "../../types";
import { supabase } from "../supabaseClient";
import { friendlyError } from "../errorMessages";
import { annotateFrameWithBox, extractFrameAt, extractFramesNear, type NormalizedBox } from "./frameExtraction";
import { callClaudeAnalysis } from "./claudeAnalysisProxy";

// Kept as its own module (not the drill-check AnalysisClient) since the input/output shape and
// prompt are meaningfully different — this is broad game-film analysis, not a single-drill form
// check.

const GAME_FILM_FEEDBACK_SCHEMA = {
  type: "object" as const,
  properties: {
    overall_note: { type: "string" as const },
    areas_to_improve: { type: "array" as const, items: { type: "string" as const } },
    comparison_player_insight: { type: "string" as const },
    explanation: { type: "string" as const },
  },
  required: ["overall_note", "areas_to_improve", "comparison_player_insight", "explanation"],
  additionalProperties: false,
};

export async function analyzeGameFilm(
  uploadId: string,
  videoUrl: string,
  referenceProfileId: string,
  jerseyNumber: string,
  jerseyColor: string,
  markerFrameTime: number,
  markerBox: NormalizedBox
): Promise<GameFilmAnalysisResult> {
  const { data: referenceProfile, error: refError } = await supabase
    .from("reference_profiles")
    .select("name, position, signature_moves, key_stats, summary")
    .eq("id", referenceProfileId)
    .single();
  if (refError) throw new Error(friendlyError(refError, "Couldn't load your reference player."));

  // The annotated reference frame MUST be the exact frame the player marked — not an approximation
  // from the nearby-frames window (extractFramesNear's first sample can be up to `spreadSeconds`
  // away from markerFrameTime). Re-extracting at the precise time keeps the box aligned with a
  // real, possibly-moving player, instead of drawing it onto a frame from a second or two earlier.
  const markerFrame = await extractFrameAt(videoUrl, markerFrameTime);
  const annotatedMarkerFrame = await annotateFrameWithBox(markerFrame.base64, markerBox, markerFrame.width, markerFrame.height);

  // Additional frames clustered close in time around the marked frame (rather than spread evenly
  // across the whole clip) so the model has continuity to track the same person, instead of
  // re-identifying them from scratch in each frame. These are context only — the annotated frame
  // above is the sole source of truth for who to track.
  const { frames: nearbyFrames } = await extractFramesNear(videoUrl, markerFrameTime, 6, 2);

  const structured_feedback = await callClaudeAnalysis<GameFilmFeedback>(
    "claude-opus-4-8",
    2048,
    GAME_FILM_FEEDBACK_SCHEMA,
    [
      {
        role: "user",
        content: [
          {
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data: annotatedMarkerFrame },
          },
          {
            type: "text" as const,
            text: "The player being analyzed is shown in the red bounding box in the reference frame above. Track this same person across the frames that follow — they are chronologically close to the reference frame, taken from the same short window of footage.",
          },
          ...nearbyFrames.map((data) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
          })),
          {
            type: "text" as const,
            text: `These are frames from a player's real game footage (not a specific drill — this is broad game-film analysis).

The marked player also wears jersey #${jerseyNumber} in ${jerseyColor} — use this as secondary/supporting confirmation only. The bounding box in the reference frame is the primary way to identify who to analyze, since jersey numbers are often too small or blurry to read reliably in real footage.

The player wants to style their game after ${referenceProfile.name} (${referenceProfile.position}).
Reference signature moves: ${JSON.stringify(referenceProfile.signature_moves)}
Reference key stats: ${JSON.stringify(referenceProfile.key_stats)}
Reference summary: ${referenceProfile.summary}

Analyze whatever is visible across these frames for the marked player specifically — shot form, ball-handling, decision-making, positioning, defense, whatever the footage shows. Don't limit yourself to one skill, and don't describe other players in the footage. Return structured feedback:
- overall_note: a short summary of the marked player's game based on what's visible
- areas_to_improve: an array of specific observations, each tied to something actually visible in the frames for the marked player
- comparison_player_insight: how their play compares to ${referenceProfile.name} in the areas you observed
- explanation: the reasoning or context behind why ${referenceProfile.name}'s approach works — the analytical layer, not just a score`,
          },
        ],
      },
    ]
  );

  const { data: inserted, error: insertError } = await supabase
    .from("analysis_results")
    .insert({
      upload_id: uploadId,
      reference_player_or_position: referenceProfile.name,
      feedback_text: structured_feedback.overall_note,
      structured_feedback,
    })
    .select("id, upload_id, reference_player_or_position, feedback_text, structured_feedback, created_at")
    .single();
  if (insertError) throw new Error(friendlyError(insertError, "Analysis finished, but saving it failed. Please try again."));

  return inserted as GameFilmAnalysisResult;
}

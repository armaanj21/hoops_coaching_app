import type { AnalysisClient } from "./analysisClient";
import type { AnalysisResult, StructuredFeedback } from "../../types";
import { supabase } from "../supabaseClient";
import { friendlyError } from "../errorMessages";
import { extractFrames } from "./frameExtraction";
import { callClaudeAnalysis } from "./claudeAnalysisProxy";

const FEEDBACK_SCHEMA = {
  type: "object" as const,
  properties: {
    overall_note: { type: "string" as const },
    form_feedback: { type: "array" as const, items: { type: "string" as const } },
    reference_comparison: { type: "string" as const },
    explanation: { type: "string" as const },
  },
  required: ["overall_note", "form_feedback", "reference_comparison", "explanation"],
  additionalProperties: false,
};

export class ClaudeAnalysisClient implements AnalysisClient {
  async analyzeUpload(uploadId: string, videoUrl: string, referenceProfileId: string): Promise<AnalysisResult> {
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .select("drill_id")
      .eq("id", uploadId)
      .single();
    if (uploadError) throw new Error(friendlyError(uploadError, "Couldn't find that upload. Please try again."));

    const { data: drill, error: drillError } = await supabase
      .from("drills")
      .select("title, description, skill_category")
      .eq("id", upload.drill_id)
      .single();
    if (drillError) throw new Error(friendlyError(drillError, "Couldn't load the drill for this upload."));

    const { data: referenceProfile, error: refError } = await supabase
      .from("reference_profiles")
      .select("name, position, signature_moves, key_stats, summary")
      .eq("id", referenceProfileId)
      .single();
    if (refError) throw new Error(friendlyError(refError, "Couldn't load your reference player."));

    const frames = await extractFrames(videoUrl, 3);

    const structured_feedback = await callClaudeAnalysis<StructuredFeedback>(
      "claude-opus-4-8",
      2048,
      FEEDBACK_SCHEMA,
      [
        {
          role: "user",
          content: [
            ...frames.map((data) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
            })),
            {
              type: "text" as const,
              text: `These are frames from a player's video performing the drill "${drill.title}" (${drill.skill_category}): ${drill.description}

The player wants to style their game after ${referenceProfile.name} (${referenceProfile.position}).
Reference signature moves: ${JSON.stringify(referenceProfile.signature_moves)}
Reference key stats: ${JSON.stringify(referenceProfile.key_stats)}
Reference summary: ${referenceProfile.summary}

Analyze the player's form in these frames compared to the reference. Return structured feedback:
- overall_note: a short summary of the player's form
- form_feedback: an array of specific, actionable things to fix
- reference_comparison: how their form compares to ${referenceProfile.name}'s form for this specific move
- explanation: the reasoning or stat behind why the reference's form works this way — this is the analytical layer, not just a score`,
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

    return inserted as AnalysisResult;
  }
}

export const analysisClient: AnalysisClient = new ClaudeAnalysisClient();

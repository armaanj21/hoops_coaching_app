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
    score: { type: "integer" as const },
    score_tier: { type: "string" as const, enum: ["needs_work", "developing", "solid", "excellent"] },
    done_well: { type: "array" as const, items: { type: "string" as const } },
    form_feedback: { type: "array" as const, items: { type: "string" as const } },
    next_steps: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["overall_note", "score", "score_tier", "done_well", "form_feedback", "next_steps"],
  additionalProperties: false,
};

export class ClaudeAnalysisClient implements AnalysisClient {
  async analyzeUpload(uploadId: string, videoUrl: string): Promise<AnalysisResult> {
    const { data: upload, error: uploadError } = await supabase
      .from("uploads")
      .select("drill_id")
      .eq("id", uploadId)
      .single();
    if (uploadError) throw new Error(friendlyError(uploadError, "Couldn't find that upload. Please try again."));

    const { data: drill, error: drillError } = await supabase
      .from("drills")
      .select("title, description, skill_category, correct_form_description")
      .eq("id", upload.drill_id)
      .single();
    if (drillError) throw new Error(friendlyError(drillError, "Couldn't load the drill for this upload."));

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

Correct form for this specific drill:
${drill.correct_form_description}

Grade the player's execution in these frames against that correct form — not against a reference NBA player, against this drill's own mechanics. Return structured feedback:
- overall_note: a short summary of the player's execution on this specific drill
- score: an integer 1-10 rating of how closely their form matches the correct form described above (10 = matches it closely, 1 = far off)
- score_tier: "needs_work" (1-3), "developing" (4-6), "solid" (7-8), or "excellent" (9-10) — must be consistent with the numeric score
- done_well: specific things visible in these frames that DO match the correct form
- form_feedback: specific things visible in these frames that DON'T match the correct form — concrete and tied to this drill's actual mechanics, not generic advice
- next_steps: 2-4 specific things to focus on before retrying this drill, ordered by priority`,
            },
          ],
        },
      ]
    );

    const { data: inserted, error: insertError } = await supabase
      .from("analysis_results")
      .insert({
        upload_id: uploadId,
        reference_player_or_position: drill.title,
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

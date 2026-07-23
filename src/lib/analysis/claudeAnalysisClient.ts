import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisClient } from "./analysisClient";
import type { AnalysisResult, StructuredFeedback } from "../../types";
import { supabase } from "../supabaseClient";
import { extractFrames } from "./frameExtraction";

// Client-side for now, per the project brief's "build and test in isolation" phase — there's no
// server infra (Edge Function / backend) available in this environment to hold the API key
// server-side. VITE_ANTHROPIC_API_KEY is dev/isolated-testing only (see .env.example); move this
// call behind a server-side function before shipping to real users.
const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

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
    if (uploadError) throw new Error(uploadError.message);

    const { data: drill, error: drillError } = await supabase
      .from("drills")
      .select("title, description, skill_category")
      .eq("id", upload.drill_id)
      .single();
    if (drillError) throw new Error(drillError.message);

    const { data: referenceProfile, error: refError } = await supabase
      .from("reference_profiles")
      .select("name, position, signature_moves, key_stats, summary")
      .eq("id", referenceProfileId)
      .single();
    if (refError) throw new Error(refError.message);

    const frames = await extractFrames(videoUrl, 3);

    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      output_config: { format: { type: "json_schema", schema: FEEDBACK_SCHEMA } },
      messages: [
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
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text response from analysis model");
    const structured_feedback = JSON.parse(textBlock.text) as StructuredFeedback;

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
    if (insertError) throw new Error(insertError.message);

    return inserted as AnalysisResult;
  }
}

export const analysisClient: AnalysisClient = new ClaudeAnalysisClient();

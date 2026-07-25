import type { AnalysisMessage, GameFilmAnalysisResult, GameFilmFeedback } from "../../types";
import { supabase } from "../supabaseClient";
import { friendlyError } from "../errorMessages";
import { annotateFrameWithBox, extractFrameAt, extractFramesNear } from "./frameExtraction";
import { callClaudeAnalysis } from "./claudeAnalysisProxy";

const CHAT_RESPONSE_SCHEMA = {
  type: "object" as const,
  properties: {
    reply: { type: "string" as const },
    correction_applied: { type: "boolean" as const },
    updated_overall_note: { type: "string" as const },
    updated_areas_to_improve: { type: "array" as const, items: { type: "string" as const } },
    updated_comparison_player_insight: { type: "string" as const },
    updated_explanation: { type: "string" as const },
  },
  required: [
    "reply",
    "correction_applied",
    "updated_overall_note",
    "updated_areas_to_improve",
    "updated_comparison_player_insight",
    "updated_explanation",
  ],
  additionalProperties: false,
};

export async function getMessages(analysisResultId: string): Promise<AnalysisMessage[]> {
  const { data, error } = await supabase
    .from("analysis_messages")
    .select("id, analysis_result_id, role, content, created_at")
    .eq("analysis_result_id", analysisResultId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(friendlyError(error, "Couldn't load this chat. Please try again."));
  return (data ?? []) as AnalysisMessage[];
}

export async function sendChatMessage(
  analysisResultId: string,
  message: string
): Promise<{ assistantMessage: AnalysisMessage; updatedAnalysis: GameFilmAnalysisResult | null }> {
  const { data: analysis, error: analysisError } = await supabase
    .from("analysis_results")
    .select("id, upload_id, reference_player_or_position, feedback_text, structured_feedback, created_at")
    .eq("id", analysisResultId)
    .single();
  if (analysisError) throw new Error(friendlyError(analysisError, "Couldn't load this analysis. Please try again."));

  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .select("video_url, marker_frame_time, marker_x, marker_y, marker_width, marker_height, jersey_number, jersey_color")
    .eq("id", analysis.upload_id)
    .single();
  if (uploadError) throw new Error(friendlyError(uploadError, "Couldn't load the original video for this analysis."));
  if (upload.marker_frame_time === null) {
    throw new Error("This upload has no saved marker — can't ground follow-up chat in the original frames.");
  }

  // maybeSingle, not single: analyses created before the position/player restructure may reference
  // a name (e.g. a bare position like "Point Guard") that no longer exists as its own profile row —
  // degrade gracefully rather than hard-failing the whole chat for old data.
  const { data: referenceProfile, error: refError } = await supabase
    .from("reference_profiles")
    .select("name, position, signature_moves, key_stats, summary")
    .eq("name", analysis.reference_player_or_position)
    .maybeSingle();
  if (refError) throw new Error(friendlyError(refError, "Couldn't load the reference player for this analysis."));

  const history = await getMessages(analysisResultId);

  // Reuse the exact same marked-frame + nearby-frames extraction as the original analysis, so the
  // model is grounded in the same visual context rather than a blank slate.
  const markerFrame = await extractFrameAt(upload.video_url, upload.marker_frame_time);
  const annotatedMarkerFrame = await annotateFrameWithBox(
    markerFrame.base64,
    { x: upload.marker_x, y: upload.marker_y, width: upload.marker_width, height: upload.marker_height },
    markerFrame.width,
    markerFrame.height
  );
  const { frames: nearbyFrames } = await extractFramesNear(upload.video_url, upload.marker_frame_time, 6, 2);

  const originalAnalysisContext = `Original structured analysis (JSON): ${JSON.stringify(analysis.structured_feedback)}

The player wears jersey #${upload.jersey_number} in ${upload.jersey_color} (secondary context only — the red bounding box in the reference frame is the primary way the marked player was identified).
${
  referenceProfile
    ? `Reference: ${referenceProfile.name} (${referenceProfile.position}). Signature moves: ${JSON.stringify(referenceProfile.signature_moves)}. Key stats: ${JSON.stringify(referenceProfile.key_stats)}. Summary: ${referenceProfile.summary}`
    : `Reference: ${analysis.reference_player_or_position} (profile details no longer available).`
}

You are now in a follow-up chat with the player about this analysis. Answer their questions or address corrections, grounded in the frames above and the original analysis. If they point out a factual mistake (e.g. "that's the wrong player" or a wrong detail about what happened in the footage), acknowledge it directly in your reply. If the correction would meaningfully change the analysis, set correction_applied to true and provide the corrected values in updated_overall_note / updated_areas_to_improve / updated_comparison_player_insight / updated_explanation — these fully replace the stored analysis, so include everything (not just the corrected part) with the correction applied throughout. If there's no meaningful correction, set correction_applied to false and just echo the original overall_note/areas_to_improve/comparison_player_insight/explanation unchanged in those fields.`;

  const messages = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: annotatedMarkerFrame } },
        {
          type: "text",
          text: "The player being analyzed is shown in the red bounding box in the reference frame above. The frames that follow are chronologically close to it, from the same short window of footage.",
        },
        ...nearbyFrames.map((data) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
        })),
        { type: "text", text: originalAnalysisContext },
      ],
    },
    { role: "assistant", content: analysis.feedback_text },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const { error: insertUserError } = await supabase
    .from("analysis_messages")
    .insert({ analysis_result_id: analysisResultId, role: "user", content: message });
  if (insertUserError) throw new Error(friendlyError(insertUserError, "Couldn't send your message. Please try again."));

  const parsed = await callClaudeAnalysis<{
    reply: string;
    correction_applied: boolean;
    updated_overall_note: string;
    updated_areas_to_improve: string[];
    updated_comparison_player_insight: string;
    updated_explanation: string;
  }>("claude-opus-4-8", 2048, CHAT_RESPONSE_SCHEMA, messages);

  const { data: insertedAssistantMessage, error: insertAssistantError } = await supabase
    .from("analysis_messages")
    .insert({ analysis_result_id: analysisResultId, role: "assistant", content: parsed.reply })
    .select("id, analysis_result_id, role, content, created_at")
    .single();
  if (insertAssistantError) {
    throw new Error(friendlyError(insertAssistantError, "Got a reply but couldn't save it. Please try again."));
  }

  let updatedAnalysis: GameFilmAnalysisResult | null = null;
  if (parsed.correction_applied) {
    const updatedFeedback: GameFilmFeedback = {
      overall_note: parsed.updated_overall_note,
      areas_to_improve: parsed.updated_areas_to_improve,
      comparison_player_insight: parsed.updated_comparison_player_insight,
      explanation: parsed.updated_explanation,
    };
    const { data: updated, error: updateError } = await supabase
      .from("analysis_results")
      .update({ feedback_text: updatedFeedback.overall_note, structured_feedback: updatedFeedback })
      .eq("id", analysisResultId)
      .select("id, upload_id, reference_player_or_position, feedback_text, structured_feedback, created_at")
      .single();
    if (updateError) {
      throw new Error(friendlyError(updateError, "The correction came through, but saving it failed. Please try again."));
    }
    updatedAnalysis = updated as GameFilmAnalysisResult;
  }

  return { assistantMessage: insertedAssistantMessage as AnalysisMessage, updatedAnalysis };
}

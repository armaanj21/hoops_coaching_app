import type { AnalysisClient } from "./analysisClient";
import type { AnalysisResult } from "../../types";

/**
 * Concrete AnalysisClient backed by the Claude API (vision-capable model).
 *
 * TODO before this is real:
 * - Extract frames (or send video directly, once supported) from `videoUrl`.
 * - Load the reference profile's scouting content (see reference_profiles table) as
 *   comparison context in the prompt.
 * - Call the Claude Messages API with image/video content blocks + the reference
 *   context, requesting structured JSON output (strengths, fixes, comparison_note).
 * - This should run server-side (a Supabase Edge Function or similar), not in the
 *   client bundle, since it needs a real API key.
 *
 * For now this returns a mocked result so the rest of the app (upload -> feedback
 * display) can be built and tested end-to-end before the real API call is wired up.
 */
export class ClaudeAnalysisClient implements AnalysisClient {
  async analyzeUpload(uploadId: string, _videoUrl: string, referenceProfileId: string): Promise<AnalysisResult> {
    return {
      id: crypto.randomUUID(),
      upload_id: uploadId,
      reference_player_or_position: referenceProfileId,
      feedback_text: "Mock feedback: analysis module not yet wired up to the Claude API.",
      structured_feedback: {
        strengths: [],
        fixes: [],
        comparison_note: "Stubbed response — see claudeAnalysisClient.ts TODOs.",
      },
      created_at: new Date().toISOString(),
    };
  }
}

export const analysisClient: AnalysisClient = new ClaudeAnalysisClient();

import type { AnalysisResult } from "../../types";

/**
 * Swappable interface for the AI Analysis Module. Per the project brief, this module
 * should be built and tested in isolation before being wired into the main app flow.
 * Implementations take an uploaded drill video and return structured feedback grading the
 * player's form against that specific drill's own correct-form description.
 */
export interface AnalysisClient {
  analyzeUpload(uploadId: string, videoUrl: string): Promise<AnalysisResult>;
}

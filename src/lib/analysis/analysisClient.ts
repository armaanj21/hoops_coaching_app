import type { AnalysisResult } from "../../types";

/**
 * Swappable interface for the AI Analysis Module. Per the project brief, this module
 * should be built and tested in isolation before being wired into the main app flow.
 * Implementations take an uploaded drill video + the player's chosen reference NBA
 * player/position, and return structured feedback comparing the player's form to the
 * reference.
 */
export interface AnalysisClient {
  analyzeUpload(uploadId: string, videoUrl: string, referenceProfileId: string): Promise<AnalysisResult>;
}

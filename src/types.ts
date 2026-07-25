export type Role = "coach" | "player";

export interface Profile {
  id: string;
  role: Role;
  name: string;
  team_id: string | null;
  reference_profile_id: string | null;
}

export interface Team {
  id: string;
  coach_id: string;
  name: string;
  invite_code: string;
}

export type SkillCategory = "shooting" | "ballhandling" | "defense" | "passing" | "conditioning";

export interface Drill {
  id: string;
  title: string;
  description: string;
  skill_category: SkillCategory;
  reference_video_url: string | null;
}

export type AssignmentStatus = "assigned" | "in_progress" | "completed";

export interface Assignment {
  id: string;
  drill_id: string;
  team_id: string | null;
  player_id: string | null;
  status: AssignmentStatus;
}

export type DrillDifficulty = "too_easy" | "just_right" | "too_hard";

export interface DrillFeedback {
  id: string;
  assignment_id: string;
  drill_id: string;
  player_id: string;
  difficulty: DrillDifficulty;
  note: string | null;
  created_at: string;
}

export interface DrillFeedbackSummary {
  drillId: string;
  drillTitle: string;
  tooEasy: number;
  justRight: number;
  tooHard: number;
  recentNotes: { playerName: string; note: string }[];
}

export type UploadType = "drill" | "game_film";

export interface Upload {
  id: string;
  player_id: string;
  drill_id: string | null;
  video_url: string;
  created_at: string;
  upload_type: UploadType;
  jersey_number: string | null;
  jersey_color: string | null;
  marker_frame_time: number | null;
  marker_x: number | null;
  marker_y: number | null;
  marker_width: number | null;
  marker_height: number | null;
}

export interface StructuredFeedback {
  overall_note: string;
  form_feedback: string[];
  reference_comparison: string;
  explanation: string;
}

export interface AnalysisResult {
  id: string;
  upload_id: string;
  reference_player_or_position: string;
  feedback_text: string;
  structured_feedback: StructuredFeedback;
  created_at: string;
}

export interface GameFilmFeedback {
  overall_note: string;
  areas_to_improve: string[];
  comparison_player_insight: string;
  explanation: string;
}

export interface GameFilmAnalysisResult {
  id: string;
  upload_id: string;
  reference_player_or_position: string;
  feedback_text: string;
  structured_feedback: GameFilmFeedback;
  created_at: string;
}

export type MessageRole = "user" | "assistant";

export interface AnalysisMessage {
  id: string;
  analysis_result_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface Progress {
  id: string;
  player_id: string;
  metric_name: string;
  value: number;
  updated_at: string;
}

export type Position = "Point Guard" | "Shooting Guard" | "Small Forward" | "Power Forward" | "Center";

export interface ReferenceProfile {
  id: string;
  name: string;
  position: Position;
  signature_moves: string[];
  key_stats: Record<string, string | number>;
  summary: string;
}

export interface TeamFilmUpload {
  id: string;
  team_id: string;
  coach_id: string;
  video_url: string;
  created_at: string;
}

export interface PlayerUtilizationNote {
  player_descriptor: string;
  note: string;
}

export interface TeamFilmAnalysisResult {
  id: string;
  upload_id: string;
  team_strategy_notes: string;
  player_utilization_notes: PlayerUtilizationNote[];
  created_at: string;
}

export type AnalysisKind = "drill" | "game_film";

// Unifies AnalysisResult (drill-check) and GameFilmAnalysisResult into one shape for the progress
// timeline — the two have different structured_feedback fields, so this pulls out just what a
// chronological/pattern view needs, regardless of which kind produced it.
export interface AnalysisHistoryEntry {
  id: string;
  uploadId: string;
  kind: AnalysisKind;
  createdAt: string;
  referenceName: string;
  overallNote: string;
  issues: string[];
  drillTitle: string | null;
}

export interface ProgressPattern {
  theme: string;
  summary: string;
  analysisIds: string[];
}

export interface IssueDrillLink {
  id: string;
  analysisResultId: string;
  assignmentId: string;
  issueDescription: string;
  createdAt: string;
  drillTitle: string;
}

// Client-computed once history + links are loaded: which analysis (if any) is the next
// chronological one after this link, and whether Claude judged the issue to have reappeared in
// it. `reappeared`/`narration` stay null until there's a next analysis to actually judge against.
export interface IssueOutcome {
  link: IssueDrillLink;
  nextAnalysisId: string | null;
  reappeared: boolean | null;
  narration: string | null;
}

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

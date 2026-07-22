export type Role = "coach" | "player";

export interface Profile {
  id: string;
  role: Role;
  name: string;
  team_id: string | null;
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

export interface Upload {
  id: string;
  player_id: string;
  drill_id: string;
  video_url: string;
  created_at: string;
}

export interface StructuredFeedback {
  strengths: string[];
  fixes: string[];
  comparison_note: string;
}

export interface AnalysisResult {
  id: string;
  upload_id: string;
  reference_player_or_position: string;
  feedback_text: string;
  structured_feedback: StructuredFeedback;
  created_at: string;
}

export interface Progress {
  id: string;
  player_id: string;
  metric_name: string;
  value: number;
  updated_at: string;
}

export type ReferenceProfileType = "player" | "position";

export interface ReferenceProfile {
  id: string;
  name: string;
  type: ReferenceProfileType;
  signature_moves: string[];
  key_stats: Record<string, string | number>;
  summary: string;
}

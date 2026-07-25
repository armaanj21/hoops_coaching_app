import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import { callClaudeAnalysis } from "./analysis/claudeAnalysisProxy";
import type {
  AnalysisHistoryEntry,
  GameFilmFeedback,
  IssueDrillLink,
  IssueOutcome,
  ProgressPattern,
  StructuredFeedback,
} from "../types";

interface AnalysisResultRow {
  id: string;
  upload_id: string;
  reference_player_or_position: string;
  feedback_text: string;
  structured_feedback: StructuredFeedback | GameFilmFeedback;
  created_at: string;
  uploads: { upload_type: "drill" | "game_film"; drills: { title: string } | null } | null;
}

// Pulls every past analysis for a player — drill-check and game-film analyses share the
// analysis_results table, distinguished by the joined upload's upload_type — into one
// chronological timeline. Read-only aggregation over existing data; doesn't touch how individual
// analyses are generated.
export async function getPlayerAnalysisHistory(playerId: string): Promise<AnalysisHistoryEntry[]> {
  const { data, error } = await supabase
    .from("analysis_results")
    .select(
      "id, upload_id, reference_player_or_position, feedback_text, structured_feedback, created_at, uploads!inner(upload_type, player_id, drills(title))"
    )
    .eq("uploads.player_id", playerId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(friendlyError(error, "Couldn't load analysis history. Please try again."));

  return ((data ?? []) as unknown as AnalysisResultRow[]).map((row) => {
    const kind = row.uploads?.upload_type ?? "drill";
    const issues =
      kind === "drill"
        ? (row.structured_feedback as StructuredFeedback).form_feedback
        : (row.structured_feedback as GameFilmFeedback).areas_to_improve;
    return {
      id: row.id,
      uploadId: row.upload_id,
      kind,
      createdAt: row.created_at,
      referenceName: row.reference_player_or_position,
      overallNote: row.structured_feedback.overall_note,
      issues: issues ?? [],
      drillTitle: row.uploads?.drills?.title ?? null,
    };
  });
}

const PATTERN_SCHEMA = {
  type: "object" as const,
  properties: {
    patterns: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          theme: { type: "string" as const },
          summary: { type: "string" as const },
          // Claude references the short labels handed to it in the prompt (A1, A2, ...) rather
          // than real UUIDs, which it could otherwise transcribe wrong — mapped back to real
          // analysis ids in code below.
          analysis_labels: { type: "array" as const, items: { type: "string" as const } },
        },
        required: ["theme", "summary", "analysis_labels"],
        additionalProperties: false,
      },
    },
  },
  required: ["patterns"],
  additionalProperties: false,
};

// Identifies recurring themes across a player's analysis history — issues that show up more than
// once are flagged as persistent patterns rather than left as scattered one-off notes buried in
// separate reports. Needs at least two analyses with at least one issue between them to have
// anything to find a pattern across.
export async function detectProgressPatterns(history: AnalysisHistoryEntry[]): Promise<ProgressPattern[]> {
  const withIssues = history.filter((h) => h.issues.length > 0);
  if (withIssues.length < 2) return [];

  const labelToId = new Map<string, string>();
  const listing = withIssues
    .map((entry, i) => {
      const label = `A${i + 1}`;
      labelToId.set(label, entry.id);
      const date = new Date(entry.createdAt).toISOString().slice(0, 10);
      return `${label} (${date}, ${entry.kind === "drill" ? entry.drillTitle : "game film"}):\n${entry.issues.map((issue) => `- ${issue}`).join("\n")}`;
    })
    .join("\n\n");

  const parsed = await callClaudeAnalysis<{
    patterns: { theme: string; summary: string; analysis_labels: string[] }[];
  }>("claude-opus-4-8", 1536, PATTERN_SCHEMA, [
    {
      role: "user",
      content: `Here is one player's history of coaching-analysis feedback, in chronological order. Each entry lists the issues flagged in that analysis.

${listing}

Identify recurring themes: issues that meaningfully repeat across two or more entries (e.g. "release point inconsistency" showing up in three separate analyses, even if worded differently each time). Group semantically similar issues under one theme rather than treating slightly different phrasing as different problems. Do NOT invent a theme from a single one-off note that only appears once — a pattern requires genuine recurrence. For each pattern, return:
- theme: a short name for the recurring issue
- summary: 1-2 sentences describing the pattern and how it's evolved (better, worse, unchanged) across the entries it appears in, if that's visible
- analysis_labels: the exact labels (e.g. "A1", "A3") of every entry where this theme appears`,
    },
  ]);

  return parsed.patterns
    .map((p) => ({
      theme: p.theme,
      summary: p.summary,
      analysisIds: p.analysis_labels.map((label) => labelToId.get(label)).filter((id): id is string => Boolean(id)),
    }))
    .filter((p) => p.analysisIds.length >= 2);
}

const OUTCOME_SCHEMA = {
  type: "object" as const,
  properties: {
    outcomes: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          link_label: { type: "string" as const },
          reappeared: { type: "boolean" as const },
          narration: { type: "string" as const },
        },
        required: ["link_label", "reappeared", "narration"],
        additionalProperties: false,
      },
    },
  },
  required: ["outcomes"],
  additionalProperties: false,
};

// Determines, for each issue -> drill link, whether the flagged issue actually reappeared in the
// next analysis after the drill was assigned. Which analysis is "next" is a plain date comparison
// (no judgment call needed); WHETHER the issue reappeared needs semantic comparison of free-text
// issue lists, which is what the Claude call is for. Links with no next analysis yet are returned
// with a null outcome rather than sent to Claude — there's nothing to judge yet.
export async function detectIssueOutcomes(
  links: IssueDrillLink[],
  history: AnalysisHistoryEntry[]
): Promise<IssueOutcome[]> {
  const sorted = [...history].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const withNext = links.map((link) => {
    const nextAnalysis = sorted.find((entry) => entry.createdAt > link.createdAt);
    return { link, nextAnalysis };
  });

  const judgeable = withNext.filter(
    (x): x is { link: IssueDrillLink; nextAnalysis: AnalysisHistoryEntry } => x.nextAnalysis !== undefined
  );

  if (judgeable.length === 0) {
    return withNext.map(({ link }) => ({ link, nextAnalysisId: null, reappeared: null, narration: null }));
  }

  const labelToLink = new Map<string, { link: IssueDrillLink; nextAnalysis: AnalysisHistoryEntry }>();
  const listing = judgeable
    .map((entry, i) => {
      const label = `L${i + 1}`;
      labelToLink.set(label, entry);
      const assignedDate = new Date(entry.link.createdAt).toISOString().slice(0, 10);
      const nextDate = new Date(entry.nextAnalysis.createdAt).toISOString().slice(0, 10);
      const nextIssues =
        entry.nextAnalysis.issues.length > 0
          ? entry.nextAnalysis.issues.map((issue) => `- ${issue}`).join("\n")
          : "(no issues flagged in this analysis)";
      return `${label}:\nOriginal issue: "${entry.link.issueDescription}"\nDrill assigned to address it: "${entry.link.drillTitle}" on ${assignedDate}\nIssues flagged in the next analysis (${nextDate}):\n${nextIssues}`;
    })
    .join("\n\n");

  const parsed = await callClaudeAnalysis<{
    outcomes: { link_label: string; reappeared: boolean; narration: string }[];
  }>("claude-opus-4-8", 1536, OUTCOME_SCHEMA, [
    {
      role: "user",
      content: `A coach assigned specific drills to address specific flagged issues. For each one below, determine whether that same issue meaningfully reappears in the next analysis's flagged issues (semantically — different wording of the same underlying problem still counts as reappearing), or whether it's genuinely absent/resolved.

${listing}

For each entry, return:
- link_label: the exact label (e.g. "L1")
- reappeared: true if the same underlying issue is still present in the next analysis, false if it's absent/resolved
- narration: one sentence stating the outcome plainly, e.g. "This was addressed with Form Shooting - One Hand on 2026-07-10 — in the next analysis, this issue did not reappear."`,
    },
  ]);

  const outcomeByLabel = new Map(parsed.outcomes.map((o) => [o.link_label, o]));

  return withNext.map(({ link, nextAnalysis }) => {
    if (!nextAnalysis) return { link, nextAnalysisId: null, reappeared: null, narration: null };
    const entry = [...labelToLink.entries()].find(([, v]) => v.link.id === link.id);
    const outcome = entry ? outcomeByLabel.get(entry[0]) : undefined;
    return {
      link,
      nextAnalysisId: nextAnalysis.id,
      reappeared: outcome?.reappeared ?? null,
      narration: outcome?.narration ?? null,
    };
  });
}

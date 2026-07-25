import { useState } from "react";
import type { AssignmentWithDrill } from "../lib/teams";
import { completeAssignment } from "../lib/drillFeedback";
import type { DrillDifficulty } from "../types";

const DIFFICULTY_LABELS: Record<DrillDifficulty, string> = {
  too_easy: "Too easy",
  just_right: "Just right",
  too_hard: "Too hard",
};

export default function AssignmentList({
  assignments,
  completedAssignmentIds,
  playerId,
  onCompleted,
}: {
  assignments: AssignmentWithDrill[];
  completedAssignmentIds: Set<string>;
  playerId: string;
  onCompleted: () => void;
}) {
  const [openAssignmentId, setOpenAssignmentId] = useState<string | null>(null);

  if (assignments.length === 0) {
    return <p>No drills assigned yet.</p>;
  }

  return (
    <ul>
      {assignments.map((a) => {
        const isCompleted = completedAssignmentIds.has(a.id);
        return (
          <li key={a.id}>
            {a.drills?.title ?? "Drill"} — {isCompleted ? "completed" : a.status}
            {a.team_id && " (whole team)"}
            {!isCompleted && openAssignmentId !== a.id && (
              <button onClick={() => setOpenAssignmentId(a.id)} style={{ marginLeft: "0.5em" }}>
                Mark complete
              </button>
            )}
            {openAssignmentId === a.id && (
              <CompleteAssignmentForm
                assignment={a}
                playerId={playerId}
                onDone={() => {
                  setOpenAssignmentId(null);
                  onCompleted();
                }}
                onCancel={() => setOpenAssignmentId(null)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CompleteAssignmentForm({
  assignment,
  playerId,
  onDone,
  onCancel,
}: {
  assignment: AssignmentWithDrill;
  playerId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [difficulty, setDifficulty] = useState<DrillDifficulty>("just_right");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await completeAssignment({
        assignmentId: assignment.id,
        drillId: assignment.drill_id,
        playerId,
        isPlayerSpecific: assignment.player_id === playerId,
        difficulty,
        note,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving your feedback. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "0.5em" }}>
      <p>How was this drill?</p>
      {(Object.keys(DIFFICULTY_LABELS) as DrillDifficulty[]).map((d) => (
        <label key={d} style={{ display: "block" }}>
          <input
            type="radio"
            name={`difficulty-${assignment.id}`}
            checked={difficulty === d}
            onChange={() => setDifficulty(d)}
            disabled={submitting}
          />{" "}
          {DIFFICULTY_LABELS[d]}
        </label>
      ))}
      <textarea
        placeholder="Optional note for your coach..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={submitting}
      />
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving..." : "Submit"}
      </button>
      <button type="button" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
    </form>
  );
}

import { useEffect, useState } from "react";
import type { Profile } from "../types";
import { getMyAssignments, type AssignmentWithDrill } from "../lib/teams";
import { getMyCompletedAssignmentIds } from "../lib/drillFeedback";
import AssignmentList from "../components/AssignmentList";

export default function PlayerHome({ profile }: { profile: Profile }) {
  const [assignments, setAssignments] = useState<AssignmentWithDrill[]>([]);
  const [completedAssignmentIds, setCompletedAssignmentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, profile.team_id]);

  async function loadAssignments() {
    setLoading(true);
    setError(null);
    try {
      const [assignmentsData, completedIds] = await Promise.all([
        getMyAssignments(profile),
        getMyCompletedAssignmentIds(profile.id),
      ]);
      setAssignments(assignmentsData);
      setCompletedAssignmentIds(completedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>My Drills</h1>
      <div className="card">
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        {!loading && !error && (
          <AssignmentList
            assignments={assignments}
            completedAssignmentIds={completedAssignmentIds}
            playerId={profile.id}
            onCompleted={() => void loadAssignments()}
          />
        )}
      </div>
    </div>
  );
}

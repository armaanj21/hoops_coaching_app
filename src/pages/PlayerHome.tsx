import { useEffect, useState } from "react";
import type { LeaderboardEntry, Profile } from "../types";
import { getMyAssignments, type AssignmentWithDrill } from "../lib/teams";
import { getMyCompletedAssignmentIds } from "../lib/drillFeedback";
import { getTeamLeaderboard } from "../lib/leaderboard";
import AssignmentList from "../components/AssignmentList";
import Leaderboard from "../components/Leaderboard";

export default function PlayerHome({ profile }: { profile: Profile }) {
  const [assignments, setAssignments] = useState<AssignmentWithDrill[]>([]);
  const [completedAssignmentIds, setCompletedAssignmentIds] = useState<Set<string>>(new Set());
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
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
      const [assignmentsData, completedIds, leaderboardData] = await Promise.all([
        getMyAssignments(profile),
        getMyCompletedAssignmentIds(profile.id),
        profile.team_id ? getTeamLeaderboard(profile.team_id) : Promise.resolve([]),
      ]);
      setAssignments(assignmentsData);
      setCompletedAssignmentIds(completedIds);
      setLeaderboard(leaderboardData);
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
      {profile.team_id && (
        <div className="card">
          <h2>Leaderboard</h2>
          <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Drills completed — consistency, not skill ranking.</p>
          <Leaderboard entries={leaderboard} />
        </div>
      )}
    </div>
  );
}

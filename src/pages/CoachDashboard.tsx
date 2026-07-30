import { useEffect, useState } from "react";
import type { Drill, DrillFeedbackSummary, LeaderboardEntry, Profile, Team } from "../types";
import { assignDrill, getDrills, getMyTeam, getRoster } from "../lib/teams";
import { getDrillFeedbackSummary } from "../lib/drillFeedback";
import { getPlayerAnalysisHistory } from "../lib/progress";
import { createIssueDrillLink } from "../lib/issueDrillLinks";
import { getTeamLeaderboard } from "../lib/leaderboard";
import RosterList from "../components/RosterList";
import Leaderboard from "../components/Leaderboard";

// Flattened for the "address this issue" picker: one option per issue string, tagged with which
// analysis it came from so a link can be created against the right analysis_result.
interface RecentIssueOption {
  analysisResultId: string;
  issueText: string;
}

export default function CoachDashboard({ profile }: { profile: Profile }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<Profile[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState<DrillFeedbackSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [selectedDrillId, setSelectedDrillId] = useState("");
  const [scope, setScope] = useState<"team" | "players">("team");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Only meaningful when assigning to exactly one player — tagging "this drill addresses that
  // issue" doesn't make sense for a whole-team assignment shared across multiple players.
  const [recentIssues, setRecentIssues] = useState<RecentIssueOption[]>([]);
  const [recentIssuesLoading, setRecentIssuesLoading] = useState(false);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState("");

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.team_id]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [teamData, drillsData] = await Promise.all([getMyTeam(profile), getDrills()]);
      setTeam(teamData);
      setDrills(drillsData);
      if (teamData) {
        const [rosterData, feedbackData, leaderboardData] = await Promise.all([
          getRoster(teamData.id),
          getDrillFeedbackSummary(teamData.id),
          getTeamLeaderboard(teamData.id),
        ]);
        setRoster(rosterData);
        setFeedbackSummary(feedbackData);
        setLeaderboard(leaderboardData);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyInviteCode() {
    if (!team) return;
    await navigator.clipboard.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds((prev) => {
      const next = prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId];
      void loadRecentIssues(next);
      return next;
    });
  }

  async function loadRecentIssues(playerIds: string[]) {
    setSelectedIssueIndex("");
    if (playerIds.length !== 1) {
      setRecentIssues([]);
      return;
    }
    setRecentIssuesLoading(true);
    try {
      const history = await getPlayerAnalysisHistory(playerIds[0]);
      // Most recent analyses first, capped so the dropdown doesn't turn into the player's entire
      // history — a coach addressing something recent doesn't need to scroll through year-old notes.
      const flattened = [...history]
        .reverse()
        .slice(0, 5)
        .flatMap((entry) => entry.issues.map((issueText) => ({ analysisResultId: entry.id, issueText })));
      setRecentIssues(flattened);
    } catch {
      setRecentIssues([]);
    } finally {
      setRecentIssuesLoading(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignError(null);
    setAssignSuccess(null);
    if (!team || !selectedDrillId) return;
    try {
      const created = await assignDrill({
        drillId: selectedDrillId,
        teamId: team.id,
        playerIds: scope === "players" ? selectedPlayerIds : [],
      });

      if (selectedIssueIndex !== "" && created.length === 1) {
        const issue = recentIssues[Number(selectedIssueIndex)];
        if (issue) {
          await createIssueDrillLink({
            analysisResultId: issue.analysisResultId,
            assignmentId: created[0].id,
            issueDescription: issue.issueText,
          });
        }
      }

      setAssignSuccess(
        scope === "team" ? "Assigned to the whole team." : `Assigned to ${selectedPlayerIds.length} player(s).`
      );
      setSelectedPlayerIds([]);
      setSelectedDrillId("");
      setRecentIssues([]);
      setSelectedIssueIndex("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Failed to assign drill.");
    }
  }

  if (loading) return <p>Loading...</p>;
  if (loadError) return <p style={{ color: "#f87171" }}>{loadError}</p>;

  return (
    <div>
      <h1>Coach Dashboard</h1>
      <div className="card">
        <h2>Leaderboard</h2>
        <p style={{ fontSize: "0.85em", opacity: 0.75 }}>Drills completed — consistency, not skill ranking.</p>
        <Leaderboard entries={leaderboard} />
      </div>
      <div className="card">
        <h2>Roster</h2>
        <RosterList players={roster} />
        {team && (
          <>
            <p>
              Invite code: <strong>{team.invite_code}</strong>
            </p>
            <button onClick={handleCopyInviteCode}>{copied ? "Copied!" : "Copy invite code"}</button>
          </>
        )}
      </div>
      <div className="card">
        <h2>Assign a drill</h2>
        {drills.length === 0 ? (
          <p>No drills in the library yet.</p>
        ) : (
          <form onSubmit={handleAssign}>
            <select value={selectedDrillId} onChange={(e) => setSelectedDrillId(e.target.value)} required>
              <option value="" disabled>
                Select a drill
              </option>
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.skill_category})
                </option>
              ))}
            </select>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as "team" | "players");
                setSelectedPlayerIds([]);
                setRecentIssues([]);
                setSelectedIssueIndex("");
              }}
            >
              <option value="team">Whole team</option>
              <option value="players">Specific players</option>
            </select>
            {scope === "players" && (
              <div>
                {roster.length === 0 && <p>No players on the roster yet.</p>}
                {roster.map((p) => (
                  <label key={p.id} style={{ display: "block" }}>
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(p.id)}
                      onChange={() => togglePlayer(p.id)}
                    />{" "}
                    {p.name}
                  </label>
                ))}
              </div>
            )}
            {scope === "players" && selectedPlayerIds.length === 1 && (
              <div>
                {recentIssuesLoading && <p>Loading this player's recent flagged issues...</p>}
                {!recentIssuesLoading && recentIssues.length > 0 && (
                  <label>
                    Optionally, address a flagged issue with this drill
                    <select value={selectedIssueIndex} onChange={(e) => setSelectedIssueIndex(e.target.value)}>
                      <option value="">Don't link to a specific issue</option>
                      {recentIssues.map((issue, i) => (
                        <option key={i} value={i}>
                          {issue.issueText}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!recentIssuesLoading && recentIssues.length === 0 && (
                  <p style={{ fontSize: "0.85em", opacity: 0.75 }}>No flagged issues yet for this player to link.</p>
                )}
              </div>
            )}
            {assignError && <p style={{ color: "#f87171" }}>{assignError}</p>}
            {assignSuccess && <p style={{ color: "#4ade80" }}>{assignSuccess}</p>}
            <button type="submit" disabled={scope === "players" && selectedPlayerIds.length === 0}>
              Assign
            </button>
          </form>
        )}
      </div>
      <div className="card">
        <h2>Drill feedback</h2>
        {feedbackSummary.length === 0 ? (
          <p>No feedback submitted yet.</p>
        ) : (
          feedbackSummary.map((s) => {
            const total = s.tooEasy + s.justRight + s.tooHard;
            return (
              <div key={s.drillId} className="card">
                <h3>{s.drillTitle}</h3>
                <p>
                  Too easy: {s.tooEasy} &middot; Just right: {s.justRight} &middot; Too hard: {s.tooHard} &middot;{" "}
                  {total} response{total === 1 ? "" : "s"}
                </p>
                {s.recentNotes.length > 0 && (
                  <ul>
                    {s.recentNotes.map((n, i) => (
                      <li key={i}>
                        <strong>{n.playerName}:</strong> {n.note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import type { LeaderboardEntry } from "../types";

// Deliberately just completion/consistency counts, not a skill ranking — the point is to make
// showing up and doing the work feel good and visible, not to rank players by ability.
export default function Leaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p>No players on the roster yet.</p>;
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>This week</th>
            <th>This month</th>
            <th>All-time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.playerId}>
              <td>
                {i === 0 && entry.completionsThisWeek > 0 ? "🏆 " : ""}
                {entry.playerName}
              </td>
              <td>{entry.completionsThisWeek}</td>
              <td>{entry.completionsThisMonth}</td>
              <td>{entry.totalCompletions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import type { TeamFilmAnalysisResult } from "../types";

export default function TeamFilmFeedbackCard({ result }: { result: TeamFilmAnalysisResult }) {
  return (
    <div>
      <h3>Team strategy</h3>
      <p>{result.team_strategy_notes}</p>
      {result.player_utilization_notes.length > 0 && (
        <>
          <h4>Player utilization</h4>
          <ul>
            {result.player_utilization_notes.map((n, i) => (
              <li key={i}>
                <strong>{n.player_descriptor}:</strong> {n.note}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

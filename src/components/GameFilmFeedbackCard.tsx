import type { GameFilmAnalysisResult } from "../types";

export default function GameFilmFeedbackCard({ result }: { result: GameFilmAnalysisResult }) {
  const { overall_note, areas_to_improve, comparison_player_insight, explanation } = result.structured_feedback;

  return (
    <div className="card">
      <h3>Game Film Analysis vs. {result.reference_player_or_position}</h3>
      <p>{overall_note}</p>
      {areas_to_improve.length > 0 && (
        <>
          <h4>Areas to improve</h4>
          <ul>
            {areas_to_improve.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </>
      )}
      <h4>How it compares</h4>
      <p>{comparison_player_insight}</p>
      <h4>Why it works</h4>
      <p>
        <em>{explanation}</em>
      </p>
    </div>
  );
}

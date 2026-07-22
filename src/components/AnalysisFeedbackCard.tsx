import type { AnalysisResult } from "../types";

export default function AnalysisFeedbackCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="card">
      <h3>Feedback vs. {result.reference_player_or_position}</h3>
      <p>{result.feedback_text}</p>
      {result.structured_feedback.fixes.length > 0 && (
        <>
          <h4>Fixes</h4>
          <ul>
            {result.structured_feedback.fixes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
      <p>
        <em>{result.structured_feedback.comparison_note}</em>
      </p>
    </div>
  );
}

import type { AnalysisResult } from "../types";

export default function AnalysisFeedbackCard({ result }: { result: AnalysisResult }) {
  const { overall_note, form_feedback, reference_comparison, explanation } = result.structured_feedback;

  return (
    <div className="card">
      <h3>Feedback vs. {result.reference_player_or_position}</h3>
      <p>{overall_note}</p>
      {form_feedback.length > 0 && (
        <>
          <h4>What to fix</h4>
          <ul>
            {form_feedback.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
      <h4>How it compares</h4>
      <p>{reference_comparison}</p>
      <h4>Why it works</h4>
      <p>
        <em>{explanation}</em>
      </p>
    </div>
  );
}

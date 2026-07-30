import type { AnalysisResult } from "../types";

const TIER_LABELS: Record<string, string> = {
  needs_work: "Needs work",
  developing: "Developing",
  solid: "Solid",
  excellent: "Excellent",
};

export default function AnalysisFeedbackCard({ result }: { result: AnalysisResult }) {
  const { overall_note, score, score_tier, done_well, form_feedback, next_steps } = result.structured_feedback;

  return (
    <div className="card">
      <h3>
        {result.reference_player_or_position} — {score}/10 ({TIER_LABELS[score_tier] ?? score_tier})
      </h3>
      <p>{overall_note}</p>
      {done_well.length > 0 && (
        <>
          <h4>What you're doing well</h4>
          <ul>
            {done_well.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
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
      {next_steps.length > 0 && (
        <>
          <h4>Next steps</h4>
          <ul>
            {next_steps.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

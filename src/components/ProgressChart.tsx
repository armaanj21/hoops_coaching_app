import type { Progress } from "../types";

// TODO: replace with a real chart (e.g. sparkline of `value` over `updated_at`) once
// progress data is being written from completed drills/uploads.
export default function ProgressChart({ metrics }: { metrics: Progress[] }) {
  if (metrics.length === 0) {
    return <p>No progress tracked yet.</p>;
  }

  return (
    <ul>
      {metrics.map((m) => (
        <li key={m.id}>
          {m.metric_name}: {m.value}
        </li>
      ))}
    </ul>
  );
}

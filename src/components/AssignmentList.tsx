import type { AssignmentWithDrill } from "../lib/teams";

export default function AssignmentList({ assignments }: { assignments: AssignmentWithDrill[] }) {
  if (assignments.length === 0) {
    return <p>No drills assigned yet.</p>;
  }

  return (
    <ul>
      {assignments.map((a) => (
        <li key={a.id}>
          {a.drills?.title ?? "Drill"} — {a.status}
          {a.team_id && " (whole team)"}
        </li>
      ))}
    </ul>
  );
}

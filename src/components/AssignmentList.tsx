import type { Assignment } from "../types";

// TODO: fetch real assignments from the `assignments` table once Supabase is wired up.
export default function AssignmentList({ assignments }: { assignments: Assignment[] }) {
  if (assignments.length === 0) {
    return <p>No drills assigned yet.</p>;
  }

  return (
    <ul>
      {assignments.map((a) => (
        <li key={a.id}>
          Drill {a.drill_id} — {a.status}
        </li>
      ))}
    </ul>
  );
}

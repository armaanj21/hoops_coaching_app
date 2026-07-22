import DrillCard from "../components/DrillCard";
import type { Drill } from "../types";

// TODO: fetch drills from the `drills` table, grouped by skill_category.
const STUB_DRILLS: Drill[] = [];

export default function DrillLibrary() {
  return (
    <div>
      <h1>Drill Library</h1>
      {STUB_DRILLS.length === 0 && <p>No drills loaded yet — connect Supabase and run the seed migration.</p>}
      {STUB_DRILLS.map((d) => (
        <DrillCard key={d.id} drill={d} />
      ))}
    </div>
  );
}

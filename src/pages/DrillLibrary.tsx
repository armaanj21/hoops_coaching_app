import { useEffect, useState } from "react";
import DrillCard from "../components/DrillCard";
import { getDrills } from "../lib/teams";
import type { Drill, SkillCategory } from "../types";

export default function DrillLibrary() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDrills();
  }, []);

  async function loadDrills() {
    setLoading(true);
    setError(null);
    try {
      setDrills(await getDrills());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drills.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;

  const grouped = drills.reduce<Record<string, Drill[]>>((acc, drill) => {
    (acc[drill.skill_category] ??= []).push(drill);
    return acc;
  }, {});

  return (
    <div>
      <h1>Drill Library</h1>
      {drills.length === 0 && <p>No drills available yet.</p>}
      {(Object.entries(grouped) as [SkillCategory, Drill[]][]).map(([category, categoryDrills]) => (
        <div key={category}>
          <h2>{category}</h2>
          {categoryDrills.map((d) => (
            <DrillCard key={d.id} drill={d} />
          ))}
        </div>
      ))}
    </div>
  );
}

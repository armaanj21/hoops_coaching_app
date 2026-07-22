import { Link } from "react-router-dom";
import type { Drill } from "../types";

export default function DrillCard({ drill }: { drill: Drill }) {
  return (
    <div className="card">
      <h3>{drill.title}</h3>
      <p>{drill.skill_category}</p>
      <Link to={`/drills/${drill.id}`}>View drill</Link>
    </div>
  );
}

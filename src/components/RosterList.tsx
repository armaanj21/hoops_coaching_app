import { Link } from "react-router-dom";
import type { Profile } from "../types";

export default function RosterList({ players }: { players: Profile[] }) {
  if (players.length === 0) {
    return <p>No players on the roster yet. Share your invite code to get started.</p>;
  }

  return (
    <ul>
      {players.map((p) => (
        <li key={p.id}>
          {p.name} — <Link to={`/progress/${p.id}`}>View progress</Link>
        </li>
      ))}
    </ul>
  );
}

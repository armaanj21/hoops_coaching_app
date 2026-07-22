import type { Profile } from "../types";

// TODO: fetch real roster from `users` table filtered by team_id once Supabase is wired up.
export default function RosterList({ players }: { players: Profile[] }) {
  if (players.length === 0) {
    return <p>No players on the roster yet. Share your invite code to get started.</p>;
  }

  return (
    <ul>
      {players.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}

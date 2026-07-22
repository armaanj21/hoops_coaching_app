import type { Profile } from "../types";
import AssignmentList from "../components/AssignmentList";

export default function PlayerHome({ profile: _profile }: { profile: Profile }) {
  // TODO: load this player's assignments from Supabase.
  return (
    <div>
      <h1>My Drills</h1>
      <div className="card">
        <AssignmentList assignments={[]} />
      </div>
    </div>
  );
}

import type { Profile } from "../types";
import RosterList from "../components/RosterList";

export default function CoachDashboard({ profile: _profile }: { profile: Profile }) {
  // TODO: load roster + per-player assignment/upload/analysis summaries from Supabase.
  return (
    <div>
      <h1>Coach Dashboard</h1>
      <div className="card">
        <h2>Roster</h2>
        <RosterList players={[]} />
        <button>Copy invite code (stub)</button>
      </div>
      <div className="card">
        <h2>Assign a drill</h2>
        <p>TODO: pick a drill from the library and assign to the whole team or individual players.</p>
      </div>
    </div>
  );
}

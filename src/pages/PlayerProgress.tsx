import type { Profile } from "../types";
import ProgressChart from "../components/ProgressChart";

export default function PlayerProgress({ profile: _profile }: { profile: Profile }) {
  // TODO: fetch this player's rows from the `progress` table.
  return (
    <div>
      <h1>My Progress</h1>
      <div className="card">
        <ProgressChart metrics={[]} />
      </div>
    </div>
  );
}

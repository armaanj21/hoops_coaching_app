import type { Profile } from "../types";
import ProgressChart from "../components/ProgressChart";
import AnalysisHistoryView from "../components/AnalysisHistoryView";

export default function PlayerProgress({ profile }: { profile: Profile }) {
  return (
    <div>
      <h1>My Progress</h1>
      <div className="card">
        {/* TODO: fetch this player's rows from the `progress` table. */}
        <ProgressChart metrics={[]} />
      </div>
      <AnalysisHistoryView playerId={profile.id} />
    </div>
  );
}

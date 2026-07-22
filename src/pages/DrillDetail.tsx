import { useParams } from "react-router-dom";
import type { Profile } from "../types";
import UploadButton from "../components/UploadButton";

export default function DrillDetail({ profile }: { profile: Profile }) {
  const { drillId } = useParams();

  // TODO: fetch the drill by id, show its reference_video_url + description, and list
  // any past uploads/analysis results for this player+drill.
  return (
    <div>
      <h1>Drill {drillId}</h1>
      <div className="card">
        <p>TODO: instructions + reference video go here.</p>
        {profile.role === "player" && drillId && <UploadButton drillId={drillId} />}
      </div>
    </div>
  );
}

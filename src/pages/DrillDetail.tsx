import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { Drill, Profile } from "../types";
import { supabase } from "../lib/supabaseClient";
import { friendlyError } from "../lib/errorMessages";
import { getUploadsForDrill, type UploadWithAnalysis } from "../lib/uploads";
import UploadButton from "../components/UploadButton";
import AnalysisFeedbackCard from "../components/AnalysisFeedbackCard";

export default function DrillDetail({ profile }: { profile: Profile }) {
  const { drillId } = useParams();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [uploads, setUploads] = useState<UploadWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (drillId) void loadData(drillId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillId]);

  async function loadData(id: string) {
    setLoading(true);
    setError(null);
    try {
      const { data: drillData, error: drillError } = await supabase
        .from("drills")
        .select("id, title, description, skill_category, reference_video_url, correct_form_description")
        .eq("id", id)
        .single();
      if (drillError) throw new Error(friendlyError(drillError, "Couldn't load this drill. Please try again."));
      setDrill(drillData);
      setUploads(await getUploadsForDrill(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drill.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!drill || !drillId) return <p>Drill not found.</p>;

  const visibleUploads = profile.role === "player" ? uploads.filter((u) => u.player_id === profile.id) : uploads;

  return (
    <div>
      <h1>{drill.title}</h1>
      <div className="card">
        <p>{drill.description}</p>
        <p>
          <strong>Category:</strong> {drill.skill_category}
        </p>
        <p>
          <strong>Correct form:</strong> {drill.correct_form_description}
        </p>
        {profile.role === "player" && (
          <UploadButton drillId={drillId} playerId={profile.id} onDone={() => void loadData(drillId)} />
        )}
      </div>
      <div className="card">
        <h2>{profile.role === "coach" ? "Team uploads" : "Your uploads"}</h2>
        {visibleUploads.length === 0 && <p>No uploads yet.</p>}
        {visibleUploads.map((upload) => (
          <div key={upload.id} className="card">
            {profile.role === "coach" && <p>Player: {upload.users?.name ?? "Unknown"}</p>}
            <p>Uploaded {new Date(upload.created_at).toLocaleString()}</p>
            {upload.analysis_results.length === 0 ? (
              <p>Analysis pending...</p>
            ) : (
              upload.analysis_results.map((result) => <AnalysisFeedbackCard key={result.id} result={result} />)
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

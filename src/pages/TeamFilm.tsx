import { useEffect, useState } from "react";
import type { Profile } from "../types";
import { getMyTeam } from "../lib/teams";
import { getTeamFilmUploads, type TeamFilmUploadWithAnalysis } from "../lib/teamFilm";
import TeamFilmUploadButton from "../components/TeamFilmUploadButton";
import TeamFilmFeedbackCard from "../components/TeamFilmFeedbackCard";

export default function TeamFilm({ profile }: { profile: Profile }) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<TeamFilmUploadWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.team_id]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const team = await getMyTeam(profile);
      setTeamId(team?.id ?? null);
      if (team) {
        setUploads(await getTeamFilmUploads(team.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team film.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;

  return (
    <div>
      <h1>Team Film</h1>
      <div className="card">
        <p>Upload full-team game or practice footage for team-level strategy and player-utilization analysis.</p>
        {!teamId ? (
          <p>You need a team set up before uploading team film.</p>
        ) : (
          <TeamFilmUploadButton teamId={teamId} coachId={profile.id} onDone={() => void loadData()} />
        )}
      </div>
      <div className="card">
        <h2>Uploaded team film</h2>
        {uploads.length === 0 && <p>No team film uploaded yet.</p>}
        {uploads.map((upload) => (
          <div key={upload.id} className="card">
            <p>Uploaded {new Date(upload.created_at).toLocaleString()}</p>
            <video src={upload.video_url} controls className="game-film-video" />
            {upload.team_film_analysis_results.length === 0 ? (
              <p>Analysis pending...</p>
            ) : (
              upload.team_film_analysis_results.map((result) => (
                <TeamFilmFeedbackCard key={result.id} result={result} />
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

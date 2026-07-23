import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { GameFilmAnalysisResult, Profile } from "../types";
import { getGameFilmUploads, type GameFilmUploadWithAnalysis } from "../lib/gameFilm";
import GameFilmUploadButton from "../components/GameFilmUploadButton";
import GameFilmFeedbackCard from "../components/GameFilmFeedbackCard";
import AnalysisChat from "../components/AnalysisChat";

export default function GameFilm({ profile }: { profile: Profile }) {
  const [uploads, setUploads] = useState<GameFilmUploadWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      setUploads(await getGameFilmUploads());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game film.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnalysisUpdated(uploadId: string, updated: GameFilmAnalysisResult) {
    setUploads((prev) =>
      prev.map((upload) =>
        upload.id !== uploadId
          ? upload
          : {
              ...upload,
              analysis_results: upload.analysis_results.map((result) =>
                result.id === updated.id ? updated : result
              ),
            }
      )
    );
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;

  const visibleUploads = profile.role === "player" ? uploads.filter((u) => u.player_id === profile.id) : uploads;

  return (
    <div>
      <h1>Game Film</h1>
      {profile.role === "player" && (
        <div className="card">
          <p>Upload real game footage for a broad comparison against your chosen NBA player — not tied to a specific drill.</p>
          {!profile.reference_profile_id ? (
            <p>
              You haven't picked a comparison player yet. <Link to="/reference-profiles">Choose one here</Link> before
              uploading.
            </p>
          ) : (
            <GameFilmUploadButton
              playerId={profile.id}
              referenceProfileId={profile.reference_profile_id}
              onDone={() => void loadData()}
            />
          )}
        </div>
      )}
      <div className="card">
        <h2>{profile.role === "coach" ? "Team game film" : "Your game film"}</h2>
        {visibleUploads.length === 0 && <p>No game film uploaded yet.</p>}
        {visibleUploads.map((upload) => (
          <div key={upload.id} className="card">
            {profile.role === "coach" && <p>Player: {upload.users?.name ?? "Unknown"}</p>}
            {(upload.jersey_number || upload.jersey_color) && (
              <p>
                Jersey: #{upload.jersey_number} ({upload.jersey_color})
              </p>
            )}
            <p>Uploaded {new Date(upload.created_at).toLocaleString()}</p>
            {upload.analysis_results.length === 0 ? (
              <>
                <video src={upload.video_url} controls className="game-film-video" />
                <p>Analysis pending...</p>
              </>
            ) : (
              upload.analysis_results.map((result) => (
                <div key={result.id}>
                  <div className="game-film-result">
                    <video src={upload.video_url} controls className="game-film-video" />
                    <GameFilmFeedbackCard result={result} />
                  </div>
                  <AnalysisChat
                    analysisResultId={result.id}
                    canSend={profile.role === "player" && upload.player_id === profile.id}
                    onAnalysisUpdated={(updated) => handleAnalysisUpdated(upload.id, updated)}
                  />
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

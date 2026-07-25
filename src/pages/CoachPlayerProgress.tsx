import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { friendlyError } from "../lib/errorMessages";
import AnalysisHistoryView from "../components/AnalysisHistoryView";

export default function CoachPlayerProgress() {
  const { playerId } = useParams();
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (playerId) void loadPlayer(playerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function loadPlayer(id: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.from("users").select("name").eq("id", id).maybeSingle();
      if (error) throw new Error(friendlyError(error, "Couldn't load this player."));
      if (!data) throw new Error("Player not found.");
      setPlayerName(data.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this player.");
    } finally {
      setLoading(false);
    }
  }

  if (!playerId) return <p>Player not found.</p>;
  if (loading) return <p>Loading...</p>;
  if (error) return <p style={{ color: "#f87171" }}>{error}</p>;

  return (
    <div>
      <h1>{playerName}'s Progress</h1>
      <AnalysisHistoryView playerId={playerId} />
    </div>
  );
}

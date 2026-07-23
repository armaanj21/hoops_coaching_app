import { useEffect, useState } from "react";
import type { Profile, ReferenceProfile } from "../types";
import { getReferenceProfiles, setMyReferenceProfile } from "../lib/gameFilm";
import { updateSessionProfile } from "../lib/auth";

export default function ReferenceProfiles({
  profile,
  onProfileUpdated,
}: {
  profile: Profile;
  onProfileUpdated?: (profile: Profile) => void;
}) {
  const [profiles, setProfiles] = useState<ReferenceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await getReferenceProfiles());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reference profiles.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelect(referenceProfileId: string) {
    setSavingId(referenceProfileId);
    try {
      await setMyReferenceProfile(profile.id, referenceProfileId);
      const updated = { ...profile, reference_profile_id: referenceProfileId };
      updateSessionProfile(updated);
      onProfileUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save your selection.");
    } finally {
      setSavingId(null);
    }
  }

  const profilesByPosition = new Map<string, ReferenceProfile[]>();
  for (const rp of profiles) {
    const list = profilesByPosition.get(rp.position) ?? [];
    list.push(rp);
    profilesByPosition.set(rp.position, list);
  }

  return (
    <div>
      <h1>Reference Profiles</h1>
      <p>Pick a position, then a player at that position, to style your game after.</p>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {!loading && profiles.length === 0 && <p>No profiles loaded yet.</p>}
      {[...profilesByPosition.entries()].map(([position, positionProfiles]) => (
        <div key={position}>
          <h2>{position}</h2>
          {positionProfiles.map((rp) => {
            const isSelected = profile.reference_profile_id === rp.id;
            return (
              <div className="card" key={rp.id}>
                <h3>{rp.name}</h3>
                <p>{rp.summary}</p>
                {profile.role === "player" && (
                  <button onClick={() => handleSelect(rp.id)} disabled={isSelected || savingId === rp.id}>
                    {isSelected ? "Selected" : savingId === rp.id ? "Saving..." : "Style my game after this"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

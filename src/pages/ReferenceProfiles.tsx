import type { Profile, ReferenceProfile } from "../types";

// TODO: fetch from the `reference_profiles` table (seeded in 0003_seed_reference_profiles.sql).
const STUB_PROFILES: ReferenceProfile[] = [];

export default function ReferenceProfiles({ profile: _profile }: { profile: Profile }) {
  return (
    <div>
      <h1>Reference Profiles</h1>
      <p>Pick an NBA player or position to style your game after.</p>
      {STUB_PROFILES.length === 0 && <p>No profiles loaded yet — run the seed migration.</p>}
      {STUB_PROFILES.map((rp) => (
        <div className="card" key={rp.id}>
          <h3>{rp.name}</h3>
          <p>{rp.summary}</p>
        </div>
      ))}
    </div>
  );
}

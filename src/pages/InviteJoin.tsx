import { useState } from "react";
import { joinTeamWithInviteCode } from "../lib/auth";
import type { Profile } from "../types";

export default function InviteJoin({
  profile,
  onUpdated,
}: {
  profile: Profile;
  onUpdated: (profile: Profile) => void;
}) {
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updated = await joinTeamWithInviteCode(profile, code);
    onUpdated(updated);
  }

  return (
    <div className="card">
      <h1>Join a Team</h1>
      <p>Enter the invite code your coach shared with you.</p>
      <form onSubmit={handleSubmit}>
        <input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button type="submit">Join</button>
      </form>
    </div>
  );
}

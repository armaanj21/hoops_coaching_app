import { useState } from "react";
import { signUp } from "../lib/auth";
import type { Profile, Role } from "../types";

export default function SignUp({ onAuthed }: { onAuthed: (profile: Profile) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const profile = await signUp(email, password, name, role);
      onAuthed(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    }
  }

  return (
    <div className="card">
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="player">Player</option>
          <option value="coach">Coach</option>
        </select>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        <button type="submit">Sign up</button>
      </form>
    </div>
  );
}

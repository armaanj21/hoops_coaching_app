import { Link } from "react-router-dom";
import type { Profile } from "../types";

export default function NavBar({ profile, onLogOut }: { profile: Profile; onLogOut: () => void }) {
  const home = profile.role === "coach" ? "/coach" : "/player";

  return (
    <div className="topbar">
      <nav>
        <Link to={home}>Home</Link>
        <Link to="/drills">Drills</Link>
        {profile.role === "player" && <Link to="/progress">Progress</Link>}
        <Link to="/reference-profiles">Reference Profiles</Link>
        <Link to="/game-film">Game Film</Link>
        {profile.role === "coach" && <Link to="/team-film">Team Film</Link>}
        {profile.role === "player" && !profile.team_id && <Link to="/join">Join Team</Link>}
      </nav>
      <div>
        <span style={{ marginRight: "1rem" }}>{profile.name}</span>
        <button onClick={onLogOut}>Log out</button>
      </div>
    </div>
  );
}

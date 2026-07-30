import { NavLink } from "react-router-dom";
import type { Profile } from "../types";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

export default function NavBar({ profile, onLogOut }: { profile: Profile; onLogOut: () => void }) {
  const home = profile.role === "coach" ? "/coach" : "/player";

  const items: NavItem[] = [
    { to: home, label: "Home", icon: "🏠" },
    { to: "/drills", label: "Drills", icon: "🏀" },
    ...(profile.role === "player" ? [{ to: "/progress", label: "Progress", icon: "📈" }] : []),
    { to: "/reference-profiles", label: "Profiles", icon: "👤" },
    { to: "/game-film", label: "Film", icon: "🎥" },
    ...(profile.role === "coach" ? [{ to: "/team-film", label: "Team Film", icon: "🎬" }] : []),
    ...(profile.role === "player" && !profile.team_id ? [{ to: "/join", label: "Join", icon: "➕" }] : []),
  ];

  return (
    <>
      {/* Desktop: full horizontal nav in the top bar, hidden below the mobile breakpoint (see
          index.css) — text links wrapping onto extra lines on a phone isn't a mobile nav, it's a
          shrunk desktop one, which is exactly what the bottom tab bar below replaces. */}
      <div className="topbar">
        <nav className="topbar-nav">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-user">
          <span>{profile.name}</span>
          <button onClick={onLogOut}>Log out</button>
        </div>
      </div>

      {/* Mobile: fixed bottom tab bar — primary nav stays reachable with a thumb without eating
          vertical space at the top of every page. Hidden above the mobile breakpoint. Log out
          deliberately isn't a tab here: it's a secondary, infrequent action, and adding it as a
          7th item pushed the row into horizontal-scroll territory (discovered by testing this at
          actual mobile widths) — bad for a control that's supposed to always be reachable. It
          stays in the slim top bar instead, which remains visible on mobile too. */}
      <nav className="bottom-tabbar">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "tab tab-active" : "tab")}>
            <span className="tab-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="tab-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}

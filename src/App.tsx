import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getSession, logOut } from "./lib/auth";
import type { Profile } from "./types";
import NavBar from "./components/NavBar";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import InviteJoin from "./pages/InviteJoin";
import CoachDashboard from "./pages/CoachDashboard";
import PlayerHome from "./pages/PlayerHome";
import DrillLibrary from "./pages/DrillLibrary";
import DrillDetail from "./pages/DrillDetail";
import PlayerProgress from "./pages/PlayerProgress";
import ReferenceProfiles from "./pages/ReferenceProfiles";
import GameFilm from "./pages/GameFilm";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(getSession());

  function handleAuthed(next: Profile) {
    setProfile(next);
  }

  function handleLogOut() {
    logOut();
    setProfile(null);
  }

  const home = profile?.role === "coach" ? "/coach" : "/player";

  return (
    <BrowserRouter>
      {profile && <NavBar profile={profile} onLogOut={handleLogOut} />}
      <main>
        <Routes>
          <Route path="/login" element={profile ? <Navigate to={home} /> : <Login onAuthed={handleAuthed} />} />
          <Route path="/signup" element={profile ? <Navigate to={home} /> : <SignUp onAuthed={handleAuthed} />} />
          <Route
            path="/join"
            element={profile ? <InviteJoin profile={profile} onUpdated={handleAuthed} /> : <Navigate to="/login" />}
          />
          <Route
            path="/coach"
            element={profile?.role === "coach" ? <CoachDashboard profile={profile} /> : <Navigate to="/login" />}
          />
          <Route
            path="/player"
            element={profile?.role === "player" ? <PlayerHome profile={profile} /> : <Navigate to="/login" />}
          />
          <Route
            path="/drills"
            element={profile ? <DrillLibrary /> : <Navigate to="/login" />}
          />
          <Route
            path="/drills/:drillId"
            element={profile ? <DrillDetail profile={profile} /> : <Navigate to="/login" />}
          />
          <Route
            path="/progress"
            element={profile?.role === "player" ? <PlayerProgress profile={profile} /> : <Navigate to="/login" />}
          />
          <Route
            path="/reference-profiles"
            element={
              profile ? (
                <ReferenceProfiles profile={profile} onProfileUpdated={handleAuthed} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route path="/game-film" element={profile ? <GameFilm profile={profile} /> : <Navigate to="/login" />} />
          <Route path="/" element={<Navigate to={profile ? home : "/login"} />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

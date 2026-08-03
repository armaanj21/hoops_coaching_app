import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getSession, logOut, clearLocalSession } from "./lib/auth";
import { supabase } from "./lib/supabaseClient";
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
import CoachPlayerProgress from "./pages/CoachPlayerProgress";
import ReferenceProfiles from "./pages/ReferenceProfiles";
import GameFilm from "./pages/GameFilm";
import TeamFilm from "./pages/TeamFilm";

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(getSession());
  // The cached profile above is just this app's own lightweight "who am I" record in
  // localStorage — it says nothing about whether the underlying Supabase auth session is still
  // valid. If that session's refresh token has expired or been revoked (realistically: the tab
  // was left logged in across many days of testing), every Supabase query then runs
  // unauthenticated, and RLS silently returns empty results rather than an error — the app looks
  // logged in but quietly shows "no data" everywhere, which is exactly what surfaced as this
  // page's "No profiles loaded yet." with nothing else wrong on screen. Verifying the real
  // session on load (and reacting if it's invalidated later) closes that gap.
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session && getSession()) {
        // No real session behind the cache — nothing to sign out of, and calling
        // supabase.auth.signOut() here can hang indefinitely with no session to act on.
        clearLocalSession();
        setProfile(null);
      }
      setCheckingSession(false);
    }
    void verifySession();

    // supabase-js fires SIGNED_OUT itself when a background token refresh fails (e.g. the
    // refresh token expired or was revoked), not a distinct "refresh failed" event — so this one
    // check also covers that case, not just an explicit signOut() call.
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        logOut();
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAuthed(next: Profile) {
    setProfile(next);
  }

  function handleLogOut() {
    logOut();
    setProfile(null);
  }

  const home = profile?.role === "coach" ? "/coach" : "/player";

  if (checkingSession) return null;

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
            path="/progress/:playerId"
            element={profile?.role === "coach" ? <CoachPlayerProgress /> : <Navigate to="/login" />}
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
          <Route
            path="/team-film"
            element={profile?.role === "coach" ? <TeamFilm profile={profile} /> : <Navigate to="/login" />}
          />
          <Route path="/" element={<Navigate to={profile ? home : "/login"} />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

import { supabase } from "./supabaseClient";
import type { Profile, Role } from "../types";

const SESSION_KEY = "hoops_coaching_profile";

// TODO: wire up to Supabase Auth (auth.signUp / auth.signInWithPassword) + a `profiles`
// table lookup once a real Supabase project exists. Stubbed for scaffold-only scope.
export async function signUp(_email: string, _password: string, name: string, role: Role): Promise<Profile> {
  const profile: Profile = { id: crypto.randomUUID(), role, name, team_id: null };
  saveSession(profile);
  return profile;
}

export async function logIn(_email: string, _password: string): Promise<Profile> {
  const existing = getSession();
  if (existing) return existing;
  throw new Error("Not implemented: wire up supabase.auth.signInWithPassword once Supabase is configured.");
}

export async function joinTeamWithInviteCode(profile: Profile, inviteCode: string): Promise<Profile> {
  // TODO: look up team by invite_code via `supabase.from("teams")` and set team_id on the profile row.
  const updated: Profile = { ...profile, team_id: inviteCode ? `team-${inviteCode}` : profile.team_id };
  saveSession(updated);
  return updated;
}

export function logOut() {
  localStorage.removeItem(SESSION_KEY);
  void supabase.auth.signOut();
}

export function getSession(): Profile | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

function saveSession(profile: Profile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

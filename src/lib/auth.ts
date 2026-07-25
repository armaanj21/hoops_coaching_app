import { supabase } from "./supabaseClient";
import { friendlyError } from "./errorMessages";
import type { Profile, Role } from "../types";

const SESSION_KEY = "hoops_coaching_profile";

export async function signUp(email: string, password: string, name: string, role: Role): Promise<Profile> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(friendlyError(error, "Couldn't create your account. Please try again."));
  const userId = data.user?.id;
  if (!userId) throw new Error("Sign up did not return a user — check your email to confirm, then log in.");

  const { error: userInsertError } = await supabase
    .from("users")
    .insert({ id: userId, role, name, team_id: null });
  if (userInsertError) {
    throw new Error(friendlyError(userInsertError, "Couldn't finish creating your account. Please try again."));
  }

  let teamId: string | null = null;
  if (role === "coach") {
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({ coach_id: userId, name: `${name}'s Team` })
      .select("id")
      .single();
    if (teamError) throw new Error(friendlyError(teamError, "Couldn't set up your team. Please try again."));
    teamId = team.id;

    const { error: updateError } = await supabase.from("users").update({ team_id: teamId }).eq("id", userId);
    if (updateError) throw new Error(friendlyError(updateError, "Couldn't finish setting up your team."));
  }

  const profile: Profile = { id: userId, role, name, team_id: teamId, reference_profile_id: null };
  saveSession(profile);
  return profile;
}

export async function logIn(email: string, password: string): Promise<Profile> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyError(error, "Couldn't log you in. Please check your email and password."));
  const userId = data.user?.id;
  if (!userId) throw new Error("Login did not return a user.");

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, role, name, team_id, reference_profile_id")
    .eq("id", userId)
    .maybeSingle();
  if (userError) throw new Error(friendlyError(userError, "Couldn't load your profile. Please try again."));
  if (!userRow) {
    throw new Error(
      "No profile found for this account. Signup may not have finished — please sign up again or contact support."
    );
  }

  const profile: Profile = userRow as Profile;
  saveSession(profile);
  return profile;
}

export async function joinTeamWithInviteCode(profile: Profile, inviteCode: string): Promise<Profile> {
  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("invite_code", inviteCode)
    .single();
  if (teamError) throw new Error("Invalid invite code.");

  const { error: updateError } = await supabase.from("users").update({ team_id: team.id }).eq("id", profile.id);
  if (updateError) throw new Error(friendlyError(updateError, "Couldn't join that team. Please try again."));

  const updated: Profile = { ...profile, team_id: team.id };
  saveSession(updated);
  return updated;
}

export function logOut() {
  localStorage.removeItem(SESSION_KEY);
  void supabase.auth.signOut();
}

export function updateSessionProfile(profile: Profile): void {
  saveSession(profile);
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

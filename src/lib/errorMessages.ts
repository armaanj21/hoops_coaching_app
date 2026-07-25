// Translates raw Postgres/PostgREST/Storage/Auth/Edge-Function errors into plain-language
// messages before they ever reach the UI. Supabase errors carry syntax like "duplicate key value
// violates unique constraint \"users_pkey\"" or "new row violates row-level security policy" —
// meaningless to a player or coach, and a minor info leak about the schema. Unrecognized errors
// fall back to a caller-supplied, context-specific message rather than the raw one; the original
// is still logged to the console for debugging.

interface ErrorLike {
  message?: string;
  code?: string;
}

// A handful of Supabase Auth messages are already written for end users (e.g. "Invalid login
// credentials", "User already registered") — pass those through instead of masking them.
const AUTH_PASSTHROUGH_PATTERNS = [
  /invalid login credentials/i,
  /user already registered/i,
  /password should be at least/i,
  /email not confirmed/i,
  /signups? (are )?not allowed/i,
  /for security purposes, you can only request this after/i,
  /unable to validate email address/i,
];

const POSTGRES_CODE_MESSAGES: Record<string, string> = {
  "23505": "That already exists — please try a different value.",
  "23503": "That action refers to something that no longer exists. Try refreshing the page.",
  "42501": "You don't have permission to do that.",
  PGRST116: "We couldn't find that record — it may have been removed.",
  PGRST301: "Your session has expired — please log in again.",
};

export function friendlyError(err: unknown, fallback: string): string {
  if (typeof err !== "object" || err === null) return fallback;
  const e = err as ErrorLike;

  if (e.code && POSTGRES_CODE_MESSAGES[e.code]) return POSTGRES_CODE_MESSAGES[e.code];

  const message = typeof e.message === "string" ? e.message : "";

  if (AUTH_PASSTHROUGH_PATTERNS.some((pattern) => pattern.test(message))) return message;

  if (/failed to fetch|network ?error|network request failed/i.test(message)) {
    return "Couldn't reach the server — check your connection and try again.";
  }
  if (/row-level security|permission denied/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (/duplicate key value violates unique constraint/i.test(message)) {
    return "That already exists — please try a different value.";
  }
  if (/violates foreign key constraint/i.test(message)) {
    return "That action refers to something that no longer exists. Try refreshing the page.";
  }
  if (/jwt expired|invalid jwt/i.test(message)) {
    return "Your session has expired — please log in again.";
  }
  if (/the resource already exists/i.test(message)) {
    return "A file with that name already exists — please try again.";
  }
  if (/payload too large|exceeded the maximum allowed size/i.test(message)) {
    return "That file is too large to upload.";
  }
  if (/mime type .* is not supported/i.test(message)) {
    return "That file type isn't supported — please upload a video file.";
  }
  if (/edge function returned a non-2xx status code|failed to send a request to the edge function/i.test(message)) {
    return "The analysis service is temporarily unavailable — please try again in a moment.";
  }

  if (message) console.error("[hoops-coaching] unhandled error:", err);
  return fallback;
}

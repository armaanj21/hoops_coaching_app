import { supabase } from "../supabaseClient";
import { friendlyError } from "../errorMessages";

// Shared by every analysis client: calls the claude-analysis Edge Function instead of the
// Anthropic API directly, so the API key lives only as a Supabase secret, never in the client
// bundle. supabase.functions.invoke automatically attaches the current session's auth header,
// which the function's verify_jwt setting requires.
export async function callClaudeAnalysis<T>(
  model: string,
  maxTokens: number,
  schema: Record<string, unknown>,
  messages: unknown[]
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<{ text: string }>("claude-analysis", {
    body: { model, max_tokens: maxTokens, schema, messages },
  });
  if (error) {
    throw new Error(friendlyError(error, "The analysis service is temporarily unavailable — please try again in a moment."));
  }
  if (!data?.text) throw new Error("The analysis didn't come back correctly — please try again.");
  return JSON.parse(data.text) as T;
}

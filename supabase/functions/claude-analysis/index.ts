import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Generic proxy for Claude structured-output calls: the frontend builds the same
// messages/schema shape it used to hand directly to the Anthropic SDK, and this function
// makes the actual API call server-side so ANTHROPIC_API_KEY never reaches the browser.
// verify_jwt (set at deploy time) already requires a valid Supabase session, so every caller
// is an authenticated app user.

interface ClaudeAnalysisRequest {
  model: string;
  max_tokens: number;
  schema: Record<string, unknown>;
  messages: unknown[];
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: ClaudeAnalysisRequest;
  try {
    body = (await req.json()) as ClaudeAnalysisRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!body.model || !body.max_tokens || !body.schema || !body.messages) {
    return new Response(JSON.stringify({ error: "Missing model, max_tokens, schema, or messages" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,
      max_tokens: body.max_tokens,
      output_config: { format: { type: "json_schema", schema: body.schema } },
      messages: body.messages,
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    return new Response(JSON.stringify({ error: `Anthropic API error: ${errorText}` }), {
      status: anthropicResponse.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const result = await anthropicResponse.json();
  const textBlock = (result.content ?? []).find((b: { type: string }) => b.type === "text");
  if (!textBlock) {
    return new Response(JSON.stringify({ error: "No text response from Claude" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ text: textBlock.text }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});

// Self-service "forgot password". Resolves username -> the employee's real Supabase Auth
// email entirely server-side (via profiles.email, service_role — same lookup as
// supabase/functions/login/index.ts) and asks Supabase to send the recovery email, without
// ever telling the browser what that email is. Always returns the exact same response
// regardless of whether the username matched an account, so an unauthenticated caller can
// never use this to enumerate valid usernames.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_MESSAGE = "If that account exists, a recovery email has been sent.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Same normalization as login/index.ts: trim + lowercase, no format regex — the lookup
  // below is the actual source of truth for whether a username is real.
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!username) return json({ error: "Username is required." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("username", username)
    .maybeSingle();

  if (profile?.email) {
    // resetPasswordForEmail is an anon-level operation — same privilege tier as the actual
    // sign-in call in login/index.ts. The service-role client above is only ever used for
    // the username -> email lookup, never for the recovery send itself.
    const anon = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const origin = req.headers.get("origin");
    await anon.auth.resetPasswordForEmail(
      profile.email,
      origin ? { redirectTo: `${origin}/reset-password` } : undefined,
    );
  }

  // Deliberately identical response whether or not `profile` was found above, and
  // regardless of whether resetPasswordForEmail itself succeeded — any difference here
  // would let an unauthenticated caller learn which usernames exist.
  return json({ message: GENERIC_MESSAGE });
});

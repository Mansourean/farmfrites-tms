// Username + password login. Resolves the username to the employee's real Supabase Auth
// email entirely server-side (via profiles.email — see
// supabase/migrations/0003_profile_email_sync.sql) so the browser never learns any
// employee's real email address, before or after a login attempt — only the resulting
// session, and only if the credentials were actually correct.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Always the same message and status, regardless of whether the username doesn't exist,
// has no email on file, or the password is wrong — the point of this function is to never
// give an unauthenticated caller any signal about which of those is true.
const GENERIC_ERROR = "Incorrect username or password.";

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

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return json({ error: GENERIC_ERROR }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // profiles.username is always stored lowercase (enforced by admin-users' normalizeUsername
  // on create/update, and by the profiles_username_lower_idx unique index), so a plain
  // case-sensitive match against the already-lowercased input is correct here.
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("username", username)
    .maybeSingle();

  if (!profile?.email) return json({ error: GENERIC_ERROR }, 400);

  // The actual credential check is a normal anon-level operation — the same one the browser
  // would call directly if it knew the email. Using the anon key (not service_role) for it
  // keeps the service-role client's use limited to exactly the one thing that needs it: the
  // username -> email lookup.
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({
    email: profile.email,
    password,
  });

  if (signInError || !signInData.session) {
    return json({ error: GENERIC_ERROR }, 400);
  }

  return json({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });
});

// Admin-only user management (create / update / resetPassword / delete).
//
// Runs with the service_role key, which must never reach the browser — this
// function is the only place that key is used. Every call is re-verified
// server-side against the caller's own profile (role='admin', status='active')
// before doing anything, regardless of what the client claims.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function normalizeUsername(raw: string) {
  const username = (raw ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new Error("Username must be 3-32 characters: lowercase letters, numbers, dots, underscores, or hyphens.");
  }
  return username;
}

function normalizeEmail(raw: string) {
  const email = (raw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new Error("Please enter a valid email address.");
  }
  return email;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing Authorization header" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerAuth, error: callerAuthError } = await anon.auth.getUser(jwt);
  if (callerAuthError || !callerAuth?.user) return json({ error: "Invalid session" }, 401);

  const { data: callerProfile, error: callerProfileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", callerAuth.user.id)
    .single();

  if (callerProfileError || !callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "active") {
    return json({ error: "Admins only" }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action } = body;

  try {
    switch (action) {
      case "create": {
        const { fullName, username: rawUsername, email: rawEmail, password, role } = body as {
          fullName: string;
          username: string;
          email: string;
          password: string;
          role: string;
        };
        const username = normalizeUsername(rawUsername);
        const email = normalizeEmail(rawEmail);
        if (!fullName?.trim() || !password?.trim() || !role) {
          return json({ error: "Please fill in every field." }, 400);
        }

        const { data: existing } = await admin
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        if (existing) return json({ error: "That username is already in use." }, 409);

        const { data: created, error: createError } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createError || !created?.user) {
          return json({ error: createError?.message ?? "Could not create user." }, 400);
        }

        const { error: profileError } = await admin.from("profiles").insert({
          id: created.user.id,
          full_name: fullName.trim(),
          username,
          email,
          role,
          status: "active",
        });
        if (profileError) {
          await admin.auth.admin.deleteUser(created.user.id);
          const message = profileError.code === "23505" ? "That username is already in use." : profileError.message;
          return json({ error: message }, 409);
        }

        return json({
          user: { id: created.user.id, fullName: fullName.trim(), username, email, role, status: "active" },
        });
      }

      case "update": {
        const { id, fullName, username: rawUsername, email: rawEmail, role } = body as {
          id: string;
          fullName: string;
          username: string;
          email: string;
          role: string;
        };
        if (!id) return json({ error: "Missing user id." }, 400);
        const username = normalizeUsername(rawUsername);
        const email = normalizeEmail(rawEmail);
        if (!fullName?.trim() || !role) return json({ error: "Please fill in every field." }, 400);

        const { data: existingUsername } = await admin
          .from("profiles")
          .select("id")
          .eq("username", username)
          .maybeSingle();
        if (existingUsername && existingUsername.id !== id) {
          return json({ error: "That username is already in use." }, 409);
        }

        // Username and email are independent identifiers now — changing one must never
        // touch the other. Only call updateUserById when the email itself actually changed.
        const { data: currentProfile } = await admin.from("profiles").select("email").eq("id", id).maybeSingle();
        if (!currentProfile) return json({ error: "User not found." }, 404);

        if (currentProfile.email !== email) {
          const { error: emailError } = await admin.auth.admin.updateUserById(id, { email });
          if (emailError) return json({ error: emailError.message }, 400);
        }

        const { error: profileError } = await admin
          .from("profiles")
          .update({ full_name: fullName.trim(), username, email, role })
          .eq("id", id);
        if (profileError) {
          const message =
            profileError.code === "23505" ? "That username or email is already in use." : profileError.message;
          return json({ error: message }, 409);
        }

        return json({ ok: true });
      }

      case "resetPassword": {
        const { id, password } = body as { id: string; password: string };
        if (!id || !password?.trim()) return json({ error: "Enter a new password." }, 400);

        const { error } = await admin.auth.admin.updateUserById(id, { password: password.trim() });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "delete": {
        const { id } = body as { id: string };
        if (!id) return json({ error: "Missing user id." }, 400);
        if (id === callerAuth.user.id) return json({ error: "You cannot delete your own account." }, 400);

        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 400);
  }
});

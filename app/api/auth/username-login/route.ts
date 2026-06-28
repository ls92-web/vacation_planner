import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ===== Secure username → email login lookup =====
// Supabase only signs in by email, so logging in by username requires resolving
// the username to its email. Doing that resolution in the browser (the old
// `get_email_for_username` anon RPC) let ANYONE map usernames → emails — a
// username/email enumeration vector.
//
// This server-only route closes that hole:
//   • The username→email lookup runs here with the SERVICE-ROLE key, which is
//     never sent to the browser. (`get_email_for_username`'s anon grant is
//     revoked, so the public key can no longer call it.)
//   • Password verification also happens server-side; the email is NEVER returned.
//   • Every response is the same generic error, so callers can't tell whether a
//     username exists or whether it was the password that was wrong.
//   • Per-IP and per-username rate limits blunt brute-force / enumeration abuse.
// On success we return only the session tokens, which the client hands to
// supabase.auth.setSession() — exactly the tokens the browser would hold anyway.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Identical message for every failure → no username/credential enumeration.
const GENERIC = "Invalid username or password.";

// In-memory sliding-window limiter (per server instance).
const hits = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON || !SERVICE_ROLE) {
    // Service-role key not configured on the server — fail closed, don't fall back.
    return NextResponse.json({ error: "Username login is unavailable. Sign in with your email." }, { status: 503 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: GENERIC }, { status: 400 });
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) return NextResponse.json({ error: GENERIC }, { status: 401 });

  const ip = clientIp(req);
  if (!rateLimit(`ulogin:ip:${ip}`, 10, 60_000) || !rateLimit(`ulogin:user:${username.toLowerCase()}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many attempts — please wait a minute." }, { status: 429 });
  }

  try {
    // 1) Resolve username → email with the service role (server-only).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: email, error: rpcErr } = await admin.rpc("get_email_for_username", { p_username: username });
    if (rpcErr || !email || typeof email !== "string") {
      return NextResponse.json({ error: GENERIC }, { status: 401 }); // never reveal "no such username"
    }

    // 2) Verify the password with an anon client (sign-in only, no session persisted here).
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn, error: siErr } = await anon.auth.signInWithPassword({ email, password });
    if (siErr || !signIn.session) {
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }

    // 3) Hand the session tokens back; the email is never exposed.
    return NextResponse.json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    });
  } catch (err) {
    console.error("[auth/username-login]", err);
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Secure username -> email login. Resolves the email server-side with the service
// role (auto-injected into edge functions), verifies the password, and returns
// ONLY session tokens. The email is never returned; every failure is generic so
// callers can't enumerate usernames. Rate-limited per IP + username.
const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const URL_ = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GENERIC = "Invalid username or password.";
const json = (o: unknown, status = 200) => Response.json(o, { status, headers: cors });

const hits = new Map<string, number[]>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now); hits.set(key, recent); return true;
}
function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  return xff.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!URL_ || !ANON || !SR) return json({ error: "Username login is unavailable. Sign in with your email." }, 503);
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) return json({ error: GENERIC }, 401);
  const ip = clientIp(req);
  if (!rateLimit(`ip:${ip}`, 10, 60_000) || !rateLimit(`u:${username.toLowerCase()}`, 5, 60_000)) return json({ error: "Too many attempts — please wait a minute." }, 429);
  try {
    const rpc = await fetch(`${URL_}/rest/v1/rpc/get_email_for_username`, { method: "POST", headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_username: username }) });
    if (!rpc.ok) return json({ error: GENERIC }, 401);
    const email = await rpc.json();
    if (!email || typeof email !== "string") return json({ error: GENERIC }, 401);
    const tok = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!tok.ok) return json({ error: GENERIC }, 401);
    const data = await tok.json();
    if (!data.access_token || !data.refresh_token) return json({ error: GENERIC }, 401);
    return json({ access_token: data.access_token, refresh_token: data.refresh_token }, 200);
  } catch (e) { console.error("[username-login]", e); return json({ error: GENERIC }, 401); }
});

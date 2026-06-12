// api/verify-fn.js — Vercel serverless function
// Verifies whether a FieldNation provider/user ID is real.
//
// Two modes, tried in order:
//  1. OFFICIAL API — if FN_CLIENT_ID + FN_CLIENT_SECRET env vars are set,
//     uses FieldNation's OAuth2 client-credentials flow to call
//     GET /api/users/{id} and returns the provider's name/role/status.
//  2. PUBLIC PAGE FALLBACK — no credentials configured: fetches /p/{id}
//     unauthenticated and infers valid/invalid from status + redirect.
//     Least reliable since app.fieldnation.com requires login — for
//     definitive checks, use the "Open All Profiles" button in the UI,
//     which opens each ID's profile in your logged-in browser session.
//
// POST body: { ids: ["12345", "67890", ...] }
// Response:  { results: [{ id, status: "valid"|"invalid"|"unknown", name, role, source }] }

const FN_API_BASE = "https://api.fieldnation.com";
const FN_TOKEN_URL = "https://api.fieldnation.com/oauth/token";
const FN_PROFILE_URL = (id) => `https://app.fieldnation.com/p/${id}`;

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getApiToken() {
  const clientId = process.env.FN_CLIENT_ID;
  const clientSecret = process.env.FN_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiry - 30_000) return cachedToken;

  try {
    const res = await fetch(FN_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.access_token) return null;
    cachedToken = data.access_token;
    cachedTokenExpiry = now + (Number(data.expires_in) || 3600) * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

async function verifyViaApi(id, token) {
  try {
    const res = await fetch(`${FN_API_BASE}/api/users/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (res.status === 404) {
      return { id, status: "invalid", name: "", role: "", source: "api" };
    }
    if (!res.ok) {
      return { id, status: "unknown", name: "", role: "", source: "api", error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (!data || !data.id) {
      return { id, status: "invalid", name: "", role: "", source: "api" };
    }
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    return { id, status: "valid", name, role: data.role_type || "", source: "api" };
  } catch (e) {
    return { id, status: "unknown", name: "", role: "", source: "api", error: e.message };
  }
}

async function verifyViaPublicPage(id) {
  try {
    const res = await fetch(FN_PROFILE_URL(id), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CPWOG-Verify/1.0)" },
      redirect: "follow",
    });

    // A hard 404 means the ID itself is invalid/doesn't exist
    if (res.status === 404) {
      return { id, status: "invalid", name: "", role: "", source: "page" };
    }
    if (res.status >= 500) {
      return { id, status: "unknown", name: "", role: "", source: "page", error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const lower = html.toLowerCase();
    const finalUrl = res.url || "";

    // Explicit "not found" content — invalid ID
    const notFoundMarkers = ["page not found", "user not found", "profile not found", "doesn't exist", "does not exist", "we can't find that"];
    if (notFoundMarkers.some(m => lower.includes(m))) {
      return { id, status: "invalid", name: "", role: "", source: "page" };
    }

    // app.fieldnation.com requires login — an unauthenticated request to a VALID
    // profile typically redirects to /login (or similar) but PRESERVES a redirect
    // target referencing the id, while an INVALID id is more likely to bounce to
    // a generic dashboard/404. Treat a login redirect that still references the
    // requested id as "exists, but login required to view details".
    const redirectedToLogin = /\/(login|signin|sign-in|auth)/i.test(finalUrl) || lower.includes("log in") || lower.includes("sign in");
    if (redirectedToLogin) {
      if (finalUrl.includes(`/p/${id}`) || lower.includes(`/p/${id}`)) {
        return { id, status: "valid", name: "", role: "", source: "page", note: "exists — login required for details" };
      }
      return { id, status: "unknown", name: "", role: "", source: "page", note: "redirected to login, couldn't confirm ID" };
    }

    // Try to pull a name out of <title> or og:title meta tag
    let name = "";
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) name = ogMatch[1].trim();
    else if (titleMatch) name = titleMatch[1].replace(/\s*\|\s*Field\s*Nation.*$/i, "").trim();

    // If we landed on a generic page with no useful title, treat as unknown
    if (!name || /^(field\s*nation|login|sign\s*in|dashboard)$/i.test(name)) {
      return { id, status: "unknown", name: "", role: "", source: "page" };
    }

    return { id, status: "valid", name, role: "", source: "page" };
  } catch (e) {
    return { id, status: "unknown", name: "", role: "", source: "page", error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST required" });

  let ids;
  try {
    ids = req.body?.ids;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }
  // Cap batch size to avoid timeouts
  const batch = ids.slice(0, 25).map(id => String(id).trim()).filter(Boolean);

  const token = await getApiToken();

  let results, mode;
  if (token) {
    results = await Promise.all(batch.map(id => verifyViaApi(id, token)));
    mode = "api";
  } else {
    results = await Promise.all(batch.map(id => verifyViaPublicPage(id)));
    mode = "page";
  }

  res.status(200).json({ results, mode });
}

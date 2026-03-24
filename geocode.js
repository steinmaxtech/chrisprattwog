// api/geocode.js — Vercel serverless function
// Proxies to US Census Geocoder to avoid CORS issues
// Supports single address (?address=...) and batch (POST with JSON array)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const CENSUS_BASE = "https://geocoding.geo.census.gov/geocoder/locations";
  const BENCHMARK  = "Public_AR_Current";

  // ── BATCH: POST { addresses: [{id, street, city, state, zip}, ...] } ──────
  if (req.method === "POST") {
    try {
      const { addresses } = req.body;
      if (!Array.isArray(addresses) || addresses.length === 0) {
        return res.status(400).json({ error: "addresses array required" });
      }

      // Build CSV for Census batch endpoint
      // Format: Unique ID, Street address, City, State, ZIP
      const csvLines = addresses.map(a =>
        `${a.id},"${(a.street || "").replace(/"/g, "")}","${(a.city || "").replace(/"/g, "")}","${a.state || ""}","${a.zip || ""}"`
      );
      const csvContent = csvLines.join("\n");

      // Census batch endpoint requires multipart/form-data
      const formData = new FormData();
      const blob = new Blob([csvContent], { type: "text/csv" });
      formData.append("addressFile", blob, "addresses.csv");
      formData.append("benchmark", BENCHMARK);
      formData.append("returntype", "locations");

      const censusRes = await fetch(`${CENSUS_BASE}/addressbatch`, {
        method: "POST",
        body: formData,
      });

      if (!censusRes.ok) {
        const txt = await censusRes.text();
        return res.status(502).json({ error: "Census API error", detail: txt });
      }

      // Response is CSV: ID, input addr, match, matchtype, matched addr, coords, tigerID, side
      const text = await censusRes.text();
      const lines = text.trim().split("\n").filter(Boolean);

      const results = lines.map(line => {
        // Parse CSV line (Census uses comma-separated, some fields may be quoted)
        const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
        const id       = cols[0];
        const matched  = (cols[2] || "").toLowerCase() === "match";
        const matchAddr = cols[4] || "";
        const coords   = cols[5] || "";

        // Parse matched address back into components
        // Format: "123 MAIN ST, DENVER, CO, 80201"
        let address = "", city = "", state = "", zip = "";
        if (matched && matchAddr) {
          const parts = matchAddr.split(",").map(p => p.trim());
          address = parts[0] ? toTitleCase(parts[0]) : "";
          city    = parts[1] ? toTitleCase(parts[1]) : "";
          state   = parts[2] || "";
          zip     = parts[3] || "";
        }

        const [lng, lat] = coords.split(",").map(Number);

        return { id, matched, address, city, state, zip, lat, lng };
      });

      return res.status(200).json({ results });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── SINGLE: GET ?address=... ───────────────────────────────────────────────
  if (req.method === "GET") {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "address param required" });

    try {
      const url = `${CENSUS_BASE}/onelineaddress?address=${encodeURIComponent(address)}&benchmark=${BENCHMARK}&format=json`;
      const censusRes = await fetch(url);
      if (!censusRes.ok) throw new Error(`Census returned ${censusRes.status}`);
      const data = await censusRes.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// api/ai.js — Vercel serverless function

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured in Vercel env vars" });

  const { sampleData } = req.body || {};
  if (!sampleData?.trim()) return res.status(400).json({ error: "sampleData required" });

  // Pre-process: split into rows and label every column with its index
  const raw = sampleData.trim();
  const firstLine = raw.split("\n")[0];
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const delimLabel = firstLine.includes("\t") ? "tab" : "comma";

  const rows = raw.split("\n").slice(0, 6).filter(l => l.trim()).map(line => {
    const cols = line.split(delim).map(c => c.replace(/^"|"$/g, "").trim());
    return cols.map((c, i) => `  col[${i}] = "${c}"`).join("\n");
  });

  const annotated = rows.map((r, i) => `ROW ${i}:\n${r}`).join("\n\n");

  const prompt = `You are analyzing spreadsheet export data to figure out which columns contain the information needed for a FieldNation work order upload.

Here is the raw data, with each column labeled by its index:

${annotated}

Your job is to identify which column index (0-based integer) holds each of these 7 values. Think through each column carefully — most columns will be irrelevant (region, timezone, quarter, status, boolean flags, duplicate/combined address strings, service lists, etc.) and should be skipped.

The 7 values you must find:

SITE CODE — A short unique identifier for the physical location. Usually 2–8 uppercase alphanumeric characters. Examples from real data: "FB01", "B015", "X382", "UEAA", "Y836", "FB2F". It is NOT a full name, NOT a number-only ID, NOT an address. Typically the very first column.

BRANCH NAME — The human-readable name of the branch or location. Examples: "Linden", "Green Valley Ranch", "Downers Grove South", "Harbor East". Often the second column. May be blank or missing in some formats.

STREET ADDRESS — The street address ONLY, no city/state/zip. Examples: "2700 Cleveland Ave", "835 S Randall Rd", "1939 W 25th St", "509 S Exeter St". This is NEVER a combined string like "2700 Cleveland Ave, Columbus, OH, 43211" — that would be a duplicate/full address column to skip.

CITY — City name only. Examples: "Columbus", "Elgin", "Chicago", "Kalamazoo", "Forestville".

STATE — Exactly 2 uppercase letters. Examples: "OH", "IL", "CO", "TX", "MD", "FL".

ZIP — 5-digit zip code. Examples: "43211", "60123", "80021", "20747". Skip if not present.

DATE — A scheduled date if present. Format like "03/24/26", "4/2/2026", "3/30/2026". Often missing — return "" if not found. Do NOT use quarter codes like "1H2026" as a date.

COLUMNS TO ALWAYS SKIP (never assign these to any field):
- Region/timezone strings like "1 - Eastern", "3 - Mountain", "Central"
- Quarter codes like "1H2026", "2H2025"
- Boolean values: "true", "false"  
- Status words: "Scheduled", "Pending", "Active"
- Full combined address strings that include city+state+zip together
- Service/scope lists like "Network Cabinet", "Physical Security"
- Any column that duplicates information already mapped to another field

Now reason through it step by step, then return ONLY this JSON (no markdown, no explanation):
{"name":"<short descriptive name>","delim":"${delimLabel}","signal":"<one sentence: what makes this format detectable>","colCode":"<index or empty string>","colBranch":"<index or empty string>","colAddr":"<index or empty string>","colCity":"<index or empty string>","colState":"<index or empty string>","colZip":"<index or empty string>","colDate":"<index or empty string>"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, rawText);
      return res.status(502).json({ error: `Anthropic returned ${response.status}`, detail: rawText.slice(0, 400) });
    }

    const data = JSON.parse(rawText);
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");

    // Extract JSON from response — handle any surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("ai.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}

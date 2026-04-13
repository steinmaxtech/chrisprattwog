// api/ai.js — Vercel serverless function
// Proxies parser-detection requests to Anthropic API
// Keeps ANTHROPIC_API_KEY server-side, never exposed to browser

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured — add it in Vercel environment variables" });
  }

  const { sampleData } = req.body || {};
  if (!sampleData?.trim()) {
    return res.status(400).json({ error: "sampleData required" });
  }

  // Number every column so the AI can reference them precisely
  const labeledData = sampleData.trim().split("\n").slice(0, 5).map(line => {
    const delim = line.includes("\t") ? "\t" : ",";
    const cols = line.split(delim);
    return cols.map((c, i) => `[${i}]=${c.trim()}`).join("  ");
  }).join("\n");

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
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `You are helping configure a FieldNation work order CSV generator. It needs to extract exactly 7 fields from pasted spreadsheet rows. Your job is to find which column index (0-based) contains each field.

THE 7 FIELDS WE NEED:
1. code — The site/building code. Short alphanumeric identifier, usually 2-6 chars. Examples: FB01, B015, X382, UEAA, C202, Y836. Always in the first 1-2 columns.
2. branchName — The human-readable branch or location name. Examples: "Linden", "Green Valley Ranch", "Downers Grove South". May be blank/missing.
3. address — Street address ONLY. Examples: "2700 Cleveland Ave", "835 S Randall Rd", "1939 W 25th St". No city/state/zip.
4. city — City name only. Examples: "Columbus", "Elgin", "Chicago".
5. state — 2-letter state abbreviation. Examples: "OH", "IL", "CO", "TX".
6. zip — 5-digit ZIP code. Examples: "43211", "60123", "80021".
7. date — Scheduled date if present. Format MM/DD/YY or MM/DD/YYYY. Examples: "03/24/26", "4/2/2026". Often missing — use "" if not found.

IMPORTANT RULES:
- Column indices are 0-based (first column = 0)
- If a field is not present in the data, return "" for that column index
- Do NOT use a column for multiple fields
- The address field should contain ONLY the street address, not city/state/zip combined
- Ignore columns containing: region names, timezone, quarter codes (like "1H2026"), boolean values (true/false), full combined addresses, status words like "Scheduled"
- Return delimiter as "tab" or "comma"

Here is the sample data with column indices labeled:
${labeledData}

Respond with ONLY this JSON, no explanation, no markdown fences:
{"name":"short descriptive name for this format","delim":"tab","signal":"one sentence describing the key detection signal","colCode":"0","colBranch":"1","colAddr":"2","colCity":"3","colState":"4","colZip":"5","colDate":""}`
        }]
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, rawText);
      return res.status(502).json({
        error: `Anthropic returned ${response.status}`,
        detail: rawText.slice(0, 300)
      });
    }

    const data = JSON.parse(rawText);
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error("ai.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}

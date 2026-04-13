// api/ai.js — Vercel serverless function
// Proxies AI parser detection to Anthropic, keeps key server-side

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

  // Label every column so the AI reasons about positions, not raw text
  const raw = sampleData.trim();
  const firstLine = raw.split("\n")[0];
  const isTab = firstLine.includes("\t");
  const delim = isTab ? "\t" : ",";
  const delimLabel = isTab ? "tab" : "comma";

  const annotated = raw.split("\n").slice(0, 6).filter(l => l.trim()).map((line, ri) => {
    const cols = line.split(delim).map(c => c.replace(/^"|"$/g, "").trim());
    return `ROW ${ri}:\n${cols.map((c, i) => `  col[${i}] = "${c}"`).join("\n")}`;
  }).join("\n\n");

  const prompt = `You are analyzing exported spreadsheet rows to find which columns hold work order location data. Each column is labeled with its 0-based index.

DATA:
${annotated}

Find the column index for each of these fields. Most columns will be irrelevant — skip them.

SITE CODE: Short unique location ID, 2-8 uppercase alphanumeric chars. Real examples: "FB01", "B015", "X382", "FB2F", "UEAA". Almost always col[0]. Never a full name or numbers-only ID.

BRANCH NAME: Human-readable location name. Examples: "Linden", "Green Valley Ranch", "Harbor East", "Downers Grove South". Often col[1]. Use "" if absent.

ADDRESS — two possibilities, pick one:
  A) SEPARATE: street address in one col, city in another, state (2 letters) in another, zip (5 digits) in another → set colAddr, colCity, colState, colZip
  B) COMBINED: one column contains full address like "13600 Colorado Blvd, Thornton, CO, 80602" or "509 S Exeter St, Baltimore, MD 21202" → set colFullAddr to that index, leave colAddr/colCity/colState/colZip as ""

DATE: Scheduled date like "04/06/26", "3/30/2026", "03/24/26". Use "" if absent. Never use quarter codes like "1H2026".

ALWAYS IGNORE these column types: region/timezone strings, quarter codes (1H2026), true/false booleans, status words (Scheduled/Pending), service lists, duplicate combined address strings.

Return ONLY this JSON with no explanation and no markdown:
{"name":"short descriptive name","delim":"${delimLabel}","signal":"one sentence detection signal","colCode":"","colBranch":"","colAddr":"","colCity":"","colState":"","colZip":"","colDate":"","colFullAddr":""}`;

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
        max_tokens: 600,
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
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return valid JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error("ai.js error:", err);
    return res.status(500).json({ error: err.message });
  }
}

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
          content: `You are a data parser expert. Analyze this pasted spreadsheet data and determine the column mapping for a FieldNation work order generator.

The fields we need to extract are:
- code: building/site code (short alphanumeric like FB01, B015, X382)
- branchName: branch or location name
- address: street address
- city: city name
- state: 2-letter state code
- zip: 5-digit zip code
- date: scheduled date (MM/DD/YYYY or similar)

Sample data:
\`\`\`
${sampleData.trim().slice(0, 800)}
\`\`\`

Respond with ONLY valid JSON, no explanation, no markdown:
{"name":"descriptive name","delim":"tab or comma","signal":"how to detect this format","colCode":"0","colBranch":"1","colAddr":"2","colCity":"3","colState":"4","colZip":"5","colDate":""}`
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

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
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
  }

  const { sampleData } = req.body;
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
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

Respond with ONLY valid JSON in this exact format, no explanation:
{
  "name": "descriptive name for this format",
  "delim": "tab" or "comma",
  "signal": "brief description of how to detect this format",
  "colCode": column index as string (0-based) or "" if not found,
  "colBranch": column index as string or "",
  "colAddr": column index as string or "",
  "colCity": column index as string or "",
  "colState": column index as string or "",
  "colZip": column index as string or "",
  "colDate": column index as string or ""
}`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: "Anthropic API error", detail: err });
    }

    const data = await response.json();
    const text = (data.content || [])
      .filter(b => b.type === "text")
      .map(b => b.text)
      .join("");

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

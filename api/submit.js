// ============================================================
//  Vercel Serverless Function — Form Submission Proxy
//  Securely relays name & email to Google Apps Script.
//  Secrets (APPS_SCRIPT_URL, SUBMIT_TOKEN) remain 100% hidden on Vercel's server.
// ============================================================

export default async function handler(req, res) {
  // Set CORS headers if needed for local development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // Edge case: req.body might be an unparsed JSON string in some environments
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ success: false, error: "Invalid JSON payload" });
      }
    }

    const { name, email } = body || {};

    if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 100) {
      return res.status(400).json({ success: false, error: "Invalid or missing name" });
    }

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: "Invalid or missing email" });
    }

    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    const SUBMIT_TOKEN = process.env.SUBMIT_TOKEN;

    if (!APPS_SCRIPT_URL || !SUBMIT_TOKEN) {
      console.error("Missing APPS_SCRIPT_URL or SUBMIT_TOKEN in Vercel environment variables.");
      return res.status(500).json({ success: false, error: "Server configuration error: missing environment variables." });
    }

    // Forward request to Google Apps Script
    const googleRes = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        token: SUBMIT_TOKEN,
        timestamp: new Date().toISOString(),
        source: "karkasar_landing_vercel",
        userAgent: req.headers["user-agent"] || "",
      }),
    });

    const rawText = await googleRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      console.error("Google Apps Script returned non-JSON response:", rawText);
      return res.status(502).json({ success: false, error: "Upstream Google Apps Script error" });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("Error in submit API function:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

// ============================================================
//  Vercel Serverless Function — Live Count Proxy
//  Securely fetches the current waitlist count from Google Apps Script.
// ============================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
    const SUBMIT_TOKEN = process.env.SUBMIT_TOKEN;

    if (!APPS_SCRIPT_URL || !SUBMIT_TOKEN) {
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    const googleRes = await fetch(`${APPS_SCRIPT_URL}?token=${SUBMIT_TOKEN}`, {
      method: "GET",
    });

    const rawText = await googleRes.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (_) {
      return res.status(502).json({ success: false, error: "Upstream Google Apps Script error" });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error("Error in count API function:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}

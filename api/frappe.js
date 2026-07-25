export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With");
    return res.status(204).end();
  }

  try {
    const BASE_URL = process.env.FRAPPE_BASE_URL || "https://ftms.galaxylabs.online";
    const API_KEY = process.env.FRAPPE_API_KEY;
    const API_SECRET = process.env.FRAPPE_API_SECRET;

    const { method, ...query } = req.query || {};
    if (!method) {
      return res.status(400).json({ error: "Missing 'method' query param" });
    }

    const url = new URL(`${BASE_URL}/api/method/${method}`);
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) url.searchParams.set(k, String(v[0]));
      else url.searchParams.set(k, String(v));
    });

    // Parse body if present
    let body;
    let reqApiKey = API_KEY;
    let reqApiSecret = API_SECRET;

    const methodUpper = (req.method || "GET").toUpperCase();
    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      if (req.body !== undefined && req.body !== null && req.body !== "") {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

        // Extract per-user API credentials from request body
        try {
          const parsed = JSON.parse(body);
          if (parsed._api_key && parsed._api_secret) {
            reqApiKey = parsed._api_key;
            reqApiSecret = parsed._api_secret;
            // Remove from body sent to Frappe
            delete parsed._api_key;
            delete parsed._api_secret;
            body = JSON.stringify(parsed);
          }
        } catch {}
      } else {
        body = "{}";
      }
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (reqApiKey && reqApiSecret) {
      const token = `token ${reqApiKey}:${reqApiSecret}`;
      headers["Authorization"] = token;
      headers["X-Frappe-Authorization"] = token;
    }

    const frappeRes = await fetch(url.toString(), {
      method: methodUpper,
      headers,
      body,
    });

    const text = await frappeRes.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With");
    res.status(frappeRes.status);
    res.setHeader("Content-Type", frappeRes.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(500).json({
      error: "Proxy crashed",
      details: String(e?.message || e),
    });
  }
}

// api/frappe.js
// Vercel Serverless Function proxy for Frappe
// Works with Vite frontend calling /api/frappe?method=...

export default async function handler(req, res) {
  // Handle preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With"
    );
    return res.status(204).end();
  }

  try {
    const BASE_URL = process.env.FRAPPE_BASE_URL || "https://tms.galaxylabs.online";
    const API_KEY = process.env.FRAPPE_API_KEY;
    const API_SECRET = process.env.FRAPPE_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({
        error: "Missing env vars on Vercel",
        missing: {
          FRAPPE_API_KEY: !API_KEY,
          FRAPPE_API_SECRET: !API_SECRET,
          FRAPPE_BASE_URL: !process.env.FRAPPE_BASE_URL,
        },
      });
    }

    const { method, ...query } = req.query || {};
    if (!method) {
      return res.status(400).json({ error: "Missing 'method' query param" });
    }

    const url = new URL(`${BASE_URL}/api/method/${method}`);

    // Forward query params (except method)
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) url.searchParams.set(k, String(v[0]));
      else url.searchParams.set(k, String(v));
    });

    const token = `token ${API_KEY}:${API_SECRET}`;

    const headers = {
      Accept: "application/json",
      Authorization: token,
      "X-Frappe-Authorization": token,
      "X-Requested-With": "XMLHttpRequest",
    };

    const methodUpper = (req.method || "GET").toUpperCase();

    let body;
    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      // Vercel may give object body; ensure JSON string
      if (req.body !== undefined && req.body !== null && req.body !== "") {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      } else {
        body = "{}";
      }
      headers["Content-Type"] = req.headers["content-type"] || "application/json";
    }

    // ✅ If fetch is missing, this will throw and you'll see debug
    const frappeRes = await fetch(url.toString(), {
      method: methodUpper,
      headers,
      body,
    });

    const text = await frappeRes.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With"
    );

    res.status(frappeRes.status);
    res.setHeader("Content-Type", frappeRes.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    // ✅ return real error so you can see in browser
    return res.status(500).json({
      error: "Proxy crashed",
      details: String(e?.message || e),
      hint:
        "If details says 'fetch is not defined', set Vercel Node runtime to 18+ or use undici.",
    });
  }
}

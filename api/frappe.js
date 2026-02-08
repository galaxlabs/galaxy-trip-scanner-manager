// api/frappe.js
// Vercel Serverless Function (Node.js)
// Proxies requests to Frappe and injects API token (kept only in Vercel env)

export default async function handler(req, res) {
  try {
    const BASE_URL = process.env.FRAPPE_BASE_URL || "https://tms.galaxylabs.online";
    const API_KEY = process.env.FRAPPE_API_KEY;
    const API_SECRET = process.env.FRAPPE_API_SECRET;

    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({
        error: "Missing FRAPPE_API_KEY / FRAPPE_API_SECRET in Vercel environment variables",
      });
    }

    // We accept:
    // /api/frappe?method=frappe.client.get_list&doctype=Trip&filters=...&fields=...
    const { method, ...query } = req.query || {};

    if (!method) {
      return res.status(400).json({
        error: "Missing 'method' query param. Example: /api/frappe?method=frappe.client.get_list",
      });
    }

    const url = new URL(`${BASE_URL}/api/method/${method}`);

    // forward query params (everything except method)
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      // Vercel may give array for repeated params
      if (Array.isArray(v)) url.searchParams.set(k, String(v[0]));
      else url.searchParams.set(k, String(v));
    });

    const headers = {
      Accept: "application/json",
      Authorization: `token ${API_KEY}:${API_SECRET}`,
      "X-Requested-With": "XMLHttpRequest",
    };

    // Forward body for POST/PUT/PATCH
    let body = undefined;
    const methodUpper = (req.method || "GET").toUpperCase();

    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      // Vercel gives parsed body if content-type is json
      if (req.body) {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      }
      headers["Content-Type"] = req.headers["content-type"] || "application/json";
    }

    const frappeRes = await fetch(url.toString(), {
      method: methodUpper,
      headers,
      body,
    });

    const text = await frappeRes.text();

    // pass-through status + content type
    res.status(frappeRes.status);
    res.setHeader("Content-Type", frappeRes.headers.get("content-type") || "application/json");
    return res.send(text);
  } catch (e) {
    return res.status(500).json({
      error: "Proxy failed",
      details: String(e?.message || e),
    });
  }
}

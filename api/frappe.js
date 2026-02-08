// api/frappe.js
// Vercel Serverless Function proxy for Frappe (Vite frontend)
// - Browser calls: /api/frappe?method=frappe.client.get_list&doctype=Trip...
// - Server adds token auth from Vercel env vars (NOT exposed to browser)

export default async function handler(req, res) {
  try {
    const BASE_URL = process.env.FRAPPE_BASE_URL || "https://tms.galaxylabs.online";
    const API_KEY = process.env.FRAPPE_API_KEY;
    const API_SECRET = process.env.FRAPPE_API_SECRET;

    // ✅ HARD FAIL if env missing (so you don't waste time)
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({
        error: "Missing env vars on Vercel",
        missing: {
          FRAPPE_API_KEY: !API_KEY,
          FRAPPE_API_SECRET: !API_SECRET,
          FRAPPE_BASE_URL: !process.env.FRAPPE_BASE_URL, // optional
        },
        hint:
          "Set FRAPPE_API_KEY and FRAPPE_API_SECRET in Vercel Project Settings for Production + Preview, then redeploy.",
      });
    }

    const { method, ...query } = req.query || {};
    if (!method) {
      return res.status(400).json({
        error: "Missing 'method' query param",
        example:
          "/api/frappe?method=frappe.client.get_list&doctype=Route&filters=%7B%7D&fields=%5B%22name%22%5D",
      });
    }

    const url = new URL(`${BASE_URL}/api/method/${method}`);

    // Forward query params (except "method")
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

    let body = undefined;
    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      // req.body may already be parsed by Vercel
      if (req.body !== undefined && req.body !== null) {
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

    // Helpful: allow browser to call this endpoint freely (same-origin anyway)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With");

    res.status(frappeRes.status);
    res.setHeader(
      "Content-Type",
      frappeRes.headers.get("content-type") || "application/json"
    );
    return res.send(text);
  } catch (e) {
    return res.status(500).json({
      error: "Proxy failed",
      details: String(e?.message || e),
    });
  }
}

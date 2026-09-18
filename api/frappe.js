export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With, X-Portal-Token");
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

    const publicMethods = new Set([
      "tms.api.auth.portal_login",
    ]);
    const blockedAccountAllowedMethods = new Set([
      "tms.api.auth.validate_portal_session",
      "tms.api.subscription.get_payment_status",
      "tms.api.subscription.subscribe_current_month",
      "tms.api.subscription.upload_payment_receipt",
    ]);

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (API_KEY && API_SECRET) {
      const token = `token ${API_KEY}:${API_SECRET}`;
      headers["Authorization"] = token;
      headers["X-Frappe-Authorization"] = token;
    }

    // Parse body if present
    let body;
    let parsedBody = null;

    const methodUpper = (req.method || "GET").toUpperCase();
    if (methodUpper !== "GET" && methodUpper !== "HEAD") {
      if (req.body !== undefined && req.body !== null && req.body !== "") {
        body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        try {
          parsedBody = JSON.parse(body);
        } catch {}
      } else {
        parsedBody = {};
        body = "{}";
      }
    }

    let verifiedSession = null;
    if (!publicMethods.has(method)) {
      const portalToken =
        req.headers["x-portal-token"] ||
        query.portal_token ||
        parsedBody?.portal_token;

      if (!portalToken) {
        return res.status(401).json({ error: "Portal login required" });
      }

      const validateRes = await fetch(`${BASE_URL}/api/method/tms.api.auth.validate_portal_session`, {
        method: "POST",
        headers,
        body: JSON.stringify({ portal_token: portalToken }),
      });
      const validateText = await validateRes.text();
      let validatePayload = null;
      try { validatePayload = validateText ? JSON.parse(validateText) : null; } catch {}
      if (!validateRes.ok || !validatePayload?.message?.user) {
        return res.status(401).json({ error: "Invalid portal session", details: validatePayload || validateText });
      }

      verifiedSession = validatePayload.message;
      const payment = verifiedSession.subscription?.payment;
      if (payment?.blocked && !blockedAccountAllowedMethods.has(method)) {
        return res.status(402).json({
          error: "Account suspended",
          payment,
        });
      }
      if (parsedBody && typeof parsedBody === "object") {
        delete parsedBody._api_key;
        delete parsedBody._api_secret;
        if (
          method !== "tms.api.auth.get_user_filtered_list" &&
          !method.startsWith("tms.api.trip_management.") &&
          !method.startsWith("tms.api.subscription.")
        ) {
          delete parsedBody.portal_token;
        }
        if (method === "tms.api.auth.get_user_filtered_list" || method.startsWith("tms.api.trip_management.")) {
          parsedBody.current_user_email = verifiedSession.user;
        }
        body = JSON.stringify(parsedBody);
      }
      delete query.portal_token;
    }

    const url = new URL(`${BASE_URL}/api/method/${method}`);
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) url.searchParams.set(k, String(v[0]));
      else url.searchParams.set(k, String(v));
    });

    const frappeRes = await fetch(url.toString(), {
      method: methodUpper,
      headers,
      body,
    });

    const text = await frappeRes.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With, X-Portal-Token");
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

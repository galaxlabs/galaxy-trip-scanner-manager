// api/print.js
// Authenticated print proxy for Frappe printview HTML

function toFileProxyUrl(rawValue, baseUrl) {
  if (!rawValue) return rawValue;
  const value = String(rawValue).trim();

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("javascript:") ||
    value.startsWith("#")
  ) {
    return value;
  }

  if (value.startsWith("/files/") || value.startsWith("/private/files/")) {
    return `/api/file?path=${encodeURIComponent(value)}`;
  }

  try {
    const parsed = new URL(value, baseUrl);
    const base = new URL(baseUrl);
    if (
      parsed.origin === base.origin &&
      (parsed.pathname.startsWith("/files/") || parsed.pathname.startsWith("/private/files/"))
    ) {
      return `/api/file?url=${encodeURIComponent(parsed.toString())}`;
    }
  } catch {
    // leave untouched if URL parsing fails
  }

  return value;
}

function rewriteAssetLinks(html, baseUrl) {
  return html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, value) => {
    const rewritten = toFileProxyUrl(value, baseUrl);
    if (rewritten === value) return match;
    return `${attr}="${rewritten}"`;
  });
}

function isTripInvoiceReceiptFormat(format) {
  return ["Kashf", "Trip Invoice POS"].includes(String(format || "").trim());
}

async function getFrappeDoc(baseUrl, token, doctype, name) {
  const url = new URL(`${baseUrl}/api/method/frappe.client.get`);
  url.searchParams.set("doctype", doctype);
  url.searchParams.set("name", name);

  const frappeRes = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: token,
      "X-Frappe-Authorization": token,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const raw = await frappeRes.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!frappeRes.ok) {
    const err = new Error(payload?.message || `Frappe get failed: HTTP ${frappeRes.status}`);
    err.status = frappeRes.status;
    throw err;
  }

  return payload.message || payload.data || {};
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With"
    );
    return res.status(204).end();
  }

  if ((req.method || "GET").toUpperCase() !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
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

    const { doctype, name, format, no_letterhead = "0", lang } = req.query || {};
    if (!doctype || !name) {
      return res.status(400).json({ error: "Missing doctype or name query param" });
    }

    const normalizedDoctype = String(doctype);
    const normalizedName = String(name);
    const normalizedFormat = String(format || doctype);
    const url = new URL(`${BASE_URL}/printview`);
    url.searchParams.set("doctype", normalizedDoctype);
    url.searchParams.set("name", normalizedName);
    url.searchParams.set("format", normalizedFormat);
    url.searchParams.set("no_letterhead", String(no_letterhead));
    if (lang) url.searchParams.set("_lang", String(lang));

    const token = `token ${API_KEY}:${API_SECRET}`;
    if (isTripInvoiceReceiptFormat(normalizedFormat)) {
      if (normalizedDoctype !== "Trip Invoice") {
        return res.status(403).json({
          error: "Kashf/POS print is allowed only for Trip Invoice documents.",
        });
      }

      const invoice = await getFrappeDoc(BASE_URL, token, "Trip Invoice", normalizedName);
      const readyStatuses = new Set(["Ready", "Sales Invoice Created"]);
      if (!readyStatuses.has(String(invoice.status || "")) || !invoice.kashf_ready || Number(invoice.grand_total || 0) <= 0) {
        return res.status(403).json({
          error: "Save Trip Invoice and mark it Ready before printing Kashf/POS.",
        });
      }
    }

    const frappeRes = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Authorization: token,
        "X-Frappe-Authorization": token,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const html = await frappeRes.text();
    const patchedHtml = rewriteAssetLinks(html, BASE_URL);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With"
    );
    res.status(frappeRes.status);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(patchedHtml);
  } catch (e) {
    return res.status(500).json({
      error: "Print proxy crashed",
      details: String(e?.message || e),
    });
  }
}

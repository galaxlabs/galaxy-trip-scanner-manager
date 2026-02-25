// api/file.js
// Authenticated file proxy for Frappe /files and /private/files assets

function isAllowedPath(pathname) {
  return pathname.startsWith("/files/") || pathname.startsWith("/private/files/");
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

    const { path, url } = req.query || {};
    let target;

    if (url) {
      const parsed = new URL(String(url));
      const base = new URL(BASE_URL);
      if (parsed.origin !== base.origin || !isAllowedPath(parsed.pathname)) {
        return res.status(400).json({ error: "Invalid file URL" });
      }
      target = parsed.toString();
    } else if (path) {
      const normalized = String(path).startsWith("/") ? String(path) : `/${String(path)}`;
      if (!isAllowedPath(normalized)) {
        return res.status(400).json({ error: "Invalid file path" });
      }
      target = new URL(normalized, BASE_URL).toString();
    } else {
      return res.status(400).json({ error: "Missing file path or url param" });
    }

    const token = `token ${API_KEY}:${API_SECRET}`;
    const upstream = await fetch(target, {
      method: "GET",
      headers: {
        Authorization: token,
        "X-Frappe-Authorization": token,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const bytes = Buffer.from(await upstream.arrayBuffer());

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Frappe-Authorization, X-Requested-With"
    );
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    return res.send(bytes);
  } catch (e) {
    return res.status(500).json({
      error: "File proxy crashed",
      details: String(e?.message || e),
    });
  }
}


// api/ai-router.js
// Routes AI extraction requests to the configured provider.
// Set AI_PROVIDER env var to "gemini" (default), "openai", or "auto".
// In "auto" mode: tries Gemini first; falls back to OpenAI on Gemini failure.

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getProvider() {
  const raw = String(process.env.AI_PROVIDER || "gemini").trim().toLowerCase();
  if (["gemini", "openai", "auto"].includes(raw)) return raw;
  return "gemini";
}

async function callHandler(handlerModule, body) {
  const req = { method: "POST", body };
  let statusCode = 200;
  const res = {
    _headers: {},
    setHeader(k, v) { this._headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(payload) { return { status: statusCode, headers: this._headers, payload }; },
    end() {},
  };

  const result = await handlerModule.default(req, res);
  // If the handler already sent a response, it returns the json result
  return result || { status: statusCode, payload: { ok: false, error: "No response" } };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    withCors(res);
    return res.status(204).end();
  }

  if ((req.method || "POST").toUpperCase() !== "POST") {
    withCors(res);
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = null; }
    }

    const provider = getProvider();

    if (provider === "openai") {
      const openaiModule = await import("./openai.js");
      return await openaiModule.default(req, res);
    }

    if (provider === "gemini") {
      const geminiModule = await import("./gemini.js");
      return await geminiModule.default(req, res);
    }

    // auto: try Gemini, fall back to OpenAI
    try {
      const geminiModule = await import("./gemini.js");
      const fakeReq = { method: "POST", body };
      let geminiRes;
      const fakeRes = {
        _headers: {},
        setHeader(k, v) { this._headers[k] = v; },
        _status: 200,
        status(code) { this._status = code; return this; },
        json(payload) { geminiRes = { status: this._status, headers: this._headers, payload }; },
        end() {},
      };
      await geminiModule.default(fakeReq, fakeRes);

      if (geminiRes && geminiRes.payload?.ok) {
        // Forward Gemini response headers
        Object.entries(geminiRes.headers).forEach(([k, v]) => res.setHeader(k, v));
        return res.status(geminiRes.status).json(geminiRes.payload);
      }

      // Gemini failed; fall through to OpenAI
    } catch {
      // fall through
    }

    const openaiModule = await import("./openai.js");
    return await openaiModule.default(req, res);
  } catch (e) {
    withCors(res);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
}

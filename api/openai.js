// api/openai.js
// Server-side OpenAI proxy for the Vite frontend.
// Keeps API keys out of the browser.

import OpenAI from "openai";

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractDataPart(base64Data) {
  if (!base64Data) return "";
  const value = String(base64Data);
  return value.includes(",") ? value.split(",")[1] : value;
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("Missing OPENAI_API_KEY");
    err.code = "MISSING_OPENAI_API_KEY";
    throw err;
  }
  return new OpenAI({ apiKey });
}

const SYSTEM_PROMPT = `You are a document data extraction assistant. Extract passenger and trip/vehicle information from the provided image.

Rules:
- For passenger documents (Passport, Aqama, Nusuk, Visa, ID): extract name, passport/document_number, nationality, document_type, contact_no, expiry_date.
- For trip/vehicle documents: extract reg_no (registration number), compny (company name), phone, model (vehicle model).
- If the document contains both, extract both.
- Respond with valid JSON only. No markdown, no code fences.`;

function buildPassengerMessages(base64Data, mimeType) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract only the core passenger details from this document. Support Passport, Aqama, Nusuk, Visa, and similar papers. Return a JSON array of objects with keys: name, passport, nationality, document_type, contact_no, expiry_date." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${extractDataPart(base64Data)}` } },
      ],
    },
  ];
}

function buildTripMessages(base64Data, mimeType) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract vehicle and trip info from this document. Return a JSON object with keys: reg_no, compny, phone, model." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${extractDataPart(base64Data)}` } },
      ],
    },
  ];
}

function buildAutoMessages(base64Data, mimeType) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: "Extract BOTH passenger details and trip/vehicle info from this document. Return JSON with keys: passengers (array of objects with name, passport, nationality, document_type, contact_no, expiry_date) and trip (object with reg_no, compny, phone, model)." },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${extractDataPart(base64Data)}` } },
      ],
    },
  ];
}

function parseJsonLoose(value, fallback) {
  if (!value) return fallback;
  try {
    const cleaned = value.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === "string") {
      try { return JSON.parse(parsed); } catch { return parsed; }
    }
    return parsed;
  } catch {
    return fallback;
  }
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

    const { task, base64Data, mimeType } = body || {};
    const normalizedTask = String(task || "").toLowerCase();

    if (!normalizedTask || !["passengers", "trip", "auto"].includes(normalizedTask)) {
      withCors(res);
      return res.status(400).json({ ok: false, error: "Invalid task", expected: ["passengers", "trip", "auto"] });
    }

    if (!base64Data) {
      withCors(res);
      return res.status(400).json({ ok: false, error: "Missing base64Data" });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const messages =
      normalizedTask === "passengers"
        ? buildPassengerMessages(base64Data, mimeType || "image/jpeg")
        : normalizedTask === "trip"
          ? buildTripMessages(base64Data, mimeType || "image/jpeg")
          : buildAutoMessages(base64Data, mimeType || "image/jpeg");

    const client = getClient();
    const response = await client.chat.completions.create({ model, messages, max_tokens: 4096 });

    const rawText = (response.choices?.[0]?.message?.content || "").trim();

    const fallbackValue =
      normalizedTask === "passengers" ? [] : normalizedTask === "trip" ? {} : { passengers: [], trip: {} };

    let data = parseJsonLoose(rawText, fallbackValue);

    if (normalizedTask === "passengers") {
      if (Array.isArray(data)) {
      } else if (data && typeof data === "object" && Array.isArray(data.passengers)) {
        data = data.passengers;
      } else if (data && typeof data === "object") {
        data = [data];
      } else {
        data = [];
      }
    } else if (normalizedTask === "trip") {
      if (Array.isArray(data)) data = data[0] || {};
      if (!data || typeof data !== "object") data = {};
    } else {
      if (!data || typeof data !== "object") data = {};
      if (Array.isArray(data.passengers)) {
      } else if (data.passengers && typeof data.passengers === "object") {
        data.passengers = [data.passengers];
      } else {
        data.passengers = [];
      }
      if (!data.trip || typeof data.trip !== "object" || Array.isArray(data.trip)) {
        data.trip = {};
      }
    }

    withCors(res);
    return res.status(200).json({ ok: true, data, provider: "openai" });
  } catch (e) {
    withCors(res);
    const status = e?.status && e.status >= 400 && e.status <= 599 ? e.status : 500;
    return res.status(status).json({
      ok: false,
      error: String(e?.message || e),
      code: e?.code,
    });
  }
}

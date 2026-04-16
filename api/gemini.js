// api/gemini.js
// Server-side Gemini (Vertex AI) proxy for the Vite frontend.
// Keeps Google credentials out of the browser.

import { GoogleGenAI, Type } from "@google/genai";

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

function getServiceAccountCredentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    const err = new Error("Missing GOOGLE_SERVICE_ACCOUNT_KEY");
    // tag for easier UI debugging (returned to client)
    err.code = "MISSING_SERVICE_ACCOUNT_KEY";
    throw err;
  }

  try {
    return JSON.parse(raw);
  } catch (e) {
    const err = new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON");
    err.code = "INVALID_SERVICE_ACCOUNT_KEY_JSON";
    throw err;
  }
}

let cachedAi;
function getAiClient() {
  if (cachedAi) return cachedAi;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;

  if (!project || !location) {
    const err = new Error("Missing GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION");
    err.code = "MISSING_VERTEX_CONFIG";
    throw err;
  }

  cachedAi = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials: getServiceAccountCredentials(),
    },
  });

  return cachedAi;
}

function buildPassengerRequest({ base64Data, mimeType, model }) {
  return {
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: extractDataPart(base64Data),
            },
          },
          {
            text: "Extract all passenger details from this document. Provide JSON array.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            passport: { type: Type.STRING },
            nationality: { type: Type.STRING },
            document_type: { type: Type.STRING },
            expiry_date: { type: Type.STRING },
            contact: { type: Type.STRING },
          },
          required: ["name", "passport", "nationality"],
        },
      },
    },
  };
}

function buildTripRequest({ base64Data, mimeType, model }) {
  return {
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: extractDataPart(base64Data),
            },
          },
          { text: "Extract vehicle and trip info." },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reg_no: { type: Type.STRING },
          compny: { type: Type.STRING },
          phone: { type: Type.STRING },
          model: { type: Type.STRING },
        },
      },
    },
  };
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
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }

    const { task, base64Data, mimeType } = body || {};
    const normalizedTask = String(task || "").toLowerCase();

    if (!normalizedTask || (normalizedTask !== "passengers" && normalizedTask !== "trip")) {
      withCors(res);
      return res.status(400).json({
        ok: false,
        error: "Invalid task",
        expected: ["passengers", "trip"],
      });
    }

    if (!base64Data) {
      withCors(res);
      return res.status(400).json({ ok: false, error: "Missing base64Data" });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const ai = getAiClient();

    const request =
      normalizedTask === "passengers"
        ? buildPassengerRequest({ base64Data, mimeType: mimeType || "image/jpeg", model })
        : buildTripRequest({ base64Data, mimeType: mimeType || "image/jpeg", model });

    const response = await ai.models.generateContent(request);

    const rawText = (response.text || "").trim();

    function parseJsonLoose(value, fallback) {
      if (!value) return fallback;
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === "string") {
          try {
            return JSON.parse(parsed);
          } catch {
            return parsed;
          }
        }
        return parsed;
      } catch {
        return fallback;
      }
    }

    let data;
    try {
      data = parseJsonLoose(
        rawText,
        normalizedTask === "passengers" ? [] : {}
      );
    } catch (e) {
      data = normalizedTask === "passengers" ? [] : {};
    }

    // Normalize shape so the frontend logic stays stable:
    // - task=passengers => always an array
    // - task=trip => always an object
    if (normalizedTask === "passengers") {
      if (Array.isArray(data)) {
        // ok
      } else if (data && typeof data === "object" && Array.isArray(data.passengers)) {
        data = data.passengers;
      } else if (data && typeof data === "object") {
        // Sometimes models return a single object.
        data = [data];
      } else {
        data = [];
      }
    } else {
      if (Array.isArray(data)) data = data[0] || {};
      if (!data || typeof data !== "object") data = {};
    }

    withCors(res);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    withCors(res);
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
      code: e?.code,
    });
  }
}

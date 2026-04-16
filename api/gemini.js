// api/gemini.js
// Server-side Gemini (Vertex AI) proxy for the Vite frontend.
// Keeps Google credentials out of the browser.

import { GoogleGenAI, Type } from "@google/genai";

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function parseErrorPayload(message) {
  if (!message) return null;
  const raw = String(message);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getRetryAfterSeconds(errorPayload) {
  const details = errorPayload?.error?.details;
  if (!Array.isArray(details)) return null;

  const retryInfo = details.find((d) => d && d["@type"] === "type.googleapis.com/google.rpc.RetryInfo");
  const retryDelay = retryInfo?.retryDelay; // e.g. "8s"
  if (typeof retryDelay === "string" && retryDelay.endsWith("s")) {
    const seconds = Number(retryDelay.slice(0, -1));
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  }

  return null;
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

let cachedApiKeyAi;
function getApiKeyClient() {
  if (cachedApiKeyAi) return cachedApiKeyAi;

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY;

  if (!apiKey) {
    const err = new Error("Missing GEMINI_API_KEY (or GOOGLE_API_KEY / API_KEY)");
    err.code = "MISSING_GEMINI_API_KEY";
    throw err;
  }

  // Explicitly force Gemini Developer API. Otherwise, if your environment has
  // GOOGLE_GENAI_USE_VERTEXAI=true, the SDK will route API-key calls to Vertex
  // and Vertex will reject API keys for generateContent.
  cachedApiKeyAi = new GoogleGenAI({ apiKey, vertexai: false });
  return cachedApiKeyAi;
}

function shouldFallbackToApiKey(e) {
  const msg = String(e?.message || e || "");
  return (
    msg.includes("BILLING_DISABLED") ||
    msg.includes("requires billing to be enabled") ||
    msg.includes("Enable billing") ||
    msg.includes("aiplatform.googleapis.com") ||
    // If Vertex credentials are missing/misconfigured, allow falling back
    // to the Gemini Developer API when an API key is available.
    msg.includes("Missing GOOGLE_SERVICE_ACCOUNT_KEY") ||
    msg.includes("Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON") ||
    msg.includes("API keys are not supported by this API") ||
    msg.includes("Expected OAuth2 access token") ||
    msg.includes("CREDENTIALS_MISSING") ||
    msg.includes("\"status\":\"UNAUTHENTICATED\"")
  );
}

function getProviderMode() {
  const raw = String(process.env.GEMINI_PROVIDER || "").trim().toLowerCase();
  if (raw === "vertex" || raw === "api_key" || raw === "auto") return raw;
  return "auto";
}

function hasVertexConfig() {
  return Boolean(
    process.env.GOOGLE_CLOUD_PROJECT &&
      process.env.GOOGLE_CLOUD_LOCATION &&
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  );
}

function hasApiKeyConfig() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY);
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

function buildAutoRequest({ base64Data, mimeType, model }) {
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
            text:
              "Extract BOTH passenger details and trip/vehicle info from this document.\n" +
              "Return JSON with keys: passengers (array) and trip (object).",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          passengers: {
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
          trip: {
            type: Type.OBJECT,
            properties: {
              reg_no: { type: Type.STRING },
              compny: { type: Type.STRING },
              phone: { type: Type.STRING },
              model: { type: Type.STRING },
            },
          },
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

    if (
      !normalizedTask ||
      (normalizedTask !== "passengers" && normalizedTask !== "trip" && normalizedTask !== "auto")
    ) {
      withCors(res);
      return res.status(400).json({
        ok: false,
        error: "Invalid task",
        expected: ["passengers", "trip", "auto"],
      });
    }

    if (!base64Data) {
      withCors(res);
      return res.status(400).json({ ok: false, error: "Missing base64Data" });
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const request =
      normalizedTask === "passengers"
        ? buildPassengerRequest({ base64Data, mimeType: mimeType || "image/jpeg", model })
        : normalizedTask === "trip"
          ? buildTripRequest({ base64Data, mimeType: mimeType || "image/jpeg", model })
          : buildAutoRequest({ base64Data, mimeType: mimeType || "image/jpeg", model });

    let response;
    let provider = "vertex";
    const providerMode = getProviderMode();

    if (providerMode === "vertex") {
      response = await getAiClient().models.generateContent(request);
    } else if (providerMode === "api_key") {
      provider = "gemini_api_key";
      response = await getApiKeyClient().models.generateContent(request);
    } else {
      // auto
      if (!hasVertexConfig() && !hasApiKeyConfig()) {
        const err = new Error(
          "Missing Gemini credentials: set Vertex vars (GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, GOOGLE_SERVICE_ACCOUNT_KEY) or set GEMINI_API_KEY."
        );
        err.code = "MISSING_GEMINI_CREDENTIALS";
        throw err;
      }

      if (hasVertexConfig()) {
        try {
          response = await getAiClient().models.generateContent(request);
        } catch (e) {
          if (!hasApiKeyConfig() || !shouldFallbackToApiKey(e)) throw e;
          provider = "gemini_api_key";
          response = await getApiKeyClient().models.generateContent(request);
        }
      } else {
        provider = "gemini_api_key";
        response = await getApiKeyClient().models.generateContent(request);
      }
    }

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
    const fallbackValue =
      normalizedTask === "passengers" ? [] : normalizedTask === "trip" ? {} : { passengers: [], trip: {} };

    try {
      data = parseJsonLoose(rawText, fallbackValue);
    } catch {
      data = fallbackValue;
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
    } else if (normalizedTask === "trip") {
      if (Array.isArray(data)) data = data[0] || {};
      if (!data || typeof data !== "object") data = {};
    } else {
      // task=auto
      if (!data || typeof data !== "object") data = {};
      if (Array.isArray(data.passengers)) {
        // ok
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
    return res.status(200).json({ ok: true, data, provider });
  } catch (e) {
    withCors(res);
    const parsed = parseErrorPayload(e?.message);
    const code = parsed?.error?.code;
    const status =
      typeof code === "number" && code >= 400 && code <= 599 ? code : 500;

    const retryAfterSeconds = parsed ? getRetryAfterSeconds(parsed) : null;
    if (retryAfterSeconds) res.setHeader("Retry-After", String(retryAfterSeconds));

    return res.status(status).json({
      ok: false,
      error: String(e?.message || e),
      code: e?.code,
      retryAfterSeconds,
    });
  }
}

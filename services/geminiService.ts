
// services/geminiService.ts
// Frontend helper: calls the server-side `/api/gemini` function (Vertex AI).

export interface ExtractedPassenger {
  name: string;
  passport: string;
  nationality: string;
}

function normalizeExtractedPassenger(input: any): ExtractedPassenger | null {
  if (!input || typeof input !== "object") return null;

  const name =
    input.name ??
    input.passenger_name ??
    input.full_name ??
    input.passengerName ??
    "";

  const passport =
    input.passport ??
    input.document_number ??
    input.documentNumber ??
    input.passport_number ??
    input.passportNumber ??
    "";

  const nationality =
    input.nationality ??
    input.country ??
    input.nationality_code ??
    input.nationalityCode ??
    "";

  const normalized: ExtractedPassenger = {
    name: String(name || ""),
    passport: String(passport || ""),
    nationality: String(nationality || ""),
  };

  // If we don't have the minimum fields, treat as unusable.
  if (!normalized.name && !normalized.passport && !normalized.nationality) return null;
  return normalized;
}

async function callGemini<T>(
  task: "passengers" | "trip" | "auto",
  base64Data: string,
  mimeType: string
): Promise<{ data: T; provider?: string }> {
  const url = new URL("/api/gemini", window.location.origin);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, base64Data, mimeType }),
  });

  const rawText = await res.text();
  let payload: any = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.ok) {
    const msg = payload?.error || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    const retryAfterHeader = res.headers.get("Retry-After");
    const retryAfterSeconds =
      payload?.retryAfterSeconds ??
      (retryAfterHeader ? Number(retryAfterHeader) : undefined);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      err.retryAfterSeconds = retryAfterSeconds;
    }
    throw err;
  }

  return { data: payload.data as T, provider: payload.provider };
}

export const extractPassengerInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedPassenger[]> => {
  const { data: raw } = await callGemini<any>("passengers", base64Data, mimeType);
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeExtractedPassenger).filter(Boolean) as ExtractedPassenger[];
};

export const extractTripInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<any> => {
  const { data } = await callGemini<Record<string, any>>("trip", base64Data, mimeType);
  return data;
};

export const extractDocumentInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<{
  passengers: ExtractedPassenger[];
  trip: Record<string, any>;
  provider?: string;
}> => {
  const { data, provider } = await callGemini<any>("auto", base64Data, mimeType);

  const rawPassengers = Array.isArray(data?.passengers) ? data.passengers : [];
  const passengers = rawPassengers
    .map(normalizeExtractedPassenger)
    .filter(Boolean) as ExtractedPassenger[];

  const trip = data?.trip && typeof data.trip === "object" && !Array.isArray(data.trip) ? data.trip : {};

  return { passengers, trip, provider };
};


// services/geminiService.ts
// Frontend helper: calls the server-side AI extraction endpoint.

export interface ExtractedPassenger {
  name: string;
  passport: string;
  nationality: string;
}

function normalizeExtractedPassenger(input: any): ExtractedPassenger | null {
  if (!input || typeof input !== "object") return null;

  const name = input.name ?? input.passenger_name ?? input.full_name ?? "";
  const passport = input.passport ?? input.document_number ?? input.passport_number ?? "";
  const nationality = input.nationality ?? input.country ?? "";

  const normalized: ExtractedPassenger = {
    name: String(name || ""),
    passport: String(passport || ""),
    nationality: String(nationality || ""),
  };

  if (!normalized.name && !normalized.passport && !normalized.nationality) return null;
  return normalized;
}

async function callAI<T>(
  task: "passengers" | "trip" | "auto",
  base64Data: string,
  mimeType: string
): Promise<{ data: T; provider?: string }> {
  const url = new URL("/api/ai-router", window.location.origin);
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
    throw err;
  }

  return { data: payload.data as T, provider: payload.provider };
}

export const extractPassengerInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedPassenger[]> => {
  const { data: raw } = await callAI<any>("passengers", base64Data, mimeType);
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeExtractedPassenger).filter(Boolean) as ExtractedPassenger[];
};

export const extractDocumentInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<{
  passengers: ExtractedPassenger[];
  provider?: string;
}> => {
  const { data, provider } = await callAI<any>("auto", base64Data, mimeType);

  const rawPassengers = Array.isArray(data) ? data : Array.isArray(data?.passengers) ? data.passengers : [];
  const passengers = rawPassengers
    .map(normalizeExtractedPassenger)
    .filter(Boolean) as ExtractedPassenger[];

  return { passengers, provider };
};


// services/geminiService.ts
// Frontend helper: calls the server-side `/api/gemini` function (Vertex AI).

export interface ExtractedPassenger {
  name: string;
  passport: string;
  nationality: string;
  document_type?: string;
  expiry_date?: string;
  contact?: string;
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

  const document_type = input.document_type ?? input.documentType;
  const expiry_date = input.expiry_date ?? input.expiryDate;
  const contact = input.contact ?? input.contact_no ?? input.contactNo;

  const normalized: ExtractedPassenger = {
    name: String(name || ""),
    passport: String(passport || ""),
    nationality: String(nationality || ""),
    document_type: document_type ? String(document_type) : undefined,
    expiry_date: expiry_date ? String(expiry_date) : undefined,
    contact: contact ? String(contact) : undefined,
  };

  // If we don't have the minimum fields, treat as unusable.
  if (!normalized.name && !normalized.passport && !normalized.nationality) return null;
  return normalized;
}

async function callGemini<T>(
  task: "passengers" | "trip",
  base64Data: string,
  mimeType: string
): Promise<T> {
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
    throw new Error(msg);
  }

  return payload.data as T;
}

export const extractPassengerInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedPassenger[]> => {
  const raw = await callGemini<any>("passengers", base64Data, mimeType);
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeExtractedPassenger).filter(Boolean) as ExtractedPassenger[];
};

export const extractTripInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<any> => {
  return await callGemini<Record<string, any>>("trip", base64Data, mimeType);
};

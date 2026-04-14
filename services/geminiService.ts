
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
  try {
    return await callGemini<ExtractedPassenger[]>("passengers", base64Data, mimeType);
  } catch (err) {
    console.error("Gemini parse failed", err);
    return [];
  }
};

export const extractTripInfo = async (
  base64Data: string,
  mimeType: string = "image/jpeg"
): Promise<any> => {
  try {
    return await callGemini<Record<string, any>>("trip", base64Data, mimeType);
  } catch (e) {
    console.error("Gemini parse failed", e);
    return {};
  }
};

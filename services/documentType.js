const FRAPPE_DOCUMENT_TYPES = new Set([
  "Passport",
  "Aqama",
  "Nusuk",
  "Visa",
  "Other",
]);

const FRAPPE_PASSENGER_SOURCES = new Set([
  "BOOKING",
  "OCR",
  "MANUAL",
]);

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function normalizePassengerDocumentType(value) {
  const normalized = normalizeToken(value);
  if (!normalized) return undefined;

  for (const allowed of FRAPPE_DOCUMENT_TYPES) {
    if (normalized === allowed.toLowerCase()) return allowed;
  }

  if (
    normalized.includes("aqama") ||
    normalized.includes("iqama") ||
    normalized.includes("قامة") ||
    normalized.includes("اقامة")
  ) {
    return "Aqama";
  }

  if (normalized.includes("nusuk")) return "Nusuk";

  if (
    normalized.includes("visa") ||
    normalized.includes("umrah") ||
    normalized.includes("visit") ||
    normalized.includes("entry")
  ) {
    return "Visa";
  }

  if (
    normalized.includes("passport") ||
    normalized === "id" ||
    normalized.includes("id card")
  ) {
    return "Passport";
  }

  if (normalized.includes("other")) return "Other";

  return "Other";
}

export function normalizePassengerSource(value, options = {}) {
  const normalized = normalizeToken(value);
  const isAutoFilled =
    options.isAutoFilled === true ||
    options.isAutoFilled === 1 ||
    options.isAutoFilled === "1";

  for (const allowed of FRAPPE_PASSENGER_SOURCES) {
    if (normalized === allowed.toLowerCase()) return allowed;
  }

  if (normalized === "scan" || normalized === "scanner" || normalized === "ocr") {
    return "OCR";
  }

  if (normalized === "manual" || normalized === "manually added") {
    return "MANUAL";
  }

  if (normalized === "booking" || normalized === "booked") {
    return "BOOKING";
  }

  if (!normalized) {
    return isAutoFilled ? "OCR" : "MANUAL";
  }

  return undefined;
}

function cleanText(value) {
  const cleaned = String(value || "").trim();
  return cleaned || undefined;
}

export function sanitizePassengerPayload(row) {
  const sanitized = {
    passenger_name: cleanText(row?.passenger_name),
    document_number: cleanText(row?.document_number),
    nationality: cleanText(row?.nationality),
  };

  if (!sanitized.passenger_name && !sanitized.document_number && !sanitized.nationality) {
    return null;
  }

  return sanitized;
}

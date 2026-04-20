const FRAPPE_DOCUMENT_TYPES = new Set([
  "Passport",
  "Aqama",
  "Nusuk",
  "Visa",
  "Other",
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

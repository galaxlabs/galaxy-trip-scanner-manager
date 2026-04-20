import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePassengerDocumentType,
  normalizePassengerSource,
} from "../services/documentType.js";

test("maps Umrah-like document labels to Frappe's Visa option", () => {
  assert.equal(normalizePassengerDocumentType("Umrah"), "Visa");
  assert.equal(normalizePassengerDocumentType("Umrah Visa"), "Visa");
  assert.equal(normalizePassengerDocumentType("visit visa"), "Visa");
});

test("preserves supported Frappe document types", () => {
  assert.equal(normalizePassengerDocumentType("Passport"), "Passport");
  assert.equal(normalizePassengerDocumentType("aqama"), "Aqama");
  assert.equal(normalizePassengerDocumentType("NUSUK"), "Nusuk");
  assert.equal(normalizePassengerDocumentType("Other"), "Other");
});

test("falls back safely for blank and unknown values", () => {
  assert.equal(normalizePassengerDocumentType(""), undefined);
  assert.equal(normalizePassengerDocumentType(undefined), undefined);
  assert.equal(normalizePassengerDocumentType("Residence Permit"), "Other");
});

test("maps legacy and inferred passenger sources to allowed Frappe values", () => {
  assert.equal(normalizePassengerSource("scan"), "OCR");
  assert.equal(normalizePassengerSource("ocr"), "OCR");
  assert.equal(normalizePassengerSource("manual"), "MANUAL");
  assert.equal(normalizePassengerSource("booking"), "BOOKING");
});

test("infers a safe default source when the value is blank", () => {
  assert.equal(normalizePassengerSource("", { isAutoFilled: 1 }), "OCR");
  assert.equal(normalizePassengerSource(undefined, { isAutoFilled: 0 }), "MANUAL");
});

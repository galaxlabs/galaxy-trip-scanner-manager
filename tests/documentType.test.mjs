import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePassengerDocumentType,
  normalizePassengerSource,
  sanitizePassengerPayload,
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

test("keeps only the passenger fields we want to store in Frappe", () => {
  assert.deepEqual(
    sanitizePassengerPayload({
      passenger_name: "  John Doe  ",
      document_number: " P12345 ",
      nationality: " PK ",
      document_type: "Visa",
      expiry_date: "21/02/2036",
      contact_no: "123",
      source: "OCR",
      is_auto_filled: 1,
    }),
    {
      passenger_name: "John Doe",
      document_number: "P12345",
      nationality: "PK",
    }
  );
});

test("drops fully empty passenger rows before save", () => {
  assert.equal(
    sanitizePassengerPayload({
      passenger_name: " ",
      document_number: "",
      nationality: undefined,
    }),
    null
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import { matchesReadyInvoiceDateRange } from "../services/driverVatDashboardCore.js";

test("includes only Ready Trip Invoices inside the selected date range", () => {
  assert.equal(
    matchesReadyInvoiceDateRange(
      { status: "Ready", date: "2026-06-01" },
      "2026-06-01",
      "2026-06-30"
    ),
    true
  );
  assert.equal(
    matchesReadyInvoiceDateRange(
      { status: "Ready", date: "2026-06-30" },
      "2026-06-01",
      "2026-06-30"
    ),
    true
  );
  assert.equal(
    matchesReadyInvoiceDateRange(
      { status: "Ready", date: "2026-05-31" },
      "2026-06-01",
      "2026-06-30"
    ),
    false
  );
  assert.equal(
    matchesReadyInvoiceDateRange(
      { status: "Draft", date: "2026-06-15" },
      "2026-06-01",
      "2026-06-30"
    ),
    false
  );
});

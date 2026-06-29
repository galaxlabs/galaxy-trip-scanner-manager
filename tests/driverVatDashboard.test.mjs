import test from "node:test";
import assert from "node:assert/strict";

import {
  buildStaffLabel,
  findCurrentStaff,
  isReadyInvoice,
  matchesSelectedDriver,
} from "../services/driverVatDashboardCore.js";

test("counts only Trip Invoices marked Ready", () => {
  assert.equal(isReadyInvoice({ status: "Ready" }), true);
  assert.equal(isReadyInvoice({ status: "Draft", kashf_ready: 1 }), false);
  assert.equal(isReadyInvoice({ status: "Sales Invoice Created" }), false);
});

test("shows both staff and linked driver names when they differ", () => {
  assert.equal(
    buildStaffLabel({ full_name: "Muhammad Imran", driver: "Imran Khan" }),
    "Muhammad Imran - Imran Khan"
  );
  assert.equal(
    buildStaffLabel({ full_name: "Muhammad Imran", driver: "Muhammad Imran" }),
    "Muhammad Imran"
  );
});

test("matches a logged-in staff member by email without case sensitivity", () => {
  const staff = [
    { name: "Muhammad Imran", email: "driver@example.com", full_name: "Muhammad Imran" },
    { name: "Ali Raza", email: "ali@example.com", full_name: "Ali Raza" },
  ];

  assert.deepEqual(
    findCurrentStaff(staff, { username: "DRIVER@example.com" }),
    staff[0]
  );
});

test("also matches local demo logins by staff name", () => {
  const staff = [
    { name: "Muhammad Imran", email: "driver@example.com", full_name: "Muhammad Imran" },
  ];

  assert.deepEqual(
    findCurrentStaff(staff, { username: "Muhammad Imran" }),
    staff[0]
  );
});

test("filters Included invoices by selected staff without considering vehicle", () => {
  const selectedDriver = "Muhammad Imran";

  assert.equal(
    matchesSelectedDriver(
      { driver: selectedDriver, vehicle: "Vehicle A", vatMode: "Included" },
      selectedDriver
    ),
    true
  );
  assert.equal(
    matchesSelectedDriver(
      { driver: selectedDriver, vehicle: "Vehicle B", vatMode: "Included" },
      selectedDriver
    ),
    true
  );
  assert.equal(
    matchesSelectedDriver(
      { driver: "Ali Raza", vehicle: "Vehicle A", vatMode: "Included" },
      selectedDriver
    ),
    false
  );
  assert.equal(
    matchesSelectedDriver(
      { driver: selectedDriver, vehicle: "Vehicle A", vatMode: "Excluded" },
      selectedDriver
    ),
    false
  );
});

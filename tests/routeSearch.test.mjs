import test from "node:test";
import assert from "node:assert/strict";

import { getVisibleRoutes } from "../services/routeSearch.js";

const routes = [
  { name: "Jeddah-To-Taif", from_place_full: "Jeddah", to_place_full: "Taif" },
  { name: "Makkah-To-Madinah", from_place_full: "Makkah", to_place_full: "Madinah" },
  { name: "Riyadh-To-Jubail", from_place_full: "Riyadh", to_place_full: "Jubail" },
  { name: "Madinah-To-Makkah", from_place_full: "Madinah", to_place_full: "Makkah" },
  { name: "Tabuk-To-Yanbu", from_place_full: "Tabuk", to_place_full: "Yanbu" },
];

test("pins Makkah/Madinah default routes before other routes", () => {
  assert.deepEqual(
    getVisibleRoutes(routes, "").slice(0, 2).map((route) => route.name),
    ["Makkah-To-Madinah", "Madinah-To-Makkah"]
  );
});

test("sorts direct route matches before looser matches", () => {
  assert.deepEqual(
    getVisibleRoutes(routes, "j").map((route) => route.name).slice(0, 2),
    ["Makkah-To-Madinah", "Madinah-To-Makkah"]
  );
  assert.equal(getVisibleRoutes(routes, "ju")[2].name, "Riyadh-To-Jubail");
});

test("falls back to routes containing typed characters anywhere when sequence is missing", () => {
  assert.deepEqual(
    getVisibleRoutes(routes, "uy").map((route) => route.name),
    ["Makkah-To-Madinah", "Madinah-To-Makkah", "Tabuk-To-Yanbu", "Riyadh-To-Jubail"]
  );
});

test("keeps ordered fuzzy matches before routes with characters in any order", () => {
  assert.deepEqual(
    getVisibleRoutes(routes, "uy").map((route) => route.name).slice(2),
    ["Tabuk-To-Yanbu", "Riyadh-To-Jubail"]
  );
});

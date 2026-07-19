import test from "node:test";
import assert from "node:assert/strict";
import { validateLaunchRequest } from "../src/agent/schemas.js";

const valid = {
  productBrief: "Launch a public beta of a release coordination workspace for engineering teams.",
  audience: "Platform engineering and product operations teams",
  launchDate: "2026-08-15",
  constraints: "Security review required.",
  assets: "QA plan and screenshots."
};

test("accepts a complete launch intake", () => {
  const result = validateLaunchRequest(valid);
  assert.equal(result.ok, true);
  assert.equal(result.data.launchDate, "2026-08-15");
});

test("rejects an underspecified product brief", () => {
  const result = validateLaunchRequest({ ...valid, productBrief: "Too short" });
  assert.equal(result.ok, false);
  assert.match(result.message, /Product brief/i);
});

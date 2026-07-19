import test from "node:test";
import assert from "node:assert/strict";
import { validateLaunchInput } from "../src/core/schemas.js";

const valid = {
  productBrief: "Launch an API observability beta with trace search and latency diagnostics for production engineering teams.",
  audience: "Platform engineering teams",
  launchDate: "2026-08-15",
  constraints: "Security review required.",
  availableAssets: "Docs draft and beta feedback.",
  tone: "Technical, precise, and restrained",
  channels: ["Release notes", "Docs"]
};

test("accepts a complete launch brief", () => {
  const result = validateLaunchInput(valid);
  assert.equal(result.ok, true);
});

test("rejects a launch without channels", () => {
  const result = validateLaunchInput({ ...valid, channels: [] });
  assert.equal(result.ok, false);
  assert.match(result.message, /channel/i);
});

test("rejects an invalid launch date", () => {
  const result = validateLaunchInput({ ...valid, launchDate: "August 15" });
  assert.equal(result.ok, false);
});

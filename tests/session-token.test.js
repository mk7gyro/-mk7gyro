import test from "node:test";
import assert from "node:assert/strict";
import { buildClientSecretRequest, publicSessionConfig, validateSessionRequest } from "../src/realtime/session-token.js";

const valid = {
  worldSeed: "A city that sails through the clouds on a broken compass.",
  style: "Mythic and luminous",
  voice: "marin"
};

test("accepts a valid world room intake", () => {
  const result = validateSessionRequest(valid);
  assert.equal(result.ok, true);
  assert.equal(result.data.voice, "marin");
});

test("rejects unsupported voices", () => {
  const result = validateSessionRequest({ ...valid, voice: "unknown" });
  assert.equal(result.ok, false);
});

test("creates a current realtime client secret request", () => {
  const body = buildClientSecretRequest(valid);
  assert.deepEqual(body, { session: { type: "realtime", model: "gpt-realtime-2.1" } });
});

test("returns only browser-safe session configuration", () => {
  const result = publicSessionConfig(valid, { value: "ek_test", expires_at: 1234 });
  assert.equal(result.value, "ek_test");
  assert.equal(result.voice, "marin");
  assert.match(result.instructions, /World Room/);
  assert.equal("apiKey" in result, false);
});

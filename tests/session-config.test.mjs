import test from "node:test";
import assert from "node:assert/strict";
import {
  REALTIME_MODEL,
  WORLD_ROOM_INSTRUCTIONS,
  buildSessionConfig
} from "../lib/world-room-config.js";

test("builds a realtime audio session", () => {
  const config = buildSessionConfig();
  assert.equal(config.session.type, "realtime");
  assert.equal(config.session.model, REALTIME_MODEL);
  assert.deepEqual(config.session.output_modalities, ["audio"]);
  assert.equal(config.session.audio.output.voice, "marin");
});

test("enables semantic turn detection and interruption", () => {
  const turnDetection = buildSessionConfig().session.audio.input.turn_detection;
  assert.equal(turnDetection.type, "semantic_vad");
  assert.equal(turnDetection.create_response, true);
  assert.equal(turnDetection.interrupt_response, true);
});

test("keeps the worldbuilding prompt voice-friendly", () => {
  assert.match(WORLD_ROOM_INSTRUCTIONS, /settings, characters, conflicts, and scene hooks/i);
  assert.match(WORLD_ROOM_INSTRUCTIONS, /one to three short sentences/i);
  assert.match(WORLD_ROOM_INSTRUCTIONS, /interruptions/i);
});
